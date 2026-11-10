import type { Answers, Problem } from './types';

/**
 * Words that suggest an emergency, in English and Kannada. Matching is on lower-cased text;
 * Kannada is matched as written. Keep this list short, specific and reviewed by a doctor.
 */
const RED_FLAG_PHRASES: { phrase: string; reason: RedFlagReason }[] = [
  // chest / heart
  { phrase: 'chest pain', reason: 'chest' },
  { phrase: 'pain in chest', reason: 'chest' },
  { phrase: 'chest pressure', reason: 'chest' },
  { phrase: 'heart attack', reason: 'chest' },
  { phrase: 'ಎದೆ ನೋವು', reason: 'chest' },
  { phrase: 'ಎದೆನೋವು', reason: 'chest' },
  { phrase: 'ಹೃದಯಾಘಾತ', reason: 'chest' },
  // breathing
  { phrase: "can't breathe", reason: 'breathing' },
  { phrase: 'cant breathe', reason: 'breathing' },
  { phrase: 'cannot breathe', reason: 'breathing' },
  { phrase: 'not breathing', reason: 'breathing' },
  { phrase: 'difficulty breathing', reason: 'breathing' },
  { phrase: 'breathless', reason: 'breathing' },
  { phrase: 'choking', reason: 'breathing' },
  { phrase: 'ಉಸಿರಾಡಲು ಆಗುತ್ತಿಲ್ಲ', reason: 'breathing' },
  { phrase: 'ಉಸಿರಾಟದ ತೊಂದರೆ', reason: 'breathing' },
  { phrase: 'ಉಸಿರು ಕಟ್ಟು', reason: 'breathing' },
  // consciousness
  { phrase: 'unconscious', reason: 'unconscious' },
  { phrase: 'fainted', reason: 'unconscious' },
  { phrase: 'fainting', reason: 'unconscious' },
  { phrase: 'collapsed', reason: 'unconscious' },
  { phrase: 'not waking', reason: 'unconscious' },
  { phrase: 'not responding', reason: 'unconscious' },
  { phrase: 'ಪ್ರಜ್ಞೆ ತಪ್ಪಿ', reason: 'unconscious' },
  { phrase: 'ಪ್ರಜ್ಞೆ ಇಲ್ಲ', reason: 'unconscious' },
  { phrase: 'ಮೂರ್ಛೆ', reason: 'unconscious' },
  // stroke
  { phrase: 'stroke', reason: 'stroke' },
  { phrase: 'face drooping', reason: 'stroke' },
  { phrase: 'slurred speech', reason: 'stroke' },
  { phrase: 'one side weak', reason: 'stroke' },
  { phrase: 'paralysis', reason: 'stroke' },
  { phrase: 'ಪಾರ್ಶ್ವವಾಯು', reason: 'stroke' },
  { phrase: 'ಲಕ್ವ', reason: 'stroke' },
  // bleeding / injury
  { phrase: 'bleeding a lot', reason: 'bleeding' },
  { phrase: 'heavy bleeding', reason: 'bleeding' },
  { phrase: 'severe bleeding', reason: 'bleeding' },
  { phrase: "won't stop bleeding", reason: 'bleeding' },
  { phrase: 'vomiting blood', reason: 'bleeding' },
  { phrase: 'ತುಂಬಾ ರಕ್ತ', reason: 'bleeding' },
  { phrase: 'ರಕ್ತಸ್ರಾವ', reason: 'bleeding' },
  { phrase: 'ರಕ್ತ ವಾಂತಿ', reason: 'bleeding' },
  { phrase: 'accident', reason: 'injury' },
  { phrase: 'head injury', reason: 'injury' },
  { phrase: 'fracture', reason: 'injury' },
  { phrase: 'ಅಪಘಾತ', reason: 'injury' },
  { phrase: 'ತಲೆಗೆ ಪೆಟ್ಟು', reason: 'injury' },
  // fits, poisoning, burns
  { phrase: 'seizure', reason: 'seizure' },
  { phrase: 'convulsion', reason: 'seizure' },
  { phrase: 'fits', reason: 'seizure' },
  { phrase: 'ಫಿಟ್ಸ್', reason: 'seizure' },
  { phrase: 'ಸೆಳವು', reason: 'seizure' },
  { phrase: 'ಮೂರ್ಛೆ ರೋಗ', reason: 'seizure' },
  { phrase: 'poison', reason: 'poisoning' },
  { phrase: 'snake bite', reason: 'poisoning' },
  { phrase: 'snakebite', reason: 'poisoning' },
  { phrase: 'overdose', reason: 'poisoning' },
  { phrase: 'ವಿಷ', reason: 'poisoning' },
  { phrase: 'ಹಾವು ಕಚ್ಚ', reason: 'poisoning' },
  { phrase: 'severe burn', reason: 'burns' },
  { phrase: 'ಸುಟ್ಟ ಗಾಯ', reason: 'burns' },
  // self-harm: show emergency help AND the mental-health helpline
  { phrase: 'suicide', reason: 'self_harm' },
  { phrase: 'kill myself', reason: 'self_harm' },
  { phrase: 'end my life', reason: 'self_harm' },
  { phrase: 'want to die', reason: 'self_harm' },
  { phrase: 'ಆತ್ಮಹತ್ಯೆ', reason: 'self_harm' },
  { phrase: 'ಸಾಯಬೇಕು', reason: 'self_harm' },
];

const DROWSY = ['drowsy', 'very sleepy', 'not waking', 'lethargic', 'ಮಂಪರು', 'ಎಚ್ಚರವಾಗುತ್ತಿಲ್ಲ'];
const FEVER = ['fever', 'high temperature', 'ಜ್ವರ'];

export type RedFlagReason =
  | 'chest'
  | 'breathing'
  | 'unconscious'
  | 'stroke'
  | 'bleeding'
  | 'injury'
  | 'seizure'
  | 'poisoning'
  | 'burns'
  | 'self_harm'
  | 'child_fever'
  | 'picked';

export type RedFlagResult = { emergency: false } | { emergency: true; reasons: RedFlagReason[] };

/** Words match on word boundaries for short English words ("fits" must not match "benefits"). */
function containsPhrase(text: string, phrase: string): boolean {
  if (/^[a-z' ]+$/.test(phrase)) {
    return new RegExp(`(^|[^a-z])${phrase.replace(/'/g, "'?")}([^a-z]|$)`).test(text);
  }
  return text.includes(phrase);
}

/**
 * PURE: runs FIRST, before any doctor search. Checks the picked problems, the follow-up
 * answers and the person's own words. When unsure, it errs towards "emergency".
 */
export function checkRedFlags(
  picked: Pick<Problem, 'code' | 'is_red_flag'>[],
  description: string,
  answers: Answers,
): RedFlagResult {
  const reasons = new Set<RedFlagReason>();
  if (picked.some((p) => p.is_red_flag)) reasons.add('picked');

  const text = description.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ');
  for (const { phrase, reason } of RED_FLAG_PHRASES) {
    if (containsPhrase(text, phrase)) reasons.add(reason);
  }

  const child = answers.patientGroup === 'child';
  const fever =
    picked.some((p) => p.code === 'fever_cold' || p.code === 'child_unwell') ||
    FEVER.some((w) => text.includes(w));
  const drowsy = DROWSY.some((w) => containsPhrase(text, w));
  if (child && fever && (drowsy || answers.severity === 'severe')) reasons.add('child_fever');

  return reasons.size > 0 ? { emergency: true, reasons: [...reasons] } : { emergency: false };
}
