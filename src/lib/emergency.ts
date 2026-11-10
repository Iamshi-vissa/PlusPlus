import { Linking } from 'react-native';

export const EMERGENCY_NUMBERS = ['108', '112'] as const;
export type EmergencyNumber = (typeof EMERGENCY_NUMBERS)[number];

/** Opens the phone dialler. Works with no internet. Returns false if the dialler couldn't open. */
export async function callEmergency(number: EmergencyNumber): Promise<boolean> {
  try {
    await Linking.openURL(`tel:${number}`);
    return true;
  } catch {
    return false;
  }
}
