import { en } from './en';
import { ta } from './ta';

export type Language = 'en' | 'ta';

export const translations = {
  en,
  ta,
};

export const languages: Array<{ code: Language; name: string; nativeName: string }> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
];

export { en, ta };
