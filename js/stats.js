/**
 * Stats module
 * Home screen stats, streak, and today count.
 */
window.StatsModule = (function () {
    'use strict';

    let dueCountEl, totalCountEl, todayReviewedEl, streakBanner, streakText;
    let pipelineNew, pipelineLearning, pipelineGraduated, pipelineMature;
    let pipelineSegNew, pipelineSegLearning, pipelineSegGraduated, pipelineSegMature;
    let studyBtn, practiceBtn, manageBtn, notebookBtn;

    async function update() {
        const [dueCount, totalCount, allCards] = await Promise.all([
            CardDB.getDueCount(),
            CardDB.getTotalCount(),
            CardDB.getAllCards()
        ]);

        dueCountEl.textContent   = dueCount;
        totalCountEl.textContent = totalCount;

        const MT = SM2.MASTERY_THRESHOLD;
        let newC = 0, learnC = 0, gradC = 0, matureC = 0;
        for (const c of allCards) {
            if      (c.repetitions === 0 && !c.lastReviewed) newC++;
            else if (c.repetitions < 3)   learnC++;
            else if (c.repetitions < MT)  gradC++;
            else                          matureC++;
        }

        pipelineNew.textContent       = newC;
        pipelineLearning.textContent  = learnC;
        pipelineGraduated.textContent = gradC;
        pipelineMature.textContent    = matureC;

        if (totalCount > 0) {
            pipelineSegNew.style.width       = `${(newC   / totalCount) * 100}%`;
            pipelineSegLearning.style.width  = `${(learnC / totalCount) * 100}%`;
            pipelineSegGraduated.style.width = `${(gradC  / totalCount) * 100}%`;
            pipelineSegMature.style.width    = `${(matureC/ totalCount) * 100}%`;
        } else {
            [pipelineSegNew, pipelineSegLearning, pipelineSegGraduated, pipelineSegMature]
                .forEach(s => s.style.width = '0%');
        }

        const today     = new Date().toDateString();
        const storedDate = localStorage.getItem('kapanak-review-date');
        const todayCount = storedDate === today
            ? parseInt(localStorage.getItem('kapanak-today-count') || '0', 10)
            : 0;
        todayReviewedEl.textContent = todayCount;

        _updateStreak();

        studyBtn.disabled   = dueCount === 0;
        practiceBtn.disabled = totalCount === 0;
        if (manageBtn)   manageBtn.disabled   = totalCount === 0;
        if (notebookBtn) notebookBtn.disabled  = totalCount === 0;
    }

    function _updateStreak() {
        const streak    = parseInt(localStorage.getItem('kapanak-streak') || '0', 10);
        const lastStudy = localStorage.getItem('kapanak-last-study');
        const today     = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        let current = streak;
        if (lastStudy !== today && lastStudy !== yesterday) {
            current = 0;
            localStorage.setItem('kapanak-streak', '0');
        }

        streakText.textContent = `${current} day streak`;
        streakBanner.classList.toggle('inactive', current === 0);
    }

    function init() {
        dueCountEl      = document.getElementById('due-count');
        totalCountEl    = document.getElementById('total-count');
        todayReviewedEl = document.getElementById('today-reviewed');
        streakBanner    = document.getElementById('streak-banner');
        streakText      = document.getElementById('streak-text');

        pipelineNew       = document.getElementById('pipeline-new');
        pipelineLearning  = document.getElementById('pipeline-learning');
        pipelineGraduated = document.getElementById('pipeline-graduated');
        pipelineMature    = document.getElementById('pipeline-mature');

        pipelineSegNew       = document.getElementById('pipeline-seg-new');
        pipelineSegLearning  = document.getElementById('pipeline-seg-learning');
        pipelineSegGraduated = document.getElementById('pipeline-seg-graduated');
        pipelineSegMature    = document.getElementById('pipeline-seg-mature');

        studyBtn    = document.getElementById('study-btn');
        practiceBtn = document.getElementById('practice-btn');
        manageBtn   = document.getElementById('manage-btn');
        notebookBtn = document.getElementById('notebook-btn');
    }

    return { init, update };
})();
