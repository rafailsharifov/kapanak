/**
 * Notebook View module
 * Fixed 3×4 grid (12 cards/page), newest page first.
 * Filters: All / Unlearned / Due
 * Controls: Show Translation toggle, Flip All toggle
 * Individual cell tap always flips that cell (XOR with global flip).
 * Page dots with due/new indicators.
 */
window.NotebookModule = (function () {
    'use strict';

    const PAGE_SIZE = 12;

    let allCards      = [];
    let dueIds        = new Set();
    let unlearnedIds  = new Set();

    let currentPage      = 0;
    let filterMode       = 'all';   // 'all' | 'unlearned' | 'due'
    let showTranslation  = false;
    let globalFlipped    = false;
    let cellOverrides    = new Set(); // card IDs with individual flip override

    // DOM refs
    let grid, pageIndicator, prevBtn, nextBtn, dotsEl;
    let showTranslationBtn, flipAllBtn, studyPageBtn;
    let filterBtns;

    // ── text sizing + split ───────────────────────────────────────────────────

    function _fontSize(text) {
        const len = (text || '').length;
        if (len <= 3)  return '2rem';
        if (len <= 5)  return '1.7rem';
        if (len <= 8)  return '1.4rem';
        if (len <= 11) return '1.15rem';
        if (len <= 15) return '0.95rem';
        if (len <= 20) return '0.82rem';
        return '0.7rem';
    }

    // Split text on common separators: / , | ; or " - "
    // Returns array of trimmed non-empty parts
    function _splitText(text) {
        if (!text) return [''];
        const parts = text.split(/\s*[\/,|;]\s*|\s+-\s+/).map(p => p.trim()).filter(Boolean);
        return parts.length > 1 ? parts : [text];
    }

    // Build a DOM element with auto-sized text, splitting on separators if present
    function _buildTextEl(text, className, highlighted) {
        const parts = _splitText(text);
        const longest = parts.reduce((a, b) => a.length > b.length ? a : b, '');

        const el = document.createElement('div');
        el.className = className;
        if (highlighted) el.style.fontSize = _fontSize(longest);

        if (parts.length > 1) {
            parts.forEach((part, i) => {
                if (i > 0) el.appendChild(document.createElement('br'));
                el.appendChild(document.createTextNode(part));
            });
        } else {
            el.textContent = text;
        }
        return el;
    }

    // ── data helpers ──────────────────────────────────────────────────────────

    function _sortCards(cards) {
        // Newest first
        return [...cards].sort((a, b) => {
            const d = new Date(b.createdAt) - new Date(a.createdAt);
            return d !== 0 ? d : b.id.localeCompare(a.id);
        });
    }

    function _pageCards() {
        return allCards.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
    }

    function _totalPages() {
        return Math.max(1, Math.ceil(allCards.length / PAGE_SIZE));
    }

    function _buildPositionMap() {
        const map = {};
        allCards.forEach((c, i) => {
            map[c.id] = { page: Math.floor(i / PAGE_SIZE), pos: i % PAGE_SIZE };
        });
        return map;
    }

    function _isHighlighted(card) {
        if (filterMode === 'all')       return true;
        if (filterMode === 'due')       return dueIds.has(card.id);
        if (filterMode === 'unlearned') return unlearnedIds.has(card.id);
        return true;
    }

    // ── render ────────────────────────────────────────────────────────────────

    function _render() {
        const cards = _pageCards();
        const total = _totalPages();

        pageIndicator.textContent = `Page ${currentPage + 1} of ${total}`;
        prevBtn.disabled     = currentPage === 0;
        nextBtn.disabled     = currentPage >= total - 1;
        studyPageBtn.disabled = cards.length === 0;

        filterBtns.forEach(btn =>
            btn.classList.toggle('active', btn.dataset.filter === filterMode)
        );
        showTranslationBtn.classList.toggle('active', showTranslation);
        flipAllBtn.classList.toggle('active', globalFlipped);

        _renderDots();

        grid.innerHTML = '';

        if (cards.length === 0) {
            grid.innerHTML = '<div class="notebook-empty">No cards on this page.</div>';
            return;
        }

        cards.forEach((card, idx) => {
            const globalIdx   = currentPage * PAGE_SIZE + idx;
            const highlighted = _isHighlighted(card);

            // XOR: individual override inverts the global state for this cell
            const isOverridden = cellOverrides.has(card.id);
            const isFlipped    = globalFlipped !== isOverridden;

            const primaryText   = isFlipped ? card.back  : card.front;
            const secondaryText = isFlipped ? card.front : card.back;

            const cell = document.createElement('div');
            cell.className = 'nb-cell';
            if (!highlighted)          cell.classList.add('nb-cell-dim');
            if (dueIds.has(card.id))   cell.classList.add('nb-cell-due');
            else if (unlearnedIds.has(card.id)) cell.classList.add('nb-cell-new');

            // Position badge
            const badge = document.createElement('span');
            badge.className = 'nb-badge';
            badge.textContent = globalIdx + 1;

            // Primary text
            const primary = _buildTextEl(primaryText, 'nb-primary', highlighted);

            cell.appendChild(badge);
            cell.appendChild(primary);

            // Translation overlay (when showTranslation is on)
            if (showTranslation && secondaryText) {
                const secondary = _buildTextEl(secondaryText, 'nb-secondary', highlighted);
                cell.appendChild(secondary);
            }

            // Anchor hint
            if (card.anchor && highlighted) {
                const anchor = document.createElement('div');
                anchor.className = 'nb-anchor';
                anchor.textContent = card.anchor;
                cell.appendChild(anchor);
            }

            cell.addEventListener('click', () => _toggleCell(card.id));
            grid.appendChild(cell);
        });
    }

    // ── page dots ─────────────────────────────────────────────────────────────

    function _renderDots() {
        const total = _totalPages();
        dotsEl.innerHTML = '';
        if (total <= 1) return;

        const MAX = 9;
        let pages;

        if (total <= MAX) {
            pages = Array.from({ length: total }, (_, i) => i);
        } else {
            const win = new Set([0, total - 1]);
            for (let i = Math.max(0, currentPage - 2); i <= Math.min(total - 1, currentPage + 2); i++) {
                win.add(i);
            }
            pages = [...win].sort((a, b) => a - b);
        }

        let last = -1;
        pages.forEach(i => {
            if (last !== -1 && i > last + 1) {
                const gap = document.createElement('span');
                gap.className = 'nb-dot-gap';
                gap.textContent = '…';
                dotsEl.appendChild(gap);
            }

            const dot = document.createElement('button');
            dot.className = 'nb-dot';
            if (i === currentPage) dot.classList.add('nb-dot-current');

            const start = i * PAGE_SIZE;
            const pCards = allCards.slice(start, start + PAGE_SIZE);
            if (pCards.some(c => dueIds.has(c.id)))       dot.classList.add('nb-dot-due');
            else if (pCards.some(c => unlearnedIds.has(c.id))) dot.classList.add('nb-dot-new');

            dot.addEventListener('click', () => {
                currentPage = i;
                cellOverrides.clear();
                _render();
            });

            dotsEl.appendChild(dot);
            last = i;
        });
    }

    // ── interactions ──────────────────────────────────────────────────────────

    function _toggleCell(cardId) {
        if (cellOverrides.has(cardId)) cellOverrides.delete(cardId);
        else cellOverrides.add(cardId);
        _render();
    }

    function _toggleFlipAll() {
        globalFlipped = !globalFlipped;
        cellOverrides.clear();
        _render();
    }

    function _toggleShowTranslation() {
        showTranslation = !showTranslation;
        _render();
    }

    function _setFilter(mode) {
        filterMode = mode;
        _render();
    }

    async function _studyPage() {
        const cards = _pageCards();
        if (!cards.length) return;

        let queue = cards;
        if (filterMode === 'due') {
            queue = cards.filter(c => dueIds.has(c.id));
            if (!queue.length) { UI.showToast('No due cards on this page'); return; }
        } else if (filterMode === 'unlearned') {
            queue = cards.filter(c => unlearnedIds.has(c.id));
            if (!queue.length) { UI.showToast('No unlearned cards on this page'); return; }
        }

        await StudyModule.startPageStudy(queue, _buildPositionMap());
    }

    // ── open ──────────────────────────────────────────────────────────────────

    async function open() {
        const [all, due] = await Promise.all([CardDB.getAllCards(), CardDB.getDueCards()]);
        allCards     = _sortCards(all);
        dueIds       = new Set(due.map(c => c.id));
        unlearnedIds = new Set(all.filter(c => c.repetitions === 0 && !c.lastReviewed).map(c => c.id));
        currentPage  = 0;
        filterMode   = 'all';
        showTranslation = false;
        globalFlipped   = false;
        cellOverrides.clear();
        _render();
        UI.showScreen('notebook');
    }

    // Re-open notebook keeping the current page (used after page-primed study)
    async function resume() {
        const [all, due] = await Promise.all([CardDB.getAllCards(), CardDB.getDueCards()]);
        allCards     = _sortCards(all);
        dueIds       = new Set(due.map(c => c.id));
        unlearnedIds = new Set(all.filter(c => c.repetitions === 0 && !c.lastReviewed).map(c => c.id));
        // Clamp page in case cards were deleted
        const maxPage = Math.max(0, _totalPages() - 1);
        if (currentPage > maxPage) currentPage = maxPage;
        cellOverrides.clear();
        _render();
        UI.showScreen('notebook');
    }

    // ── init ──────────────────────────────────────────────────────────────────

    function init() {
        grid               = document.getElementById('nb-grid');
        pageIndicator      = document.getElementById('nb-page-indicator');
        prevBtn            = document.getElementById('nb-prev-btn');
        nextBtn            = document.getElementById('nb-next-btn');
        dotsEl             = document.getElementById('nb-dots');
        showTranslationBtn = document.getElementById('nb-show-translation');
        flipAllBtn         = document.getElementById('nb-flip-all');
        studyPageBtn       = document.getElementById('nb-study-page-btn');
        filterBtns         = document.querySelectorAll('.nb-filter-btn');

        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) { currentPage--; cellOverrides.clear(); _render(); }
        });
        nextBtn.addEventListener('click', () => {
            if (currentPage < _totalPages() - 1) { currentPage++; cellOverrides.clear(); _render(); }
        });

        showTranslationBtn.addEventListener('click', _toggleShowTranslation);
        flipAllBtn.addEventListener('click', _toggleFlipAll);
        studyPageBtn.addEventListener('click', _studyPage);
        filterBtns.forEach(btn => btn.addEventListener('click', () => _setFilter(btn.dataset.filter)));

        document.getElementById('nb-back-btn').addEventListener('click', async () => {
            await StatsModule.update();
            UI.showScreen('home');
        });

        document.getElementById('notebook-btn').addEventListener('click', open);
    }

    return { init, open, resume };
})();
