let fakeNewsData = []; 
let currentQuestions = []; 
let currentQuestionIndex = 0;
let correctCount = 0;
let userReviewData = [];
let questionStartTime = 0; 

const QUESTIONS_PER_PLAY = 10; 
const TIME_LIMIT = 15.0; // 投稿文とアカウントを吟味できるよう15秒に設定
let timeLeft = TIME_LIMIT;
let timerInterval = null;
let isPracticeMode = false; // true: 制限時間なし（練習モード）, false: 制限時間あり（本番モード）

const resultScreen = document.getElementById('result-screen');

document.addEventListener('DOMContentLoaded', () => {
    fetch('./assets/fake_news_data.json')
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(data => {
            fakeNewsData = data;
        })
        .catch(error => {
            console.error('Data load error:', error);
            const pText = document.getElementById('p-text');
            if (pText) pText.innerText = "データの読み込みに失敗しました。ページをリロードしてください。";
        });

    // モード選択ボタンの制御
    const cardTimed = document.getElementById('fake-mode-timed');
    const cardPractice = document.getElementById('fake-mode-practice');

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

    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', startQuiz);
    }
        
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', () => checkAnswer(true));
        btnShare.onmouseover = () => { btnShare.style.background = 'rgba(255, 40, 0, 0.15)'; };
        btnShare.onmouseout = () => { btnShare.style.background = '#111'; };
    }

    const btnIgnore = document.getElementById('btn-ignore');
    if (btnIgnore) {
        btnIgnore.addEventListener('click', () => checkAnswer(false));
        btnIgnore.onmouseover = () => { btnIgnore.style.background = 'rgba(86, 180, 233, 0.15)'; };
        btnIgnore.onmouseout = () => { btnIgnore.style.background = '#111'; };
    }
});

function startQuiz() {
    if (!fakeNewsData || fakeNewsData.length === 0) return;
    currentQuestions = shuffleArray(fakeNewsData).slice(0, QUESTIONS_PER_PLAY);
    currentQuestionIndex = 0;
    correctCount = 0;
    userReviewData = []; 

    const quizScreen = document.getElementById('quiz-screen');
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.style.display = 'none';
    if (quizScreen) quizScreen.style.display = 'block';
    if (resultScreen) resultScreen.style.display = 'none';

    loadQuestion();
}

function loadQuestion() {
    const qData = currentQuestions[currentQuestionIndex];
    if (!qData) return;

    const qCounter = document.getElementById('q-counter');
    if (qCounter) qCounter.innerText = `Q. ${currentQuestionIndex + 1} / ${currentQuestions.length}`;

    const scoreCounter = document.getElementById('score-counter');
    if (scoreCounter) scoreCounter.innerText = `スコア: ${correctCount}点`;
    
    const pIcon = document.getElementById('p-icon');
    const pName = document.getElementById('p-name');
    const pBadge = document.getElementById('p-badge');
    const pId = document.getElementById('p-id');
    const pText = document.getElementById('p-text');
    
    if (pName) pName.innerText = qData.name || "ユーザー";
    if (pId) pId.innerText = qData.id || "@user";
    if (pText) pText.innerText = qData.q;

    // アカウントアイコンとバッジ表示
    if (pIcon) {
        if (qData.isOfficial) {
            pIcon.innerText = "🏛️";
            pIcon.style.background = "#1d9bf0";
        } else {
            pIcon.innerText = "👤";
            pIcon.style.background = "#333";
        }
    }

    if (pBadge) {
        if (qData.isOfficial) {
            pBadge.style.display = "inline-flex";
            pBadge.innerText = "✓ 認証";
        } else {
            pBadge.style.display = "none";
        }
    }
    
    const actionBtns = document.getElementById('action-btns');
    if (actionBtns) actionBtns.style.display = 'flex';
    
    const feedback = document.getElementById('feedback');
    if (feedback) feedback.style.display = 'none';

    questionStartTime = Date.now(); 
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    
    if (isPracticeMode) {
        // 練習モード：タイマーカウントダウンなし
        const timerLabel = document.getElementById('timer-label');
        if (timerLabel) timerLabel.innerText = "訓練モード";

        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.innerHTML = `<span style="color:var(--cud-green); font-size:2.5rem;">🟢 練習（時間無制限）</span>`;
            timerDisplay.style.textShadow = '0 0 15px rgba(0, 230, 118, 0.4)';
        }
        return;
    }

    timeLeft = TIME_LIMIT;
    updateTimerUI();

    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
            timeLeft = 0;
            clearInterval(timerInterval);
            processAnswer(null); // 時間切れ
        }
        updateTimerUI();
    }, 100);
}

function updateTimerUI() {
    const timerLabel = document.getElementById('timer-label');
    if (timerLabel) timerLabel.innerText = "残り判断時間";

    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        timerDisplay.innerText = `${Math.max(0, timeLeft).toFixed(1)}秒`;
        if (timeLeft > 7.0) {
            timerDisplay.style.color = 'var(--cud-purple)'; 
            timerDisplay.style.textShadow = 'none';
        } else if (timeLeft > 3.0) {
            timerDisplay.style.color = 'var(--cud-yellow)'; 
            timerDisplay.style.textShadow = 'none';
        } else {
            timerDisplay.style.color = '#FF2800'; 
            timerDisplay.style.textShadow = '0 0 20px rgba(255,40,0,0.6)';
        }
    }
}

function checkAnswer(userAnswer) {
    clearInterval(timerInterval);
    processAnswer(userAnswer);
}

function processAnswer(userAnswer) {
    const qData = currentQuestions[currentQuestionIndex];
    const isCorrect = (userAnswer !== null && userAnswer === qData.a);
    if (isCorrect) correctCount++;

    const scoreCounter = document.getElementById('score-counter');
    if (scoreCounter) scoreCounter.innerText = `スコア: ${correctCount}点`;

    userReviewData.push({
        q: qData.q,
        name: qData.name,
        correctAnswer: qData.a,
        userAnswer: userAnswer,
        isCorrect: isCorrect,
        exp: qData.exp
    });

    const actionBtns = document.getElementById('action-btns');
    if (actionBtns) actionBtns.style.display = 'none';
    
    const fb = document.getElementById('feedback');
    if (fb) fb.style.display = 'block';
    
    const fbTitle = document.getElementById('fb-title');
    const fbDesc = document.getElementById('fb-desc');

    if (userAnswer === null) {
        // 時間切れ
        if (fb) fb.className = "feedback-area incorrect";
        if (fbTitle) {
            fbTitle.innerText = "⏳ 思考停止（判断時間切れ）";
            fbTitle.style.color = "var(--cud-orange)";
        }
        if (fbDesc) {
            fbDesc.innerHTML = `<strong style="color:var(--cud-orange);">【迷っている間に情報が流れていきます】</strong><br>${qData.exp}`;
        }
    } else if (isCorrect) {
        if (fb) fb.className = "feedback-area correct";
        if (fbTitle) {
            if (userAnswer === true) {
                fbTitle.innerText = "⭕ 正しい判断！（有益な情報を拡散）";
            } else {
                fbTitle.innerText = "⭕ 見破りました！（デマの拡散を阻止）";
            }
            fbTitle.style.color = "var(--cud-green)";
        }
        if (fbDesc) fbDesc.innerHTML = qData.exp;
    } else {
        if (fb) fb.className = "feedback-area incorrect";
        if (fbTitle) {
            if (userAnswer === true) {
                fbTitle.innerText = "❌ デマを拡散してしまいました！（インフォデミック加担）";
            } else {
                fbTitle.innerText = "❌ 周知が必要な公式情報でした（拡散見送り）";
            }
            fbTitle.style.color = "var(--cud-orange)";
        }
        if (fbDesc) fbDesc.innerHTML = qData.exp;
    }
    
    const btnNext = document.getElementById('btn-next');
    const btnFinish = document.getElementById('btn-finish');
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        if (btnNext) btnNext.style.display = 'inline-block';
        if (btnFinish) btnFinish.style.display = 'none';
        if (btnNext) btnNext.onclick = nextQuestion;
    } else {
        if (btnNext) btnNext.style.display = 'none';
        if (btnFinish) btnFinish.style.display = 'inline-block';
        if (btnFinish) btnFinish.onclick = showResultScreen;
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    loadQuestion();
}

function showResultScreen() {
    const quizScreen = document.getElementById('quiz-screen');
    const resultScreen = document.getElementById('result-screen');
    if (quizScreen) quizScreen.style.display = 'none';
    if (resultScreen) resultScreen.style.display = 'block';

    const modeBadge = isPracticeMode 
        ? `<div style="font-size:0.9rem; color:var(--cud-green); margin-bottom:8px; font-weight:bold;">🟢 練習モード完了（時間無制限）</div>`
        : `<div style="font-size:0.9rem; color:#b366ff; margin-bottom:8px; font-weight:bold;">🔥 本番タイムアタック完了</div>`;

    const finalScore = document.getElementById('final-score');
    if (finalScore) finalScore.innerHTML = `${modeBadge}${correctCount} / ${currentQuestions.length}`;

    const resultMsg = document.getElementById('result-message');
    if (resultMsg) {
        if (correctCount === currentQuestions.length) {
            resultMsg.innerHTML = isPracticeMode
                ? `<span style="font-size:3rem; margin-bottom:10px; display:inline-block;">🛡️</span><br><strong>全問見極め成功！</strong><br>細部まで注意深く観察できました。次は15秒制限の「本番モード」で実戦的な流速を体験してみましょう！`
                : `<span style="font-size:3rem; margin-bottom:10px; display:inline-block;">🛡️</span><br><strong>見事な情報リテラシーです！全問見極め成功！</strong><br>偽情報や詐欺に惑わされず、本当に必要な情報だけを共有できる頼もしい判断力を持っています。`;
        } else if (correctCount >= 7) {
            resultMsg.innerHTML = `<span style="font-size:2.5rem; margin-bottom:10px; display:inline-block;">📱</span><br><strong>優秀な見極め力です（合格ライン）</strong><br>あと少しで満点です！巧妙ななりすましや古い情報に気をつけて再挑戦してみましょう。`;
        } else {
            resultMsg.innerHTML = `<span style="font-size:2.5rem; margin-bottom:10px; display:inline-block;">⚠️</span><br><strong>注意！デマや詐欺に騙されやすい状態です</strong><br>災害時は不安や善意から不用意に拡散しがちです。「一歩立ち止まって公式確認」を意識して再訓練しましょう。`;
        }
    }

    // 本番モード（制限時間あり）かつ正答率80%以上（10問中8問以上正解）でバッジ獲得
    if (!isPracticeMode && currentQuestions.length > 0 && (correctCount / currentQuestions.length) >= 0.8) {
        if (typeof unlockBadge === 'function') {
            unlockBadge('fake_news_buster');
        }
    }

    // 再挑戦ボタン
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) {
        btnRetry.onclick = () => {
            if (resultScreen) resultScreen.style.display = 'none';
            if (quizScreen) quizScreen.style.display = 'block';
            startQuiz();
        };
    }

    // クイズ結果画面のHTMLに、マイページへのデカデカとしたボタンを挿入する
    const resultContainer = document.getElementById('result-screen');
    appendMyPageLink(resultContainer);
}