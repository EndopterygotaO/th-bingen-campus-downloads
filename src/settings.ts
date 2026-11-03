import { t, getLanguage, localizeText, applyLanguage, setLanguage } from './i18n.mjs';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { version } from '../package.json';

interface UpdateInfo { available: boolean; version: string; current: string }
interface InstallResult { needsPermission?: boolean }
const updater = registerPlugin<{
  check(): Promise<UpdateInfo>;
  install(): Promise<InstallResult>;
}>('CampusUpdater');

export function initSettings() {
  const dialog = document.getElementById('settings-panel') as HTMLDialogElement;
  const language = document.getElementById('language') as HTMLSelectElement;
  language.value = getLanguage();
  language.addEventListener('change', () => {
    if (!setLanguage(language.value)) return;
    applyLanguage(); refreshVersion();
    ready = false; status.textContent = ''; button.textContent = t(t("Update suchen"));
    window.dispatchEvent(new Event('campus-language-change'));
  });
  const theme = document.getElementById('theme') as HTMLSelectElement;
  const button = document.getElementById('update') as HTMLButtonElement;
  const status = document.getElementById('update-status')!;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  let ready = false;
  try { preference = localStorage.getItem('campus-theme') || 'system'; } catch { /* optional */ }
  if (!['system', 'light', 'dark'].includes(preference)) preference = 'system';
  theme.value = preference;
  const applyTheme = () => {
    const dark = preference === 'dark' || (preference === 'system' && system.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.classList.toggle('calcite-mode-dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111d1a' : '#173e37');
  };
  applyTheme(); system.addEventListener('change', applyTheme);
  theme.addEventListener('change', () => {
    preference = theme.value;
    try { localStorage.setItem('campus-theme', preference); } catch { /* optional */ }
    applyTheme();
  });
  document.getElementById('settings-open')!.addEventListener('click', () => dialog.showModal());
  document.getElementById('settings-close')!.addEventListener('click', () => dialog.close());
  let installedVersion = version;
  const refreshVersion = () => { document.getElementById('app-version')!.textContent = t('Installierte Version: {version}', {version:installedVersion}); };
  refreshVersion();
  if (Capacitor.isNativePlatform()) {
    void App.getInfo().then(info => { installedVersion = info.version; refreshVersion(); }).catch(() => {});
  }
  button.addEventListener('click', () => {
    if (!Capacitor.isNativePlatform()) {
      void Browser.open({ url: 'https://github.com/EndopterygotaO/th-bingen-campus-downloads/releases/latest' });
      return;
    }
    button.disabled = true;
    void (async () => {
      if (!ready) {
        status.textContent = t("Aktuelle Version wird geprüft …");
        const info = await updater.check();
        ready = info.available;
        status.textContent = ready ? t('Version {version} ist verfügbar.', {version:info.version}) : t("Du hast bereits die aktuelle Version.");
        button.textContent = ready ? t("Update herunterladen und installieren") : t("Erneut prüfen");
      } else {
        status.textContent = t("Update wird heruntergeladen und geprüft. Bitte die App geöffnet lassen …");
        const result = await updater.install();
        status.textContent = result.needsPermission
          ? t("Bitte Installationen aus „Campus finden“ erlauben. Danach hier „Installation fortsetzen“ antippen.")
          : t("Bitte die Installation im Android-Dialog bestätigen.");
        button.textContent = result.needsPermission ? t("Installation fortsetzen") : t("Installation erneut öffnen");
      }
    })().catch(error => { status.textContent = t('Update fehlgeschlagen: {error}. Bitte erneut versuchen.', {error:error.message || error}); })
      .finally(() => { button.disabled = false; });
  });
}
