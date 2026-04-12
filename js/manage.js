/**
 * Manage Cards screen module
 */
window.ManageModule = (function () {
    'use strict';

    let sortMode = 'due';

    // DOM refs
    let cardList, manageSearch, sortChips, emptyState;
    let editModal, editCardId, editFront, editBack, editAnchor;

    function _renderList(query = '') {
        CardDB.getAllCards().then(all => {
            const collator = new Intl.Collator('pl', { sensitivity: 'base' });

            if (sortMode === 'alpha') {
                all.sort((a, b) => collator.compare(a.front, b.front));
            } else if (sortMode === 'newest') {
                all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            } else {
                all.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            }

            const q = query.trim().toLowerCase();
            const cards = q
                ? all.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q))
                : all;

            if (all.length === 0) {
                cardList.classList.add('hidden');
                emptyState.classList.remove('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            cardList.classList.remove('hidden');

            if (cards.length === 0) {
                cardList.innerHTML = '<div class="empty-state"><p>No cards match your search.</p></div>';
                return;
            }

            cardList.innerHTML = cards.map(card => `
                <div class="card-item" data-id="${card.id}">
                    <div class="card-item-content">
                        <div class="card-item-front">${UI.escapeHtml(card.front)}</div>
                        <div class="card-item-back">${UI.escapeHtml(card.back)}</div>
                        ${card.anchor ? `<div class="card-item-anchor">${UI.escapeHtml(card.anchor)}</div>` : ''}
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
        });
    }

    async function _deleteCard(id) {
        if (!confirm('Delete this card?')) return;
        try {
            await CardDB.deleteCard(id);
            _renderList(manageSearch.value);
            await StatsModule.update();
            UI.showToast('Card deleted');
        } catch (e) {
            UI.showToast('Error deleting card');
        }
    }

    async function _openEdit(id) {
        const card = await CardDB.getCard(id);
        if (!card) { UI.showToast('Card not found'); return; }
        editCardId.value = card.id;
        editFront.value  = card.front;
        editBack.value   = card.back;
        editAnchor.value = card.anchor || '';
        editModal.classList.remove('hidden');
        editFront.focus();
    }

    function _closeEdit() {
        editModal.classList.add('hidden');
        editCardId.value = editFront.value = editBack.value = editAnchor.value = '';
    }

    async function _saveEdit() {
        const id     = editCardId.value;
        const front  = editFront.value.trim();
        const back   = editBack.value.trim();
        const anchor = editAnchor.value.trim();

        if (!front || !back) { UI.showToast('Both fields are required'); return; }

        try {
            await CardDB.updateCard(id, { front, back, anchor });
            _closeEdit();
            _renderList(manageSearch.value);
            UI.showToast('Card updated');
        } catch (e) {
            UI.showToast('Error updating card');
        }
    }

    function open() {
        manageSearch.value = '';
        sortMode = 'due';
        sortChips.querySelectorAll('.sort-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.sort === 'due');
        });
        _renderList();
        UI.showScreen('manage');
    }

    function init() {
        cardList    = document.getElementById('card-list');
        manageSearch = document.getElementById('manage-search');
        sortChips   = document.getElementById('sort-chips');
        emptyState  = document.getElementById('empty-state');
        editModal   = document.getElementById('edit-modal');
        editCardId  = document.getElementById('edit-card-id');
        editFront   = document.getElementById('edit-front');
        editBack    = document.getElementById('edit-back');
        editAnchor  = document.getElementById('edit-anchor');

        manageSearch.addEventListener('input', () => _renderList(manageSearch.value));

        sortChips.addEventListener('click', e => {
            const chip = e.target.closest('.sort-chip');
            if (!chip) return;
            sortMode = chip.dataset.sort;
            sortChips.querySelectorAll('.sort-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            _renderList(manageSearch.value);
        });

        cardList.addEventListener('click', e => {
            const item = e.target.closest('.card-item');
            if (!item) return;
            if (e.target.closest('.card-item-edit'))   _openEdit(item.dataset.id);
            else if (e.target.closest('.card-item-delete')) _deleteCard(item.dataset.id);
        });

        document.getElementById('edit-cancel-btn').addEventListener('click', _closeEdit);
        document.getElementById('edit-save-btn').addEventListener('click', _saveEdit);
        editModal.addEventListener('click', e => { if (e.target === editModal) _closeEdit(); });
        editFront.addEventListener('keydown', e => { if (e.key === 'Enter') editBack.focus(); });
        editBack.addEventListener('keydown',  e => { if (e.key === 'Enter') editAnchor.focus(); });
        editAnchor.addEventListener('keydown', e => { if (e.key === 'Enter') _saveEdit(); });

        document.getElementById('manage-back-btn').addEventListener('click', async () => {
            await StatsModule.update();
            UI.showScreen('home');
        });
        document.getElementById('manage-btn').addEventListener('click', open);
    }

    return { init, open };
})();
