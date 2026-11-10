import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatIndianMobile, normalizeIndianMobile } from '@/features/auth/phone';
import {
  addContact,
  type EmergencyContact,
  listContacts,
  removeContact,
} from '@/features/contacts/api';
import { canAddContact, type ContactInput, validateContact } from '@/features/contacts/rules';
import { colors, spacing } from '@/lib/theme';

const EMPTY: ContactInput = { name: '', phone: '', relation: '' };

export default function EmergencyContactsScreen() {
  const { t } = useTranslation();
  const { session, loading: authLoading } = useAuth();

  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [form, setForm] = useState<ContactInput>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ContactInput, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!session) return;
    let active = true;
    listContacts()
      .then((list) => {
        if (!active) return;
        setContacts(list);
        setError(null);
      })
      .catch(() => {
        if (active) setError(t('contacts.errors.loadFailed'));
      });
    return () => {
      active = false;
    };
  }, [session, t, reloadKey]);

  if (authLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;

  const ownPhone = normalizeIndianMobile(session.user.phone ?? '');

  const add = async () => {
    const result = validateContact(form, {
      ownPhone,
      existingPhones: (contacts ?? []).map((c) => c.phone),
    });
    if (!result.ok) {
      setFieldErrors(
        Object.fromEntries(Object.entries(result.errors).map(([field, key]) => [field, t(key)])),
      );
      return;
    }
    setFieldErrors({});
    setSaving(true);
    const saved = await addContact(result.value);
    setSaving(false);
    if (!saved.ok) {
      setError(t(saved.error));
      return;
    }
    setForm(EMPTY);
    setError(null);
    reload();
  };

  const remove = async (id: string) => {
    setConfirmingId(null);
    if (await removeContact(id)) reload();
    else setError(t('contacts.errors.removeFailed'));
  };

  const count = contacts?.length ?? 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>{t('contacts.intro')}</Text>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {contacts && contacts.length === 0 ? (
        <Text style={styles.muted}>{t('contacts.empty')}</Text>
      ) : null}

      {contacts?.map((contact) => (
        <View key={contact.id} style={styles.card} testID="contact-row">
          <Text style={styles.name}>{contact.name}</Text>
          <Text style={styles.muted}>
            {formatIndianMobile(contact.phone)}
            {contact.relation ? ` · ${contact.relation}` : ''}
          </Text>
          {confirmingId === contact.id ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>
                {t('contacts.confirmRemove', { name: contact.name })}
              </Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    variant="secondary"
                    label={t('common.cancel')}
                    onPress={() => setConfirmingId(null)}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    variant="danger"
                    label={t('contacts.remove')}
                    onPress={() => remove(contact.id)}
                  />
                </View>
              </View>
            </View>
          ) : (
            <Button
              variant="danger"
              label={t('contacts.remove')}
              onPress={() => setConfirmingId(contact.id)}
            />
          )}
        </View>
      ))}

      {contacts && !canAddContact(count) ? (
        <Text style={styles.muted}>{t('contacts.limitReached')}</Text>
      ) : null}

      {contacts && canAddContact(count) ? (
        <View style={styles.form}>
          <Field
            label={t('contacts.nameLabel')}
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name })}
            autoComplete="name"
            maxLength={60}
            error={fieldErrors.name}
            testID="contact-name"
          />
          <Field
            label={t('contacts.phoneLabel')}
            prefix="+91"
            value={form.phone}
            onChangeText={(phone) => setForm({ ...form, phone })}
            keyboardType="phone-pad"
            maxLength={16}
            error={fieldErrors.phone}
            testID="contact-phone"
          />
          <Field
            label={t('contacts.relationLabel')}
            value={form.relation}
            onChangeText={(relation) => setForm({ ...form, relation })}
            placeholder={t('contacts.relationPlaceholder')}
            maxLength={30}
            error={fieldErrors.relation}
            testID="contact-relation"
          />
          <Button
            label={saving ? t('common.saving') : t('contacts.add')}
            onPress={add}
            loading={saving}
            testID="add-contact"
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  intro: { fontSize: 17, lineHeight: 25, color: colors.text },
  muted: { fontSize: 16, color: colors.textMuted },
  error: { fontSize: 16, color: colors.sos },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  confirm: { gap: spacing.sm },
  confirmText: { fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  form: { gap: spacing.md, marginTop: spacing.md },
});
