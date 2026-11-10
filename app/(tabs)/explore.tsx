import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function ExploreScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('explore.title')} message={t('explore.comingSoon')} />;
}
