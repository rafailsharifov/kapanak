/**
 * Enhanced SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 with a graduated interval schedule
 * for more granular early-phase repetition.
 *
 * Schedule for successful reviews (quality >= 3):
 *   rep 0 → 10 min   (learning phase)
 *   rep 1 → 1 day    (graduated phase)
 *   rep 2 → 3 days
 *   rep 3 → 7 days
 *   rep 4 → 14 days
 *   rep 5+ → interval × EF  (mature, standard SM-2)
 *
 * Quality ratings:
 * 0 - Complete blackout (Again)  → reset to rep 0, due in 1 min
 * 3 - Correct with difficulty (Good) → advance one step
 * 5 - Perfect response (Easy) → skip one step / 1.3× bonus
 */

// Graduated schedule: index = repetition count, value = minutes or days
// rep 0 is sub-day (minutes), reps 1-4 are day-based
const LEARNING_STEPS_MIN = [10];        // sub-day steps in minutes (rep 0)
const GRADUATED_DAYS = [1, 3, 7, 14];   // day-based steps (reps 1-4)
const LEARNING_COUNT = LEARNING_STEPS_MIN.length; // reps in learning phase
const GRADUATED_COUNT = GRADUATED_DAYS.length;    // reps in graduated phase
const MASTERY_THRESHOLD = LEARNING_COUNT + GRADUATED_COUNT; // rep 5+ = mastered

/**
 * Calculate the next review date and update card parameters
 * @param {Object} card - The card to update
 * @param {number} quality - Rating: 0 (Again), 3 (Good), or 5 (Easy)
 * @returns {Object} Updated card with new SM-2 values
 */
function calculateNextReview(card, quality) {
    const updated = { ...card };
    const now = new Date();

    updated.lastReviewed = now.toISOString();

    // Failed review — reset and re-learn
    if (quality < 3) {
        updated.repetitions = 0;
        updated.interval = 0;
        const dueDate = new Date(now.getTime() + 60 * 1000); // 1 minute
        updated.dueDate = dueDate.toISOString();
        return updated;
    }

    // Update ease factor (standard SM-2 formula, only affects mature phase)
    const newEF = updated.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    updated.easeFactor = Math.max(1.3, newEF);

    const rep = updated.repetitions;

    // --- Learning phase (sub-day intervals) ---
    if (rep < LEARNING_COUNT) {
        if (quality === 5) {
            // Easy: skip learning, graduate to first day interval
            updated.interval = GRADUATED_DAYS[0];
            updated.repetitions = LEARNING_COUNT + 1;
            const dueDate = new Date(now);
            dueDate.setDate(dueDate.getDate() + updated.interval);
            updated.dueDate = dueDate.toISOString();
        } else {
            // Good: advance through learning steps
            const minutes = LEARNING_STEPS_MIN[rep];
            updated.interval = 0; // sub-day marker
            updated.repetitions = rep + 1;
            const dueDate = new Date(now.getTime() + minutes * 60 * 1000);
            updated.dueDate = dueDate.toISOString();
        }
        return updated;
    }

    // --- Graduated phase (short day intervals) ---
    const gradIndex = rep - LEARNING_COUNT;
    if (gradIndex < GRADUATED_COUNT) {
        if (quality === 5 && gradIndex + 1 < GRADUATED_COUNT) {
            // Easy: skip one step
            updated.interval = GRADUATED_DAYS[gradIndex + 1];
            updated.repetitions = rep + 2;
        } else {
            updated.interval = GRADUATED_DAYS[gradIndex];
            updated.repetitions = rep + 1;
            if (quality === 5) {
                updated.interval = Math.round(updated.interval * 1.3);
            }
        }
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + updated.interval);
        updated.dueDate = dueDate.toISOString();
        return updated;
    }

    // --- Mature phase (standard SM-2) ---
    updated.interval = Math.round(updated.interval * updated.easeFactor);
    if (quality === 5) {
        updated.interval = Math.round(updated.interval * 1.3);
    }
    updated.repetitions = rep + 1;

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + updated.interval);
    updated.dueDate = dueDate.toISOString();

    return updated;
}

/**
 * Get human-readable interval hint for UI buttons
 * @param {Object} card - The card
 * @param {number} quality - Hypothetical quality rating
 * @returns {string} Human-readable interval
 */
function getIntervalHint(card, quality) {
    const simulated = calculateNextReview(card, quality);

    if (quality < 3) {
        return '1 min';
    }

    // Sub-day interval (learning phase)
    if (simulated.interval === 0) {
        const now = new Date();
        const due = new Date(simulated.dueDate);
        const minutes = Math.round((due - now) / (60 * 1000));
        if (minutes < 60) return `${minutes} min`;
        return `${Math.round(minutes / 60)} hr`;
    }

    const interval = simulated.interval;
    if (interval === 1) return '1 day';
    if (interval < 30) return `${interval} days`;
    if (interval < 365) {
        const months = Math.round(interval / 30);
        return months === 1 ? '1 month' : `${months} months`;
    }
    const years = Math.round(interval / 365 * 10) / 10;
    return years === 1 ? '1 year' : `${years} years`;
}

/**
 * Sort cards for review: learning cards first, then by due date
 * @param {Array} cards - Cards to sort
 * @returns {Array} Sorted cards
 */
function sortCardsForReview(cards) {
    const collator = new Intl.Collator('pl', { sensitivity: 'base' });

    return cards.sort((a, b) => {
        const aLearning = a.repetitions < MASTERY_THRESHOLD;
        const bLearning = b.repetitions < MASTERY_THRESHOLD;

        // Learning/graduated cards before mature cards
        if (aLearning && !bLearning) return -1;
        if (!aLearning && bLearning) return 1;

        // Within same category, by due date
        const dateA = new Date(a.dueDate);
        const dateB = new Date(b.dueDate);
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;

        // Finally by front text (Polish locale)
        return collator.compare(a.front, b.front);
    });
}

// Export functions and constants
window.SM2 = {
    calculateNextReview,
    getIntervalHint,
    sortCardsForReview,
    MASTERY_THRESHOLD
};
