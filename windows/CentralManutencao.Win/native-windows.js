(() => {
  'use strict';

  if (!window.chrome?.webview) return;

  const ENABLED_KEY = 'central_native_windows_notifications';
  const SEEN_KEY = 'central_native_windows_seen_v1';
  const MAX_SEEN = 500;

  window.__CENTRAL_WINDOWS_NATIVE__ = true;

  const post = message => {
    try {
      window.chrome.webview.postMessage(message);
      return true;
    } catch {
      return false;
    }
  };

  const isEnabled = () => localStorage.getItem(ENABLED_KEY) === '1';

  const loadSeen = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set();
    }
  };

  const saveSeen = seen => {
    const values = [...seen].slice(-MAX_SEEN);
    localStorage.setItem(SEEN_KEY, JSON.stringify(values));
  };

  const seedCurrentNotifications = async () => {
    if (typeof window.ownNotifications !== 'function') return;
    const rows = await window.ownNotifications(100);
    const seen = loadSeen();
    rows.forEach(row => row?.id && seen.add(String(row.id)));
    saveSeen(seen);
  };

  window.activatePushOnThisDevice = async function activateNativeWindowsNotifications() {
    if (!navigator.onLine) throw new Error('Conecte-se à internet para ativar as notificações.');

    localStorage.setItem(ENABLED_KEY, '1');

    if (typeof window.persistPushPreferences === 'function') {
      await window.persistPushPreferences({ enabled: true });
    }

    await seedCurrentNotifications();
    post({ type: 'notifications-state', enabled: true });
    return { endpoint: 'native-windows://central-manutencao' };
  };

  window.deactivatePushOnThisDevice = async function deactivateNativeWindowsNotifications() {
    localStorage.removeItem(ENABLED_KEY);
    post({ type: 'notifications-state', enabled: false });
    return true;
  };

  window.refreshPushDeviceCard = async function refreshNativeWindowsDeviceCard() {
    const button = document.getElementById('push-device-toggle');
    const help = document.getElementById('push-device-help');
    if (!button) return;

    const active = isEnabled();
    button.dataset.active = active ? 'true' : 'false';
    button.disabled = false;
    button.textContent = active ? 'Desativar neste dispositivo' : 'Ativar neste dispositivo';

    if (help) {
      help.textContent = active
        ? 'Notificações do Windows ativas neste dispositivo.'
        : 'Ative para receber avisos do Windows enquanto a Central estiver em execução.';
      help.classList.toggle('hidden', !help.textContent);
    }
  };

  window.registerCentralServiceWorker = async () => null;
  window.reconcilePushRegistrationSilently = async () => {
    if (isEnabled()) await window.centralNativePollNow?.();
  };

  window.centralNativePollNow = async function centralNativePollNow() {
    if (!isEnabled() || !navigator.onLine || typeof window.ownNotifications !== 'function') return;

    try {
      const rows = await window.ownNotifications(60);
      const seen = loadSeen();
      const pending = rows
        .filter(row => row?.id && !row.read_at && !seen.has(String(row.id)))
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));

      for (const row of pending) {
        const id = String(row.id);

        const title = typeof window.notificationEventLabel === 'function'
          ? window.notificationEventLabel(row.event_type)
          : 'Central de Manutenção';
        const body = typeof window.notificationBodyText === 'function'
          ? window.notificationBodyText(row)
          : 'Há uma nova atualização na Central de Manutenção.';

        if (post({
          type: 'notify',
          id,
          reportId: row.report_id || null,
          title,
          body
        })) {
          seen.add(id);
          saveSeen(seen);
        }
      }
    } catch {
      // A Central continua operacional mesmo se uma consulta de notificação falhar.
    }
  };

  window.centralNativeOpenNotification = async function centralNativeOpenNotification(id) {
    if (!id || typeof window.ownNotifications !== 'function') return;

    try {
      const rows = await window.ownNotifications(100);
      const row = rows.find(item => String(item.id) === String(id));
      if (!row) return;

      if (!row.read_at && typeof window.markNotificationRead === 'function') {
        await window.markNotificationRead(row.id);
      }
      if (typeof window.updateNotificationBell === 'function') {
        await window.updateNotificationBell();
      }
      if (typeof window.openNotificationReport === 'function') {
        await window.openNotificationReport(row);
      }
    } catch {
      // O clique continua abrindo a Central mesmo sem deep link.
    }
  };

  const originalEnterApplication = window.enterApplication;
  if (typeof originalEnterApplication === 'function') {
    window.enterApplication = async function nativeEnterApplication(...args) {
      const result = await originalEnterApplication.apply(this, args);
      post({ type: 'native-ready' });
      if (isEnabled()) setTimeout(() => window.centralNativePollNow?.(), 500);
      return result;
    };
  }

  post({ type: 'bridge-loaded' });
})();
