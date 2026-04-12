/**
 * App entry point
 * Initialises all modules and wires up remaining global interactions.
 */
(function () {
    'use strict';

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(r => console.log('SW registered:', r.scope))
                .catch(e => console.error('SW failed:', e));
        }
    }

    async function init() {
        // Initialise modules (order matters — Stats/UI first)
        StatsModule.init();
        StudyModule.init();
        ManageModule.init();
        SettingsModule.init();
        NotebookModule.init();
        ImportModule.init();

        SettingsModule.loadPreferences();
        registerServiceWorker();
        await StatsModule.update();
        UI.showScreen('home');

        // Logo → home
        document.getElementById('logo-btn').addEventListener('click', async () => {
            await StatsModule.update();
            UI.showScreen('home');
        });

        // Home study buttons
        document.getElementById('study-btn').addEventListener('click', () => StudyModule.startStudy());
        document.getElementById('practice-btn').addEventListener('click', () => StudyModule.startPractice());
        document.getElementById('import-btn').addEventListener('click', () => UI.showScreen('import'));

        // Version
        document.getElementById('app-version').textContent = `Kapanak v${APP_VERSION}`;

        console.log('Kapanak initialised');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
