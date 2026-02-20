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
    let isSwapped = false; // Swap front↔back display
    let soundEnabled = false;
    let notificationsEnabled = false;

    // DOM Elements
    const screens = {
        home: document.getElementById('home-screen'),
        study: document.getElementById('study-screen'),
        complete: document.getElementById('complete-screen'),
        import: document.getElementById('import-screen'),
        manage: document.getElementById('manage-screen'),
        settings: document.getElementById('settings-screen')
    };

    // Header elements
    const logoBtn = document.getElementById('logo-btn');

    // Home screen elements
    const dueCountEl = document.getElementById('due-count');
    const totalCountEl = document.getElementById('total-count');
    const todayReviewedEl = document.getElementById('today-reviewed');
    const streakBanner = document.getElementById('streak-banner');
    const streakText = document.getElementById('streak-text');
    const masteredPercent = document.getElementById('mastered-percent');
    const masteryFill = document.getElementById('mastery-fill');
    const swapToggle = document.getElementById('swap-toggle');
    const swapLabel = document.getElementById('swap-label');
    const studyBtn = document.getElementById('study-btn');
    const practiceBtn = document.getElementById('practice-btn');
    const importBtn = document.getElementById('import-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // Manage screen elements
    const manageBtn = document.getElementById('manage-btn');
    const manageBackBtn = document.getElementById('manage-back-btn');
    const cardList = document.getElementById('card-list');
    const emptyState = document.getElementById('empty-state');

    // Edit modal elements
    const editModal = document.getElementById('edit-modal');
    const editCardId = document.getElementById('edit-card-id');
    const editFront = document.getElementById('edit-front');
    const editBack = document.getElementById('edit-back');
    const editCancelBtn = document.getElementById('edit-cancel-btn');
    const editSaveBtn = document.getElementById('edit-save-btn');

    // Study screen elements
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const flashcardContainer = document.getElementById('flashcard-container');
    const flashcard = document.getElementById('flashcard');
    const cardFront = document.getElementById('card-front');
    const cardBack = document.getElementById('card-back');
    const tapHint = document.getElementById('tap-hint');
    const reviewButtons = document.getElementById('review-buttons');
    const goodHint = document.getElementById('good-hint');
    const easyHint = document.getElementById('easy-hint');
    const undoBtn = document.getElementById('undo-btn');
    const endStudyBtn = document.getElementById('end-study-btn');

    // Swipe gesture state
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

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
    const soundToggle = document.getElementById('sound-toggle');
    const notificationToggle = document.getElementById('notification-toggle');
    const notificationHint = document.getElementById('notification-hint');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const confettiContainer = document.getElementById('confetti-container');
    const exportBtn = document.getElementById('export-btn');
    const importBackupBtn = document.getElementById('import-backup-btn');
    const backupFileInput = document.getElementById('backup-file-input');
    const deleteAllBtn = document.getElementById('delete-all-btn');

    // Toast element
    const toast = document.getElementById('toast');

    // Version element
    const appVersionEl = document.getElementById('app-version');

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
        const [dueCount, totalCount, allCards] = await Promise.all([
            CardDB.getDueCount(),
            CardDB.getTotalCount(),
            CardDB.getAllCards()
        ]);

        dueCountEl.textContent = dueCount;
        totalCountEl.textContent = totalCount;

        // Calculate mastered cards (cards with 3+ successful repetitions)
        const masteredCount = allCards.filter(c => c.repetitions >= 3).length;
        const masteredPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;
        masteredPercent.textContent = `${masteredCount} / ${totalCount}`;
        masteryFill.style.width = `${masteredPct}%`;

        // Get today's reviewed count from localStorage
        const today = new Date().toDateString();
        const storedDate = localStorage.getItem('kapanak-review-date');
        let todayCount = 0;
        if (storedDate === today) {
            todayCount = parseInt(localStorage.getItem('kapanak-today-count') || '0', 10);
        }
        todayReviewedEl.textContent = todayCount;

        // Update streak
        updateStreak();

        // Disable study button if no due cards
        studyBtn.disabled = dueCount === 0;
        // Disable practice button if no cards at all
        practiceBtn.disabled = totalCount === 0;
        // Disable manage button if no cards
        if (manageBtn) manageBtn.disabled = totalCount === 0;
    }

    /**
     * Update streak display
     */
    function updateStreak() {
        const streak = parseInt(localStorage.getItem('kapanak-streak') || '0', 10);
        const lastStudy = localStorage.getItem('kapanak-last-study');
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        // Check if streak is still valid
        let currentStreak = streak;
        if (lastStudy !== today && lastStudy !== yesterday) {
            currentStreak = 0;
            localStorage.setItem('kapanak-streak', '0');
        }

        streakText.textContent = `${currentStreak} day streak`;
        if (currentStreak === 0) {
            streakBanner.classList.add('inactive');
        } else {
            streakBanner.classList.remove('inactive');
        }
    }

    /**
     * Record a study session for streak tracking
     */
    function recordStudySession() {
        const today = new Date().toDateString();
        const lastStudy = localStorage.getItem('kapanak-last-study');
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        let streak = parseInt(localStorage.getItem('kapanak-streak') || '0', 10);

        if (lastStudy === today) {
            // Already studied today, don't update streak
        } else if (lastStudy === yesterday) {
            // Continued streak
            streak++;
        } else {
            // Streak broken, start new
            streak = 1;
        }

        localStorage.setItem('kapanak-streak', streak.toString());
        localStorage.setItem('kapanak-last-study', today);
    }

    /**
     * Increment today's review count
     */
    function incrementTodayCount() {
        const today = new Date().toDateString();
        const storedDate = localStorage.getItem('kapanak-review-date');

        let count = 0;
        if (storedDate === today) {
            count = parseInt(localStorage.getItem('kapanak-today-count') || '0', 10);
        } else {
            localStorage.setItem('kapanak-review-date', today);
        }

        count++;
        localStorage.setItem('kapanak-today-count', count.toString());
        todayReviewedEl.textContent = count;
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
     * Start a practice session (all cards)
     */
    async function startPractice() {
        isPracticeMode = true;
        const allCards = await CardDB.getAllCards();

        if (allCards.length === 0) {
            showToast('No cards to practice!');
            return;
        }

        // Sort by dueDate (due soonest first)
        studyQueue = allCards.sort((a, b) => {
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
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

        // Show front, hide back (swap if enabled)
        const displayFront = isSwapped ? card.back : card.front;
        const displayBack = isSwapped ? card.front : card.back;
        cardFront.textContent = displayFront;
        cardBack.textContent = displayBack;

        // Reset flip state instantly (no reverse-flip animation)
        flashcard.style.transition = 'none';
        flashcard.classList.remove('flipped', 'swiping-left', 'swiping-right', 'swiping-up');
        // Force reflow, then restore transition for next flip
        flashcard.offsetHeight;
        flashcard.style.transition = '';
        tapHint.classList.remove('hidden');
        reviewButtons.classList.add('hidden');

        // Update interval hints
        goodHint.textContent = SM2.getIntervalHint(card, 3);
        easyHint.textContent = SM2.getIntervalHint(card, 5);
    }

    /**
     * Reveal the back of the card (flip animation)
     */
    function revealCard() {
        flashcard.classList.add('flipped');
        tapHint.classList.add('hidden');
        reviewButtons.classList.remove('hidden');
        playSound('flip');
    }

    /**
     * Check if card is flipped (revealed)
     */
    function isCardFlipped() {
        return flashcard.classList.contains('flipped');
    }

    /**
     * Handle review button click
     * @param {number} quality - SM-2 quality rating (0, 3, or 5)
     */
    async function handleReview(quality) {
        const card = studyQueue[currentCardIndex];

        // Save for undo
        lastAction = {
            card: { ...card },
            index: currentCardIndex,
            wasInQueue: true
        };
        undoBtn.disabled = false;

        // Calculate and save next review (both modes update schedule)
        const updated = SM2.calculateNextReview(card, quality);
        await CardDB.updateCard(card.id, updated);

        // Track review
        incrementTodayCount();

        // Sound feedback
        if (quality === 0) {
            playSound('again');
        } else {
            playSound('success');
        }

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
        if (!lastAction) return;

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

        // Record streak if reviewed at least one card
        if (reviewedCount > 0) {
            recordStudySession();
        }

        showScreen('complete');

        // Celebration effects
        playSound('complete');
        showConfetti();
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
                <div class="card-item-actions">
                    <button class="card-item-edit" aria-label="Edit card">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="card-item-delete" aria-label="Delete card">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
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
     * Open edit modal for a card
     */
    async function openEditModal(id) {
        const card = await CardDB.getCard(id);
        if (!card) {
            showToast('Card not found');
            return;
        }

        editCardId.value = card.id;
        editFront.value = card.front;
        editBack.value = card.back;
        editModal.classList.remove('hidden');
        editFront.focus();
    }

    /**
     * Close edit modal
     */
    function closeEditModal() {
        editModal.classList.add('hidden');
        editCardId.value = '';
        editFront.value = '';
        editBack.value = '';
    }

    /**
     * Save edited card
     */
    async function saveEditedCard() {
        const id = editCardId.value;
        const front = editFront.value.trim();
        const back = editBack.value.trim();

        if (!front || !back) {
            showToast('Both fields are required');
            return;
        }

        try {
            await CardDB.updateCard(id, { front, back });
            closeEditModal();
            await renderCardList();
            showToast('Card updated');
        } catch (error) {
            console.error('Edit error:', error);
            showToast('Error updating card');
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
     * Submit import with duplicate detection
     */
    async function submitImport() {
        const text = importTextarea.value;
        const cards = ImportParser.importFromText(text);

        if (cards.length === 0) {
            showToast('No valid cards to import');
            return;
        }

        try {
            // Check for duplicates
            const existingCards = await CardDB.getAllCards();
            const existingFronts = new Set(existingCards.map(c => c.front.toLowerCase().trim()));

            const newCards = [];
            const duplicates = [];

            for (const card of cards) {
                const frontLower = card.front.toLowerCase().trim();
                if (existingFronts.has(frontLower)) {
                    duplicates.push(card.front);
                } else {
                    newCards.push(card);
                    existingFronts.add(frontLower); // Prevent duplicates within import
                }
            }

            if (duplicates.length > 0 && newCards.length > 0) {
                const proceed = confirm(
                    `Found ${duplicates.length} duplicate(s) that will be skipped:\n\n` +
                    duplicates.slice(0, 5).join(', ') +
                    (duplicates.length > 5 ? `\n...and ${duplicates.length - 5} more` : '') +
                    `\n\nImport ${newCards.length} new card(s)?`
                );
                if (!proceed) return;
            } else if (duplicates.length > 0 && newCards.length === 0) {
                showToast('All cards already exist');
                return;
            }

            if (newCards.length > 0) {
                await CardDB.addCards(newCards);
                let message = `Imported ${newCards.length} card${newCards.length !== 1 ? 's' : ''}`;
                if (duplicates.length > 0) {
                    message += `, ${duplicates.length} skipped`;
                }
                showToast(message);
            }

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
     * Toggle swap mode (front↔back)
     * @param {boolean} enabled - Whether to swap front and back
     */
    function setSwapMode(enabled) {
        isSwapped = enabled;
        localStorage.setItem('kapanak-swap-mode', enabled);
        swapToggle.checked = enabled;
        swapLabel.textContent = enabled ? 'Back → Front' : 'Front → Back';
    }

    /**
     * Toggle sound effects
     */
    function setSoundEnabled(enabled) {
        soundEnabled = enabled;
        localStorage.setItem('kapanak-sound', enabled);
        soundToggle.checked = enabled;
    }


    /**
     * Play sound effect
     */
    function playSound(type) {
        if (!soundEnabled) return;

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Different sounds for different actions
        if (type === 'success') {
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
        } else if (type === 'again') {
            oscillator.frequency.value = 300;
            gainNode.gain.value = 0.1;
        } else if (type === 'flip') {
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.05;
        } else if (type === 'complete') {
            oscillator.frequency.value = 1000;
            gainNode.gain.value = 0.1;
        }

        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.stop(audioCtx.currentTime + 0.1);
    }

    /**
     * Show confetti animation
     */
    function showConfetti() {
        confettiContainer.innerHTML = '';
        const colors = ['#4361ee', '#7c3aed', '#2ecc71', '#f1c40f', '#e74c3c', '#ff6b6b'];

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            confettiContainer.appendChild(confetti);
        }

        // Clean up after animation
        setTimeout(() => {
            confettiContainer.innerHTML = '';
        }, 4000);
    }

    /**
     * Request notification permission and enable reminders
     */
    async function setNotificationsEnabled(enabled) {
        if (enabled) {
            if (!('Notification' in window)) {
                showToast('Notifications not supported');
                notificationToggle.checked = false;
                return;
            }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                showToast('Notification permission denied');
                notificationToggle.checked = false;
                return;
            }

            notificationsEnabled = true;
            localStorage.setItem('kapanak-notifications', 'true');
            notificationHint.textContent = 'Reminder enabled for 9:00 AM';
            scheduleNotification();
        } else {
            notificationsEnabled = false;
            localStorage.setItem('kapanak-notifications', 'false');
            notificationHint.textContent = 'Get reminded to study every day';
        }
        notificationToggle.checked = notificationsEnabled;
    }

    /**
     * Schedule daily notification
     */
    function scheduleNotification() {
        if (!notificationsEnabled || !('serviceWorker' in navigator)) return;

        // Store reminder preference - service worker will check this
        localStorage.setItem('kapanak-reminder-time', '09:00');
    }

    /**
     * Check and show notification if needed (called on app load)
     */
    function checkNotificationReminder() {
        if (!notificationsEnabled) return;

        const lastNotification = localStorage.getItem('kapanak-last-notification');
        const today = new Date().toDateString();

        if (lastNotification !== today) {
            const now = new Date();
            const reminderHour = 9;

            if (now.getHours() >= reminderHour) {
                const lastStudy = localStorage.getItem('kapanak-last-study');
                if (lastStudy !== today) {
                    // Show notification if hasn't studied today
                    if (Notification.permission === 'granted') {
                        new Notification('🦋 Kapanak', {
                            body: 'Time to review your flashcards!',
                            icon: './icons/icon-192.png'
                        });
                        localStorage.setItem('kapanak-last-notification', today);
                    }
                }
            }
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
        // Load swap mode preference
        const storedSwap = localStorage.getItem('kapanak-swap-mode');
        setSwapMode(storedSwap === 'true');

        // Load sound preference
        const storedSound = localStorage.getItem('kapanak-sound');
        setSoundEnabled(storedSound === 'true');

        // Load notification preference
        const storedNotifications = localStorage.getItem('kapanak-notifications');
        notificationsEnabled = storedNotifications === 'true';
        notificationToggle.checked = notificationsEnabled;
        if (notificationsEnabled) {
            notificationHint.textContent = 'Reminder enabled for 9:00 AM';
            checkNotificationReminder();
        }

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
     * Handle touch start for swipe gestures
     */
    function handleTouchStart(e) {
        if (!isCardFlipped()) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
    }

    /**
     * Handle touch move for swipe visual feedback
     */
    function handleTouchMove(e) {
        if (!isSwiping || !isCardFlipped()) return;

        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        // Show visual feedback
        flashcard.classList.remove('swiping-left', 'swiping-right', 'swiping-up');

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX < -50) {
                flashcard.classList.add('swiping-left');
                e.preventDefault();
            } else if (deltaX > 50) {
                flashcard.classList.add('swiping-right');
                e.preventDefault();
            }
        } else if (deltaY < -50) {
            flashcard.classList.add('swiping-up');
            e.preventDefault();
        }
    }

    /**
     * Handle touch end for swipe action
     */
    function handleTouchEnd(e) {
        if (!isSwiping || !isCardFlipped()) {
            isSwiping = false;
            return;
        }

        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const threshold = 80;

        flashcard.classList.remove('swiping-left', 'swiping-right', 'swiping-up');

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX < -threshold) {
                // Swipe left = Again
                handleReview(0);
            } else if (deltaX > threshold) {
                // Swipe right = Good
                handleReview(3);
            }
        } else if (deltaY < -threshold) {
            // Swipe up = Easy
            handleReview(5);
        }

        isSwiping = false;
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
        if ((key === ' ' || key === 'enter') && !isCardFlipped()) {
            event.preventDefault();
            revealCard();
            return;
        }

        // Review shortcuts (only when card is revealed)
        if (isCardFlipped()) {
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
            navigator.serviceWorker.register('./sw.js')
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
        // Logo - return to home
        logoBtn.addEventListener('click', async () => {
            await updateStats();
            showScreen('home');
        });

        // Home screen
        studyBtn.addEventListener('click', startStudy);
        practiceBtn.addEventListener('click', startPractice);
        importBtn.addEventListener('click', () => showScreen('import'));
        settingsBtn.addEventListener('click', () => showScreen('settings'));

        // Swap toggle on home
        swapToggle.addEventListener('change', (e) => {
            setSwapMode(e.target.checked);
        });

        // Manage button (now in settings)
        manageBtn.addEventListener('click', async () => {
            await renderCardList();
            showScreen('manage');
        });

        // Study screen - click to flip
        flashcard.addEventListener('click', () => {
            if (!isCardFlipped()) {
                revealCard();
            }
        });

        // Swipe gestures for mobile
        flashcardContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        flashcardContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        flashcardContainer.addEventListener('touchend', handleTouchEnd, { passive: true });

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
            const cardItem = e.target.closest('.card-item');
            if (!cardItem) return;

            const editBtn = e.target.closest('.card-item-edit');
            const deleteBtn = e.target.closest('.card-item-delete');

            if (editBtn) {
                openEditModal(cardItem.dataset.id);
            } else if (deleteBtn) {
                deleteCard(cardItem.dataset.id);
            }
        });

        // Edit modal
        editCancelBtn.addEventListener('click', closeEditModal);
        editSaveBtn.addEventListener('click', saveEditedCard);
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                closeEditModal();
            }
        });
        editFront.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') editBack.focus();
        });
        editBack.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveEditedCard();
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

        soundToggle.addEventListener('change', (e) => {
            setSoundEnabled(e.target.checked);
            if (e.target.checked) playSound('success');
        });

        notificationToggle.addEventListener('change', (e) => {
            setNotificationsEnabled(e.target.checked);
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

        // Set version from shared constant
        appVersionEl.textContent = `Kapanak v${APP_VERSION}`;

        console.log('Kapanak initialized');
    }

    // Start app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
