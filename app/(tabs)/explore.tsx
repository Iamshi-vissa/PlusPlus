import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { searchPlaces } from '@/features/places/api';
import { AreaPicker } from '@/features/places/AreaPicker';
import { widerRadius } from '@/features/places/format';
import { PlaceCard } from '@/features/places/PlaceCard';
import { MAP_SUPPORTED, PlacesMap } from '@/features/places/PlacesMap';
import {
  type Filters,
  NO_FILTERS,
  type PlaceResult,
  type PlaceType,
  type Where,
} from '@/features/places/types';
import { checkInKarnataka, isKarnatakaPincode } from '@/lib/geo/karnataka';
import { getCurrentLocation } from '@/lib/location';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

const TYPES: PlaceType[] = ['hospital', 'clinic', 'medical_store'];

export default function FindCareScreen() {
  const { t } = useTranslation();
  const [where, setWhere] = useState<Where | null>(null);
  // From the emergency screen: open with the "Emergency" filter on.
  const params = useLocalSearchParams<{ emergency?: string }>();
  const [filters, setFilters] = useState<Filters>(
    params.emergency === '1' ? { ...NO_FILTERS, emergency: true } : NO_FILTERS,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Typing in the search box updates the filter after a short pause.
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => (f.query === query ? f : { ...f, query })),
      400,
    );
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!where) return;
    let active = true;
    searchPlaces(where, filters)
      .then((list) => {
        if (!active) return;
        setResults(list);
        setMessage(null);
      })
      .catch(() => {
        if (active) setMessage(t('places.errors.searchFailed'));
      });
    return () => {
      active = false;
    };
  }, [where, filters, t]);

  if (!isSupabaseConfigured()) {
    return <Text style={[styles.message, styles.pad]}>{t('places.errors.notConfigured')}</Text>;
  }

  const nearMe = async () => {
    setBusy(true);
    setMessage(t('places.locating'));
    const location = await getCurrentLocation();
    setBusy(false);
    if (!location.ok) {
      setMessage(t(location.reason === 'denied' ? 'home.area.denied' : 'home.area.unavailable'));
      return;
    }
    if (checkInKarnataka(location.coords) === 'outside') {
      setResults(null);
      setMessage(t('geo.outsideKarnataka'));
      return;
    }
    setWhere({ kind: 'near', ...location.coords, radiusM: 5000 });
  };

  const searchPin = () => {
    const clean = pin.replace(/\s/g, '');
    if (!isKarnatakaPincode(clean)) {
      setPinError(t('places.pincodeInvalid'));
      return;
    }
    setPinError(null);
    setPinOpen(false);
    setWhere({ kind: 'pincode', pincode: clean });
  };

  const toggleType = (type: PlaceType) =>
    setFilters((f) => ({
      ...f,
      types: f.types.includes(type) ? f.types.filter((x) => x !== type) : [...f.types, type],
    }));

  const areaLabel =
    where?.kind === 'taluk' || where?.kind === 'district'
      ? where.label
      : where?.kind === 'pincode'
        ? where.pincode
        : null;
  const next = where?.kind === 'near' ? widerRadius(where.radiusM) : null;
  const centre = where?.kind === 'near' ? { lat: where.lat, lng: where.lng } : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        accessibilityLabel={t('places.searchLabel')}
        placeholder={t('places.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
        returnKeyType="search"
        testID="place-search"
      />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t('places.nearMe')}
            onPress={nearMe}
            loading={busy}
            variant={where?.kind === 'near' ? 'primary' : 'secondary'}
            testID="near-me"
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('places.chooseArea')}
            onPress={() => setPickerOpen(true)}
            variant={
              where?.kind === 'taluk' || where?.kind === 'district' ? 'primary' : 'secondary'
            }
            testID="choose-area"
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('places.pincode')}
            onPress={() => setPinOpen((o) => !o)}
            variant={where?.kind === 'pincode' ? 'primary' : 'secondary'}
            testID="choose-pincode"
          />
        </View>
      </View>

      {pinOpen ? (
        <View style={styles.pinRow}>
          <View style={styles.flex}>
            <Field
              label={t('places.pincodeLabel')}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              error={pinError}
              onSubmitEditing={searchPin}
              testID="pincode-input"
            />
          </View>
          <View style={styles.pinButton}>
            <Button label={t('places.pincodeSearch')} onPress={searchPin} testID="pincode-search" />
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('places.types.all')}
          selected={filters.types.length === 0}
          onPress={() => setFilters((f) => ({ ...f, types: [] }))}
        />
        {TYPES.map((type) => (
          <Chip
            key={type}
            label={t(`places.types.${type}`)}
            selected={filters.types.includes(type)}
            onPress={() => toggleType(type)}
            testID={`type-${type}`}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('places.filters.openNow')}
          selected={filters.openNow}
          onPress={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
          testID="filter-open"
        />
        <Chip
          label={t('places.filters.is24x7')}
          selected={filters.is24x7}
          onPress={() => setFilters((f) => ({ ...f, is24x7: !f.is24x7 }))}
        />
        <Chip
          label={t('places.filters.emergency')}
          selected={filters.emergency}
          onPress={() => setFilters((f) => ({ ...f, emergency: !f.emergency }))}
          testID="filter-emergency"
        />
        <Chip
          label={t('places.filters.government')}
          selected={filters.ownership === 'government'}
          onPress={() =>
            setFilters((f) => ({
              ...f,
              ownership: f.ownership === 'government' ? null : 'government',
            }))
          }
        />
        <Chip
          label={t('places.filters.private')}
          selected={filters.ownership === 'private'}
          onPress={() =>
            setFilters((f) => ({ ...f, ownership: f.ownership === 'private' ? null : 'private' }))
          }
        />
      </ScrollView>

      {!where && !message ? <Text style={styles.message}>{t('places.start')}</Text> : null}
      {message ? (
        <Text style={styles.message} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}

      {results && where ? (
        <>
          <View style={styles.resultsHeader}>
            <Text style={styles.count} testID="results-count">
              {areaLabel
                ? t('places.resultsIn', { count: results.length, area: areaLabel })
                : t('places.results', { count: results.length })}
            </Text>
            <View style={styles.row}>
              <Chip
                label={t('places.view.list')}
                selected={view === 'list'}
                onPress={() => setView('list')}
              />
              <Chip
                label={t('places.view.map')}
                selected={view === 'map'}
                onPress={() => setView('map')}
              />
            </View>
          </View>

          {view === 'map' ? <PlacesMap places={results} centre={centre} /> : null}
          {view === 'list' || !MAP_SUPPORTED
            ? results.map((place) => <PlaceCard key={place.id} place={place} />)
            : null}

          {results.length === 0 ? (
            <Text style={styles.message}>{t('places.noResults')}</Text>
          ) : null}
          {next && where.kind === 'near' ? (
            <Button
              variant="secondary"
              label={t('places.wider', { km: next / 1000 })}
              onPress={() => setWhere({ ...where, radiusM: next })}
              testID="wider"
            />
          ) : null}
        </>
      ) : null}

      <AreaPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(w) => {
          setPickerOpen(false);
          setWhere(w);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md },
  pad: { padding: spacing.lg },
  search: {
    minHeight: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  pinRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  pinButton: { width: 110 },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  message: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  count: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
});
