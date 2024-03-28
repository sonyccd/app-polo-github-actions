import React, { useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { setOperationData } from '../../store/operations'
import { findRef, replaceRef } from '../../tools/refTools'
import ThemedTextInput from '../../screens/components/ThemedTextInput'
import { List } from 'react-native-paper'
import { ListRow } from '../../screens/components/ListComponents'

/*
 NOTES:

 ADIF
   <ARRL_SECT:3>ENY
   <CONTEST_ID:3>WFD
   <APP_N1MM_EXCHANGE1:2>1H

 Cabrillo
   QSO: 18072 CW 2024-01-24 0246 KI2D          1H     ENY KN2X          1H   ENY
   QSO: 18072 CW 2024-01-24 0246 KI2D          1H     ENY WC3W          2H   NFL

 */

const Info = {
  key: 'wfd',
  icon: 'snowflake',
  name: 'Winter Field Day',
  shortName: 'WFD',
  infoURL: 'https://www.winterfieldday.org/',
  defaultValue: { class: '', location: '' }
}

const Extension = {
  ...Info,
  category: 'fieldOps',
  onActivation: ({ registerHook, registerHandler }) => {
    registerHook('activity', { hook: ActivityHook })
    registerHook(`ref:${Info.key}`, { hook: ReferenceHandler })
  }
}
export default Extension

const ActivityHook = {
  ...Info,
  Options: ActivityOptions,
  fieldsForMainExchangePanel
}

const ReferenceHandler = {
  ...Info,

  descriptionPlaceholder: '',
  description: (operation) => {
    let date
    if (operation?.qsos && operation.qsos[0]?.startOnMillis) date = Date.parse(operation.qsos[0].startOnMillis)
    else date = new Date()
    const ref = findRef(operation, Info.key)
    return [`WFD ${date.getFullYear()}`, [ref?.class, ref?.location].filter(x => x).join(' ')].filter(x => x).join(' • ')
  },

  suggestOperationTitle: (ref) => {
    return { for: Info.shortName, subtitle: [ref?.class, ref?.location].filter(x => x).join(' ') }
  },

  cabrilloHeaders: ({ operation, settings, headers }) => {
    const ref = findRef(operation, Info.key)
    headers.CONTEST = Info.cabrilloName ?? Info.shortName
    headers.CALLSIGN = operation.stationCall || settings.operatorCall
    headers.LOCATION = ref.location
    headers.NAME = ''
    headers.OPERATORS = settings.operatorCall
    if (operation.grid) headers['GRID-LOCATOR'] = operation.grid
    return headers
  },

  qsoToCabrilloParts: ({ qso, ref, operation, settings, parts }) => {
    const ourCall = operation.stationCall || settings.operatorCall
    const qsoRef = findRef(qso, Info.key)

    parts.push((ourCall ?? '').padEnd(13, ' '))
    parts.push((ref?.class ?? '').padEnd(6, ' '))
    parts.push((ref?.location ?? '').padEnd(3, ' '))
    parts.push((qso?.their?.call ?? '').padEnd(13, ' '))
    parts.push((qsoRef?.class ?? '').padEnd(4, ' '))
    parts.push((qsoRef?.location ?? '').padEnd(3, ' '))
    return parts
  }
}

function fieldsForMainExchangePanel (props) {
  const { qso, setQSO, styles, disabled, refStack, onSubmitEditing, keyHandler, focusedRef } = props

  const ref = findRef(qso?.refs, Info.key) || { type: Info.key, class: '', location: '' }

  const fields = []

  fields.push(
    <ThemedTextInput
      key={`${Info.key}/class`}
      innerRef={refStack.shift()}
      style={[styles.input, { minWidth: styles.oneSpace * 7, flex: 1 }]}
      textStyle={styles.text.callsign}
      label={'Class'}
      placeholder={''}
      mode={'flat'}
      uppercase={true}
      noSpaces={true}
      value={ref?.class || ''}
      disabled={disabled}
      onChangeText={(text) => setQSO({
        ...qso,
        refs: replaceRef(qso?.refs, Info.key, { ...ref, class: text }),
        their: { ...qso?.their, exchange: [text, ref?.location].join(' ') }
      })}
      onSubmitEditing={onSubmitEditing}
      onKeyPress={keyHandler}
      focusedRef={focusedRef}
    />
  )
  fields.push(
    <ThemedTextInput
      key={`${Info.key}/location`}
      innerRef={refStack.shift()}
      style={[styles.input, { minWidth: styles.oneSpace * 7, flex: 1 }]}
      textStyle={styles.text.callsign}
      label={'Loc'}
      placeholder={''}
      mode={'flat'}
      uppercase={true}
      noSpaces={true}
      value={ref?.location || ''}
      disabled={disabled}
      onChangeText={(text) => setQSO({
        ...qso,
        refs: replaceRef(qso?.refs, Info.key, { ...ref, location: text }),
        their: { ...qso?.their, arrlSection: text, exchange: [ref?.class, text].join(' ') }
      })}
      onSubmitEditing={onSubmitEditing}
      onKeyPress={keyHandler}
      focusedRef={focusedRef}
    />
  )
  return fields
}

export function ActivityOptions (props) {
  const { styles, operation } = props

  const dispatch = useDispatch()

  const ref = useMemo(() => findRef(operation, Info.key), [operation])

  const handleChange = useCallback((value) => {
    if (value?.class) value.class = value.class.toUpperCase()
    if (value?.location) value.location = value.location.toUpperCase()

    dispatch(setOperationData({ uuid: operation.uuid, refs: replaceRef(operation?.refs, Info.key, { ...ref, ...value }) }))
  }, [dispatch, operation, ref])

  return (
    <List.Section title={'Exchange Information'}>
      <ListRow>
        <ThemedTextInput
          style={[styles.input, { marginTop: styles.oneSpace, flex: 1 }]}
          textStyle={styles.text.callsign}
          label={'Class'}
          mode={'flat'}
          uppercase={true}
          noSpaces={true}
          value={ref?.class || ''}
          onChangeText={(text) => handleChange({ class: text })}
        />
      </ListRow>
      <ListRow>
        <ThemedTextInput
          style={[styles.input, { marginTop: styles.oneSpace, flex: 1 }]}
          textStyle={styles.text.callsign}
          label={'Location'}
          mode={'flat'}
          uppercase={true}
          noSpaces={true}
          value={ref?.location || ''}
          onChangeText={(text) => handleChange({ location: text })}
        />
      </ListRow>
    </List.Section>
  )
}