import { parseValue } from './core.mjs';

export const preferenceKey = 'tuition-payback.preferences.v1';
export const languages = [
  { code: 'en-US', name: 'English', short: 'English' },
  { code: 'zh-CN', name: '简体中文', short: '中文' },
  { code: 'ja-JP', name: '日本語', short: '日本語' },
  { code: 'zh-TW', name: '繁體中文', short: '繁中' },
  { code: 'ko-KR', name: '한국어', short: '한국어' },
  { code: 'es-ES', name: 'Español', short: 'Español' },
];
export const currencies = ['USD', 'CNY', 'JPY', 'EUR', 'GBP', 'HKD', 'TWD', 'KRW', 'CAD', 'AUD', 'SGD', 'CHF'];
export const defaultPreferences = { language: 'en-US', currency: 'USD' };

export function validatePreferences(value) {
  if (!value || !languages.some(language => language.code === value.language) || !currencies.includes(value.currency)) {
    throw new Error('语言或货币设置无效，请重新选择。');
  }
  return { language: value.language, currency: value.currency };
}

export function decodePreferences(text) {
  const record = JSON.parse(text);
  if (record?.version !== 1) throw new Error('语言与货币设置版本不受支持，原文件保留。');
  return validatePreferences(record);
}

export function parseTuition(value, language) {
  // Spanish decimal commas are accepted without treating grouping as decimals.
  // The core parser still rejects grouped or ambiguous amounts.
  return parseValue(language === 'es-ES' ? String(value).replace(',', '.') : value);
}

export function createPreferencePersistence({ localStorage, invoke } = {}) {
  return {
    async load() {
      const text = invoke ? await invoke('load_preferences') : (localStorage ?? globalThis.localStorage).getItem(preferenceKey);
      return text == null ? null : decodePreferences(text);
    },
    async save(value) {
      const preferences = validatePreferences(value);
      const text = JSON.stringify({ version: 1, ...preferences });
      if (invoke) await invoke('save_preferences', { text });
      else (localStorage ?? globalThis.localStorage).setItem(preferenceKey, text);
      return preferences;
    },
  };
}

export function createMoneyFormatters({ language, currency }) {
  // The calculator retains hundredths for every unit, including JPY and KRW,
  // so the per-second recovery remains visible and stored tuition stays exact.
  const money = new Intl.NumberFormat(language, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sample = money.formatToParts(0);
  const rateFormat = new Intl.NumberFormat(language, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const smallRateFormat = new Intl.NumberFormat(language, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumSignificantDigits: 4, maximumSignificantDigits: 4 });
  return {
    money,
    symbol: sample.find(part => part.type === 'currency').value,
    decimal: sample.find(part => part.type === 'decimal').value,
    digits: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }),
    rate: value => (value >= 0.0001 ? rateFormat : smallRateFormat).format(value),
  };
}
