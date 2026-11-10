import type { SpecialityWeights } from '@/features/doctors/types';

/** All weights live here (PROJECT.md "Doctor recommendation"). They must add up to 1. */
export const DOCTOR_RANKING = {
  weights: {
    speciality: 0.3,
    availability: 0.2,
    proximity: 0.2,
    rating: 0.15,
    experience: 0.1,
    language: 0.05,
  },
  bayesC: 10, // a doctor needs ~10 reviews before their own average dominates
  maxExperienceYears: 20,
  availabilityDays: 7, // a slot today = 1, falling to 0 at 7 days
  top: 20,
  bestMatch: 3,
} as const;

export type DoctorCandidate = {
  doctor_id: string;
  name: string;
  specialities: string[];
  years_experience: number;
  languages: string[];
  fee: number;
  rating_sum: number;
  rating_count: number;
  distance_m: number;
  next_slot_at: string; // ISO time
  mean_rating: number; // average across all doctors
};

export type ReasonPart =
  | { kind: 'speciality'; code: string }
  | { kind: 'slot'; days: number }
  | { kind: 'distance'; meters: number }
  | { kind: 'language'; language: string }
  | { kind: 'rating'; value: number; count: number };

export type RankedDoctor<T extends DoctorCandidate = DoctorCandidate> = T & {
  score: number;
  parts: Record<keyof typeof DOCTOR_RANKING.weights, number>;
  bestMatch: boolean;
  reasons: ReasonPart[];
  bayesRating: number;
};

const DAY_MS = 86400000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60000;

/** Whole days between today and the slot's day, both in India time. */
export function daysUntil(slotIso: string, now: Date): number {
  const day = (t: number) => Math.floor((t + IST_OFFSET_MS) / DAY_MS);
  return Math.max(0, day(new Date(slotIso).getTime()) - day(now.getTime()));
}

export function bayesianRating(
  sum: number,
  count: number,
  mean: number,
  c: number = DOCTOR_RANKING.bayesC,
): number {
  return (c * mean + sum) / (c + count);
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/**
 * PURE: score and rank doctors. Filters (fee, gender, language, government/private) are applied
 * before this, on the server. Paid promotion never changes the score.
 */
export function rankDoctors<T extends DoctorCandidate>(
  candidates: T[],
  weights: SpecialityWeights,
  ctx: { radiusM: number; language: string; now: Date },
): RankedDoctor<T>[] {
  const W = DOCTOR_RANKING.weights;
  const scored = candidates.map((c) => {
    const bestCode = c.specialities.reduce<{ code: string; w: number }>(
      (best, code) => ((weights[code] ?? 0) > best.w ? { code, w: weights[code] ?? 0 } : best),
      { code: c.specialities[0] ?? '', w: 0 },
    );
    const days = daysUntil(c.next_slot_at, ctx.now);
    const bayes = bayesianRating(c.rating_sum, c.rating_count, c.mean_rating);
    const speaks = c.languages.includes(ctx.language);
    const parts = {
      speciality: clamp(bestCode.w),
      availability: clamp(1 - days / DOCTOR_RANKING.availabilityDays),
      proximity: clamp(1 - c.distance_m / ctx.radiusM),
      rating: clamp((bayes - 1) / 4),
      experience: clamp(
        Math.min(c.years_experience, DOCTOR_RANKING.maxExperienceYears) /
          DOCTOR_RANKING.maxExperienceYears,
      ),
      language: speaks ? 1 : 0,
    };
    const score =
      W.speciality * parts.speciality +
      W.availability * parts.availability +
      W.proximity * parts.proximity +
      W.rating * parts.rating +
      W.experience * parts.experience +
      W.language * parts.language;
    const reasons: ReasonPart[] = [
      { kind: 'speciality', code: bestCode.code },
      { kind: 'slot', days },
      { kind: 'distance', meters: c.distance_m },
    ];
    if (speaks) reasons.push({ kind: 'language', language: ctx.language });
    if (c.rating_count > 0)
      reasons.push({ kind: 'rating', value: Math.round(bayes * 10) / 10, count: c.rating_count });
    return { ...c, score, parts, reasons, bayesRating: bayes, bestMatch: false };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      new Date(a.next_slot_at).getTime() - new Date(b.next_slot_at).getTime() ||
      a.distance_m - b.distance_m ||
      a.doctor_id.localeCompare(b.doctor_id),
  );
  return (
    scored
      .slice(0, DOCTOR_RANKING.top)
      // "Best match" only for the top doctors who fully match the needed speciality —
      // a fallback (e.g. GP at 0.5 when a specialist was asked for) is listed but never labelled best.
      .reduce<RankedDoctor<T>[]>((out, d) => {
        const labelled = out.filter((x) => x.bestMatch).length;
        out.push({
          ...d,
          bestMatch: labelled < DOCTOR_RANKING.bestMatch && d.parts.speciality >= 1,
        });
        return out;
      }, [])
  );
}
