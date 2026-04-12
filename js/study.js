/**
 * Study session module
 * Handles both due-card study and practice-all sessions.
 */
window.StudyModule = (function () {
    'use strict';

    let studyQueue = [];
    let currentCardIndex = 0;
    let reviewedCount = 0;
    let lastAction = null;
    let isPracticeMode = false;
    let isPageStudy = false;

    // Notebook position map: cardId → { page, pos } (set before starting page-primed session)
    let positionMap = null;

    // Touch state
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

    // DOM refs (assigned in init)
    let progressFill, progressText, flashcard, cardFront, cardBack;
    let tapHint, reviewButtons, goodHint, easyHint, undoBtn;
    let flashcardContainer, cardPosition, cardAnchor, completeStats;

    // ── public: start sessions ──────────────────────────────────────────────

    async function startStudy(cards) {
        isPracticeMode = false;
        isPageStudy = false;
        positionMap = null;

        if (!cards) {
            cards = await CardDB.getDueCards();
        }

        if (cards.length === 0) {
            UI.showToast('No cards due for review!');
            return;
        }

        studyQueue = SM2.sortCardsForReview(cards);
        _resetSession();
        UI.showScreen('study');
        _showCard();
    }

    async function startPractice() {
        isPracticeMode = true;
        isPageStudy = false;
        positionMap = null;
        const all = await CardDB.getAllCards();

        if (all.length === 0) {
            UI.showToast('No cards to practice!');
            return;
        }

        studyQueue = all.sort((a, b) => {
            const diff = new Date(a.dueDate) - new Date(b.dueDate);
            return diff !== 0 ? diff : Math.random() - 0.5;
        });
        _resetSession();
        UI.showScreen('study');
        _showCard();
    }

    // Page-primed: study only the cards from one notebook page
    async function startPageStudy(cards, pagePositionMap) {
        isPracticeMode = false;
        isPageStudy = true;
        positionMap = pagePositionMap;

        if (cards.length === 0) {
            UI.showToast('No cards on this page.');
            return;
        }

        const dueCards = await CardDB.getDueCards();
        const dueIds = new Set(dueCards.map(c => c.id));

        // Prioritise due cards from the page; append non-due at end
        const due = cards.filter(c => dueIds.has(c.id));
        const rest = cards.filter(c => !dueIds.has(c.id));
        studyQueue = SM2.sortCardsForReview(due).concat(rest);

        _resetSession();
        UI.showScreen('study');
        _showCard();
    }

    // ── private helpers ─────────────────────────────────────────────────────

    function _resetSession() {
        currentCardIndex = 0;
        reviewedCount = 0;
        lastAction = null;
        undoBtn.disabled = true;
    }

    function _showCard() {
        if (currentCardIndex >= studyQueue.length) {
            _endStudy();
            return;
        }

        const card = studyQueue[currentCardIndex];
        const progress = Math.round((currentCardIndex / studyQueue.length) * 100);
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${currentCardIndex} / ${studyQueue.length}`;

        // Reset flip instantly
        flashcard.style.transition = 'none';
        flashcard.classList.remove('flipped', 'swiping-left', 'swiping-right', 'swiping-up');
        flashcard.offsetHeight; // force reflow

        const displayFront = UI.getSwapped() ? card.back : card.front;
        const displayBack  = UI.getSwapped() ? card.front : card.back;
        cardFront.textContent = displayFront;
        cardBack.textContent  = displayBack;

        // Position hint
        if (positionMap && positionMap[card.id]) {
            const { page, pos } = positionMap[card.id];
            cardPosition.textContent = `Pg ${page + 1} · #${pos + 1}`;
            cardPosition.classList.remove('hidden');
        } else {
            cardPosition.classList.add('hidden');
        }

        // Anchor hint (memory image)
        if (card.anchor) {
            cardAnchor.textContent = card.anchor;
            cardAnchor.classList.remove('hidden');
        } else {
            cardAnchor.classList.add('hidden');
        }

        flashcard.style.transition = '';
        tapHint.classList.remove('hidden');
        reviewButtons.classList.add('hidden');

        goodHint.textContent = SM2.getIntervalHint(card, 3);
        easyHint.textContent = SM2.getIntervalHint(card, 5);
    }

    function _revealCard() {
        flashcard.classList.add('flipped');
        tapHint.classList.add('hidden');
        reviewButtons.classList.remove('hidden');
    }

    function _isFlipped() {
        return flashcard.classList.contains('flipped');
    }

    async function _handleReview(quality) {
        const card = studyQueue[currentCardIndex];

        lastAction = { card: { ...card }, index: currentCardIndex };
        undoBtn.disabled = false;

        const updated = SM2.calculateNextReview(card, quality);
        await CardDB.updateCard(card.id, updated);
        _incrementTodayCount();

        if (quality === 0) {
            studyQueue[currentCardIndex] = updated;
            const failed = studyQueue.splice(currentCardIndex, 1)[0];
            studyQueue.push(failed);
        } else {
            reviewedCount++;
            currentCardIndex++;
        }

        _showCard();
    }

    async function _undoLastAction() {
        if (!lastAction) return;
        const { card, index } = lastAction;
        await CardDB.updateCard(card.id, card);
        studyQueue = studyQueue.filter(c => c.id !== card.id);
        studyQueue.splice(index, 0, card);
        currentCardIndex = index;
        if (reviewedCount > 0) reviewedCount--;
        lastAction = null;
        undoBtn.disabled = true;
        _showCard();
        UI.showToast('Undone');
    }

    function _endStudy() {
        const label = isPracticeMode ? 'practiced' : 'reviewed';
        completeStats.textContent = `You ${label} ${reviewedCount} card${reviewedCount !== 1 ? 's' : ''}.`;
        if (reviewedCount > 0) _recordStudySession();
        UI.showScreen('complete');
        _showConfetti();
    }

    // ── streak / count helpers ───────────────────────────────────────────────

    function _incrementTodayCount() {
        const today = new Date().toDateString();
        const storedDate = localStorage.getItem('kapanak-review-date');
        let count = storedDate === today
            ? parseInt(localStorage.getItem('kapanak-today-count') || '0', 10)
            : 0;
        localStorage.setItem('kapanak-review-date', today);
        localStorage.setItem('kapanak-today-count', (++count).toString());
        const el = document.getElementById('today-reviewed');
        if (el) el.textContent = count;
    }

    function _recordStudySession() {
        const today = new Date().toDateString();
        const last = localStorage.getItem('kapanak-last-study');
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        let streak = parseInt(localStorage.getItem('kapanak-streak') || '0', 10);
        if (last === today) { /* already counted */ }
        else if (last === yesterday) streak++;
        else streak = 1;
        localStorage.setItem('kapanak-streak', streak.toString());
        localStorage.setItem('kapanak-last-study', today);
    }

    // ── confetti ─────────────────────────────────────────────────────────────

    function _showConfetti() {
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';
        const colors = ['#4361ee', '#7c3aed', '#2ecc71', '#f1c40f', '#e74c3c', '#ff6b6b'];
        for (let i = 0; i < 50; i++) {
            const el = document.createElement('div');
            el.className = 'confetti';
            el.style.left = Math.random() * 100 + '%';
            el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            el.style.animationDelay = Math.random() * 0.5 + 's';
            el.style.animationDuration = (2 + Math.random() * 2) + 's';
            container.appendChild(el);
        }
        setTimeout(() => { container.innerHTML = ''; }, 4000);
    }

    // ── touch / keyboard ─────────────────────────────────────────────────────

    function _onTouchStart(e) {
        if (!_isFlipped()) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
    }

    function _onTouchMove(e) {
        if (!isSwiping || !_isFlipped()) return;
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        flashcard.classList.remove('swiping-left', 'swiping-right', 'swiping-up');
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < -50) { flashcard.classList.add('swiping-left'); e.preventDefault(); }
            else if (dx > 50) { flashcard.classList.add('swiping-right'); e.preventDefault(); }
        } else if (dy < -50) {
            flashcard.classList.add('swiping-up'); e.preventDefault();
        }
    }

    function _onTouchEnd(e) {
        if (!isSwiping || !_isFlipped()) { isSwiping = false; return; }
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const threshold = 80;
        flashcard.classList.remove('swiping-left', 'swiping-right', 'swiping-up');
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < -threshold) _handleReview(0);
            else if (dx > threshold) _handleReview(3);
        } else if (dy < -threshold) {
            _handleReview(5);
        }
        isSwiping = false;
    }

    function _onKeydown(e) {
        if (UI.getScreen() !== 'study') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const key = e.key.toLowerCase();
        if ((key === ' ' || key === 'enter') && !_isFlipped()) {
            e.preventDefault(); _revealCard(); return;
        }
        if (_isFlipped()) {
            if (key === '1' || key === 'a') { e.preventDefault(); _handleReview(0); }
            else if (key === '2' || key === 'g') { e.preventDefault(); _handleReview(3); }
            else if (key === '3' || key === 'e') { e.preventDefault(); _handleReview(5); }
        }
        if ((e.ctrlKey || e.metaKey) && key === 'z') {
            e.preventDefault(); _undoLastAction();
        }
    }

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        progressFill      = document.getElementById('progress-fill');
        progressText      = document.getElementById('progress-text');
        flashcard         = document.getElementById('flashcard');
        flashcardContainer = document.getElementById('flashcard-container');
        cardFront         = document.getElementById('card-front');
        cardBack          = document.getElementById('card-back');
        tapHint           = document.getElementById('tap-hint');
        reviewButtons     = document.getElementById('review-buttons');
        goodHint          = document.getElementById('good-hint');
        easyHint          = document.getElementById('easy-hint');
        undoBtn           = document.getElementById('undo-btn');
        cardPosition      = document.getElementById('card-position');
        cardAnchor        = document.getElementById('card-anchor');
        completeStats     = document.getElementById('complete-stats');

        flashcard.addEventListener('click', () => { if (!_isFlipped()) _revealCard(); });

        flashcardContainer.addEventListener('touchstart', _onTouchStart, { passive: true });
        flashcardContainer.addEventListener('touchmove',  _onTouchMove,  { passive: false });
        flashcardContainer.addEventListener('touchend',   _onTouchEnd,   { passive: true });

        document.querySelectorAll('.review-buttons .btn').forEach(btn => {
            btn.addEventListener('click', () => _handleReview(parseInt(btn.dataset.rating, 10)));
        });

        document.getElementById('undo-btn').addEventListener('click', _undoLastAction);
        document.getElementById('end-study-btn').addEventListener('click', () => {
            if (confirm('End study session?')) _endStudy();
        });
        document.getElementById('back-home-btn').addEventListener('click', async () => {
            if (isPageStudy) {
                await NotebookModule.open();
            } else {
                await StatsModule.update();
                UI.showScreen('home');
            }
        });

        document.addEventListener('keydown', _onKeydown);
    }

    return { init, startStudy, startPractice, startPageStudy };
})();
