/**
 * Database module using Dexie.js for IndexedDB
 * Stores flashcards with SM-2 spaced repetition data
 */

// Initialize Dexie database
const db = new Dexie('KapanakDB');

// Version 1 — original schema
db.version(1).stores({
    cards: 'id, dueDate, createdAt'
});

// Version 2 — added anchor (memory mnemonic) field
db.version(2).stores({
    cards: 'id, dueDate, createdAt'
}).upgrade(tx => {
    return tx.table('cards').toCollection().modify(card => {
        if (card.anchor === undefined) card.anchor = '';
    });
});

// Notebook layout constants — see _nextSlot for placement rules.
const NOTEBOOK_PAGE_CAPACITY = 12;

// Version 3 — fixed notebook coordinates (notebookPage, notebookSlot) per card.
// Backfill assigns existing cards in createdAt order using the same placement
// algorithm new imports will use, so layout matches what the app currently
// renders (newest cards on the newest page, oldest at slot 11 of page 0).
db.version(3).stores({
    cards: 'id, dueDate, createdAt, notebookPage'
}).upgrade(async tx => {
    const cards = await tx.table('cards').toArray();
    cards.sort((a, b) => {
        const d = new Date(a.createdAt) - new Date(b.createdAt);
        return d !== 0 ? d : a.id.localeCompare(b.id);
    });
    const state = { maxPage: null, frontPageFilledCount: 0 };
    for (const card of cards) {
        const coords = _nextSlot(state);
        await tx.table('cards').update(card.id, coords);
    }
});

/**
 * Compute the next (notebookPage, notebookSlot) for an incoming card and
 * mutate the running state accordingly.
 *
 * Placement rule:
 *  - Fill the frontmost page (highest notebookPage) that still has room.
 *  - Within a page, fill bottom-up: slot 11 first, then 10, 9, … down to 0.
 *  - When the current front page is full, create a new page (id = max+1).
 *
 * @param {{maxPage:number|null, frontPageFilledCount:number}} state
 * @returns {{notebookPage:number, notebookSlot:number}}
 */
function _nextSlot(state) {
    if (state.maxPage === null || state.frontPageFilledCount >= NOTEBOOK_PAGE_CAPACITY) {
        state.maxPage = state.maxPage === null ? 0 : state.maxPage + 1;
        state.frontPageFilledCount = 0;
    }
    const filled = state.frontPageFilledCount;
    state.frontPageFilledCount = filled + 1;
    return {
        notebookPage: state.maxPage,
        notebookSlot: NOTEBOOK_PAGE_CAPACITY - 1 - filled
    };
}

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Create a new flashcard with initial SM-2 values
 * @param {string} front - Front text of the card
 * @param {string} back - Back text of the card
 * @returns {Object} New card object
 */
function createCard(front, back) {
    const now = new Date();
    return {
        id: generateUUID(),
        front: front,
        back: back,
        // SM-2 algorithm fields
        interval: 0,           // Days until next review
        easeFactor: 2.5,       // Difficulty factor (2.5 is default)
        repetitions: 0,        // Number of successful reviews
        dueDate: now.toISOString(),
        lastReviewed: null,
        createdAt: now.toISOString(),
        anchor: ''          // Memory mnemonic / visual image note
    };
}

/**
 * Add multiple cards to the database
 * @param {Array} cards - Array of card objects
 * @returns {Promise<number>} Number of cards added
 */
async function addCards(cards) {
    return await db.cards.bulkAdd(cards);
}

/**
 * Add cards while assigning each a permanent (notebookPage, notebookSlot)
 * coordinate per the placement rule in _nextSlot. Runs in a single
 * transaction so concurrent imports cannot race on the frontmost page.
 *
 * @param {Array} cards - Array of card objects (without notebook coords)
 * @returns {Promise<number>} Number of cards added
 */
async function addCardsWithPlacement(cards) {
    return await db.transaction('rw', db.cards, async () => {
        const lastByPage = await db.cards.orderBy('notebookPage').last();
        let state;
        if (!lastByPage || lastByPage.notebookPage === undefined) {
            state = { maxPage: null, frontPageFilledCount: 0 };
        } else {
            const count = await db.cards
                .where('notebookPage').equals(lastByPage.notebookPage).count();
            state = { maxPage: lastByPage.notebookPage, frontPageFilledCount: count };
        }
        const placed = cards.map(c => ({ ...c, ..._nextSlot(state) }));
        return await db.cards.bulkAdd(placed);
    });
}

/**
 * Get all cards from the database
 * @returns {Promise<Array>} All cards
 */
async function getAllCards() {
    return await db.cards.toArray();
}

/**
 * Get cards due for review (dueDate <= now)
 * @returns {Promise<Array>} Cards due for review
 */
async function getDueCards() {
    const now = new Date().toISOString();
    return await db.cards
        .where('dueDate')
        .belowOrEqual(now)
        .toArray();
}

/**
 * Get count of cards due for review
 * @returns {Promise<number>} Count of due cards
 */
async function getDueCount() {
    const now = new Date().toISOString();
    return await db.cards
        .where('dueDate')
        .belowOrEqual(now)
        .count();
}

/**
 * Get total count of cards
 * @returns {Promise<number>} Total card count
 */
async function getTotalCount() {
    return await db.cards.count();
}

/**
 * Update a card in the database
 * @param {string} id - Card ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>} Number of updated records
 */
async function updateCard(id, updates) {
    return await db.cards.update(id, updates);
}

/**
 * Get a single card by ID
 * @param {string} id - Card ID
 * @returns {Promise<Object>} Card object
 */
async function getCard(id) {
    return await db.cards.get(id);
}

/**
 * Delete a single card by ID
 * @param {string} id - Card ID to delete
 * @returns {Promise<void>}
 */
async function deleteCard(id) {
    return await db.cards.delete(id);
}

/**
 * Delete all cards from the database
 * @returns {Promise<void>}
 */
async function deleteAllCards() {
    return await db.cards.clear();
}

/**
 * Export all cards as JSON
 * @returns {Promise<string>} JSON string of all cards
 */
async function exportData() {
    const cards = await getAllCards();
    const exportObj = {
        version: 2,
        exportDate: new Date().toISOString(),
        cards: cards
    };
    return JSON.stringify(exportObj, null, 2);
}

/**
 * Import cards from JSON backup
 * @param {string} jsonString - JSON string to import
 * @returns {Promise<number>} Number of cards imported
 */
async function importData(jsonString) {
    const data = JSON.parse(jsonString);

    if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error('Invalid backup format');
    }

    // Backfill notebook coordinates for older backups that predate v3.
    const needsCoords = data.cards.some(
        c => c.notebookPage === undefined || c.notebookSlot === undefined
    );
    let toImport = data.cards;
    if (needsCoords) {
        const sorted = [...data.cards].sort((a, b) => {
            const d = new Date(a.createdAt) - new Date(b.createdAt);
            return d !== 0 ? d : a.id.localeCompare(b.id);
        });
        const state = { maxPage: null, frontPageFilledCount: 0 };
        const byId = new Map();
        for (const c of sorted) byId.set(c.id, { ...c, ..._nextSlot(state) });
        toImport = data.cards.map(c => byId.get(c.id));
    }

    // Clear existing data
    await deleteAllCards();

    // Import cards
    return await db.cards.bulkAdd(toImport);
}

// Export functions for use in other modules
window.CardDB = {
    createCard,
    addCards,
    addCardsWithPlacement,
    getAllCards,
    getDueCards,
    getDueCount,
    getTotalCount,
    updateCard,
    getCard,
    deleteCard,
    deleteAllCards,
    exportData,
    importData,
    NOTEBOOK_PAGE_CAPACITY
};
