import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen title={t('appointments.title')} message={t('appointments.comingSoon')} />
  );
}
