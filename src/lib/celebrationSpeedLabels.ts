/**
 * Localized labels for the Friendly Widget celebration speed control.
 *
 * Kept in a dedicated module (rather than the main translations.ts bundle)
 * so admin-only strings don't inflate the public-facing i18n payload.
 * Falls back to English when the requested language is not covered.
 */
export type CelebrationSpeed = 'slower' | 'normal' | 'faster';

export const CELEBRATION_SPEEDS: readonly CelebrationSpeed[] = ['slower', 'normal', 'faster'] as const;

export const DEFAULT_CELEBRATION_SPEED: CelebrationSpeed = 'normal';

type LabelPack = {
  label: string;
  slower: string;
  normal: string;
  faster: string;
  reset: string;
};

const packs: Record<string, LabelPack> = {
  en: { label: 'Speed',    slower: 'Slower',  normal: 'Normal',  faster: 'Faster',  reset: 'Reset to defaults' },
  ar: { label: 'السرعة',   slower: 'أبطأ',    normal: 'عادي',    faster: 'أسرع',    reset: 'استعادة الافتراضيات' },
  es: { label: 'Velocidad', slower: 'Más lento', normal: 'Normal', faster: 'Más rápido', reset: 'Restablecer' },
  fr: { label: 'Vitesse',  slower: 'Plus lent', normal: 'Normal', faster: 'Plus rapide', reset: 'Réinitialiser' },
  hi: { label: 'गति',      slower: 'धीमा',    normal: 'सामान्य', faster: 'तेज़',    reset: 'रीसेट करें' },
  de: { label: 'Geschwindigkeit', slower: 'Langsamer', normal: 'Normal', faster: 'Schneller', reset: 'Zurücksetzen' },
};

export function getCelebrationSpeedLabels(lang: string | undefined | null): LabelPack {
  if (!lang) return packs.en;
  return packs[lang] ?? packs.en;
}

/** Coerce arbitrary persisted values back to a valid enum member. */
export function normalizeCelebrationSpeed(value: unknown): CelebrationSpeed {
  return CELEBRATION_SPEEDS.includes(value as CelebrationSpeed)
    ? (value as CelebrationSpeed)
    : DEFAULT_CELEBRATION_SPEED;
}