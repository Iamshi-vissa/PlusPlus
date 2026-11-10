import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { colors } from '@/lib/theme';

import { placeName } from './PlaceCard';
import type { PlaceResult } from './types';

export const MAP_SUPPORTED = true;

const MARKER_COLOURS = { hospital: 'red', clinic: 'green', medical_store: 'blue' } as const;

export function PlacesMap({
  places,
  centre,
}: {
  places: PlaceResult[];
  centre: { lat: number; lng: number } | null;
}) {
  const { t, i18n } = useTranslation();
  const first =
    centre ??
    (places[0] ? { lat: places[0].lat, lng: places[0].lng } : { lat: 12.9716, lng: 77.5946 });
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: first.lat,
        longitude: first.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }}
      showsUserLocation={centre !== null}
    >
      {places.map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.lat, longitude: p.lng }}
          title={placeName(p, i18n.language)}
          description={t(`places.type.${p.type}`)}
          pinColor={MARKER_COLOURS[p.type]}
          onCalloutPress={() => router.push({ pathname: '/clinic/[id]', params: { id: p.id } })}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 420, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
});
