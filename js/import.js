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

// Export parser functions
window.ImportParser = {
    parseImportText,
    countValidCards,
    convertToCards,
    importFromText
};

/**
 * Import screen UI module
 */
window.ImportModule = (function () {
    'use strict';

    let textarea, preview, submitBtn;

    function _handleInput() {
        const count = ImportParser.countValidCards(textarea.value);
        preview.textContent = count > 0 ? `${count} card${count !== 1 ? 's' : ''} ready` : '';
        submitBtn.disabled  = count === 0;
    }

    async function _submit() {
        const cards = ImportParser.importFromText(textarea.value);
        if (cards.length === 0) { UI.showToast('No valid cards to import'); return; }

        try {
            const existing      = await CardDB.getAllCards();
            const existingFronts = new Set(existing.map(c => c.front.toLowerCase().trim()));

            const newCards = [], duplicates = [];
            for (const card of cards) {
                const key = card.front.toLowerCase().trim();
                if (existingFronts.has(key)) {
                    duplicates.push(card.front);
                } else {
                    newCards.push(card);
                    existingFronts.add(key);
                }
            }

            if (duplicates.length > 0 && newCards.length > 0) {
                const msg = `Found ${duplicates.length} duplicate(s):\n\n` +
                    duplicates.slice(0, 5).join(', ') +
                    (duplicates.length > 5 ? `\n...and ${duplicates.length - 5} more` : '') +
                    `\n\nImport ${newCards.length} new card(s)?`;
                if (!confirm(msg)) return;
            } else if (duplicates.length > 0 && newCards.length === 0) {
                UI.showToast('All cards already exist');
                return;
            }

            if (newCards.length > 0) {
                await CardDB.addCards(newCards);
                let msg = `Imported ${newCards.length} card${newCards.length !== 1 ? 's' : ''}`;
                if (duplicates.length > 0) msg += `, ${duplicates.length} skipped`;
                UI.showToast(msg);
            }

            textarea.value = '';
            _handleInput();
            await StatsModule.update();
            UI.showScreen('home');
        } catch (e) {
            console.error('Import error:', e);
            UI.showToast('Error importing cards');
        }
    }

    function init() {
        textarea  = document.getElementById('import-textarea');
        preview   = document.getElementById('import-preview');
        submitBtn = document.getElementById('import-submit-btn');

        textarea.addEventListener('input', _handleInput);
        submitBtn.addEventListener('click', _submit);
        document.getElementById('import-back-btn').addEventListener('click', () => UI.showScreen('home'));
    }

    return { init };
})();
