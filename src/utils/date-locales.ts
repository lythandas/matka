import { enUS, fr, de, es } from 'date-fns/locale';
import i18n from '@/i18n'; // Import the i18n instance

export const getDateFnsLocale = () => {
  const currentLanguage = i18n.language;
  switch (currentLanguage) {
    case 'fr':
      return fr;
    case 'de':
      return de;
    case 'es':
      return es;
    case 'en':
    default:
      return enUS;
  }
};