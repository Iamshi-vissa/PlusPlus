import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { sendHeartbeat } from './api';
import { type Fix, shouldSend, smooth } from './locationRules';

/**
 * Shares the responder's location while they are available.
 * - Development / production builds: a background task with a visible "You are available"
 *   notification (Android foreground service), so alerts work with the phone locked.
 * - Expo Go and web: only while the app is open (foreground watch).
 * Fixes are filtered (≤ 100 m), smoothed (last 3) and throttled (30 s / 100 m; 5 s during an SOS).
 */
export const LOCATION_TASK = 'plusplus-responder-location';

let recent: Fix[] = [];
let lastSent: Fix | null = null;
let activeSos = false;
let foreground: Location.LocationSubscription | null = null;

export function setActiveSos(active: boolean): void {
  activeSos = active;
}

export async function handleFixes(locations: Location.LocationObject[]): Promise<void> {
  for (const l of locations) {
    recent = [
      ...recent.slice(-5),
      {
        lat: l.coords.latitude,
        lng: l.coords.longitude,
        accuracyM: l.coords.accuracy ?? 999,
        at: l.timestamp,
      },
    ];
    const smoothed = smooth(recent);
    if (smoothed && shouldSend(lastSent, smoothed, activeSos)) {
      if (await sendHeartbeat(smoothed.lat, smoothed.lng, smoothed.accuracyM)) lastSent = smoothed;
    }
  }
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
      if (error || !data) return;
      await handleFixes(data.locations);
    },
  );
}

export type TrackingMode = 'background' | 'foreground' | 'off';

export async function startTracking(notification: {
  title: string;
  body: string;
}): Promise<TrackingMode> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'off';
  recent = [];
  lastSent = null;

  if (Platform.OS !== 'web') {
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === 'granted' && (await TaskManager.isAvailableAsync())) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 20,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: notification.title,
            notificationBody: notification.body,
          },
        });
        return 'background';
      }
    } catch {
      // Expo Go or no background permission: fall back to foreground below.
    }
  }

  foreground?.remove();
  foreground = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 20 },
    (l) => void handleFixes([l]),
  );
  return 'foreground';
}

export async function stopTracking(): Promise<void> {
  foreground?.remove();
  foreground = null;
  if (Platform.OS !== 'web') {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    } catch {
      // not started
    }
  }
}
