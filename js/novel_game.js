// --- グローバル変数 ---
let userDecisionHistory = []; 
let currentSceneId = "intro1";
let textIndex = 0;
let isTyping = false;
let typeInterval;
let novelStartTime = 0;

const msgBox = document.getElementById('msg-box');
const messageEl = document.getElementById('message');
const speakerEl = document.getElementById('speaker');
const choicesDiv = document.getElementById('choices');
const gameUi = document.getElementById('game-ui');
const resultBox = document.getElementById('result-box');
const btnNext = document.getElementById('btn-next');

// --- 史実解説データマッピング ---
const historicalReflections = {
    "ch1_A": {
        chapterTitle: "第1章：初動の判断（家族の安否と津波避難）",
        choiceLabel: "海側へ大切な人を探しに戻る",
        factText: "中央防災会議や被災自治体の避難行動調査では、地震後に「家族を探すため」に自宅や沿岸部へ戻り、津波に巻き込まれたケースが犠牲者の大きな割合を占めました。深い愛情があるからこそ、平時に『大地震の時は絶対に探しに戻らない』と事前合意を結んでおくことが、最大の命綱となります。"
    },
    "ch1_B": {
        chapterTitle: "第1章：初動の判断（家族の安否と津波避難）",
        choiceLabel: "相手の判断力を信じ、高台へ走る",
        factText: "相手の判断力を信じて高台へ逃げ切る行動は、「津波てんでんこ」の真髄です。岩手県釜石市等では、児童・生徒が互いを信じて率先して逃げたことで、家族全員が各々の避難先で無事に再会を果たした実例が多数報告されています。"
    },
    "ch1_C": {
        chapterTitle: "第1章：初動の判断（家族の安否と津波避難）",
        choiceLabel: "情報待ちでその場に留まる",
        factText: "発災直後は激しい通信障害や停電により、携帯電話や公衆電話は瞬時に遮断されました。安否確認のためにその場に留まり、数分〜十数分の判断の遅れが致命的となった事例が多く記録されています。"
    },
    "ch2_A": {
        chapterTitle: "第2章：場所の判断（指定避難所と同調圧力）",
        choiceLabel: "恥じらいを捨て『裏山へ走れ』と叫ぶ",
        factText: "釜石東中学校の生徒たちが『津波が来るぞ、逃げるぞ！』と叫びながら走ったことで、隣接する小学校の児童や地域住民が次々と避難行動を開始し、約3,000人の命が救われました（釜石の奇跡）。自らが率先避難者となることが、周囲の同調圧力を打ち破る最大の力となります。"
    },
    "ch2_B": {
        chapterTitle: "第2章：場所の判断（指定避難所と同調圧力）",
        choiceLabel: "身近な数人にだけ促し、石段を登る",
        factText: "大規模な集団を動かすことは難しくても、隣にいる人へ直接声をかける『声かけ避難』は極めて有効な共助です。多くの避難者が『近所の人の一言で逃げる決心がついた』と証言しています。"
    },
    "ch2_C": {
        chapterTitle: "第2章：場所の判断（指定避難所と同調圧力）",
        choiceLabel: "昔から安全だからと周囲に合わせて待機する",
        factText: "南三陸町の防災対策庁舎や各地の指定避難場所において、『ここまで来るはずがない』『指定場所だから安全』という過去の経験や過信から留まり、屋上や屋根の上で孤立・被災した事例が報告されています。想定にとらわれず、異変を感じたらさらに高い場所を目指す重要性が示されました。"
    },
    "ch3_A": {
        chapterTitle: "第3章：避難所の判断（氷点下の夜と毛布のシェア）",
        choiceLabel: "互いに肩を寄せ合い、毛布をシェアする",
        factText: "3月11日の夜は氷点下の雪でした。暖房のない避難所で、見知らぬ人同士が段ボールを敷き、毛布をシェアして体温を保ち合った共助の行動が、低体温症による災害関連死を未然に防ぎました。"
    },
    "ch3_B": {
        chapterTitle: "第3章：避難所の判断（氷点下の夜と毛布のシェア）",
        choiceLabel: "無言で相手にすべて譲り、自分は寒さに耐える",
        factText: "避難生活において、支援者が無理を重ねて体調を崩し、二次的な要介護者となってしまう事例が散見されました。『共倒れを防ぎ、まず自分自身の生命・健康を維持した上で助け合う』ことが持続可能な共助の原則です。"
    },
    "ch3_C": {
        chapterTitle: "第3章：避難所の判断（氷点下の夜と毛布のシェア）",
        choiceLabel: "まず自分自身の体温を守る",
        factText: "災害直後の自助・共助・公助の基本原則において、『まず自分の命を守り切ること（自助）』はすべての基盤です。自分が健康を保つこと自体が、限られた医療や救助リソースを圧迫しない貢献でもあります。"
    }
};

// --- 完成版シナリオデータ ---
const scenario = {
    "intro1": {
        bg: "#050505",
        texts: [
            "2011年3月11日、金曜日。14時46分。",
            "あなたは今、海から歩いて数分の沿岸の街にいます。\n周りには、買い物客や下校中の学生など、見知らぬ他者が行き交っています。",
            "その時でした。\nポケットのスマートフォンが、けたたましく鳴り響きました。",
            "『——緊急地震速報です。強い揺れに警戒してください』",
            "直後、立っていられないほどの激震が襲いかかりました。\n地鳴りのような重低音。物が落ちる音や悲鳴。",
            "……永遠に続くかのように長く感じられた揺れが、ようやく収まりました。"
        ],
        next: "intro2"
    },
    "intro2": {
        bg: "#1a1a1a",
        texts: [
            "街中の防災無線から、女性のアナウンスが響き渡ります。\n『大津波警報が発表されました。予想される津波の高さは、3メートルです。沿岸部の方は高台へ避難してください』",
            "「3メートルか……それなら、高さ10メートルの防潮堤があるから大丈夫かもしれない」\n近くにいた大人が、安堵したように呟く声が耳に入りました。",
            "しかし、それは後に「過小評価」と判明する、最初の警報に過ぎませんでした。"
        ],
        next: "ch1_dilemma"
    },
    "ch1_dilemma": {
        bg: "#1a1a1a",
        texts: [
            "ここで一つ、あなたの心の中に思い浮かべてほしい人がいます。\n家族、親、パートナー、あるいは親友。",
            "その大切な人が今、あなたよりもさらに「海に近い場所」にいると想像してください。\n電話もメールも、一切繋がりません。",
            "防災無線が何度も高台への避難を呼びかけています。\n海側へ戻れば、合流できるかもしれない。しかしそれは、津波が向かってくる方向へ自ら逆走することを意味します。",
            "相手を深く愛しているからこそ、あなたの心は激しく引き裂かれます。"
        ],
        choices: [
            { 
                text: "「まだ時間はあるはずだ。顔を見て一緒に逃げよう」と自分に言い聞かせ、海側へ走る", 
                next: "ch1_A_result", 
                actionKey: "ch1_A" 
            },
            { 
                text: "「あいつなら絶対に逃げている」と相手の判断力を信じ、引き裂かれる思いで高台へ走る", 
                next: "ch1_B_result", 
                actionKey: "ch1_B" 
            },
            { 
                text: "公衆電話や近所の人を探し、安否が確認できるまでその場に留まる", 
                next: "ch1_C_result", 
                actionKey: "ch1_C" 
            }
        ]
    },
    "ch1_A_result": {
        bg: "#220000",
        texts: [
            "あなたは海に向かって走り出しました。\nしかし数百メートル進んだところで、避難してくる人々の波と崩れたブロック塀に阻まれます。",
            "「もうすぐ波が来るぞ！ 戻れ！」\n見知らぬ男性に腕を強く引かれ、あなたは立ち止まりました。",
            "これ以上進めば、確実に命を落とす。\nあなたは涙を拭い、高台への道へと引き返しました。"
        ],
        next: "ch2_dilemma"
    },
    "ch1_B_result": {
        bg: "#111",
        texts: [
            "「生きて再会するんだ。絶対に無事でいてくれ」",
            "あなたは心の中で祈り続けながら、全力で坂道を駆け上がりました。"
        ],
        next: "ch2_dilemma"
    },
    "ch1_C_result": {
        bg: "#111",
        texts: [
            "あなたは公衆電話を探しましたが、全く繋がりません。",
            "遠くから響く不気味な地鳴りと、サイレンのけたたましさに背中を押され、ぎりぎりのところで高台へ走り出しました。"
        ],
        next: "ch2_dilemma"
    },
    "ch2_dilemma": {
        bg: "#222",
        texts: [
            "坂を登り、あなたは指定避難場所である高台の神社境内にたどり着きました。",
            "境内にはすでに多くの住民が集まり、座り込んでいます。\n「ここは市の指定避難所だし、昔からここには津波が来なかったから絶対に安全だよ」\n年長者たちが互いを安心させるように頷き合っています。",
            "その時でした。\n視界の先、防潮堤を遥かに超えて、真っ白な水しぶきが空高く吹き上がるのが見えました。",
            "ドーン、ドーンと、家屋や船が押し流されて破壊される地響きが足元を震わせます。\n（……ダメだ。3メートルどころじゃない。ここも呑まれる！）",
            "境内の奥には、さらに高い裏山へ続く石段があります。\nしかし、大人たちは誰も異変に気づいておらず、静かに座り込んだままです。",
            "ここで大声を上げたら、もし見間違いだった時に『大げさな奴だ』と笑われるかもしれない。\n年長者たちが落ち着いているのに、自分だけ騒ぎ立てるのは恥ずかしいのではないか——。\n心のブレーキが、あなたの喉を締め付けます。"
        ],
        choices: [
            { 
                text: "笑われてもいい。「ここも危ない！裏山へ走って！」と叫び、石段へ駆け上がる", 
                next: "ch2_A_result", 
                actionKey: "ch2_A" 
            },
            { 
                text: "隣の数人にだけ「上へ行きましょう」と耳打ちし、少人数で静かに石段を登る", 
                next: "ch2_B_result", 
                actionKey: "ch2_B" 
            },
            { 
                text: "昔から安全な場所なのだから大丈夫だと自分に言い聞かせ、周囲に合わせて待機する", 
                next: "ch2_C_result", 
                actionKey: "ch2_C" 
            }
        ]
    },
    "ch2_A_result": {
        bg: "#000",
        texts: [
            "あなたの必死の叫びと走る姿を見て、一人の若者が「本当だ、山へ逃げろ！」と叫び返しました。",
            "静まり返っていた境内の空気が一変し、人々が一斉に裏山の石段へ雪崩れ込みました。",
            "全員が石段の中腹へ登り切った直後、濁流が境内の鳥居をなぎ倒しました。\nあなたの勇気ある声が、多くの命を救ったのです。"
        ],
        next: "ch3_intro"
    },
    "ch2_B_result": {
        bg: "#000",
        texts: [
            "あなたは数人と共に石段を登り始めました。\nその動きにつられて、後から数組の家族が登ってきます。",
            "境内からも逃げてくる人々の姿が見え、間一髪で全員が高台へ逃れました。"
        ],
        next: "ch3_intro"
    },
    "ch2_C_result": {
        bg: "#000",
        texts: [
            "「大丈夫だよ、ここは昔から水が来ない場所だから」\n大人たちの言葉に、あなたも『そうだ、騒ぐのは恥ずかしい』と座り直しました。",
            "しかし数分後、足元を揺るがす地響きとともに、白波が鳥居を突き破り、境内へ一気に濁流が雪崩れ込んできました。",
            "「山へ逃げろ！」誰かが叫びましたが、もう遅すぎました。\n石段の登り口はすでに押し寄せた泥水に呑まれ、駆け寄ることすらできません。",
            "「社殿へ上がれ！ 屋根の上だ！」\nあなたは大人たちと押し合うように社殿へ駆け上がり、高い梁（はり）、そして屋根の上へと這い登りました。",
            "水面は足元数十センチまで達し、轟音を立てて渦を巻いています。\n一歩判断が遅れただけで、安全な山へ逃げるすべての選択肢を失い、逃げ場のない孤立状態に追い込まれました。"
        ],
        next: "ch3_intro"
    },
    "ch3_intro": {
        bg: "#0a1128",
        texts: [
            "やがて夕暮れとともに水が引き始め、生き残った人々は、高台にある中学校の体育館へと救出・合流しました。",
            "しかし、試練は終わりませんでした。\n街は完全に水没し、夜が訪れます。電気も暖房もなく、気温は氷点下。外には雪が舞い始めていました。",
            "備蓄物資は圧倒的に足りず、配られた毛布は数人に1枚。\n冷え切った体育館の床で、凍えるような寒さとの戦いが始まりました。"
        ],
        next: "ch3_dilemma"
    },
    "ch3_dilemma": {
        bg: "#0a1128",
        texts: [
            "あなたは幸運にも1枚の毛布を受け取ることができました。\nしかしふと横を見ると、薄着の高齢者が紫色になった唇で激しく震えています。",
            "見知らぬ他人ばかりの空間で声をかけることには躊躇いがあります。\nしかし、この寒さでは朝まで命がもたないかもしれない。\nかといって毛布を手放せば、今度は自分が低体温症で倒れてしまう……。"
        ],
        choices: [
            { 
                text: "緊張を振り払い「一緒に使いましょう」と声をかけ、毛布を広げて肩を寄せ合う", 
                next: "ch3_A_result", 
                actionKey: "ch3_A" 
            },
            { 
                text: "無言で自分の毛布を相手にすべて被せ、自分は膝を抱えて寒さに耐える", 
                next: "ch3_B_result", 
                actionKey: "ch3_B" 
            },
            { 
                text: "まずは自分が生き延びることが先決だと割り切り、自分だけで毛布に包まる", 
                next: "ch3_C_result", 
                actionKey: "ch3_C" 
            }
        ]
    },
    "ch3_A_result": {
        bg: "#0a1128",
        texts: [
            "見知らぬ他者と肩を寄せ合い、互いの体温を分け合いました。",
            "「ありがとうね」という震える声に励まされ、あなたは過酷で長い氷点下の夜を二人で耐え抜きました。"
        ],
        next: "ending"
    },
    "ch3_B_result": {
        bg: "#0a1128",
        texts: [
            "相手の命は救われましたが、あなた自身も激しい寒気と体の震えで体調を著しく崩しました。",
            "自分を犠牲にするだけの支援は、二次的な要救護者を生み出してしまう過酷さを痛感しました。"
        ],
        next: "ending"
    },
    "ch3_C_result": {
        bg: "#0a1128",
        texts: [
            "自分自身の体温を守り、夜を越しました。",
            "胸の痛みは残りますが、災害現場において「まず自分の健康と生命を維持すること」もまた、他者に負担をかけないための現実的な選択の一つでした。"
        ],
        next: "ending"
    },
    "ending": {
        bg: "#223344",
        texts: [
            "震災から数日後の朝。遠くからヘリコプターの音が響き、自衛隊員たちが救援物資を抱えて体育館へ駆け込んできました。",
            "「もう大丈夫です！ 支援物資が届きました！」\nあちこちで安堵の涙と歓声が上がります。",
            "家族を愛するがゆえの葛藤。\n恥ずかしさを振り払って人を動かした決断。\n見知らぬ誰かと温もりを分け合った夜。",
            "あなたが下したすべての選択は、あの過酷な日に無数の人々が直面した「魂の選択」そのものでした。"
        ],
        next: "show_result"
    }
};

function initNovelGame() {
    const btnStart = document.getElementById('btn-start');
    const consentCheckbox = document.getElementById('consent-checkbox');

    if (consentCheckbox && btnStart) {
        consentCheckbox.addEventListener('change', () => {
            btnStart.disabled = !consentCheckbox.checked;
        });
        btnStart.disabled = !consentCheckbox.checked;
    }

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            document.getElementById('start-screen').style.display = 'none';
            gameUi.style.display = 'flex';
            novelStartTime = Date.now();
            userDecisionHistory = [];
            currentSceneId = "intro1";
            showScene("intro1");
        });
    }

    // PTSD配慮：描写をスキップして教訓のみ確認
    const btnSkip = document.getElementById('btn-skip-lesson');
    if (btnSkip) {
        btnSkip.addEventListener('click', () => {
            showLessonDigest();
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (isTyping) {
                clearInterval(typeInterval);
                messageEl.innerHTML = scenario[currentSceneId].texts[textIndex - 1].replace(/\n/g, '<br>');
                isTyping = false;
            } else {
                showNextText();
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNovelGame);
} else {
    initNovelGame();
}

function getSceneBgColor(sceneBg) {
    const isLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme')) === 'light';
    if (!isLight) {
        return sceneBg || "#000";
    }
    // ライトモード用の時間帯・シーン別背景色マッピング
    const lightBgMap = {
        "#050505": "#F8FAFC", // 発災直後・緊迫（非常に淡いスレートグレー）
        "#1a1a1a": "#EDF2F7", // 余震・避難路
        "#0a1128": "#E2E8F0", // 寒冷・吹雪の夜
        "#223344": "#CBD5E1"  // 夜明け・自衛隊の救援
    };
    return lightBgMap[sceneBg] || (sceneBg ? "#E2E8F0" : "#F8FAFC");
}

function showScene(sceneId) {
    if (sceneId === "show_result") {
        showResultScreen();
        return;
    }

    currentSceneId = sceneId;
    const scene = scenario[sceneId];
    if (!scene) return;

    gameUi.style.backgroundColor = getSceneBgColor(scene.bg);
    textIndex = 0;
    choicesDiv.innerHTML = ''; 
    speakerEl.innerText = "";
    
    showNextText();
}

// テーマ切り替え時にプレイ中の背景色を即時反映
document.addEventListener('themechange', () => {
    if (currentSceneId && scenario[currentSceneId] && gameUi.style.display !== 'none') {
        gameUi.style.backgroundColor = getSceneBgColor(scenario[currentSceneId].bg);
    }
});

function showNextText() {
    const scene = scenario[currentSceneId];
    if (!scene) return;
    
    if (textIndex < scene.texts.length) {
        isTyping = true;
        messageEl.innerHTML = '';
        const currentText = scene.texts[textIndex];
        let charIndex = 0;
        btnNext.innerText = "次へ";
        
        clearInterval(typeInterval);
        typeInterval = setInterval(() => {
            messageEl.innerHTML += currentText.charAt(charIndex) === '\n' ? '<br>' : currentText.charAt(charIndex);
            charIndex++;
            if (charIndex >= currentText.length) {
                clearInterval(typeInterval);
                isTyping = false;
            }
        }, 35); 
        textIndex++;
    } else {
        if (scene.choices && scene.choices.length > 0) {
            btnNext.style.display = 'none';
            choicesDiv.style.display = 'flex';
            choicesDiv.innerHTML = '';
            scene.choices.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'btn secondary choice-btn';
                btn.innerText = c.text;
                btn.onclick = () => {
                    if (c.actionKey) {
                        userDecisionHistory.push(c.actionKey);
                    }
                    choicesDiv.innerHTML = '';
                    choicesDiv.style.display = 'none';
                    btnNext.style.display = 'inline-block';
                    showScene(c.next);
                };
                choicesDiv.appendChild(btn);
            });
        } else if (scene.next) {
            showScene(scene.next);
        }
    }
}

function showResultScreen() {
    gameUi.style.display = 'none';
    resultBox.style.display = 'block';

    const reflectionListEl = document.getElementById('reflection-list');
    if (!reflectionListEl) return;
    reflectionListEl.innerHTML = '';

    userDecisionHistory.forEach(actionKey => {
        const item = historicalReflections[actionKey];
        if (!item) return;

        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>${item.chapterTitle}</h3>
            <div><span class="user-choice-badge">あなたが選んだ決断：${item.choiceLabel}</span></div>
            <div class="history-fact">
                <strong style="color: #56B4E9; display: block; margin-bottom: 4px;">📊 東日本大震災の記録・検証データ</strong>
                ${item.factText}
            </div>
        `;
        reflectionListEl.appendChild(card);
    });

    // バッジ獲得（記憶の継承者）
    if (typeof unlockBadge === 'function') {
        unlockBadge('memory_inheritor');
    }

    // クイズ結果画面と同様にマイページボタンを挿入
    appendMyPageLink(resultBox.querySelector('.result-content') || resultBox);
}

/**
 * 緊迫描写をスキップして教訓のみ確認する機能（PTSD配慮ルート）
 */
function showLessonDigest() {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.style.display = 'none';
    if (gameUi) gameUi.style.display = 'none';
    if (resultBox) resultBox.style.display = 'block';

    const reflectionListEl = document.getElementById('reflection-list');
    if (reflectionListEl) {
        reflectionListEl.innerHTML = `
            <div class="result-card" style="border-left: 4px solid var(--cud-green);">
                <div style="font-size:0.85rem; color:var(--cud-green); font-weight:bold; margin-bottom:6px;">🕊️ 教訓ダイジェスト（PTSD配慮モード）</div>
                <p style="font-size:0.95rem; color:var(--text-sub); margin:0 0 12px 0; line-height:1.6;">
                    緊迫したシチュエーション描写をスキップし、東日本大震災の記録・避難行動調査から得られた最重要教訓をまとめました。
                </p>
            </div>
            <div class="result-card" style="border-left: 4px solid #56B4E9;">
                <h3>第1章の教訓：初動の判断（家族の安否と津波避難）</h3>
                <div class="history-fact">
                    <strong style="color: #56B4E9; display: block; margin-bottom: 4px;">📊 東日本大震災の記録・検証データ</strong>
                    ${historicalReflections["ch1_B"].factText}
                </div>
            </div>
            <div class="result-card" style="border-left: 4px solid #56B4E9;">
                <h3>第2章の教訓：場所の判断（指定避難所と同調圧力）</h3>
                <div class="history-fact">
                    <strong style="color: #56B4E9; display: block; margin-bottom: 4px;">📊 東日本大震災の記録・検証データ</strong>
                    ${historicalReflections["ch2_A"].factText}
                </div>
            </div>
            <div class="result-card" style="border-left: 4px solid #56B4E9;">
                <h3>第3章の教訓：避難所の判断（氷点下の夜と毛布のシェア）</h3>
                <div class="history-fact">
                    <strong style="color: #56B4E9; display: block; margin-bottom: 4px;">📊 東日本大震災の記録・検証データ</strong>
                    ${historicalReflections["ch3_A"].factText}
                </div>
            </div>
        `;
    }

    // バッジ獲得（記憶の継承者）
    if (typeof unlockBadge === 'function') {
        unlockBadge('memory_inheritor');
    }

    // マイページリンク挿入
    appendMyPageLink(resultBox.querySelector('.result-content') || resultBox);
}