let contentBox;
let trainingMode = "timed"; // "timed" (制限時間あり) or "practice" (制限時間なし)
let currentSceneId = null;
let currentPhase = 0; 
let timerAnimation;
let startTime;
let timeLimit;
let isAnswered = false;
let questionStartTime = 0; 
let playerConfig = {};

let isRhythmGameActive = false;
let rhythmStartTime = 0;
let combo = 0;
let rhythmAnimFrame = null;
let bgmAudio = null; 
let targetEarthquakeTime = 5000; 



const scenarios = {
    sleep: {
        title: "SCENE 1：就寝中の寝室",
        setupSteps: [
            {
                id: "direction", text: "あなたの現実の寝室を思い浮かべてください。<br>一番背の高い家具（本棚やタンス）、または窓は、ベッドから見てどの方向にありますか？",
                options: [
                    { id: "top", icon: "⬆️", text: "頭の方向", nextStep: "fixed" },
                    { id: "bottom", icon: "⬇️", text: "足の方向", nextStep: "fixed" },
                    { id: "side", icon: "⬅️", text: "横の方向", nextStep: "fixed" },
                    { id: "none", icon: "✅", text: "家具も窓もない", nextStep: "done" }
                ]
            },
            {
                id: "fixed", text: "その家具（または窓ガラス）は、L字金具や飛散防止フィルムなどで、しっかりと【固定・対策】されていますか？",
                options: [
                    { id: "yes", icon: "🛡️", text: "はい（対策している）", nextStep: "done" },
                    { id: "no", icon: "⚠️", text: "いいえ（対策していない）", nextStep: "done" }
                ]
            }
        ],
        phases: [
            {   
                time: 7000, 
                getText: () => `<span class="alert-text"><span class="keyword-danger">激しい揺れ</span>で目が覚めました！</span><br><span class="phase-badge">Phase 1: DROP (まず低く)</span><br>周囲は真っ暗です。<strong>まずどう行動しますか！？</strong>`,
                options: [
                    { icon: "💡", text: "<strong>電気をつける</strong>", isCorrect: false, feedback: "暗闇での移動は、飛散したガラス等で足を切り、動けなくなる危険性が極めて高いです。" },
                    { icon: "🚪", text: "<strong>ドアを開ける</strong>", isCorrect: false, feedback: "揺れている最中に立ち上がるのは不可能です。転倒して大けがをします。" },
                    { icon: "🛌", text: "<strong>起き上がらない</strong>", isCorrect: true, feedback: "就寝中の最大の脅威は「転倒」です。絶対に起き上がらず、布団に留まるのが鉄則です。" }
                ]
            },
            {   
                time: 7000,
                getText: () => {
                    if (playerConfig.directionId === 'none') return `<span class="phase-badge">Phase 2: COVER (頭を守る)</span><br>家具はありませんが、<span class="keyword-warning">天井の照明</span>が激しく揺れています！<br>どうやって<strong>頭を守りますか！？</strong>`;
                    if (playerConfig.fixedId === 'yes') return `<span class="phase-badge">Phase 2: COVER (頭を守る)</span><br><strong>${playerConfig.direction}</strong>の家具は固定されていますが、<span class="keyword-warning">天井の照明の落下</span>に警戒が必要です！<br>どうやって<strong>頭を守りますか！？</strong>`;
                    return `<span class="phase-badge">Phase 2: COVER (頭を守る)</span><br>激しい揺れの中、<strong>${playerConfig.direction}</strong>から<span class="keyword-danger">固定されていない家具が倒れてきました！</span><br>どうやって<strong>頭を守りますか！？</strong>`;
                },
                options: [
                    { icon: "📱", text: "<strong>スマホ</strong>でライトを照らす", isCorrect: false, feedback: "頭が無防備なままでは落下物の直撃を受けます。" },
                    { icon: "👐", text: "<strong>両手</strong>で頭を覆う", isCorrect: false, feedback: "手だけでは防具として不十分です。重量物の落下には耐えられません。" },
                    { icon: "枕", text: "<strong>布団や枕</strong>を深く被る", isCorrect: true, feedback: "暗闇では身近にある寝具が最高の盾（ヘルメット代わり）になります。" }
                ]
            }
        ],
        hold: { 
            time: 4000, 
            text: `<span class="alert-text">【Phase 3: HOLD ON (動かない)】</span><br><span class="keyword-danger" style="font-size:1.3rem;">本震が襲来！</span><br>下のボタンを<strong>【4秒間 長押し】</strong>して、揺れが収まるまで布団の中で耐え抜いてください！`,
            failText: "指が離れてしまいました。恐怖に耐えきれず暗闇へ逃げ出し、飛散したガラスを踏んで負傷しました。「揺れが収まるまでその場から動かない」という強い意志が必要です。",
            getClearText: () => {
                if (playerConfig.directionId === 'none') return "布団の中で頭を守り抜きました。<br><br>家具のない寝室は、地震において非常に安全な空間です。今後もその環境を維持してください。";
                if (playerConfig.fixedId === 'yes') return "布団の中で頭を守り抜きました。<br><br>素晴らしいです。あなたが家具を【固定】していたおかげで、倒壊による圧死やガラス飛散のリスクを最小限に抑えることができました。日頃の備えが命を救う最大の防御です。";
                return "布団の中で頭を守り抜きました。<br><br>今回はなんとか助かりましたが、先ほどあなたが選んだ「固定されていない背の高い家具」。現実の地震では、これが凶器となって命を奪います。このシミュレーションを機に、どうか家具の固定をお願いします。";
            }
        }
    },
    arena: {
        title: "SCENE 2：アリーナ会場", setupSteps: [], 
        phases: [
            {
                time: 7000, 
                getText: () => `<span class="alert-text">警報音！会場が突然停電しました！</span><br><span class="phase-badge">Phase 1: DROP (まず低く)</span><br>満員の観客席に<span class="keyword-danger">強い揺れ</span>が来ます！どう行動しますか！？`,
                options: [
                    { icon: "🏃", text: "<strong>出口へ走る</strong>", isCorrect: false, feedback: "出口付近で将棋倒し（群集事故）が発生し、圧死する危険性が極めて高くなります。" },
                    { icon: "🚶", text: "<strong>通路へ出る</strong>", isCorrect: false, feedback: "暗闇の中で通路に出ると、逃げ惑う他の観客に踏みつぶされる危険があります。" },
                    { icon: "🧎", text: "<strong>その場にしゃがむ</strong>", isCorrect: true, feedback: "アリーナ席で最も恐ろしいのは「群衆雪崩」です。絶対に移動せず、その場で小さくなるのが正解です。" }
                ]
            },
            {
                time: 7000, 
                getText: () => `<span class="phase-badge">Phase 2: COVER (頭を守る)</span><br>暗闇の中、頭上で<span class="keyword-warning">天井の大型照明がきしむ音</span>が響きます！<br>どうやって<strong>頭を守りますか！？</strong>`,
                options: [
                    { icon: "🪑", text: "<strong>座席の下</strong>に潜る", isCorrect: false, feedback: "アリーナの椅子は狭く、下に潜り込むことは物理的に困難で、かえって身動きが取れなくなります。" },
                    { icon: "📱", text: "<strong>スマホ</strong>で情報を探す", isCorrect: false, feedback: "情報収集は揺れが収まってからです。今は頭を守るのが最優先です。" },
                    { icon: "👜", text: "<strong>カバンや上着</strong>で頭を覆う", isCorrect: true, feedback: "机がない場所では、自分の持っているカバンや上着で頭を保護します。" }
                ]
            }
        ],
        hold: { 
            time: 4000, 
            text: `<span class="alert-text">【Phase 3: HOLD ON (動かない)】</span><br><span class="keyword-danger" style="font-size:1.3rem;">激しい揺れと周囲のパニック！</span><br>立ち上がろうとする周囲の波に流されず、下のボタンを<strong>【4秒間 長押し】</strong>して耐え抜いてください！`,
            failText: "指が離れてしまいました。恐怖から防御姿勢を解いて立ち上がってしまい、暗闇の中で転倒し、逃げ惑う他の観客に踏みつぶされました。「揺れている最中の移動」は自殺行為です。",
            getClearText: () => "激しい揺れを耐え抜き、その後のパニックにも巻き込まれずに冷静に行動できました。<br><br>アリーナのような巨大空間では、揺れの最中や直後に一斉に出口へ走る「同調圧力」が群集事故（将棋倒し）の最大のトリガーとなります。周囲のパニックに流されず、自らの判断で座席に留まり、係員の指示を待つ『落ち着いた行動』があなたの命を救いました。"
        },
        afterHold: { 
            time: 8000, 
            getText: () => `<span class="phase-badge">Phase 4: WAIT & FOLLOW (指示を待つ)</span><br>揺れは収まりましたが、<span class="keyword-danger">「早く逃げろ！」と一部の観客が出口へ殺到</span>しています！<br>あなたはどう行動しますか？`,
            options: [
                { icon: "🏃", text: "<strong>人の波に乗って</strong>出口へ急ぐ", isCorrect: false, feedback: "出口付近は最も将棋倒し（群集事故）が起きやすい危険地帯です。パニックになった群衆の流れに乗るのは自殺行為です。" },
                { icon: "🔦", text: "<strong>スマホの明かりで</strong>非常口を探す", isCorrect: false, feedback: "暗闇での単独行動は危険です。勝手な方向に動くことで他の観客と衝突し、パニックをさらに助長してしまいます。" },
                { icon: "🧘", text: "<strong>その場に留まり</strong>、指示を待つ", isCorrect: true, feedback: "大正解です。巨大施設では、安全が確認されるまで『動かない』ことが最大の防御になります。出口に殺到せず、落ち着いて公式の誘導を待つのが鉄則です。" }
            ]
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            document.getElementById('start-screen').style.display = 'none';
            document.getElementById('training-screen').style.display = 'none';
            
            const mainEl = document.querySelector('main');
            let mainContainer = document.getElementById('main-container');
            if (!mainContainer) {
                mainContainer = document.createElement('div');
                mainContainer.id = 'main-container';
                mainContainer.className = 'main-container';
                mainEl.appendChild(mainContainer);
                
                const contentBox = document.createElement('div');
                contentBox.id = 'content-box';
                contentBox.style.width = '100%';
                contentBox.style.padding = '0 20px';
                mainContainer.appendChild(contentBox);
            }
            showMenu();
        });
    }
});

function setTrainingMode(mode) {
    trainingMode = mode;
    showMenu();
}

function showMenu() {
    contentBox = document.getElementById("content-box");
    contentBox.innerHTML = `
        <h2 style="color: #FFBE00; margin-bottom: 0.5rem; font-size: 1.8rem;">シミュレーション設定</h2>
        <p style="color: var(--text-sub); font-size: 0.95rem; margin-bottom: 1.5rem;">訓練モードと環境を選択してスタートしてください</p>
        
        <!-- モード選択 -->
        <div style="background: var(--surface-hover); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-bottom: 2rem;">
            <div style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 10px; font-weight: bold; text-align: left; letter-spacing: 0.05em;">
                STEP 1. 訓練モードを選択
            </div>
            <div class="mode-select-grid">
                <div class="mode-card ${trainingMode === 'timed' ? 'selected-timed' : ''}" onclick="setTrainingMode('timed')">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span style="font-size: 1.6rem;">⏱️</span>
                        <span style="font-weight: bold; font-size: 1.15rem; color: ${trainingMode === 'timed' ? '#FF2800' : 'var(--text-main)'};">実戦モード</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #FFBE00; margin-top: 6px; font-weight: bold;">【制限時間あり (7〜8秒)】</div>
                    <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 4px; line-height: 1.4;">
                        緊急地震速報のリアルな緊迫感と初動の瞬発的判断を体験
                    </div>
                </div>
                <div class="mode-card ${trainingMode === 'practice' ? 'selected-practice' : ''}" onclick="setTrainingMode('practice')">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span style="font-size: 1.6rem;">📖</span>
                        <span style="font-weight: bold; font-size: 1.15rem; color: ${trainingMode === 'practice' ? '#56B4E9' : 'var(--text-main)'};">練習モード</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #56B4E9; margin-top: 6px; font-weight: bold;">【制限時間なし (無制限)】</div>
                    <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 4px; line-height: 1.4;">
                        状況文や選択肢を落ち着いて読みながら学習<br><span style="color:#F0E442;">※HOLD ON（長押し4秒）は維持</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 環境選択 -->
        <div style="text-align: left; margin-bottom: 10px; font-size: 0.85rem; color: var(--text-sub); font-weight: bold; letter-spacing: 0.05em;">
            STEP 2. シミュレーション環境を選択
        </div>
        <div style="display:flex; flex-direction:column; gap: 12px;">
            <button class="shakeout-menu-btn" style="max-width:100%; justify-content: flex-start; padding: 18px 20px; border-radius: 10px;" onclick="startScenario('sleep')">
                <span style="font-size:2.4rem; min-width: 50px;">🛏️</span>
                <div style="text-align: left;">
                    <div style="font-size: 1.15rem; font-weight: bold; color: var(--text-main);">就寝中（自室マッピング）</div>
                    <div style="font-size: 0.8rem; color: var(--text-sub); margin-top: 3px;">自室の家具配置・固定状況に応じたパーソナライズ訓練</div>
                </div>
            </button>
            <button class="shakeout-menu-btn" style="max-width:100%; justify-content: flex-start; padding: 18px 20px; border-radius: 10px;" onclick="startScenario('arena')">
                <span style="font-size:2.4rem; min-width: 50px;">🏟️</span>
                <div style="text-align: left;">
                    <div style="font-size: 1.15rem; font-weight: bold; color: var(--text-main); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span>ライブ会場（アリーナ）</span><span style="font-size: 0.75rem; background: rgba(255, 123, 0, 0.15); color: var(--cud-orange); border: 1px solid var(--cud-orange); padding: 2px 7px; border-radius: 4px; font-weight: bold;">🔊 音が出ます</span></div>
                    <div style="font-size: 0.8rem; color: var(--text-sub); margin-top: 3px;">大規模集客施設での群衆パニックと同調圧力への抵抗訓練 <span style="color: var(--cud-orange); font-weight: bold;">※BGM・音が出ます（音量注意）</span></div>
                </div>
            </button>
        </div>
    `;
}
function startScenario(sceneId) {
    currentSceneId = sceneId;
    currentPhase = 0;
    playerConfig = {};
    if (scenarios[sceneId].setupSteps && scenarios[sceneId].setupSteps.length > 0) showSetupStep(0);
    else startArenaRhythmGame();
}

function showSetupStep(stepIndex) {
    const setupData = scenarios[currentSceneId].setupSteps[stepIndex];
    let html = `<h2 class="scene-title" style="margin-bottom:1.5rem;">${scenarios[currentSceneId].title}</h2><p class="situation-text" style="font-size:1.1rem; line-height:1.6; margin-bottom:2rem;">${setupData.text}</p><div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px;">`;
    setupData.options.forEach(opt => {
        html += `<button class="shakeout-setup-btn" onclick="saveSetup('${setupData.id}', '${opt.text}', '${opt.id}', '${opt.nextStep}')">
                    <span style="font-size:3rem;">${opt.icon}</span><span>${opt.text}</span>
                 </button>`;
    });
    html += `</div>`;
    document.getElementById('content-box').innerHTML = html;
}

function saveSetup(setupId, text, valueId, nextStep) {
    playerConfig[setupId] = text;
    playerConfig[setupId + "Id"] = valueId;
    if (nextStep === "fixed") showSetupStep(1);
    else if (nextStep === "done") startCountdown();
}

function startCountdown() {
    let count = 3;
    document.getElementById('main-container').className = 'main-container bg-alert';
    const interval = setInterval(() => {
        if (count > 0) { document.getElementById('content-box').innerHTML = `<h2 style="font-size: 8rem; color: #FF2800; margin:0; text-shadow: 0 0 20px rgba(255,0,0,0.5);">${count}</h2>`; count--; } 
        else { clearInterval(interval); playPhase(); }
    }, 1000);
}

function startArenaRhythmGame() {
    document.getElementById('main-container').className = 'main-container';
    document.getElementById('main-container').style.background = 'radial-gradient(circle at center, #1a0033 0%, #000 100%)';
    combo = 0;
    targetEarthquakeTime = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
    
    bgmAudio = new Audio('./audio/arena_bgm.mp3'); 
    bgmAudio.volume = 0.6; 
    bgmAudio.play().catch(e => console.log("BGM再生不可: ", e));
    
    document.getElementById('content-box').innerHTML = `
        <h2 class="scene-title" style="color: #FF69B4; font-size: 2rem; text-shadow: 0 0 10px #FF69B4; margin-bottom: 0.5rem;">💖 ARENA LIVE START! 💖</h2>
        <div style="margin-bottom: 1.2rem;"><span style="display: inline-block; font-size: 0.85rem; color: #FFBE00; background: rgba(255, 190, 0, 0.15); border: 1px solid #FFBE00; padding: 4px 12px; border-radius: 20px; font-weight: bold;">🔊 音が出ます（音量にご注意ください）</span></div>
        <p style="font-size: 1.2rem; margin-bottom: 2rem; color: #fff;">音楽に合わせてペンライト（キー）を振れ！<br><span style="color:#aaa; font-size:0.9rem;">PC: [F] と [J] キー / スマホ: 画面の左右をタップ</span></p>
        
        <div style="display: flex; justify-content: space-around; width: 100%; max-width: 400px; margin: 0 auto; height: 150px; position: relative;">
            <div id="lane-left" style="width: 80px; height: 80px; border: 4px solid #56B4E9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; position: absolute; bottom: 0; left: 10%; cursor: pointer; color: #56B4E9;">F</div>
            <div id="lane-right" style="width: 80px; height: 80px; border: 4px solid #FFBE00; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; position: absolute; bottom: 0; right: 10%; cursor: pointer; color: #FFBE00;">J</div>
        </div>
        <div id="combo-text" style="font-size: 3rem; font-weight: bold; color: #fff; margin-top: 2rem; opacity: 0; text-shadow: 0 0 15px rgba(255,255,255,0.5);">1 COMBO!</div>
    `;

    isRhythmGameActive = true;
    rhythmStartTime = performance.now();
    
    window.addEventListener('keydown', handleRhythmKey);
    document.getElementById('lane-left').addEventListener('pointerdown', () => triggerRhythmAction('lane-left'));
    document.getElementById('lane-right').addEventListener('pointerdown', () => triggerRhythmAction('lane-right'));
    rhythmAnimFrame = requestAnimationFrame(rhythmGameLoop);
}

function handleRhythmKey(e) {
    if (!isRhythmGameActive) return;
    if (e.key.toLowerCase() === 'f') triggerRhythmAction('lane-left');
    if (e.key.toLowerCase() === 'j') triggerRhythmAction('lane-right');
}

function triggerRhythmAction(laneId) {
    if (!isRhythmGameActive) return;
    combo++;
    const comboEl = document.getElementById('combo-text');
    comboEl.innerText = `${combo} COMBO!`;
    comboEl.style.opacity = 1;
    const lane = document.getElementById(laneId);
    const originalColor = lane.style.background;
    lane.style.background = 'rgba(255,255,255,0.5)';
    setTimeout(() => { if (lane) lane.style.background = originalColor; }, 100);
}

function rhythmGameLoop(currentTime) {
    if (!isRhythmGameActive) return;
    if (currentTime - rhythmStartTime > targetEarthquakeTime) return triggerEarthquake();
    rhythmAnimFrame = requestAnimationFrame(rhythmGameLoop);
}

function triggerEarthquake() {
    isRhythmGameActive = false;
    window.removeEventListener('keydown', handleRhythmKey);
    cancelAnimationFrame(rhythmAnimFrame);
    if (bgmAudio) bgmAudio.pause();
    
    document.getElementById('content-box').innerHTML = '<h2 style="color:red; font-size:5rem; text-shadow: 0 0 30px red;">地震発生！！</h2>'; 
    setTimeout(() => {
        document.getElementById('main-container').style.background = '';
        document.getElementById('main-container').className = 'main-container bg-alert';
        currentPhase = 0; 
        playPhase(); 
    }, 1000);
}

function playPhase() {
    isAnswered = false;
    const phaseData = scenarios[currentSceneId].phases[currentPhase];
    timeLimit = phaseData.time;

    let shuffledOptions = [...phaseData.options].sort(() => Math.random() - 0.5);
    
    let timerHtml = "";
    if (trainingMode === "timed") {
        timerHtml = `
            <div class="shakeout-timer-wrapper">
                <div style="font-size: 0.85rem; color: var(--text-sub); letter-spacing: 0.15em; margin-bottom: 4px; font-family: var(--font-mono);">残り時間（実戦モード）</div>
                <div id="timer-text" style="font-size: 3.5rem; font-weight: bold; color: #00E676; text-shadow: 0 0 15px rgba(0,230,118,0.5); line-height: 1; font-family: var(--font-mono);">${(timeLimit/1000).toFixed(1)}秒</div>
                <div class="timer-container">
                    <div id="timer-bar" class="timer-bar"></div>
                </div>
            </div>`;
    } else {
        timerHtml = `
            <div class="shakeout-timer-wrapper" style="margin-bottom: 1.5rem;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(86, 180, 233, 0.15); border: 1px solid #56B4E9; padding: 6px 16px; border-radius: 20px; color: #56B4E9; font-size: 0.95rem; font-weight: bold;">
                    <span>📖 練習モード</span>
                    <span style="font-size: 0.8rem; background: #56B4E9; color: #000; padding: 2px 8px; border-radius: 10px; font-weight: bold;">時間無制限</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-sub); margin-top: 6px; margin-bottom: 0;">状況文と選択肢を落ち着いて読み、最適な行動を選んでください</p>
            </div>`;
    }

    let html = `<h2 class="scene-title" style="margin-bottom:1rem;">${scenarios[currentSceneId].title}</h2>
                ${timerHtml}
                <div class="situation-text" style="font-size:1.2rem; line-height:1.6; margin-bottom:2rem;">${phaseData.getText()}</div>
                <div style="display:flex; flex-direction:column; gap:10px;">`;
                
    shuffledOptions.forEach(opt => {
        html += `<button class="shakeout-action-btn" onclick="selectAnswer(${opt.isCorrect}, '${opt.feedback}')"><span style="font-size:2.5rem;">${opt.icon}</span><span>${opt.text}</span></button>`;
    });
    html += `</div>`;
    document.getElementById("content-box").innerHTML = html;
    
    questionStartTime = Date.now();
    if (trainingMode === "timed") {
        startTime = performance.now();
        requestAnimationFrame(updateTimer);
    }
}
function updateTimer(currentTime) {
    if (isAnswered) return;
    const remainingRatio = Math.max(0, 1 - ((currentTime - startTime) / timeLimit));
    const sec = (timeLimit / 1000) * remainingRatio;
    
    // ★視覚的加速：読書中は緩やかに減り、後半（判断時）は急速に縮小
    const visualRatio = Math.pow(remainingRatio, 1.25);
    
    const timerBarEl = document.getElementById('timer-bar');
    const timerTextEl = document.getElementById('timer-text');
    
    if (timerBarEl) {
        timerBarEl.style.transform = `scaleX(${visualRatio})`;
        if (sec <= 2.0) {
            timerBarEl.style.background = '#FF2800';
            timerBarEl.style.boxShadow = '0 0 20px rgba(255, 40, 0, 0.9)';
        } else if (sec <= 3.8) {
            timerBarEl.style.background = '#FFBE00';
            timerBarEl.style.boxShadow = '0 0 12px rgba(255, 190, 0, 0.6)';
        } else {
            timerBarEl.style.background = '#00E676';
            timerBarEl.style.boxShadow = '0 0 10px rgba(0, 230, 118, 0.4)';
        }
    }
    
    if (timerTextEl) {
        timerTextEl.innerText = `${sec.toFixed(1)}秒`;
        if (sec <= 2.0) {
            timerTextEl.style.color = '#FF2800';
            timerTextEl.style.textShadow = '0 0 20px rgba(255, 40, 0, 0.9)';
            timerTextEl.classList.add('timer-panic');
        } else if (sec <= 3.8) {
            timerTextEl.style.color = '#FFBE00';
            timerTextEl.style.textShadow = '0 0 15px rgba(255, 190, 0, 0.7)';
            timerTextEl.classList.remove('timer-panic');
        } else {
            timerTextEl.style.color = '#00E676';
            timerTextEl.style.textShadow = '0 0 15px rgba(0, 230, 118, 0.5)';
            timerTextEl.classList.remove('timer-panic');
        }
    }

    if (remainingRatio > 0) timerAnimation = requestAnimationFrame(updateTimer);
    else { 
        isAnswered = true; showFeedback(false, "【時間切れ】現実の地震は待ってくれません。迷っている数秒の間に、落下物の直撃を受ける可能性が極めて高いです。"); 
    }
}

function selectAnswer(isCorrect, feedbackText) {
    if (isAnswered) return;

    isAnswered = true; cancelAnimationFrame(timerAnimation);
    showFeedback(isCorrect, feedbackText);
}

function showFeedback(isCorrect, feedbackText) {
    document.getElementById('content-box').innerHTML = `
        <div class="feedback-box ${isCorrect ? "feedback-correct" : "feedback-incorrect"}" style="font-size:1.1rem;">
            <h3 style="color: ${isCorrect ? '#00B400' : '#FF2800'}; margin-top:0; font-size:1.5rem;">${isCorrect ? "正しい判断です！" : "【致命的な判断ミス】"}</h3>
            <p style="line-height: 1.6; margin-bottom:0;">${feedbackText}</p>
        </div>
        <button class="btn primary" style="font-size:1.2rem; padding:15px 30px;" onclick="${isCorrect ? "nextPhase()" : "showMenu()"}">${isCorrect ? "次の状況へ" : "メニューへ戻る"}</button>
    `;
}

function nextPhase() {
    currentPhase++;
    document.getElementById('main-container').className = 'main-container bg-alert';
    if (currentPhase < scenarios[currentSceneId].phases.length) playPhase();
    else playHoldPhase();
}

let holdStartTime = 0, holdTimerAnim = null, isHolding = false;

function playHoldPhase() {
    const holdData = scenarios[currentSceneId].hold;
    timeLimit = holdData.time;
    isHolding = false; isAnswered = false;

    // ★修正：タイマーバーを廃止し、耐える時間を中央巨大化
    document.getElementById('content-box').innerHTML = `
        <h2 class="scene-title">${scenarios[currentSceneId].title}</h2>
        <div style="text-align: center; margin: 1.5rem 0 1.5rem; font-family: var(--font-mono);">
            <div style="font-size: 0.9rem; color: var(--text-sub); letter-spacing: 0.15em; margin-bottom: 5px;">耐える時間</div>
            <div id="hold-timer-text" style="font-size: 4rem; font-weight: bold; color: #00B400; text-shadow: 0 0 15px rgba(0,180,0,0.5); line-height: 1;">${(timeLimit/1000).toFixed(1)}秒</div>
        </div>
        <div class="situation-text" style="font-size:1.2rem; line-height:1.6; margin-bottom:1.5rem;">${holdData.text}</div>
        <div id="hold-hint-msg" style="text-align: center; min-height: 1.8rem; margin-bottom: 1.5rem; font-weight: bold; font-size: 1.1rem; color: #00E676;"></div>
        <div class="btn-hold" id="btn-hold" style="background: #8B0000; border: 6px solid #FF2800; color: #fff; width: 250px; height: 250px; border-radius: 50%; font-size: 1.5rem; font-weight: bold; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto; user-select: none; box-shadow: 0 0 30px rgba(255,0,0,0.5); transition: 0.1s;">
            <span style="font-size: 4rem; pointer-events: none;">✊</span><span id="hold-text" style="font-size: 2rem; pointer-events: none;">HOLD ON</span><span style="font-size: 1rem; font-weight: normal; pointer-events: none;">(押し続けろ)</span>
        </div>
    `;

    const btnHold = document.getElementById('btn-hold');
    const hintMsgEl = document.getElementById('hold-hint-msg');
    const holdTimerTextEl = document.getElementById('hold-timer-text');

    const startHold = (e) => { 
        e.preventDefault(); if (isAnswered) return;
        isHolding = true; 
        btnHold.style.background = '#008B00'; btnHold.style.borderColor = '#00FF00'; btnHold.style.transform = 'scale(0.95)'; btnHold.style.boxShadow = '0 0 40px rgba(0,255,0,0.8)';
        document.getElementById('hold-text').innerText = "耐えろ！"; 
        if (hintMsgEl) {
            hintMsgEl.innerText = "そのまま4秒間押し続けてください！";
            hintMsgEl.style.color = "#00E676";
        }
        holdStartTime = performance.now(); holdTimerAnim = requestAnimationFrame(updateHoldProgress);
    };
    const endHold = (e) => { 
        e.preventDefault(); if (!isHolding || isAnswered) return; 
        isHolding = false; 
        btnHold.style.background = '#8B0000'; btnHold.style.borderColor = '#FF2800'; btnHold.style.transform = 'scale(1)'; btnHold.style.boxShadow = '0 0 30px rgba(255,0,0,0.5)';
        cancelAnimationFrame(holdTimerAnim);
        if (trainingMode === 'practice') {
            document.getElementById('hold-text').innerText = "HOLD ON";
            if (holdTimerTextEl) {
                holdTimerTextEl.innerText = `${(timeLimit/1000).toFixed(1)}秒`;
                holdTimerTextEl.style.color = "#00B400";
                holdTimerTextEl.style.textShadow = "0 0 15px rgba(0,180,0,0.5)";
            }
            if (hintMsgEl) {
                hintMsgEl.innerText = "⚠️ 手が離れてしまいました。もう一度やってみましょう！";
                hintMsgEl.style.color = "#FFCC00";
            }
        } else {
            isAnswered = true;
            showFeedback(false, scenarios[currentSceneId].hold.failText);
        }
    };

    btnHold.addEventListener('pointerdown', startHold);
    btnHold.addEventListener('pointerup', endHold);
    btnHold.addEventListener('pointerleave', endHold);
}

function updateHoldProgress(currentTime) {
    if (!isHolding || isAnswered) return;
    const holdRatio = Math.min(1, (currentTime - holdStartTime) / timeLimit);
    const holdTimerBarEl = document.getElementById('hold-timer-bar');
    if (holdTimerBarEl) holdTimerBarEl.style.transform = `scaleX(${holdRatio})`;
    
    // ★追加：数字のカウントダウン処理
    const holdTimerTextEl = document.getElementById('hold-timer-text');
    if(holdTimerTextEl) {
        const sec = (timeLimit / 1000) * (1 - holdRatio);
        holdTimerTextEl.innerText = `${sec.toFixed(1)}秒`;
        if (sec <= 1.5) {
            holdTimerTextEl.style.color = '#FF2800';
            holdTimerTextEl.style.textShadow = '0 0 20px rgba(255, 40, 0, 0.8)';
        } else {
            holdTimerTextEl.style.color = '#00B400';
            holdTimerTextEl.style.textShadow = '0 0 15px rgba(0, 180, 0, 0.5)';
        }
    }

    if (holdRatio < 1) holdTimerAnim = requestAnimationFrame(updateHoldProgress);
    else {
        isAnswered = true; isHolding = false;
        if (scenarios[currentSceneId].afterHold) playAfterHoldPhase();
        else showClear(scenarios[currentSceneId].hold.getClearText());
    }
}

function playAfterHoldPhase() {
    isAnswered = false;
    const phaseData = scenarios[currentSceneId].afterHold;
    timeLimit = phaseData.time;

    let shuffledOptions = [...phaseData.options].sort(() => Math.random() - 0.5);
    
    let timerHtml = "";
    if (trainingMode === "timed") {
        timerHtml = `
            <div class="shakeout-timer-wrapper">
                <div style="font-size: 0.85rem; color: var(--text-sub); letter-spacing: 0.15em; margin-bottom: 4px; font-family: var(--font-mono);">残り時間（実戦モード）</div>
                <div id="timer-text" style="font-size: 3.5rem; font-weight: bold; color: #00E676; text-shadow: 0 0 15px rgba(0,230,118,0.5); line-height: 1; font-family: var(--font-mono);">${(timeLimit/1000).toFixed(1)}秒</div>
                <div class="timer-container">
                    <div id="timer-bar" class="timer-bar"></div>
                </div>
            </div>`;
    } else {
        timerHtml = `
            <div class="shakeout-timer-wrapper" style="margin-bottom: 1.5rem;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(86, 180, 233, 0.15); border: 1px solid #56B4E9; padding: 6px 16px; border-radius: 20px; color: #56B4E9; font-size: 0.95rem; font-weight: bold;">
                    <span>📖 練習モード</span>
                    <span style="font-size: 0.8rem; background: #56B4E9; color: #000; padding: 2px 8px; border-radius: 10px; font-weight: bold;">時間無制限</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-sub); margin-top: 6px; margin-bottom: 0;">状況文と選択肢を落ち着いて読み、最適な行動を選んでください</p>
            </div>`;
    }

    let html = `<h2 class="scene-title" style="margin-bottom:1rem;">${scenarios[currentSceneId].title}</h2>
                ${timerHtml}
                <div class="situation-text" style="font-size:1.2rem; line-height:1.6; margin-bottom:2rem;">${phaseData.getText()}</div>
                <div style="display:flex; flex-direction:column; gap:10px;">`;
                
    shuffledOptions.forEach(opt => {
        html += `<button class="shakeout-action-btn" onclick="selectAfterHoldAnswer(${opt.isCorrect}, '${opt.feedback}')"><span style="font-size:2.5rem;">${opt.icon}</span><span>${opt.text}</span></button>`;
    });
    html += `</div>`;
    document.getElementById("content-box").innerHTML = html;
    
    questionStartTime = Date.now();
    if (trainingMode === "timed") {
        startTime = performance.now();
        requestAnimationFrame(updateAfterHoldTimer);
    }
}
function updateAfterHoldTimer(currentTime) {
    if (isAnswered) return;
    const remainingRatio = Math.max(0, 1 - ((currentTime - startTime) / timeLimit));
    const sec = (timeLimit / 1000) * remainingRatio;
    
    const visualRatio = Math.pow(remainingRatio, 1.25);
    
    const timerBarEl = document.getElementById('timer-bar');
    const timerTextEl = document.getElementById('timer-text');
    
    if (timerBarEl) {
        timerBarEl.style.transform = `scaleX(${visualRatio})`;
        if (sec <= 2.5) {
            timerBarEl.style.background = '#FF2800';
            timerBarEl.style.boxShadow = '0 0 20px rgba(255, 40, 0, 0.9)';
        } else if (sec <= 4.5) {
            timerBarEl.style.background = '#FFBE00';
            timerBarEl.style.boxShadow = '0 0 12px rgba(255, 190, 0, 0.6)';
        } else {
            timerBarEl.style.background = '#00E676';
            timerBarEl.style.boxShadow = '0 0 10px rgba(0, 230, 118, 0.4)';
        }
    }

    if (timerTextEl) {
        timerTextEl.innerText = `${sec.toFixed(1)}秒`;
        if (sec <= 2.5) {
            timerTextEl.style.color = '#FF2800';
            timerTextEl.style.textShadow = '0 0 20px rgba(255, 40, 0, 0.9)';
            timerTextEl.classList.add('timer-panic');
        } else if (sec <= 4.5) {
            timerTextEl.style.color = '#FFBE00';
            timerTextEl.style.textShadow = '0 0 15px rgba(255, 190, 0, 0.7)';
            timerTextEl.classList.remove('timer-panic');
        } else {
            timerTextEl.style.color = '#00E676';
            timerTextEl.style.textShadow = '0 0 15px rgba(0, 230, 118, 0.5)';
            timerTextEl.classList.remove('timer-panic');
        }
    }

    if (remainingRatio > 0) requestAnimationFrame(updateAfterHoldTimer);
    else { 
        isAnswered = true; showFeedback(false, "【時間切れ】パニックになった群衆に巻き込まれてしまいました。"); 
    }
}

function selectAfterHoldAnswer(isCorrect, feedbackText) {
    if (isAnswered) return;
    isAnswered = true; 
    
    if (isCorrect) {
        // ★修正ポイント：正解時は無限ループを防ぐため、専用の「結果を見る」画面を出す
        document.getElementById('content-box').innerHTML = `
            <div class="feedback-box feedback-correct" style="font-size:1.1rem;">
                <h3 style="color: #00B400; margin-top:0; font-size:1.5rem;">正しい判断です！</h3>
                <p style="line-height: 1.6; margin-bottom:0;">${feedbackText}</p>
            </div>
            <button class="btn primary" style="font-size:1.2rem; padding:15px 30px;" onclick="showClear(scenarios[currentSceneId].hold.getClearText())">結果を見る</button>
        `;
    } else {
        // 不正解の場合は、従来通りメニューへ戻る（showFeedbackに任せる）
        showFeedback(false, feedbackText); 
    }
}

function showClear(clearText) {
    // 本番モード（制限時間あり）でのみバッジ獲得
    if (trainingMode === "timed" && typeof unlockBadge === 'function') {
        if (currentSceneId === 'sleep') {
            unlockBadge('shakeout_sleep');
        } else if (currentSceneId === 'arena') {
            unlockBadge('shakeout_arena');
        }
    }

    document.getElementById("content-box").innerHTML = `
        <h2 style="color: #00B400; font-size: 2.5rem; margin-bottom: 1rem;">SURVIVAL SUCCESS</h2>
        <div class="feedback-box feedback-correct" style="margin-bottom: 2rem; font-size:1.1rem;"><p style="line-height: 1.6; margin: 0;">${clearText}</p></div>
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <button class="btn secondary" style="font-size:1.1rem; padding:15px 25px;" onclick="showMenu()">別のモード・環境で挑戦</button>
            <a href="index.html" class="btn primary" style="font-size:1.1rem; padding:15px 25px;">ダッシュボードへ帰還</a>
        </div>
    `;

    // マイページ導線カードを配置
    if (typeof appendMyPageLink === 'function') {
        appendMyPageLink(document.getElementById("content-box"));
    }
}
