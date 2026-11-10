import { sosErrorCode } from '@/features/sos/api';
import { etaMinutes, navigationUrl, progressMessage, secondsLeft } from '@/features/sos/progress';

const base = {
  status: 'searching' as const,
  alerted: 0,
  deciding: 0,
  radius_m: 2000,
  responder: null,
  hospital: null,
};

describe('progressMessage', () => {
  it('tells the user what is happening', () => {
    expect(progressMessage(base)).toEqual({ key: 'sos.progress.starting' });
    expect(progressMessage({ ...base, alerted: 3, deciding: 3 })).toEqual({
      key: 'sos.progress.searching',
      params: { count: 3, km: 2 },
    });
    expect(progressMessage({ ...base, alerted: 6, deciding: 0, radius_m: 5000 })).toEqual({
      key: 'sos.progress.searching',
      params: { count: 6, km: 5 },
    });
  });

  it('shows who is coming and when', () => {
    const responder = {
      name: 'Ravi',
      vehicle_type: 'three_wheeler' as const,
      vehicle_number: 'KA01AB1234',
      lat: 1,
      lng: 2,
      last_seen_at: null,
      distance_m: 900,
      eta_s: 230,
    };
    expect(progressMessage({ ...base, status: 'assigned', responder })).toEqual({
      key: 'sos.progress.coming',
      params: { name: 'Ravi', minutes: 4 },
    });
    expect(
      progressMessage({
        ...base,
        status: 'picked_up',
        responder,
        hospital: { name: 'City Hospital', phone: null, lat: 0, lng: 0 },
      }),
    ).toEqual({
      key: 'sos.progress.pickedUp',
      params: { hospital: 'City Hospital' },
    });
  });

  it('is honest when nobody is available', () => {
    expect(progressMessage({ ...base, status: 'no_responder' })).toEqual({
      key: 'sos.progress.noResponder',
    });
  });
});

describe('helpers', () => {
  it('rounds ETAs to at least 1 minute', () => {
    expect(etaMinutes(20)).toBe(1);
    expect(etaMinutes(400)).toBe(7);
    expect(etaMinutes(null)).toBeNull();
  });
  it('counts down the decision time', () => {
    expect(secondsLeft('2026-11-10T10:00:25Z', new Date('2026-11-10T10:00:00Z').getTime())).toBe(
      25,
    );
    expect(secondsLeft('2026-11-10T10:00:25Z', new Date('2026-11-10T10:01:00Z').getTime())).toBe(0);
  });
  it('builds navigation links', () => {
    expect(navigationUrl(12.97, 77.59, 'android')).toBe('google.navigation:q=12.970000,77.590000');
    expect(navigationUrl(12.97, 77.59, 'ios')).toContain('travelmode=driving');
  });
  it('maps server errors without showing raw text', () => {
    expect(sosErrorCode('rate_limited')).toBe('rate_limited');
    expect(sosErrorCode('ERROR: outside_karnataka')).toBe('outside_karnataka');
    expect(sosErrorCode('TypeError: Failed to fetch')).toBe('network');
    expect(sosErrorCode('something else')).toBe('failed');
  });
});
