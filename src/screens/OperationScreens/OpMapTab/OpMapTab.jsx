/*
 * Copyright ©️ 2024 Sebastian Delmont <sd@ham2k.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IconButton } from 'react-native-paper'
import MapView, { Marker, Polyline, Circle } from 'react-native-maps'

import { gridToLocation } from '@ham2k/lib-maidenhead-grid'

import { useThemedStyles } from '../../../styles/tools/useThemedStyles'
import { selectRuntimeOnline } from '../../../store/runtime'
import { selectOperation } from '../../../store/operations'
import { addQSO, selectQSOs } from '../../../store/qsos'
import { fmtShortTimeZulu } from '../../../tools/timeFormats'
import { View, useWindowDimensions } from 'react-native'
import { selectSettings } from '../../../store/settings'
import { apiQRZ } from '../../../store/apiQRZ'
import { distanceOnEarth, fmtDistance, locationForQSONInfo } from '../../../tools/geoTools'
import { reportError } from '../../../App'
import { useUIState } from '../../../store/ui'

const TRANSP_PNG = require('../../../../assets/images/transp-16.png')

const METERS_IN_ONE_DEGREE = 111111

const RGB_FOR_STRENGTH = {
  1: '247, 239, 126',
  2: '252, 234, 35',
  3: '247, 206, 0',
  4: '250, 202, 45',
  5: '250, 178, 45',
  6: '250, 168, 45',
  7: '252, 133, 28',
  8: '252, 118, 50',
  9: '245, 7, 7'
}

function prepareStyles (baseStyles, themeColor) {
  return {
    ...baseStyles,
    root: {
      flexDirection: 'column',
      flex: 1
    },
    panel: {
      backgroundColor: baseStyles.theme.colors[`${themeColor}Container`],
      borderBottomColor: baseStyles.theme.colors[`${themeColor}Light`],
      borderTopColor: baseStyles.theme.colors[`${themeColor}Light`],
      borderBottomWidth: 1,
      padding: baseStyles.oneSpace
    }
  }
}

export default function OpMapTab ({ navigation, route }) {
  const themeColor = 'tertiary'
  const styles = useThemedStyles(prepareStyles, themeColor)

  const dispatch = useDispatch()

  const online = useSelector(selectRuntimeOnline)
  const settings = useSelector(selectSettings)

  const operation = useSelector(state => selectOperation(state, route.params.operation.uuid))

  const [loggingState] = useUIState('OpLoggingTab', 'loggingState', {})

  const qth = useMemo(() => {
    try {
      if (!operation?.grid) return {}
      const [latitude, longitude] = gridToLocation(operation.grid)
      return { latitude, longitude }
    } catch (e) {
      return {}
    }
  }, [operation?.grid])

  const qsos = useSelector(state => selectQSOs(state, route.params.operation.uuid))

  const [nextQSOWithoutInfo, setNextQSOWithoutInfo] = useState(null)

  useEffect(() => {
    if (online && settings?.accounts?.qrz?.login && settings?.accounts?.qrz?.password) {
      if (!nextQSOWithoutInfo) {
        setNextQSOWithoutInfo(qsos.find(qso => !qso.their?.lookup))
      }
    }
  }, [qsos, online, settings, nextQSOWithoutInfo])

  useEffect(() => {
    if (nextQSOWithoutInfo) {
      setTimeout(async () => {
        try {
          const { data } = await dispatch(apiQRZ.endpoints.lookupCall.initiate({ call: nextQSOWithoutInfo.their.call }))
          const lookup = {
            name: data?.name,
            state: data?.state,
            city: data?.city,
            country: data?.country,
            county: data?.county,
            postal: data?.postal,
            grid: data?.grid,
            cqZone: data?.cqZone,
            ituZone: data?.ituZone,
            image: data?.image,
            imageInfo: data?.imageInfo
          }

          if (data?.error) lookup.error = data.error

          await dispatch(addQSO({
            uuid: operation.uuid,
            qso: {
              ...nextQSOWithoutInfo,
              their: {
                ...nextQSOWithoutInfo.their,
                guess: {
                  name: data?.name,
                  grid: data?.grid,
                  ...nextQSOWithoutInfo.their.guess
                },
                lookup
              }
            }
          }))
        } catch (e) {
          reportError('QRZ Lookup Error', e)
        } finally {
          setNextQSOWithoutInfo(null)
        }
      }, 10)
    }
  }, [nextQSOWithoutInfo, dispatch, operation?.uuid])

  const mappableQSOs = useMemo(() => {
    const activeQSOs = qsos.filter(qso => !qso.deleted)
    return activeQSOs
      .map(qso => {
        const location = locationForQSONInfo(qso?.their)
        const strength = strengthForQSO(qso)
        const distance = location && qth ? distanceOnEarth(location, qth, { units: settings.distanceUnits }) : null
        const distanceStr = distance ? fmtDistance(distance, { units: settings.distanceUnits }) : ''
        return { qso, location, strength, distance, distanceStr }
      })
      .filter(({ location }) => location)
      .sort((a, b) => b.strength - a.strength) // Weakest first
  }, [qsos, qth, settings])

  const initialRegion = useMemo(() => {
    const { latitude, longitude } = qth
    let latitudeMin = latitude ?? 0; let latitudeMax = latitude ?? 0; let longitudeMin = longitude ?? 0; let longitudeMax = longitude ?? 0
    for (const { location } of mappableQSOs) {
      latitudeMin = Math.min(latitudeMin, location.latitude)
      latitudeMax = Math.max(latitudeMax, location.latitude)
      longitudeMin = Math.min(longitudeMin, location.longitude)
      longitudeMax = Math.max(longitudeMax, location.longitude)
    }
    return {
      latitude: latitudeMin + (latitudeMax - latitudeMin) / 2,
      longitude: longitudeMin + (longitudeMax - longitudeMin) / 2,
      latitudeDelta: latitudeMax - latitudeMin + 10,
      longitudeDelta: longitudeMax - longitudeMin + 10
    }
  }, [qth, mappableQSOs])

  // eslint-disable-next-line no-unused-vars
  const { width, height } = useWindowDimensions()
  const [longitudeDelta, setLongitudeDelta] = useState(Math.floor(initialRegion.longitudeDelta))
  const handleRegionChange = useCallback((newRegion) => {
    setLongitudeDelta(Math.max(1, Math.floor(newRegion.longitudeDelta)))
  }, [])

  const scale = useMemo(() => {
    const metersPerPixel = (longitudeDelta * METERS_IN_ONE_DEGREE) / width
    const metersPerOneSpace = metersPerPixel * styles.oneSpace
    return { metersPerPixel, metersPerOneSpace }
  }, [longitudeDelta, width, styles])

  const mapStyles = useMemo(() => {
    const newStyles = stylesForMap({ longitudeDelta, count: mappableQSOs?.length })

    return newStyles
  }, [longitudeDelta, mappableQSOs?.length])

  return (
    <>
      <MapView
        style={styles.root}
        initialRegion={initialRegion}
        onRegionChange={handleRegionChange}
        mapType={styles.isIOS ? 'mutedStandard' : 'terrain'}
      >
        {qth.latitude && qth.longitude && (
          <>
            <Marker
              key={'qth'}
              coordinate={qth}
              title={`QTH: ${operation.grid}`}
              description={operation.title}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
              tracksViewChanges={false}
              icon={TRANSP_PNG}
            >
              <View style={{ width: styles.oneSpace, height: styles.oneSpace }} />
            </Marker>
            <Circle
              center={qth}
              radius={scale.metersPerOneSpace * 0.5}
              fillColor={'rgba(0,200,0,1)'}
              strokeWidth={0.1}
            />
          </>
        )}
        <MapMarkers
          qth={qth}
          qsos={mappableQSOs}
          mapStyles={mapStyles}
          styles={styles}
          metersPerOneSpace={scale.metersPerOneSpace}
          selectedKey={loggingState?.selectedKey}
        />
      </MapView>
      <View style={{ position: 'absolute', bottom: styles.oneSpace * 2, right: styles.oneSpace * 2 }}>
        <IconButton
          icon="fullscreen"
          size={styles.oneSpace * 4}
          mode={'contained'}
          style={{ opacity: 0.7 }}
          onPress={() => navigation.navigate('OperationBadgeScreen', { operation })}
        />
      </View>
    </>
  )
}

const MapMarkers = ({ qth, qsos, selectedKey, mapStyles, styles, metersPerOneSpace }) => {
  const ref = useRef()

  useEffect(() => {
    if (ref.current) {
      ref.current.showCallout()
    }
  }, [ref, selectedKey])

  return (
    <>
      {qth.latitude && qth.longitude && qsos.map(({ qso, location, strength }) => (
        <Polyline
          key={qso.key}
          geodesic={true}
          coordinates={[location, qth]}
          {...mapStyles.line}
        />
      ))}
      {qsos.map(({ qso, location, strength, distanceStr }) => (
        <React.Fragment key={qso.key}>
          <Marker
            coordinate={location}
            ref={selectedKey && selectedKey === qso.key ? ref : undefined}
            anchor={{ x: 0.5, y: 0.5 }}
            title={[qso.their.call, distanceStr].join(' • ')}
            description={[qso.their?.sent, qso.mode, qso.band, fmtShortTimeZulu(qso.startOnMillis)].join(' • ')}
            flat={true}
            tracksViewChanges={false}
            icon={TRANSP_PNG}
          >
            <View width={12} height={12} style={{ width: styles.oneSpace * mapStyles.marker.size, height: styles.oneSpace * mapStyles.marker.size }}>
              <View />{/* Empty View */}
            </View>
          </Marker>
          <Circle
            center={location}
            radius={metersPerOneSpace * mapStyles.marker.size / 2}
            fillColor={`rgba(${RGB_FOR_STRENGTH[strength] ?? RGB_FOR_STRENGTH[5]}, ${mapStyles.marker.opacity})`}
            strokeWidth={0.1}
          />
        </React.Fragment>
      ))}
    </>
  )
}

function strengthForQSO (qso) {
  try {
    if (qso.mode === 'CW' || qso.mode === 'RTTY') {
      return Math.floor(qso.their?.sent || 555 / 10) % 10
    } else if (qso.mode === 'FT8' || qso.mode === 'FT4') {
      const signal = (qso.their?.sent || -10)
      // map signal report from -20 to +10 into 1 to 9
      const remapped = (9 - 1) / (10 - (-20)) * (signal - (-20)) + 1
      return Math.min(9, Math.max(1, Math.round(remapped)))
    } else {
      return (qso.their?.sent || 55) % 10
    }
  } catch (e) {
    return 5
  }
}

function stylesForMap ({ longitudeDelta, count }) {
  if (count > 50) {
    longitudeDelta = longitudeDelta * 1.5
  }
  if (longitudeDelta > 140) {
    return { marker: { opacity: 0.7, size: 0.5 }, line: { strokeColor: 'rgba(60,60,60,0.2)' } }
  } else if (longitudeDelta > 120) {
    return { marker: { opacity: 0.7, size: 0.5 }, line: { strokeColor: 'rgba(60,60,60,0.2)' } }
  } else if (longitudeDelta > 90) {
    return { marker: { opacity: 0.7, size: 0.5 }, line: { strokeColor: 'rgba(60,60,60,0.2)' } }
  } else if (longitudeDelta > 60) {
    return { marker: { opacity: 0.7, size: 0.8 }, line: { strokeColor: 'rgba(60,60,60,0.3)' } }
  } else if (longitudeDelta > 40) {
    return { marker: { opacity: 0.7, size: 0.9 }, line: { strokeColor: 'rgba(60,60,60,0.4)' } }
  } else if (longitudeDelta > 25) {
    return { marker: { opacity: 0.7, size: 1 }, line: { strokeColor: 'rgba(60,60,60,0.4)' } }
  } else if (longitudeDelta > 15) {
    return { marker: { opacity: 1, size: 1 }, line: { strokeColor: 'rgba(75,75,75,0.5)' } }
  } else if (longitudeDelta > 10) {
    return { marker: { opacity: 1, size: 1.2 }, line: { strokeColor: 'rgba(90,90,90,0.7)' } }
  } else {
    return { marker: { opacity: 1, size: 1.4 }, line: { strokeColor: 'rgba(60,60,60,0.3)' } }
  }
}
