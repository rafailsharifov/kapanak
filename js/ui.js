/**
 * Shared UI utilities and application state
 * All modules read/write state through this object.
 */
window.UI = (function () {
    'use strict';

    let currentScreen = 'home';
    let isDarkMode = false;
    let isSwapped = false;

    const toast = document.getElementById('toast');

    function showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(name + '-screen').classList.add('active');
        currentScreen = name;
    }

    function showToast(message, duration = 3000) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        showScreen,
        showToast,
        escapeHtml,
        getScreen: () => currentScreen,
        getSwapped: () => isSwapped,
        setSwapped: (v) => { isSwapped = v; },
        getDarkMode: () => isDarkMode,
        setDarkMode: (v) => { isDarkMode = v; },
    };
})();
