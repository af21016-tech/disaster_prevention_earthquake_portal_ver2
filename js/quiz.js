// --- グローバル変数 ---
let quizData = []; 
let currentStageIndex = 0;
let currentStageQuestions = []; 
let currentQuestionIndex = 0;
let correctCount = 0; 
let userReviewData = []; 
let questionStartTime = 0; 

const QUESTIONS_PER_PLAY = 10; 
const STAGE_TIME_LIMITS = [12.0, 10.0, 10.0]; // 初級: 12秒, 中級: 10秒, 上級: 10秒
let currentTimeLimit = 10.0;
let timeLeft = 10.0;
let timerInterval = null;
let isPracticeMode = false; // true: 制限時間なし（練習モード）, false: 制限時間あり（本番モード）

document.addEventListener('DOMContentLoaded', () => {
    // モード選択ボタンの制御
    const cardTimed = document.getElementById('quiz-mode-timed');
    const cardPractice = document.getElementById('quiz-mode-practice');

    if (cardTimed && cardPractice) {
        cardTimed.addEventListener('click', () => {
            isPracticeMode = false;
            cardTimed.classList.add('selected-timed');
            cardPractice.classList.remove('selected-practice');
        });

        cardPractice.addEventListener('click', () => {
            isPracticeMode = true;
            cardPractice.classList.add('selected-practice');
            cardTimed.classList.remove('selected-timed');
        });
    }

    // 3つのステージボタンそれぞれのイベントリスナー
    const btnStage0 = document.getElementById('btn-start-stage0');
    if (btnStage0) btnStage0.addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('quiz-screen').style.display = 'block';
        initQuiz(0); // 初級
    });

    const btnStage1 = document.getElementById('btn-start-stage1');
    if (btnStage1) btnStage1.addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('quiz-screen').style.display = 'block';
        initQuiz(1); // 中級
    });

    const btnStage2 = document.getElementById('btn-start-stage2');
    if (btnStage2) btnStage2.addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('quiz-screen').style.display = 'block';
        initQuiz(2); // 上級
    });
    
    const btnNext = document.getElementById('btn-next');
    if (btnNext) btnNext.addEventListener('click', nextQuestion);
    
    const btnFinish = document.getElementById('btn-finish');
    if (btnFinish) btnFinish.addEventListener('click', showResultScreen);
    
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) btnRetry.addEventListener('click', () => {
        document.getElementById('result-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'block';
    });
});

// 引数で選ばれたステージ番号を受け取る
function initQuiz(stageIndex) {
    fetch('./assets/quiz_data.json')
        .then(res => res.json())
        .then(data => {
            quizData = data;
            startStage(stageIndex);
        })
        .catch(err => {
            console.error(err);
            const qText = document.getElementById('q-text');
            if (qText) qText.innerText = "JSONデータの読み込みに失敗しました。";
        });
}

function startStage(stageIndex) {
    currentStageIndex = stageIndex;
    currentTimeLimit = STAGE_TIME_LIMITS[currentStageIndex] !== undefined ? STAGE_TIME_LIMITS[currentStageIndex] : 10.0;
    
    let pool = [];
    if (Array.isArray(quizData)) {
        if (quizData.length > 0 && quizData[currentStageIndex].questions) {
            pool = quizData[currentStageIndex].questions;
        } else {
            pool = quizData;
        }
    } else if (quizData.questions) {
        pool = quizData.questions;
    }
    
    if (!pool || pool.length === 0) return;
    
    let arr = shuffleArray(pool);
    
    currentStageQuestions = arr.slice(0, QUESTIONS_PER_PLAY);
    currentQuestionIndex = 0;
    correctCount = 0;
    userReviewData = []; 
    loadQuestion();
}

function loadQuestion() {
    const qData = currentStageQuestions[currentQuestionIndex];
    if(!qData) return;
    
    const stageInfo = quizData[currentStageIndex];
    const stageNameDisplay = stageInfo ? `【${stageInfo.stageName}】 ` : '';

    const qCounter = document.getElementById('q-counter');
    if(qCounter) qCounter.innerText = `${stageNameDisplay}Q. ${currentQuestionIndex + 1} / ${currentStageQuestions.length}`;
    
    const qText = document.getElementById('q-text');
    if(qText) qText.innerText = qData.q || qData.question || "問題文がありません";
    
    const feedback = document.getElementById('feedback');
    if(feedback) feedback.style.display = 'none';
    
    const choicesDiv = document.getElementById('choices');
    if(choicesDiv) choicesDiv.style.display = 'flex';
    
    const progress = document.getElementById('progress');
    if(progress) progress.style.width = `${((currentQuestionIndex + 1) / currentStageQuestions.length) * 100}%`;

    let choicesArr = [];
    if (Array.isArray(qData.choices)) choicesArr = qData.choices;
    else if (Array.isArray(qData.options)) choicesArr = qData.options;
    
    if (choicesArr.length === 0) {
        choicesArr = [
            { label: "⭕ 正しい（適切な行動）", isTrue: true },
            { label: "❌ 誤り（危険・NG行動）", isTrue: false }
        ]; 
    }

    const choicesContainer = document.getElementById('choices');
    choicesContainer.innerHTML = ''; 
    choicesContainer.style.display = 'flex';

    choicesArr.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        
        let label = "";
        if (typeof item === 'object' && item !== null && item.label) {
            label = item.label;
        } else if (item === "〇") {
            label = "⭕ 正しい（適切な行動）";
        } else if (item === "✖") {
            label = "❌ 誤り（危険・NG行動）";
        } else {
            label = item;
        }
        
        btn.innerText = label;
        btn.onclick = () => checkAnswer(index, label, btn);
        choicesContainer.appendChild(btn);
    });
    
    const scoreCounter = document.getElementById('score-counter');
    if (scoreCounter) {
        scoreCounter.style.color = '#888';
        scoreCounter.style.fontWeight = 'normal';
    }

    questionStartTime = Date.now(); 
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    
    if (isPracticeMode) {
        // 練習モード：タイマーカウントダウンを行わず、無制限表示にする
        updatePracticeUI();
        return;
    }

    timeLeft = currentTimeLimit;
    updateTimerUI();

    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
            timeLeft = 0;
            clearInterval(timerInterval);
            processAnswer(null, "時間切れ", null); 
        }
        updateTimerUI();
    }, 100);
}

function updatePracticeUI() {
    const scoreCounter = document.getElementById('score-counter');
    if (scoreCounter) {
        scoreCounter.innerText = `スコア: ${correctCount}点`;
        scoreCounter.style.color = '#888';
    }
    const timerLabel = document.getElementById('timer-label');
    if (timerLabel) timerLabel.innerText = "訓練モード";
    
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        timerDisplay.innerHTML = `<span style="color:var(--cud-green); font-size:2.8rem;">🟢 練習（時間無制限）</span>`;
        timerDisplay.style.textShadow = '0 0 15px rgba(0, 230, 118, 0.4)';
    }
}

function updateTimerUI() {
    const scoreCounter = document.getElementById('score-counter');
    if (scoreCounter) {
        scoreCounter.innerText = `スコア: ${correctCount}点`;
        scoreCounter.style.color = '#888';
        scoreCounter.style.fontWeight = 'normal';
    }
    const timerLabel = document.getElementById('timer-label');
    if (timerLabel) timerLabel.innerText = "残り時間";

    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        timerDisplay.innerText = `${Math.max(0, timeLeft).toFixed(1)}秒`;
        if (timeLeft <= 3.0) {
            timerDisplay.style.color = '#FF2800'; 
            timerDisplay.style.textShadow = '0 0 20px rgba(255, 40, 0, 0.8)';
        } else {
            timerDisplay.style.color = 'var(--text-main)';
            timerDisplay.style.textShadow = 'none';
        }
    }
}

function checkAnswer(userIndex, choiceText, btnElement) {
    clearInterval(timerInterval);
    processAnswer(userIndex, choiceText, btnElement);
}

function processAnswer(userIndex, choiceText, btnElement) {
    const qData = currentStageQuestions[currentQuestionIndex];
    let isCorrect = false;
    
    const correctAns = qData.a ?? qData.ans ?? qData.answer;
    
    if (typeof correctAns === 'boolean') {
        // userIndex 0 is True ("正しい"), userIndex 1 is False ("誤り")
        const userBool = (userIndex === 0);
        isCorrect = (correctAns === userBool);
    } else {
        if (correctAns === userIndex || correctAns === (userIndex + 1) || correctAns === choiceText) {
            isCorrect = true;
        }
    }
    
    if (isCorrect) correctCount++;
    
    if (btnElement) {
        if (userIndex === 0) {
            btnElement.style.background = 'rgba(0, 230, 118, 0.12)'; 
            btnElement.style.borderColor = 'var(--cud-green)';
        } else if (userIndex === 1) {
            btnElement.style.background = 'rgba(86, 180, 233, 0.12)'; 
            btnElement.style.borderColor = 'var(--cud-blue)';
        } else {
            btnElement.style.background = 'rgba(255, 123, 0, 0.12)';
            btnElement.style.borderColor = 'var(--cud-orange)';
        }
    }

    userReviewData.push({ q: qData.q, userAnswer: choiceText, isCorrect: isCorrect, exp: qData.exp });

    const choicesContainer = document.getElementById('choices');
    if (choicesContainer) choicesContainer.style.display = 'none';
    
    const fb = document.getElementById('feedback');
    if (fb) {
        fb.style.display = 'block';
        fb.className = isCorrect ? "feedback-box correct" : "feedback-box incorrect";
    }
    
    const rm = document.getElementById('fb-title');
    const expText = document.getElementById('fb-desc');
    
    if (userIndex === null) {
        if(fb) fb.className = "feedback-box incorrect";
        if(rm) { 
            rm.innerHTML = `<span style="font-size:1.25rem;">⏳</span> 逃げ遅れ（時間切れ）`; 
            rm.style.color = "var(--cud-orange)"; 
        }
        if(expText) {
            expText.innerHTML = `
                <div class="fb-summary" style="margin-bottom: 14px; padding: 12px 14px; background: var(--surface-hover); border-radius: 6px; font-size: 0.92rem; line-height: 1.6; border: 1px solid var(--border-color);">
                    <div style="color:var(--cud-orange); font-weight:bold; margin-bottom:4px;">【判断が遅れると命を落とします】</div>
                    <div><strong>行動の評価：</strong> <span style="font-weight: bold; color: ${correctAns ? 'var(--cud-green)' : 'var(--cud-orange)'};">${correctAns ? "⭕ この行動は【安全・推奨】です" : "⚠️ この行動は【危険・NG】です（やってはいけません）"}</span></div>
                </div>
                <div class="fb-explanation" style="line-height: 1.65; font-size: 0.95rem;">
                    ${qData.exp || "時間内に判断する訓練が必要です。"}
                </div>
            `;
        }
    } else if (isCorrect) {
        if(rm) { 
            rm.innerHTML = `<span style="font-size:1.25rem;">✅</span> 正解！ <span style="font-size:0.92rem; font-weight:normal; margin-left:8px; opacity:0.9;">あなたの判断は的確です</span>`; 
            rm.style.color = "var(--cud-green)"; 
        }
        const userChoiceLabel = (userIndex === 0) ? "⭕ 正しい（適切な行動）" : "❌ 誤り（危険・NG行動）";
        const actionEvaluation = correctAns 
            ? `<span style="color:var(--cud-green); font-weight:bold;">⭕ この行動は【安全・推奨】です</span>` 
            : `<span style="color:var(--cud-orange); font-weight:bold;">⚠️ この行動は【危険・NG】です（絶対にやってはいけません）</span>`;

        if(expText) {
            expText.innerHTML = `
                <div class="fb-summary" style="margin-bottom: 14px; padding: 12px 14px; background: var(--surface-hover); border-radius: 6px; font-size: 0.92rem; line-height: 1.6; border: 1px solid var(--border-color);">
                    <div><strong>あなたの選択：</strong> ${userChoiceLabel}</div>
                    <div><strong>行動の評価：</strong> ${actionEvaluation}</div>
                </div>
                <div class="fb-explanation" style="line-height: 1.65; font-size: 0.95rem;">
                    ${qData.exp || "正しい判断です。"}
                </div>
            `;
        }
    } else {
        if(rm) { 
            rm.innerHTML = `<span style="font-size:1.25rem;">⚠️</span> 不正解… <span style="font-size:0.92rem; font-weight:normal; margin-left:8px; opacity:0.9;">命を危険に晒す判断です</span>`; 
            rm.style.color = "var(--cud-orange)"; 
        }
        const userChoiceLabel = (userIndex === 0) ? "⭕ 正しい（適切な行動）" : "❌ 誤り（危険・NG行動）";
        const actionEvaluation = correctAns 
            ? `<span style="color:var(--cud-green); font-weight:bold;">⭕ 正しい行動は【安全・推奨】でした</span>` 
            : `<span style="color:var(--cud-orange); font-weight:bold;">⚠️ この行動は【危険・NG】です（絶対にやってはいけません）</span>`;

        if(expText) {
            expText.innerHTML = `
                <div class="fb-summary" style="margin-bottom: 14px; padding: 12px 14px; background: var(--surface-hover); border-radius: 6px; font-size: 0.92rem; line-height: 1.6; border: 1px solid var(--border-color);">
                    <div><strong>あなたの選択：</strong> ${userChoiceLabel}</div>
                    <div><strong>正しい評価：</strong> ${actionEvaluation}</div>
                </div>
                <div class="fb-explanation" style="line-height: 1.65; font-size: 0.95rem;">
                    ${qData.exp || "間違った判断は命を危険に晒します。"}
                </div>
            `;
        }
    }
    
    const btnNext = document.getElementById('btn-next');
    const btnFinish = document.getElementById('btn-finish');
    if (currentQuestionIndex < currentStageQuestions.length - 1) {
        if(btnNext) btnNext.style.display = 'inline-block';
        if(btnFinish) btnFinish.style.display = 'none';
    } else {
        if(btnNext) btnNext.style.display = 'none';
        if(btnFinish) btnFinish.style.display = 'inline-block';
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    loadQuestion();
}

function showResultScreen() {
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';

    const stage = quizData[currentStageIndex];
    const modeBadge = isPracticeMode 
        ? `<div style="font-size:0.9rem; color:var(--cud-green); margin-bottom:8px; font-weight:bold;">🟢 練習モード完了（時間無制限）</div>`
        : `<div style="font-size:0.9rem; color:var(--cud-orange); margin-bottom:8px; font-weight:bold;">🔥 本番タイムアタック完了</div>`;

    document.getElementById('final-score').innerHTML = `${modeBadge}${correctCount} / ${currentStageQuestions.length}`;
    const resultMsg = document.getElementById('result-message');

    if (correctCount === currentStageQuestions.length) {
        if(resultMsg) resultMsg.innerText = isPracticeMode 
            ? "全問正解です！しっかり理解できています。次は本番タイムアタックに挑戦してみましょう！"
            : "全問正解です！見事な判断力でした。緊迫した状況でも冷静に行動できる力があります。";
    } else {
        if(resultMsg) resultMsg.innerText = "間違えた問題の解説をよく復習し、繰り返し訓練して正しい判断を身につけましょう。";
    }

    // 本番モード（制限時間あり）かつ正答率80%以上でバッジ獲得
    const totalQ = currentStageQuestions.length;
    if (!isPracticeMode && totalQ > 0 && (correctCount / totalQ) >= 0.8) {
        if (typeof unlockBadge === 'function') {
            if (currentStageIndex === 0) unlockBadge('quiz_stage0');
            else if (currentStageIndex === 1) unlockBadge('quiz_stage1');
            else if (currentStageIndex === 2) unlockBadge('quiz_stage2');
        }
    }

    // クイズ結果画面のHTMLに、マイページへのデカデカとしたボタンを挿入する
    const resultContainer = document.getElementById('result-screen');
    appendMyPageLink(resultContainer);
}