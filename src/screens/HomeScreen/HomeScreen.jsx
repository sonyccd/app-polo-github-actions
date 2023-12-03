import React, { useCallback, useEffect } from 'react'

import {
  Text,
  View
} from 'react-native'
import { Button } from 'react-native-paper'

import { useThemedStyles } from '../../styles/tools/useThemedStyles'
import ScreenView from '../components/ScreenView'
import { useDispatch, useSelector } from 'react-redux'
import { addNewOperation, loadOperationsList, selectOperationsList, selectOperationsStatus } from '../../store/operations'
import OperationItem from '../../components/OperationItem'

export default function HomeScreen ({ navigation }) {
  const styles = useThemedStyles()
  const dispatch = useDispatch()
  // const operationsStatus = useSelector(selectOperationsStatus)
  const operations = useSelector(selectOperationsList)

  useEffect(() => {
    dispatch(loadOperationsList())
  }, [dispatch])

  const handleNewOperation = useCallback(() => {
    dispatch(addNewOperation({ call: 'KI2D', name: `Operation ${operations.length + 1}` }))
  }, [dispatch, operations])

  const navigateToOperation = useCallback((operation) => {
    navigation.navigate('Operation', { uuid: operation.uuid, operation })
  }, [navigation])

  return (
    <ScreenView styles={styles}>
      <View style={styles.listContainer}>
        {operations.length > 0 ? (
          operations.map((operation, index) => (
            <OperationItem operation={operation} key={operation.uuid} styles={styles} onPress={navigateToOperation} />
          )
          )
        ) : (
          <Text>No Operations!</Text>
        )}
      </View>
      <View style={styles.sectionContainer}>
        <Button
          mode="contained"
          onPress={handleNewOperation}
          style={styles.button}
        >
          New
        </Button>

        <Button
          mode="contained"
          onPress={() => navigation.navigate('Settings')}
          style={styles.button}
        >
          Settings
        </Button>

      </View>
    </ScreenView>
  )
}
