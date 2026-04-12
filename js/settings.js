/**
 * Settings module
 * Preferences, data export/import, notifications, dark mode.
 */
window.SettingsModule = (function () {
    'use strict';

    let notificationsEnabled = false;

    let notificationToggle, notificationHint, darkModeToggle;
    let backupFileInput;

    function setDarkMode(enabled) {
        UI.setDarkMode(enabled);
        document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
        localStorage.setItem('kapanak-dark-mode', enabled);
        darkModeToggle.checked = enabled;
    }

    function setSwapMode(enabled) {
        UI.setSwapped(enabled);
        localStorage.setItem('kapanak-swap-mode', enabled);
        document.getElementById('swap-toggle').checked = enabled;
        document.getElementById('swap-label').textContent = enabled ? 'Back → Front' : 'Front → Back';
    }

    async function setNotifications(enabled) {
        if (enabled) {
            if (!('Notification' in window)) {
                UI.showToast('Notifications not supported');
                notificationToggle.checked = false;
                return;
            }
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') {
                UI.showToast('Notification permission denied');
                notificationToggle.checked = false;
                return;
            }
            notificationsEnabled = true;
            localStorage.setItem('kapanak-notifications', 'true');
            notificationHint.textContent = 'Reminder enabled for 9:00 AM';
            localStorage.setItem('kapanak-reminder-time', '09:00');
        } else {
            notificationsEnabled = false;
            localStorage.setItem('kapanak-notifications', 'false');
            notificationHint.textContent = 'Get reminded to study every day';
        }
        notificationToggle.checked = notificationsEnabled;
    }

    function _checkNotification() {
        if (!notificationsEnabled) return;
        const today = new Date().toDateString();
        if (localStorage.getItem('kapanak-last-notification') === today) return;
        const now = new Date();
        if (now.getHours() >= 9) {
            const lastStudy = localStorage.getItem('kapanak-last-study');
            if (lastStudy !== today && Notification.permission === 'granted') {
                new Notification('🦋 Kapanak', { body: 'Time to review your flashcards!', icon: './icons/icon-192.png' });
                localStorage.setItem('kapanak-last-notification', today);
            }
        }
    }

    async function _exportData() {
        try {
            const json = await CardDB.exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `kapanak-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            UI.showToast('Backup exported');
        } catch (e) {
            UI.showToast('Error exporting data');
        }
    }

    async function _importBackup(file) {
        try {
            const text  = await file.text();
            const count = await CardDB.importData(text);
            await StatsModule.update();
            UI.showToast(`Restored ${count} card${count !== 1 ? 's' : ''}`);
        } catch (e) {
            UI.showToast('Error restoring backup');
        }
    }

    async function _deleteAll() {
        if (!confirm('Delete ALL cards? This cannot be undone.')) return;
        try {
            await CardDB.deleteAllCards();
            await StatsModule.update();
            UI.showToast('All data deleted');
        } catch (e) {
            UI.showToast('Error deleting data');
        }
    }

    function loadPreferences() {
        setSwapMode(localStorage.getItem('kapanak-swap-mode') === 'true');

        notificationsEnabled = localStorage.getItem('kapanak-notifications') === 'true';
        notificationToggle.checked = notificationsEnabled;
        if (notificationsEnabled) {
            notificationHint.textContent = 'Reminder enabled for 9:00 AM';
            _checkNotification();
        }

        const stored = localStorage.getItem('kapanak-dark-mode');
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDarkMode(stored !== null ? stored === 'true' : sysDark);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (localStorage.getItem('kapanak-dark-mode') === null) setDarkMode(e.matches);
        });
    }

    function init() {
        notificationToggle = document.getElementById('notification-toggle');
        notificationHint   = document.getElementById('notification-hint');
        darkModeToggle     = document.getElementById('dark-mode-toggle');
        backupFileInput    = document.getElementById('backup-file-input');

        document.getElementById('swap-toggle').addEventListener('change', e => setSwapMode(e.target.checked));
        notificationToggle.addEventListener('change', e => setNotifications(e.target.checked));
        darkModeToggle.addEventListener('change',     e => setDarkMode(e.target.checked));

        document.getElementById('export-btn').addEventListener('click', _exportData);
        document.getElementById('import-backup-btn').addEventListener('click', () => backupFileInput.click());
        backupFileInput.addEventListener('change', e => {
            if (e.target.files.length > 0) { _importBackup(e.target.files[0]); e.target.value = ''; }
        });
        document.getElementById('delete-all-btn').addEventListener('click', _deleteAll);

        document.getElementById('settings-btn').addEventListener('click', () => UI.showScreen('settings'));
        document.getElementById('settings-back-btn').addEventListener('click', async () => {
            await StatsModule.update();
            UI.showScreen('home');
        });
    }

    return { init, loadPreferences };
})();
