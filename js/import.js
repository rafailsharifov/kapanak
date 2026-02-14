/**
 * Import Parser Module
 * Parses simple text format for flashcard import
 *
 * Format:
 * - One card per line
 * - First comma separates front and back
 * - Everything after first comma is the back
 * - Empty lines are ignored
 * - Whitespace is trimmed
 */

/**
 * Parse import text into card objects
 * @param {string} text - Raw import text
 * @returns {Array} Array of parsed cards (front/back only)
 */
function parseImportText(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const lines = text.split('\n');
    const cards = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            continue;
        }

        // Find first comma
        const commaIndex = trimmed.indexOf(',');

        // Skip lines without comma
        if (commaIndex === -1) {
            continue;
        }

        // Extract front and back
        const front = trimmed.substring(0, commaIndex).trim();
        const back = trimmed.substring(commaIndex + 1).trim();

        // Skip if either side is empty
        if (!front || !back) {
            continue;
        }

        cards.push({ front, back });
    }

    return cards;
}

/**
 * Count valid cards in import text (for preview)
 * @param {string} text - Raw import text
 * @returns {number} Count of valid cards
 */
function countValidCards(text) {
    return parseImportText(text).length;
}

/**
 * Convert parsed cards to full card objects with SM-2 defaults
 * @param {Array} parsedCards - Array of {front, back} objects
 * @returns {Array} Array of full card objects
 */
function convertToCards(parsedCards) {
    return parsedCards.map(({ front, back }) => {
        return window.CardDB.createCard(front, back);
    });
}

/**
 * Full import pipeline: parse text and create card objects
 * @param {string} text - Raw import text
 * @returns {Array} Array of ready-to-save card objects
 */
function importFromText(text) {
    const parsed = parseImportText(text);
    return convertToCards(parsed);
}

// Export functions
window.ImportParser = {
    parseImportText,
    countValidCards,
    convertToCards,
    importFromText
};
