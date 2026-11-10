import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabase } from '@/lib/supabase';

/**
 * Registers this phone for push notifications (SOS alerts, reminders).
 * Needs a development or production build with an EAS project id; Expo Go and web skip this,
 * and SOS alerts then still arrive through the in-app alert check.
 */
export async function registerForPush(userId: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sos', {
        name: 'SOS alerts',
        importance: AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 600, 300, 600],
        bypassDnd: true,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await getSupabase()
      .from('push_tokens')
      .upsert({
        token,
        user_id: userId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      });
    return !error;
  } catch {
    return false;
  }
}
