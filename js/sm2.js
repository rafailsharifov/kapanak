/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo 2 algorithm by Piotr Wozniak
 *
 * Quality ratings:
 * 0 - Complete blackout (Again)
 * 1 - Incorrect, but upon seeing answer, remembered (not used in UI)
 * 2 - Incorrect, but answer seemed easy to recall (not used in UI)
 * 3 - Correct with serious difficulty (Good)
 * 4 - Correct after hesitation (not used in UI)
 * 5 - Perfect response (Easy)
 */

/**
 * Calculate the next review date and update card parameters
 * @param {Object} card - The card to update
 * @param {number} quality - Rating from 0-5
 * @returns {Object} Updated card with new SM-2 values
 */
function calculateNextReview(card, quality) {
    // Clone the card to avoid mutation
    const updated = { ...card };
    const now = new Date();

    updated.lastReviewed = now.toISOString();

    // If quality < 3, reset the card (failed review)
    if (quality < 3) {
        updated.repetitions = 0;
        updated.interval = 0;
        // Set due date to ~1 minute from now (for "Again" button)
        const dueDate = new Date(now.getTime() + 60 * 1000);
        updated.dueDate = dueDate.toISOString();
        return updated;
    }

    // Calculate new ease factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const newEF = updated.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    updated.easeFactor = Math.max(1.3, newEF); // EF should never go below 1.3

    // Calculate new interval
    if (updated.repetitions === 0) {
        updated.interval = 1; // First successful review: 1 day
    } else if (updated.repetitions === 1) {
        updated.interval = 6; // Second successful review: 6 days
    } else {
        // Subsequent reviews: interval * EF
        updated.interval = Math.round(updated.interval * updated.easeFactor);
    }

    // Bonus for "Easy" rating (quality 5)
    if (quality === 5) {
        updated.interval = Math.round(updated.interval * 1.3);
    }

    // Increment repetition count
    updated.repetitions += 1;

    // Calculate due date
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + updated.interval);
    updated.dueDate = dueDate.toISOString();

    return updated;
}

/**
 * Get human-readable interval hint for UI
 * @param {Object} card - The card
 * @param {number} quality - Hypothetical quality rating
 * @returns {string} Human-readable interval
 */
function getIntervalHint(card, quality) {
    // Simulate the review to get the interval
    const simulated = calculateNextReview(card, quality);

    if (quality < 3) {
        return '<1min';
    }

    const interval = simulated.interval;

    if (interval === 1) {
        return '1 day';
    } else if (interval < 30) {
        return `${interval} days`;
    } else if (interval < 365) {
        const months = Math.round(interval / 30);
        return months === 1 ? '1 month' : `${months} months`;
    } else {
        const years = Math.round(interval / 365 * 10) / 10;
        return years === 1 ? '1 year' : `${years} years`;
    }
}

/**
 * Sort cards for review with Polish locale awareness
 * New cards first (repetitions === 0), then by due date
 * @param {Array} cards - Cards to sort
 * @returns {Array} Sorted cards
 */
function sortCardsForReview(cards) {
    const collator = new Intl.Collator('pl', { sensitivity: 'base' });

    return cards.sort((a, b) => {
        // New cards first
        if (a.repetitions === 0 && b.repetitions !== 0) return -1;
        if (a.repetitions !== 0 && b.repetitions === 0) return 1;

        // Then by due date
        const dateA = new Date(a.dueDate);
        const dateB = new Date(b.dueDate);
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;

        // Finally by front text (Polish locale)
        return collator.compare(a.front, b.front);
    });
}

// Export functions
window.SM2 = {
    calculateNextReview,
    getIntervalHint,
    sortCardsForReview
};
