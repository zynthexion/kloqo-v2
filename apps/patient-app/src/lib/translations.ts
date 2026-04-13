import en from '../translations/en.json';
import ml from '../translations/ml.json';

export const translations = {
  en,
  ml
} as const;

export type TranslationType = typeof translations.en;
