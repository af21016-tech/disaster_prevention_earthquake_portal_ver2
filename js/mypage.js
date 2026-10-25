document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. ユーザーIDの取得 ---
    const userId = getOrCreateUserId();

    // --- 2. クリップボードへのコピー機能 ---
    const btnCopy = document.getElementById('btn-copy-id');
    if(btnCopy) {
        btnCopy.addEventListener('click', () => {
            navigator.clipboard.writeText(userId).then(() => {
                showToast('クリップボードにコピーしました');
            }).catch(err => {
                console.error('Copy failed:', err);
                showToast('コピーに失敗しました');
            });
        });
    }

    // --- 3. 実績（バッジ）の初期描画 ---
    renderBadges();

    // --- 行動ログCSVダウンロード（10分経過後のみ有効化） ---
    const btnDownloadLogMypage = document.getElementById('btn-download-log-mypage');
    const descLogDownload = document.getElementById('log-download-desc');
    if (btnDownloadLogMypage) {
        const elapsed = (typeof getValidatedElapsedTime === 'function') ? getValidatedElapsedTime() : parseInt(localStorage.getItem('v2_accumulated_elapsed_time') || '0', 10);
        const limit = 10 * 60 * 1000; // 10分 (600,000ms)
        
        if (elapsed >= limit) {
            btnDownloadLogMypage.disabled = false;
            btnDownloadLogMypage.style.cursor = 'pointer';
            if (descLogDownload) {
                descLogDownload.textContent = '実験での操作ログをCSV形式で保存します。事後アンケート等への添付にご利用ください。';
            }
        } else {
            btnDownloadLogMypage.disabled = true;
            btnDownloadLogMypage.title = '10分間の学習完了後にダウンロード可能になります';
        }

        btnDownloadLogMypage.addEventListener('click', () => {
            const currentElapsed = (typeof getValidatedElapsedTime === 'function') ? getValidatedElapsedTime() : parseInt(localStorage.getItem('v2_accumulated_elapsed_time') || '0', 10);
            if (currentElapsed < limit) {
                alert('10分間の学習が完了した後にダウンロードできるようになります。');
                return;
            }
            if (typeof exportLogsAsCSV === 'function') {
                exportLogsAsCSV();
                showToast('行動ログ (CSV) をダウンロードしました');
            }
        });
    }

    window.addEventListener('badgeunlocked', renderBadges);

    // --- 4. 各種設定のアクション ---
    const btnTutorial = document.getElementById('btn-replay-tutorial');
    if (btnTutorial) {
        btnTutorial.addEventListener('click', () => {
            localStorage.removeItem('v2_quake_tutorial_done');
            localStorage.removeItem('v2_tutorialCompleted');
            localStorage.setItem('v2_start_tutorial_now', 'true'); 
            localStorage.setItem('v2_is_replaying_tutorial', 'true'); // リプレイフラグをセット
            window.location.href = 'index.html'; 
        });
    }

    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            const confirmReset = confirm("獲得した実績などの学習データがすべて消去されます。\n本当によろしいですか？\n（※ユーザーIDは維持されます）");
            
            if (confirmReset) {
                localStorage.removeItem('v2_quake_medals');
                localStorage.removeItem('v2_quake_viewed_eqs');
                renderBadges();
                showToast('学習データと実績を初期化しました');
            }
        });
    }

    // --- 4. マイページチュートリアル機能 ---
    const overlay = document.getElementById('tut-overlay');
    const tooltip = document.getElementById('tut-tooltip');
    const btnClose = document.getElementById('tut-close');
    const btnNext = document.getElementById('tut-next');
    const btnPrev = document.getElementById('tut-prev');

    if (overlay && tooltip) {
        const targets = Array.from(document.querySelectorAll('.tut-target'))
                             .sort((a, b) => parseInt(a.dataset.step) - parseInt(b.dataset.step));

        let currentStep = 0;

        function startMyPageTutorial() {
            currentStep = 0;
            
            // リプレイ中のみ「✕」ボタンを表示し、初回オンボーディング時は非表示にする
            const isReplay = localStorage.getItem('v2_is_replaying_tutorial') === 'true';
            if (btnClose) {
                btnClose.style.display = isReplay ? 'block' : 'none';
            }

            overlay.style.display = 'block';
            tooltip.style.display = 'block';
            setTimeout(() => {
                overlay.style.opacity = '1';
                tooltip.style.opacity = '1';
            }, 10);
            showStep(currentStep);
        }

        function closeMyPageTutorial() {
            const isReplay = localStorage.getItem('v2_is_replaying_tutorial') === 'true';

            overlay.style.opacity = '0';
            tooltip.style.opacity = '0';
            clearHighlight();
            setTimeout(() => {
                overlay.style.display = 'none';
                tooltip.style.display = 'none';
            }, 300);
            
            localStorage.removeItem('v2_start_mypage_tutorial');
            localStorage.removeItem('v2_is_replaying_tutorial'); // リプレイフラグを消去

            // 初回チュートリアルの場合はホーム（index.html）に強制遷移
            if (!isReplay) {
                window.location.href = 'index.html';
            }
        }

        if (localStorage.getItem('v2_start_mypage_tutorial') === 'true') {
            startMyPageTutorial();
        }

        if (btnClose) btnClose.addEventListener('click', closeMyPageTutorial);
        // overlay.addEventListener('click', closeMyPageTutorial); // 背景クリックでの終了を無効化

        if (btnNext) {
            btnNext.addEventListener('click', () => {
                if (currentStep < targets.length - 1) {
                    currentStep++;
                    showStep(currentStep);
                } else {
                    closeMyPageTutorial();
                }
            });
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (currentStep > 0) {
                    currentStep--;
                    showStep(currentStep);
                }
            });
        }

        function showStep(index) {
            clearHighlight();
            const target = targets[index];
            if (!target) return;

            target.classList.add('tut-highlight');

            const rect = target.getBoundingClientRect();
            window.scrollTo({
                top: window.scrollY + rect.top - 100,
                behavior: 'smooth'
            });

            document.querySelector('.tut-step-counter').innerText = `STEP ${index + 1} / ${targets.length}`;
            document.getElementById('tut-title').innerText = target.dataset.title;
            document.getElementById('tut-desc').innerText = target.dataset.desc;

            btnPrev.style.visibility = index === 0 ? 'hidden' : 'visible';
            btnNext.innerText = index === targets.length - 1 ? 'FINISH ✔' : 'NEXT ▶';

            setTimeout(() => {
                const updatedRect = target.getBoundingClientRect();
                let topPos = updatedRect.bottom + window.scrollY + 15;
                let leftPos = updatedRect.left + window.scrollX;
                
                if (topPos + tooltip.offsetHeight > window.scrollY + window.innerHeight) {
                    topPos = updatedRect.top + window.scrollY - tooltip.offsetHeight - 15;
                }
                
                const safeTopMargin = 100;
                if (topPos < window.scrollY + safeTopMargin) {
                    topPos = window.scrollY + safeTopMargin;
                }
                
                if (leftPos < 10) {
                    leftPos = 10;
                }
                
                if (leftPos + tooltip.offsetWidth > window.innerWidth - 10) {
                    leftPos = window.innerWidth - tooltip.offsetWidth - 10;
                }

                tooltip.style.top = `${topPos}px`;
                tooltip.style.left = `${leftPos}px`;
            }, 350);
        }

        function showStepMyPage(index) {
            // Not needed as showStep works
        }

        function clearHighlight() {
            targets.forEach(el => el.classList.remove('tut-highlight'));
        }
    }
});

// トースト通知関数
function showToast(message) {
    let toast = document.getElementById('toast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #00E676; color: #000; padding: 10px 20px; border-radius: 4px; font-weight: bold; font-size: 0.9rem; z-index: 10000; opacity: 0; pointer-events: none; transition: opacity 0.3s;";
        document.body.appendChild(toast);
    }
    
    toast.innerText = message;
    toast.style.opacity = '1';
    
    setTimeout(() => { 
        toast.style.opacity = '0'; 
    }, 2500);
}

/**
 * 獲得実績（バッジ一覧）をDOMへ描画・更新する関数
 */
function renderBadges() {
    const earnedIds = typeof getEarnedBadges === 'function' ? getEarnedBadges() : [];
    const baseBadges = (typeof BADGE_DEFINITIONS !== 'undefined') 
        ? BADGE_DEFINITIONS.filter(b => !b.isMaster) 
        : [];
    const masterBadge = (typeof BADGE_DEFINITIONS !== 'undefined')
        ? BADGE_DEFINITIONS.find(b => b.isMaster)
        : null;

    const earnedCount = baseBadges.filter(b => earnedIds.includes(b.id)).length;
    const isMasterUnlocked = earnedIds.includes('master') || (earnedCount === baseBadges.length && baseBadges.length > 0);

    // 進捗サマリー表示の更新
    const summaryEl = document.getElementById('badge-summary-text');
    if (summaryEl) {
        summaryEl.textContent = `獲得状況: ${earnedCount} / ${baseBadges.length}${isMasterUnlocked ? ' (👑 MASTER達成)' : ''}`;
    }

    // 進捗バーの更新
    const progressFill = document.getElementById('badge-progress-fill');
    if (progressFill) {
        const percent = baseBadges.length > 0 ? Math.round((earnedCount / baseBadges.length) * 100) : 0;
        progressFill.style.width = `${percent}%`;
    }

    // マスターバッジバナーの表示切り替え
    const masterBanner = document.getElementById('master-badge-banner');
    if (masterBanner) {
        masterBanner.style.display = isMasterUnlocked ? 'flex' : 'none';
    }

    // 9つのバッジグリッドの描画
    const gridEl = document.getElementById('badge-grid');
    if (gridEl) {
        gridEl.innerHTML = '';
        baseBadges.forEach(b => {
            const isUnlocked = earnedIds.includes(b.id);
            const card = document.createElement('div');
            card.className = `badge-card ${isUnlocked ? 'unlocked' : 'locked'}`;
            card.id = `badge-${b.id}`;

            if (isUnlocked) {
                card.innerHTML = `
                    <div class="badge-icon">${b.icon}</div>
                    <div class="badge-category">${b.category}</div>
                    <div class="badge-name">${b.name}</div>
                    <div class="badge-desc">${b.desc}</div>
                    <div class="badge-status-tag">✓ 獲得済み</div>
                `;
            } else {
                card.innerHTML = `
                    <div class="badge-icon">${b.icon}</div>
                    <div class="badge-category">${b.category}</div>
                    <div class="badge-name">${b.name}</div>
                    <div class="badge-desc"><span style="color:var(--cud-orange); font-weight:bold;">【要件】</span> ${b.req}</div>
                    <div class="badge-status-tag">🔒 未獲得</div>
                `;
            }
            gridEl.appendChild(card);
        });
    }
}