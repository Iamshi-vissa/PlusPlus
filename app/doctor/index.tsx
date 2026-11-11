import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { suggestDoctorType } from '@/dispatch/suggestDoctorType';
import {
  listProblems,
  listSpecialities,
  type Speciality,
  suggestProblems,
} from '@/features/doctors/api';
import { checkRedFlags } from '@/features/doctors/redFlags';
import {
  resetDoctorSearch,
  setDoctorSearch,
  useDoctorSearch,
} from '@/features/doctors/searchStore';
import type { BodyArea, Duration, PatientGroup, Problem, Severity } from '@/features/doctors/types';
import { colors, spacing } from '@/lib/theme';

const AREAS: BodyArea[] = [
  'head',
  'chest',
  'stomach',
  'back',
  'arms',
  'legs',
  'skin',
  'general',
  'mind',
  'women',
  'child',
];
const AREA_ICONS: Record<BodyArea, ComponentProps<typeof Ionicons>['name']> = {
  head: 'happy',
  chest: 'heart',
  stomach: 'body',
  back: 'body',
  arms: 'hand-left',
  legs: 'walk',
  skin: 'hand-right',
  general: 'person',
  mind: 'cloudy',
  women: 'female',
  child: 'happy',
};

export default function FindDoctorScreen() {
  const { t, i18n } = useTranslation();
  const search = useDoctorSearch();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tab, setTab] = useState<'list' | 'body'>('list');
  const [area, setArea] = useState<BodyArea | null>(null);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matched, setMatched] = useState<Problem[]>([]);
  const kn = i18n.language === 'kn';

  useEffect(() => {
    resetDoctorSearch();
    listProblems()
      .then(setProblems)
      .catch(() => setError(t('places.errors.searchFailed')));
    listSpecialities()
      .then(setSpecialities)
      .catch(() => undefined);
  }, [t]);

  const picked = search.problems;
  const togglePick = (p: Problem) =>
    setDoctorSearch({
      problems: picked.some((x) => x.code === p.code)
        ? picked.filter((x) => x.code !== p.code)
        : [...picked, p],
    });

  const goEmergencyIfNeeded = () => {
    const flags = checkRedFlags(picked, search.description, search.answers);
    if (flags.emergency) {
      router.push({ pathname: '/doctor/emergency', params: { reasons: flags.reasons.join(',') } });
      return true;
    }
    return false;
  };

  const next1 = async () => {
    if (picked.length === 0 && !search.description.trim()) {
      setError(t('doctors.needProblem'));
      return;
    }
    setError(null);
    if (goEmergencyIfNeeded()) return;
    setMatched([]);
    // Only typed words and nothing picked: match the words to problems from our list.
    if (picked.length === 0 && problems) {
      setMatching(true);
      const result = await suggestProblems(search.description);
      setMatching(false);
      if (result?.emergency) {
        router.push({ pathname: '/doctor/emergency', params: { reasons: 'described' } });
        return;
      }
      const found = (result?.problemCodes ?? [])
        .map((code) => problems.find((p) => p.code === code))
        .filter((p): p is Problem => p !== undefined);
      if (found.length > 0) {
        setDoctorSearch({ problems: found });
        setMatched(found);
      }
    }
    setStep(2);
  };
  const next2 = () => {
    const a = search.answers;
    if (!a.duration || !a.severity || !a.patientGroup) {
      setError(t('doctors.needAnswers'));
      return;
    }
    setError(null);
    if (!goEmergencyIfNeeded()) setStep(3);
  };
  const find = () => {
    if (!goEmergencyIfNeeded()) router.push('/doctor/results');
  };

  const suggestion = useMemo(
    () => suggestDoctorType(picked, search.answers),
    [picked, search.answers],
  );
  const name = (p: Problem) => (kn ? p.name_kn : p.name_en);
  const visible = (problems ?? []).filter((p) =>
    tab === 'body' ? area !== null && p.body_area === area : true,
  );
  const emergencies = visible.filter((p) => p.is_red_flag);
  const common = visible.filter((p) => !p.is_red_flag);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {step === 1 ? (
        <>
          <Text style={styles.h1} accessibilityRole="header">
            {t('doctors.step1')}
          </Text>
          <View style={styles.row}>
            <Chip
              label={t('doctors.tabList')}
              selected={tab === 'list'}
              onPress={() => setTab('list')}
            />
            <Chip
              label={t('doctors.tabBody')}
              selected={tab === 'body'}
              onPress={() => setTab('body')}
              testID="tab-body"
            />
          </View>

          {tab === 'body' ? (
            <>
              <Text style={styles.muted}>{t('doctors.pickArea')}</Text>
              <View style={styles.grid}>
                {AREAS.map((a) => (
                  <Pressable
                    key={a}
                    accessibilityRole="button"
                    accessibilityState={{ selected: area === a }}
                    onPress={() => setArea(a)}
                    style={[styles.areaTile, area === a && styles.tileSelected]}
                    testID={`area-${a}`}
                  >
                    <Ionicons
                      name={AREA_ICONS[a]}
                      size={26}
                      color={area === a ? colors.onSos : colors.primary}
                    />
                    <Text style={[styles.tileText, area === a && styles.tileTextSelected]}>
                      {t(`doctors.bodyArea.${a}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {common.length > 0 ? (
            <View style={styles.grid}>
              {common.map((p) => (
                <ProblemTile
                  key={p.code}
                  label={name(p)}
                  icon={p.icon}
                  selected={picked.some((x) => x.code === p.code)}
                  onPress={() => togglePick(p)}
                  testID={`problem-${p.code}`}
                />
              ))}
            </View>
          ) : null}
          {emergencies.length > 0 ? (
            <>
              <Text style={styles.danger}>{t('doctors.emergencyGroup')}</Text>
              <View style={styles.grid}>
                {emergencies.map((p) => (
                  <ProblemTile
                    key={p.code}
                    label={name(p)}
                    icon={p.icon}
                    danger
                    selected={picked.some((x) => x.code === p.code)}
                    onPress={() => togglePick(p)}
                    testID={`problem-${p.code}`}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>{t('doctors.describeLabel')}</Text>
          <TextInput
            accessibilityLabel={t('doctors.describeLabel')}
            value={search.description}
            onChangeText={(description) => setDoctorSearch({ description })}
            placeholder={t('doctors.describePlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            style={styles.textArea}
            testID="describe"
          />
          <Text style={styles.muted}>{t('doctors.describeHint')}</Text>
          {error ? (
            <Text style={styles.danger} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            label={matching ? t('doctors.matching') : t('doctors.next')}
            onPress={() => void next1()}
            loading={matching}
            testID="next-1"
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={styles.h1} accessibilityRole="header">
            {t('doctors.step2')}
          </Text>
          {matched.length > 0 ? (
            <View style={styles.matched} testID="matched">
              <Text style={styles.suggestion}>
                {t('doctors.matched', { problems: matched.map(name).join(', ') })}
              </Text>
              <Text style={styles.muted}>{t('doctors.matchedHint')}</Text>
              <Button
                variant="secondary"
                label={t('doctors.matchedChange')}
                onPress={() => {
                  setMatched([]);
                  setStep(1);
                }}
              />
            </View>
          ) : null}
          <Question<Duration>
            title={t('doctors.duration.q')}
            options={['today', 'few_days', 'weeks']}
            value={search.answers.duration}
            label={(o) => t(`doctors.duration.${o}`)}
            onChange={(duration) => setDoctorSearch({ answers: { ...search.answers, duration } })}
          />
          <Question<Severity>
            title={t('doctors.severity.q')}
            options={['mild', 'moderate', 'severe']}
            value={search.answers.severity}
            label={(o) => t(`doctors.severity.${o}`)}
            onChange={(severity) => setDoctorSearch({ answers: { ...search.answers, severity } })}
          />
          <Question<PatientGroup>
            title={t('doctors.who.q')}
            options={['adult', 'child', 'elderly', 'pregnant']}
            value={search.answers.patientGroup}
            label={(o) => t(`doctors.who.${o}`)}
            onChange={(patientGroup) =>
              setDoctorSearch({ answers: { ...search.answers, patientGroup } })
            }
          />
          {error ? (
            <Text style={styles.danger} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label={t('doctors.next')} onPress={next2} testID="next-2" />
          <Button variant="secondary" label={t('doctors.back')} onPress={() => setStep(1)} />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Text style={styles.h1} accessibilityRole="header">
            {t('doctors.step3')}
          </Text>
          {(['not_sure', 'general', 'specialist'] as const).map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ selected: search.choice === c }}
              onPress={() => setDoctorSearch({ choice: c, manualSpeciality: null })}
              style={[styles.option, search.choice === c && styles.optionSelected]}
              testID={`choice-${c}`}
            >
              <Text style={styles.optionTitle}>{t(`doctors.type.${c}`)}</Text>
              {c !== 'not_sure' ? (
                <Text style={styles.muted}>{t(`doctors.typeHint.${c}`)}</Text>
              ) : null}
              {c === 'not_sure' && search.choice === 'not_sure' ? (
                <Text style={styles.suggestion} testID="suggestion">
                  {t('doctors.suggestion', {
                    type: t(`doctors.type.${suggestion.type}`),
                    reason: t(suggestion.reasonKey),
                  })}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {search.choice === 'not_sure' ? (
            <Button
              variant="secondary"
              label={t('doctors.switchTo', {
                type: t(`doctors.type.${suggestion.type === 'general' ? 'specialist' : 'general'}`),
              })}
              onPress={() =>
                setDoctorSearch({
                  choice: suggestion.type === 'general' ? 'specialist' : 'general',
                })
              }
            />
          ) : null}
          {search.choice === 'specialist' ? (
            <>
              <Text style={styles.label}>{t('doctors.chooseSpeciality')}</Text>
              <View style={styles.wrap}>
                <Chip
                  label={t('doctors.anySpecialist')}
                  selected={!search.manualSpeciality}
                  onPress={() => setDoctorSearch({ manualSpeciality: null })}
                />
                {specialities
                  .filter((s) => !['gp', 'family_medicine', 'emergency'].includes(s.code))
                  .map((s) => (
                    <Chip
                      key={s.code}
                      label={kn ? s.name_kn : s.name_en}
                      selected={search.manualSpeciality === s.code}
                      onPress={() => setDoctorSearch({ manualSpeciality: s.code })}
                    />
                  ))}
              </View>
            </>
          ) : null}
          <Text style={styles.note}>{t('doctors.notDiagnosis')}</Text>
          <Button label={t('doctors.findDoctors')} onPress={find} testID="find-doctors" />
          <Button variant="secondary" label={t('doctors.back')} onPress={() => setStep(2)} />
        </>
      ) : null}
    </ScrollView>
  );
}

function ProblemTile(props: {
  label: string;
  icon: string;
  selected: boolean;
  danger?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const tint = props.selected ? colors.onSos : props.danger ? colors.sos : colors.primary;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.selected }}
      onPress={props.onPress}
      style={[
        styles.tile,
        props.danger && styles.tileDanger,
        props.selected && (props.danger ? styles.tileDangerSelected : styles.tileSelected),
      ]}
      testID={props.testID}
    >
      <Ionicons
        name={props.icon as ComponentProps<typeof Ionicons>['name']}
        size={24}
        color={tint}
      />
      <Text style={[styles.tileText, props.selected && styles.tileTextSelected]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function Question<T extends string>(props: {
  title: string;
  options: T[];
  value: T | null;
  label: (o: T) => string;
  onChange: (o: T) => void;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.label}>{props.title}</Text>
      <View style={styles.wrap}>
        {props.options.map((o) => (
          <Chip
            key={o}
            label={props.label(o)}
            selected={props.value === o}
            onPress={() => props.onChange(o)}
            testID={`answer-${o}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  areaTile: {
    width: '31%',
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: spacing.xs,
  },
  tileSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileDanger: { borderColor: '#F5B7B7' },
  tileDangerSelected: { backgroundColor: colors.sos, borderColor: colors.sos },
  tileText: { fontSize: 15, color: colors.text, textAlign: 'center' },
  tileTextSelected: { color: colors.onSos, fontWeight: '700' },
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  danger: { fontSize: 16, fontWeight: '700', color: colors.sos },
  textArea: {
    minHeight: 96,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 17,
    color: colors.text,
    textAlignVertical: 'top',
  },
  question: { gap: spacing.sm },
  option: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.surface },
  optionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  suggestion: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  note: { fontSize: 15, color: colors.textMuted, fontStyle: 'italic' },
  matched: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
});
