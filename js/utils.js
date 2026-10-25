/**
 * Quake Interactive Archive - Common Utilities
 * 
 * [機能一覧]
 * 1. ユーザーIDの管理 (LocalStorage保存・取得・同期 & 改ざん防止検証)
 * 2. 汎用HTMLエスケープ関数 (DOM-based XSS防御)
 * 3. CSVセルサニタイズ関数 (CSV Formula / DDE Injection 防止)
 * 4. 汎用配列シャッフル関数 (Fisher-Yates)
 * 5. クイズ/ゲーム結果画面への「マイページ誘導共通カード」の安全な差し込み
 * 6. 防災バッジ獲得・トースト表示システム (全9種＋マスターバッジ)
 * 7. 実験行動ログ収集・蓄積 (上限5,000件FIFOリングバッファ & 300ms連打スロットリング)
 * 8. 実験行動ログCSVエクスポート (UTF-8 BOM付き)
 */

const STORAGE_KEY = 'v2_research_user_id';
const BADGES_KEY = 'v2_quake_medals';
const ELAPSED_TIME_KEY = 'v2_accumulated_elapsed_time';
const SYSTEM_LOGS_KEY = 'v2_system_logs';
const MAX_LOG_LIMIT = 5000;

let lastClickLogDetail = '';
let lastClickLogTime = 0;
const pageLoadTimestamp = Date.now();

// ==========================================
// 1. セキュリティサニタイズ関数群
// ==========================================

/**
 * 汎用HTMLエスケープ関数（DOM-based XSS防御）
 * @param {string} str エスケープ対象の文字列
 * @returns {string} サニタイズ済み文字列
 */
function escapeHTML(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
if (typeof window !== 'undefined') {
    window.escapeHTML = escapeHTML;
}

/**
 * CSVセル値のサニタイズ関数 (CSV Formula / DDE Injection 防止)
 * @param {*} val セル値
 * @returns {string} エスケープ済みCSVセル
 */
function sanitizeCSVCell(val) {
    if (val === undefined || val === null) return '""';
    let str = String(val);
    
    // 先頭文字が数式トリガー (=, +, -, @, \t, \r) の場合、先頭に ' を付与して無効化
    if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
    }
    
    // ダブルクォートをエスケープして全体を囲む
    return `"${str.replace(/"/g, '""')}"`;
}
if (typeof window !== 'undefined') {
    window.sanitizeCSVCell = sanitizeCSVCell;
}

// ==========================================
// 2. LocalStorage データ検証 & フェイルセーフ関数群
// ==========================================

/**
 * ユーザーIDをLocalStorageから取得、存在しないか形式が不正な場合は新規生成して保存する関数
 * @returns {string} ユーザーID
 */
function getOrCreateUserId() {
    let userId = localStorage.getItem(STORAGE_KEY);
    const validPattern = /^User-V2-[A-Z0-9]{6,16}$/;
    
    if (!userId || !validPattern.test(userId)) {
        const randHex = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()
            : Math.random().toString(36).substring(2, 10).toUpperCase();
        userId = 'User-V2-' + randHex;
        try {
            localStorage.setItem(STORAGE_KEY, userId);
        } catch (e) {
            console.error('Failed to save userId:', e);
        }
    }
    
    return userId;
}

/**
 * LocalStorageの累積経過時間を安全に取得する関数（改ざん・破損防止）
 * @returns {number} 累積ミリ秒 (0 <= time <= 86,400,000)
 */
function getValidatedElapsedTime() {
    try {
        const raw = localStorage.getItem(ELAPSED_TIME_KEY);
        const parsed = parseInt(raw, 10);
        const MAX_ELAPSED = 24 * 60 * 60 * 1000; // 最大24時間
        if (isNaN(parsed) || parsed < 0) return 0;
        return Math.min(parsed, MAX_ELAPSED);
    } catch (e) {
        return 0;
    }
}
if (typeof window !== 'undefined') {
    window.getValidatedElapsedTime = getValidatedElapsedTime;
}

/**
 * 獲得済みバッジリストを安全に取得する関数（配列検証・破損防止）
 * @returns {Array<string>} バッジIDの配列
 */
function getValidatedBadges() {
    try {
        const raw = localStorage.getItem(BADGES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}
if (typeof window !== 'undefined') {
    window.getValidatedBadges = getValidatedBadges;
    window.getEarnedBadges = getValidatedBadges; // 既存互換性エイリアス
}

// ==========================================
// 3. 汎用ユーティリティ
// ==========================================

/**
 * 配列をランダムにシャッフルする関数 (Fisher-Yatesアルゴリズム)
 * @param {Array} array シャッフルしたい配列
 * @returns {Array} シャッフルされた新しい配列
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 結果画面に「マイページ誘導カード」を安全に挿入する関数
 * @param {HTMLElement} container 挿入対象のコンテナ要素
 */
function appendMyPageLink(container) {
    if (!container) return;
    
    // 既に差し込まれている場合は多重追加を防止
    if (container.querySelector('.mypage-promo-card')) return;

    const promoCard = document.createElement('div');
    promoCard.className = 'mypage-promo-card';
    promoCard.innerHTML = `
        <h3>🎉 新しいバッジを獲得したかも？</h3>
        <p>マイページに戻って、あなたのコレクションを確認しましょう！</p>
        <button onclick="location.href='mypage.html'" data-log="結果画面：マイページ誘導カードボタンをクリック">
            マイページへ行く 👤
        </button>
    `;
    container.appendChild(promoCard);
}

// ==========================================
// 4. 防災バッジ獲得 & トースト通知システム
// ==========================================

const BADGE_DEFINITIONS = [
    {
        id: 'quiz_stage0',
        name: '初動サバイバー',
        icon: '🥉',
        category: 'サバイバル・クイズ',
        req: '本番・初級 80%以上正解',
        desc: '揺れ発生直後の基本行動を確実にマスターした証'
    },
    {
        id: 'quiz_stage1',
        name: '都市災害エキスパート',
        icon: '🥈',
        category: 'サバイバル・クイズ',
        req: '本番・中級 80%以上正解',
        desc: '都市特有のリスクや二次災害への的確な対処力を証明'
    },
    {
        id: 'quiz_stage2',
        name: '極限防災マスター',
        icon: '🥇',
        category: 'サバイバル・クイズ',
        req: '本番・上級 80%以上正解',
        desc: 'デマ対応や長期避難など過酷な環境での知恵を完全習得'
    },
    {
        id: 'shakeout_sleep',
        name: '暗闇の防衛者',
        icon: '🛏️',
        category: 'シェイクアウト訓練',
        req: '本番・就寝時シナリオクリア',
        desc: '寝起き・暗闇の無防備な状況下で頭部を守り生き延びた証'
    },
    {
        id: 'shakeout_arena',
        name: '流されない勇気',
        icon: '🏟️',
        category: 'シェイクアウト訓練',
        req: '本番・アリーナシナリオクリア',
        desc: '集団心理やパニックに流されず冷静に安全確保した証'
    },
    {
        id: 'fake_news_buster',
        name: 'フェイクバスター',
        icon: '📱',
        category: 'デマ見極め訓練',
        req: '本番 80%以上正解 (8問以上)',
        desc: '災害時の不確実な情報やAI生成デマを鋭く見抜いた証'
    },
    {
        id: 'memory_inheritor',
        name: '記憶の継承者',
        icon: '🕊️',
        category: '3.11記憶の追体験',
        req: '本編クリア または 教訓ダイジェスト確認',
        desc: '東日本大震災の教訓と命を守る判断を学び受け継いだ証'
    },
    {
        id: 'hazard_navigator',
        name: 'リスクナビゲーター',
        icon: '🗺️',
        category: '複合ハザードマップ',
        req: '避難所マーカーをクリックして詳細を確認',
        desc: '地域の複合リスクと避難拠点の情報を能動的に調査した証'
    },
    {
        id: 'intensity_analyst',
        name: '地震史のアナリスト',
        icon: '🔍',
        category: '巨大地震震度分布',
        req: '過去の巨大地震を3件以上比較・確認',
        desc: '日本の過去の地震被害と揺れの広がりを多角的に比較分析した証'
    },
    {
        id: 'master',
        name: '総合防災マスター',
        icon: '👑',
        category: 'マスター実績',
        req: '全9種のバッジをすべて獲得する',
        desc: '全ての防災訓練・アーカイブを探求し、真の防災力を身につけた達人',
        isMaster: true
    }
];

if (typeof window !== 'undefined') {
    window.BADGE_DEFINITIONS = BADGE_DEFINITIONS;
}

/**
 * 指定されたバッジをアンロックする
 * @param {string} badgeId 解除したいバッジのID
 * @returns {boolean} 新規に獲得できた場合は true、既に獲得済みの場合は false
 */
function unlockBadge(badgeId) {
    try {
        const earned = getValidatedBadges();
        if (earned.includes(badgeId)) {
            return false; // 既に獲得済み
        }

        const badgeDef = BADGE_DEFINITIONS.find(b => b.id === badgeId);
        if (!badgeDef) {
            console.warn(`Badge definition not found: ${badgeId}`);
            return false;
        }

        earned.push(badgeId);
        localStorage.setItem(BADGES_KEY, JSON.stringify(earned));

        // バッジ獲得ログを記録
        if (typeof addSystemLog === 'function') {
            addSystemLog('badge_unlock', badgeDef.name, badgeDef.id);
        }

        // トースト通知を表示
        showBadgeToast(badgeDef);

        // バッジ獲得イベントをブロードキャスト
        window.dispatchEvent(new CustomEvent('badgeunlocked', { detail: { badge: badgeDef } }));

        // マスターバッジの獲得判定（通常バッジ全9種をコンプリート）
        const baseBadgeIds = BADGE_DEFINITIONS.filter(b => !b.isMaster).map(b => b.id);
        const hasAllBase = baseBadgeIds.every(id => earned.includes(id));
        if (hasAllBase && !earned.includes('master')) {
            setTimeout(() => {
                unlockBadge('master');
            }, 1200);
        }

        return true;
    } catch (e) {
        console.error('Error unlocking badge:', e);
        return false;
    }
}
if (typeof window !== 'undefined') {
    window.unlockBadge = unlockBadge;
}

/**
 * バッジ獲得トースト通知を表示する
 * @param {Object} badge バッジ定義オブジェクト
 */
function showBadgeToast(badge) {
    let container = document.getElementById('badge-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'badge-toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            max-width: calc(100vw - 32px);
            width: 360px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const isMaster = badge.isMaster;
    const accentColor = isMaster ? '#E69F00' : 'var(--cud-green, #00E676)';

    toast.className = 'badge-toast-card';
    toast.style.cssText = `
        background: var(--surface-color, #1a1a1a);
        border: 2px solid ${accentColor};
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        gap: 14px;
        color: var(--text-main, #ffffff);
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
    `;

    toast.innerHTML = `
        <div style="font-size: 2.2rem; line-height: 1; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
            ${badge.icon}
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-size: 0.72rem; font-weight: bold; color: ${accentColor}; letter-spacing: 0.08em; margin-bottom: 2px;">
                🏆 ${isMaster ? '★ 殿堂入りマスター達成！ ★' : 'バッジを獲得しました！'}
            </div>
            <div style="font-size: 1rem; font-weight: bold; color: var(--text-main, #ffffff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHTML(badge.name)}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-sub, #aaaaaa); margin-top: 2px; line-height: 1.35;">
                ${escapeHTML(badge.desc)}
            </div>
        </div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 4500);
}

// ==========================================
// 5. 実験行動ログ収集・蓄積 & CSVエクスポート
// ==========================================

/**
 * ログエントリをローカルストレージに蓄積する関数（上限5,000件・容量保護）
 * @param {string} actionType イベント種別 (page_view, click, stay_time, score, badge_unlock 等)
 * @param {string} detailInfo 操作内容やクリックされたボタン名
 * @param {string|number} extraVal 補足値（スコアや秒数など）
 */
function addSystemLog(actionType, detailInfo = '', extraVal = '') {
    try {
        const userId = getOrCreateUserId();
        const pagePath = window.location.pathname.split('/').pop() || 'index.html';
        const elapsedSec = Math.floor(getValidatedElapsedTime() / 1000);
        const jstDate = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

        const logEntry = {
            timestamp: new Date().toISOString(),
            jst: jstDate,
            elapsedSec: elapsedSec,
            userId: userId,
            page: pagePath,
            action: actionType,
            detail: detailInfo,
            extra: extraVal !== undefined ? String(extraVal) : ''
        };

        let logs = [];
        const raw = localStorage.getItem(SYSTEM_LOGS_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                logs = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                logs = [];
            }
        }
        logs.push(logEntry);

        // 上限5,000件のFIFOリングバッファ（古いログから自動破棄）
        if (logs.length > MAX_LOG_LIMIT) {
            logs = logs.slice(logs.length - MAX_LOG_LIMIT);
        }

        try {
            localStorage.setItem(SYSTEM_LOGS_KEY, JSON.stringify(logs));
        } catch (quotaErr) {
            console.warn('LocalStorage quota warning in addSystemLog:', quotaErr);
            // 万が一の容量超過時はログを半分にトリミングして緊急保存
            if (logs.length > 500) {
                logs = logs.slice(Math.floor(logs.length / 2));
                try {
                    localStorage.setItem(SYSTEM_LOGS_KEY, JSON.stringify(logs));
                } catch (e2) {
                    console.error('Critical quota error in addSystemLog:', e2);
                }
            }
        }
    } catch (e) {
        console.error('Failed to record system log:', e);
    }
}
if (typeof window !== 'undefined') {
    window.addSystemLog = addSystemLog;
}

/**
 * 蓄積されたログをCSV形式に整形してダウンロードする関数
 */
function exportLogsAsCSV() {
    try {
        const userId = getOrCreateUserId();
        let logs = [];
        const raw = localStorage.getItem(SYSTEM_LOGS_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                logs = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                logs = [];
            }
        }

        // CSVヘッダー
        const headers = ["日時 (JST)", "経過時間 (秒)", "被験者ID", "ページ", "イベント種別", "詳細・操作内容", "補足・スコア"];
        const rows = [headers];

        logs.forEach(item => {
            rows.push([
                item.jst || item.timestamp || '',
                String(item.elapsedSec !== undefined ? item.elapsedSec : ''),
                item.userId || userId,
                item.page || '',
                item.action || '',
                item.detail || '',
                item.extra || ''
            ]);
        });

        // ログが空の場合の初期行
        if (logs.length === 0) {
            rows.push([
                new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
                String(Math.floor(getValidatedElapsedTime() / 1000)),
                userId,
                window.location.pathname.split('/').pop() || 'index.html',
                'session_summary',
                'セッションログ出力',
                ''
            ]);
        }

        // CSV文字列化（数式インジェクション防止・ダブルクォートエスケープ）
        const csvContent = rows.map(r => 
            r.map(sanitizeCSVCell).join(',')
        ).join('\r\n');

        // Excel用 BOM (0xEF, 0xBB, 0xBF) 付与
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const now = new Date();
        const dateStr = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0');
        
        const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
        const filename = `QuakeLog_${cleanUserId}_${dateStr}.csv`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        addSystemLog('export_csv', `CSVダウンロード実行: ${filename}`);
    } catch (e) {
        console.error('Failed to export CSV:', e);
        alert('CSVの生成中にエラーが発生しました。');
    }
}
if (typeof window !== 'undefined') {
    window.exportLogsAsCSV = exportLogsAsCSV;
}

// 画面クリック（data-log属性付き）の自動トラッキング（300ms連打スロットリング）
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-log]');
    if (target) {
        const detailMessage = target.getAttribute('data-log');
        const now = Date.now();
        // 同一ボタン・内容が300ms以内に連打された場合は重複記録を抑止
        if (detailMessage === lastClickLogDetail && (now - lastClickLogTime < 300)) {
            return;
        }
        lastClickLogDetail = detailMessage;
        lastClickLogTime = now;
        addSystemLog('click', detailMessage);
    }
}, { passive: true });

// ページビューの自動記録
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        addSystemLog('page_view', document.title);
    }, 400);
});

// ページ離脱時の滞在時間記録
window.addEventListener('pagehide', () => {
    const stayTimeMs = Date.now() - pageLoadTimestamp;
    const stayTimeSeconds = Math.round(stayTimeMs / 1000);
    if (stayTimeSeconds > 0) {
        addSystemLog('stay_time', `滞在時間: ${stayTimeSeconds}秒`, stayTimeSeconds);
    }
});
