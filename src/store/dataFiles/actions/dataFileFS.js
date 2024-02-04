import RNFetchBlob from 'react-native-blob-util'
import { getDataFileDefinition, getDataFileDefinitions } from '../dataFilesRegistry'
import { actions, selectDataFileInfo } from '../dataFilesSlice'

export const fetchDataFile = (key) => async (dispatch) => {
  const definition = getDataFileDefinition(key)
  if (!definition) throw new Error(`No data file definition found for ${key}`)

  dispatch(actions.setDataFileInfo(key, { status: 'fetching' }))
  const { fetch } = definition
  const data = await fetch()

  if (!await RNFetchBlob.fs.exists(`${RNFetchBlob.fs.dirs.DocumentDir}/data`)) await RNFetchBlob.fs.mkdir(`${RNFetchBlob.fs.dirs.DocumentDir}/data/`)

  await RNFetchBlob.fs.writeFile(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.new.json`, JSON.stringify(data))

  if (await RNFetchBlob.fs.exists(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.old.json`)) {
    await RNFetchBlob.fs.unlink(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.old.json`)
  }
  if (await RNFetchBlob.fs.exists(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.json`)) {
    await RNFetchBlob.fs.mv(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.json`, `${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.old.json`)
  }
  await RNFetchBlob.fs.mv(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.new.json`, `${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.json`)
  if (await RNFetchBlob.fs.exists(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.old.json`)) {
    await RNFetchBlob.fs.unlink(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.old.json`)
  }

  if (definition.onLoad) definition.onLoad(data)

  dispatch(actions.setDataFileInfo(key, { ...data, status: 'loaded', date: data.date ?? new Date() }))
}

export const readDataFile = (key) => async (dispatch) => {
  const definition = getDataFileDefinition(key)
  if (!definition) throw new Error(`No data file definition found for ${key}`)
  dispatch(actions.setDataFileInfo(key, { status: 'loading' }))

  const body = await RNFetchBlob.fs.readFile(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.json`)
  const data = JSON.parse(body)

  dispatch(actions.setDataFileInfo(key, { ...data, status: 'loaded', date: Date.parse(data.date) }))
  if (definition.onLoad) definition.onLoad(data)
}

export const loadDataFile = (key, force) => async (dispatch, getState) => {
  if (selectDataFileInfo(key)(getState())?.date) return // Already loaded, do nothing

  const definition = getDataFileDefinition(key)
  if (!definition) throw new Error(`No data file definition found for ${key}`)

  const exists = await RNFetchBlob.fs.exists(`${RNFetchBlob.fs.dirs.DocumentDir}/data/${definition.key}.json`)
  if (!exists || force) {
    console.info(`Data for ${definition.key} not found, fetching a fresh version`)
    dispatch(fetchDataFile(key))
  } else {
    await dispatch(readDataFile(key))
    const date = selectDataFileInfo(key)(getState())?.date
    if (date && definition.maxAgeInDays && (Date.now() - date.getTime()) / 1000 / 60 / 60 / 24 > definition.maxAgeInDays) {
      console.info(`Data for ${definition.key} is too old, fetching a fresh version`)
      dispatch(fetchDataFile(key))
    }
  }
}

export const loadAllDataFiles = () => (dispatch, getState) => {
  const definitions = getDataFileDefinitions()

  definitions.forEach((definition) => {
    dispatch(loadDataFile(definition.key))
  })
}