/**
 * Database module using Dexie.js for IndexedDB
 * Stores flashcards with SM-2 spaced repetition data
 */

// Initialize Dexie database
const db = new Dexie('KapanakDB');

// Define schema - version 1
db.version(1).stores({
    // Primary key is 'id', indexed fields for querying
    cards: 'id, dueDate, createdAt'
});

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
        createdAt: now.toISOString()
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
        version: 1,
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

    // Clear existing data
    await deleteAllCards();

    // Import cards
    return await db.cards.bulkAdd(data.cards);
}

// Export functions for use in other modules
window.CardDB = {
    createCard,
    addCards,
    getAllCards,
    getDueCards,
    getDueCount,
    getTotalCount,
    updateCard,
    getCard,
    deleteCard,
    deleteAllCards,
    exportData,
    importData
};
