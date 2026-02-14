/**
 * Main Application Module
 * Handles UI interactions and app state
 */

(function() {
    'use strict';

    // State
    let currentScreen = 'home';
    let studyQueue = [];
    let currentCardIndex = 0;
    let reviewedCount = 0;
    let lastAction = null; // For undo functionality
    let isDarkMode = false;
    let isPracticeMode = false; // Practice mode doesn't affect scheduling

    // DOM Elements
    const screens = {
        home: document.getElementById('home-screen'),
        study: document.getElementById('study-screen'),
        complete: document.getElementById('complete-screen'),
        import: document.getElementById('import-screen'),
        manage: document.getElementById('manage-screen'),
        settings: document.getElementById('settings-screen')
    };

    // Home screen elements
    const dueCountEl = document.getElementById('due-count');
    const totalCountEl = document.getElementById('total-count');
    const studyBtn = document.getElementById('study-btn');
    const practiceBtn = document.getElementById('practice-btn');
    const importBtn = document.getElementById('import-btn');
    const manageBtn = document.getElementById('manage-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // Manage screen elements
    const manageBackBtn = document.getElementById('manage-back-btn');
    const cardList = document.getElementById('card-list');
    const emptyState = document.getElementById('empty-state');

    // Study screen elements
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const flashcard = document.getElementById('flashcard');
    const cardFront = document.getElementById('card-front');
    const cardBack = document.getElementById('card-back');
    const tapHint = document.getElementById('tap-hint');
    const reviewButtons = document.getElementById('review-buttons');
    const goodHint = document.getElementById('good-hint');
    const easyHint = document.getElementById('easy-hint');
    const undoBtn = document.getElementById('undo-btn');
    const endStudyBtn = document.getElementById('end-study-btn');

    // Complete screen elements
    const completeStats = document.getElementById('complete-stats');
    const backHomeBtn = document.getElementById('back-home-btn');

    // Import screen elements
    const importBackBtn = document.getElementById('import-back-btn');
    const importTextarea = document.getElementById('import-textarea');
    const importPreview = document.getElementById('import-preview');
    const importSubmitBtn = document.getElementById('import-submit-btn');

    // Settings screen elements
    const settingsBackBtn = document.getElementById('settings-back-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const exportBtn = document.getElementById('export-btn');
    const importBackupBtn = document.getElementById('import-backup-btn');
    const backupFileInput = document.getElementById('backup-file-input');
    const deleteAllBtn = document.getElementById('delete-all-btn');

    // Toast element
    const toast = document.getElementById('toast');

    /**
     * Show a screen, hide others
     * @param {string} screenName - Screen to show
     */
    function showScreen(screenName) {
        Object.keys(screens).forEach(name => {
            screens[name].classList.remove('active');
        });
        screens[screenName].classList.add('active');
        currentScreen = screenName;
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in ms (default 3000)
     */
    function showToast(message, duration = 3000) {
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    /**
     * Update home screen stats
     */
    async function updateStats() {
        const [dueCount, totalCount] = await Promise.all([
            CardDB.getDueCount(),
            CardDB.getTotalCount()
        ]);

        dueCountEl.textContent = dueCount;
        totalCountEl.textContent = totalCount;

        // Disable study button if no due cards
        studyBtn.disabled = dueCount === 0;
        // Disable practice/manage buttons if no cards at all
        practiceBtn.disabled = totalCount === 0;
        manageBtn.disabled = totalCount === 0;
    }

    /**
     * Start a study session (due cards only)
     */
    async function startStudy() {
        isPracticeMode = false;
        const dueCards = await CardDB.getDueCards();

        if (dueCards.length === 0) {
            showToast('No cards due for review!');
            return;
        }

        // Sort cards for review
        studyQueue = SM2.sortCardsForReview(dueCards);
        currentCardIndex = 0;
        reviewedCount = 0;
        lastAction = null;
        undoBtn.disabled = true;

        showScreen('study');
        showCard();
    }

    /**
     * Start a practice session (all cards, no schedule updates)
     */
    async function startPractice() {
        isPracticeMode = true;
        const allCards = await CardDB.getAllCards();

        if (allCards.length === 0) {
            showToast('No cards to practice!');
            return;
        }

        // Shuffle cards for practice
        studyQueue = shuffleArray([...allCards]);
        currentCardIndex = 0;
        reviewedCount = 0;
        lastAction = null;
        undoBtn.disabled = true;

        showScreen('study');
        showCard();
    }

    /**
     * Shuffle an array (Fisher-Yates)
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Display current card
     */
    function showCard() {
        if (currentCardIndex >= studyQueue.length) {
            endStudy();
            return;
        }

        const card = studyQueue[currentCardIndex];

        // Update progress
        const progress = Math.round((currentCardIndex / studyQueue.length) * 100);
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${currentCardIndex} / ${studyQueue.length}`;

        // Show front, hide back
        cardFront.textContent = card.front;
        cardBack.textContent = card.back;
        cardBack.classList.add('hidden');
        tapHint.classList.remove('hidden');
        reviewButtons.classList.add('hidden');

        // Update interval hints (only show in study mode)
        if (isPracticeMode) {
            goodHint.textContent = '';
            easyHint.textContent = '';
            undoBtn.style.visibility = 'hidden';
        } else {
            goodHint.textContent = SM2.getIntervalHint(card, 3);
            easyHint.textContent = SM2.getIntervalHint(card, 5);
            undoBtn.style.visibility = 'visible';
        }
    }

    /**
     * Reveal the back of the card
     */
    function revealCard() {
        cardBack.classList.remove('hidden');
        tapHint.classList.add('hidden');
        reviewButtons.classList.remove('hidden');
    }

    /**
     * Handle review button click
     * @param {number} quality - SM-2 quality rating (0, 3, or 5)
     */
    async function handleReview(quality) {
        const card = studyQueue[currentCardIndex];

        // Save for undo (only in study mode, not practice)
        if (!isPracticeMode) {
            lastAction = {
                card: { ...card },
                index: currentCardIndex,
                wasInQueue: true
            };
            undoBtn.disabled = false;
        }

        // In practice mode, just move through cards without updating schedule
        if (isPracticeMode) {
            if (quality === 0) {
                // Move card to end for another try
                const failedCard = studyQueue.splice(currentCardIndex, 1)[0];
                studyQueue.push(failedCard);
            } else {
                reviewedCount++;
                currentCardIndex++;
            }
            showCard();
            return;
        }

        // Study mode: Calculate and save next review
        const updated = SM2.calculateNextReview(card, quality);
        await CardDB.updateCard(card.id, updated);

        // If "Again" (quality 0), card stays in queue at end
        if (quality === 0) {
            // Update card in queue with new values
            studyQueue[currentCardIndex] = updated;
            // Move to end of queue
            const failedCard = studyQueue.splice(currentCardIndex, 1)[0];
            studyQueue.push(failedCard);
            // Don't increment index (next card is now at same index)
        } else {
            // Card is done, move to next
            reviewedCount++;
            currentCardIndex++;
        }

        showCard();
    }

    /**
     * Undo last review action
     */
    async function undoLastAction() {
        if (!lastAction || isPracticeMode) return;

        const { card, index } = lastAction;

        // Restore card to database
        await CardDB.updateCard(card.id, card);

        // Restore queue state
        if (lastAction.wasInQueue) {
            // Remove any duplicate of this card that might be at end
            studyQueue = studyQueue.filter(c => c.id !== card.id);
            // Insert back at original position
            studyQueue.splice(index, 0, card);
            currentCardIndex = index;
            if (reviewedCount > 0) reviewedCount--;
        }

        lastAction = null;
        undoBtn.disabled = true;

        showCard();
        showToast('Undone');
    }

    /**
     * End study session
     */
    function endStudy() {
        const modeText = isPracticeMode ? 'practiced' : 'reviewed';
        completeStats.textContent = `You ${modeText} ${reviewedCount} card${reviewedCount !== 1 ? 's' : ''}.`;
        showScreen('complete');
    }

    /**
     * Render the card list in manage screen
     */
    async function renderCardList() {
        const cards = await CardDB.getAllCards();
        const collator = new Intl.Collator('pl', { sensitivity: 'base' });

        // Sort cards alphabetically by front
        cards.sort((a, b) => collator.compare(a.front, b.front));

        if (cards.length === 0) {
            cardList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        cardList.classList.remove('hidden');
        emptyState.classList.add('hidden');

        cardList.innerHTML = cards.map(card => `
            <div class="card-item" data-id="${card.id}">
                <div class="card-item-content">
                    <div class="card-item-front">${escapeHtml(card.front)}</div>
                    <div class="card-item-back">${escapeHtml(card.back)}</div>
                </div>
                <button class="card-item-delete" aria-label="Delete card">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Delete a single card
     */
    async function deleteCard(id) {
        if (!confirm('Delete this card?')) {
            return;
        }

        try {
            await CardDB.deleteCard(id);
            await renderCardList();
            await updateStats();
            showToast('Card deleted');
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Error deleting card');
        }
    }

    /**
     * Handle import text input
     */
    function handleImportInput() {
        const text = importTextarea.value;
        const count = ImportParser.countValidCards(text);

        importPreview.textContent = count > 0
            ? `${count} card${count !== 1 ? 's' : ''} ready`
            : '';
        importSubmitBtn.disabled = count === 0;
    }

    /**
     * Submit import
     */
    async function submitImport() {
        const text = importTextarea.value;
        const cards = ImportParser.importFromText(text);

        if (cards.length === 0) {
            showToast('No valid cards to import');
            return;
        }

        try {
            await CardDB.addCards(cards);
            showToast(`Imported ${cards.length} card${cards.length !== 1 ? 's' : ''}`);
            importTextarea.value = '';
            handleImportInput();
            await updateStats();
            showScreen('home');
        } catch (error) {
            console.error('Import error:', error);
            showToast('Error importing cards');
        }
    }

    /**
     * Export data to JSON file
     */
    async function exportData() {
        try {
            const json = await CardDB.exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `kapanak-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Backup exported');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Error exporting data');
        }
    }

    /**
     * Import backup from file
     * @param {File} file - JSON file to import
     */
    async function importBackup(file) {
        try {
            const text = await file.text();
            const count = await CardDB.importData(text);
            await updateStats();
            showToast(`Restored ${count} card${count !== 1 ? 's' : ''}`);
        } catch (error) {
            console.error('Import backup error:', error);
            showToast('Error restoring backup');
        }
    }

    /**
     * Delete all data
     */
    async function deleteAllData() {
        if (!confirm('Are you sure you want to delete ALL cards? This cannot be undone.')) {
            return;
        }

        try {
            await CardDB.deleteAllCards();
            await updateStats();
            showToast('All data deleted');
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Error deleting data');
        }
    }

    /**
     * Toggle dark mode
     * @param {boolean} enabled - Whether dark mode should be enabled
     */
    function setDarkMode(enabled) {
        isDarkMode = enabled;
        document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
        localStorage.setItem('kapanak-dark-mode', enabled);
        darkModeToggle.checked = enabled;
    }

    /**
     * Load saved preferences
     */
    function loadPreferences() {
        // Check system preference first, then stored preference
        const stored = localStorage.getItem('kapanak-dark-mode');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (stored !== null) {
            setDarkMode(stored === 'true');
        } else {
            setDarkMode(systemDark);
        }
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event
     */
    function handleKeyboard(event) {
        // Only handle in study screen
        if (currentScreen !== 'study') return;

        // Prevent shortcuts when typing in input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

        const key = event.key.toLowerCase();

        // Space or Enter to reveal
        if ((key === ' ' || key === 'enter') && cardBack.classList.contains('hidden')) {
            event.preventDefault();
            revealCard();
            return;
        }

        // Review shortcuts (only when card is revealed)
        if (!cardBack.classList.contains('hidden')) {
            if (key === '1' || key === 'a') {
                event.preventDefault();
                handleReview(0); // Again
            } else if (key === '2' || key === 'g') {
                event.preventDefault();
                handleReview(3); // Good
            } else if (key === '3' || key === 'e') {
                event.preventDefault();
                handleReview(5); // Easy
            }
        }

        // Undo with Ctrl+Z or Cmd+Z
        if ((event.ctrlKey || event.metaKey) && key === 'z') {
            event.preventDefault();
            undoLastAction();
        }
    }

    /**
     * Register Service Worker
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered:', registration.scope);
                })
                .catch((error) => {
                    console.error('SW registration failed:', error);
                });
        }
    }

    /**
     * Initialize event listeners
     */
    function initEventListeners() {
        // Home screen
        studyBtn.addEventListener('click', startStudy);
        practiceBtn.addEventListener('click', startPractice);
        importBtn.addEventListener('click', () => showScreen('import'));
        manageBtn.addEventListener('click', async () => {
            await renderCardList();
            showScreen('manage');
        });
        settingsBtn.addEventListener('click', () => showScreen('settings'));

        // Study screen
        flashcard.addEventListener('click', () => {
            if (cardBack.classList.contains('hidden')) {
                revealCard();
            }
        });

        document.querySelectorAll('.review-buttons .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const rating = parseInt(btn.dataset.rating, 10);
                handleReview(rating);
            });
        });

        undoBtn.addEventListener('click', undoLastAction);
        endStudyBtn.addEventListener('click', () => {
            if (confirm('End study session?')) {
                endStudy();
            }
        });

        // Complete screen
        backHomeBtn.addEventListener('click', async () => {
            await updateStats();
            showScreen('home');
        });

        // Manage screen
        manageBackBtn.addEventListener('click', async () => {
            await updateStats();
            showScreen('home');
        });
        cardList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.card-item-delete');
            if (deleteBtn) {
                const cardItem = deleteBtn.closest('.card-item');
                if (cardItem) {
                    deleteCard(cardItem.dataset.id);
                }
            }
        });

        // Import screen
        importBackBtn.addEventListener('click', () => showScreen('home'));
        importTextarea.addEventListener('input', handleImportInput);
        importSubmitBtn.addEventListener('click', submitImport);

        // Settings screen
        settingsBackBtn.addEventListener('click', async () => {
            await updateStats();
            showScreen('home');
        });

        darkModeToggle.addEventListener('change', (e) => {
            setDarkMode(e.target.checked);
        });

        exportBtn.addEventListener('click', exportData);

        importBackupBtn.addEventListener('click', () => {
            backupFileInput.click();
        });

        backupFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importBackup(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });

        deleteAllBtn.addEventListener('click', deleteAllData);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // System dark mode changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't set a preference
            if (localStorage.getItem('kapanak-dark-mode') === null) {
                setDarkMode(e.matches);
            }
        });
    }

    /**
     * Initialize app
     */
    async function init() {
        loadPreferences();
        initEventListeners();
        registerServiceWorker();
        await updateStats();
        showScreen('home');

        console.log('Kapanak initialized');
    }

    // Start app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
