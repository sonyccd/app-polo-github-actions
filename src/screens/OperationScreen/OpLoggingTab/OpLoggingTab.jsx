import React, { useCallback, useEffect, useRef, useState } from 'react'

import { View } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { selectOperation, setOperation } from '../../../store/operations'
import { useThemedStyles } from '../../../styles/tools/useThemedStyles'
import LoggingPanel from './components/LoggingPanel'
import QSOList from './components/QSOList'
import { addQSO, selectQSOs } from '../../../store/qsos'

function prepareNewQSO (operation) {
  return {
    our: {
      call: operation.call
    },
    band: operation.band,
    mode: operation.mode
  }
}

export default function OpLoggingTab ({ navigation, route }) {
  const styles = useThemedStyles((baseStyles) => {
    return {
      ...baseStyles,
      input: {
        backgroundColor: baseStyles.theme.colors.background,
        color: baseStyles.theme.colors.onBackground,
        paddingHorizontal: baseStyles.oneSpace
      }
    }
  })

  const dispatch = useDispatch()
  const operation = useSelector(selectOperation(route.params.operation.uuid))
  const qsos = useSelector(selectQSOs(route.params.operation.uuid))

  const [lastQSO, setLastQSO] = useState()
  const [currentQSO, setCurrentQSO] = useState(prepareNewQSO(operation))

  const listRef = useRef()

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({ title: `${qsos.length} QSOs`, iconName: 'radio' })
  }, [navigation, qsos])

  // When the lastQSO changes, scroll to it
  useEffect(() => {
    setTimeout(() => {
      if (lastQSO) {
        const i = qsos.findIndex((qso) => qso.key === lastQSO.ket)
        if (i > -1) {
          listRef.current?.scrollToIndex({ index: i, animated: true })
        } else {
          listRef.current?.scrollToEnd()
        }
      } else {
        listRef.current?.scrollToEnd()
      }
    }, 0)
  }, [listRef, qsos, lastQSO])

  // Log (or update) a QSO
  const logQSO = useCallback((qso) => {
    qso.our.call = operation.call

    qso.startOn = new Date(qso.startOnMillis).toISOString()
    if (qso.endOnMillis) {
      qso.endOn = new Date(qso.endOnMillis).toISOString()
    }
    qso.our.sent = qso.our.sent || (operation.mode === 'CW' ? '599' : '59')
    qso.their.sent = qso.their.sent || (operation.mode === 'CW' ? '599' : '59')

    qso.mode = operation.mode
    qso.freq = operation.freq

    if (operation.pota) {
      qso.refs = qso.refs ?? []
      qso.refs.push({ type: 'potaActivation', ref: operation.pota })
    }

    dispatch(addQSO({ uuid: operation.uuid, qso }))
    setLastQSO(qso)
    setCurrentQSO(prepareNewQSO(operation))
  }, [dispatch, operation])

  const handleOperationChange = useCallback((attributes) => {
    dispatch(setOperation({ uuid: operation.uuid, ...attributes }))
  }, [dispatch, operation.uuid])

  return (
    <View style={{ flex: 1 }}>
      <QSOList qsos={qsos} styles={styles} style={{ flex: 1 }} listRef={listRef} />
      <LoggingPanel operation={operation} onLog={logQSO} onOperationChange={handleOperationChange} qso={currentQSO} style={{ flex: 0 }} />
    </View>
  )
}