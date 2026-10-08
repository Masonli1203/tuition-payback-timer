import { configurationRecord, decodeConfiguration, storageKey } from './configuration.mjs';

export function createPersistence({ localStorage, invoke } = {}) {
  return {
    desktop: !!invoke,
    async load() {
      const text = invoke ? await invoke('load_configuration') : (localStorage ?? globalThis.localStorage).getItem(storageKey);
      return text == null ? null : decodeConfiguration(text);
    },
    async save(semester) {
      const record = configurationRecord(semester);
      const text = JSON.stringify(record);
      if (invoke) await invoke('save_configuration', { text });
      else (localStorage ?? globalThis.localStorage).setItem(storageKey, text);
      return record.semester;
    },
    async exportFile(text, filename) {
      if (invoke) return invoke('export_configuration', { text, filename });
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    },
  };
}
