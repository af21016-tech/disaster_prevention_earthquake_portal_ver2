// --- グローバル変数 ---
let intensityData = [];
let map = null;
let geojsonLayer = null; 
let epicenterLayer = null; // ★震源地マーカーレイヤー
let jmaRegionData = null; 
let intensityLegend = null; // ★凡例オブジェクトをグローバルで保持
let currentSelectedEqId = null; // 現在選択中の地震ID

// ★JSONの「震度７」「震度５強」といった日本語文字列を、
// プログラムが計算できる「数値（7.0, 5.5など）」に翻訳する関数
function parseIntensityString(intensityStr) {
    if (typeof intensityStr === 'number') return intensityStr;
    if (!intensityStr) return 0;

    const str = String(intensityStr); 
    if (str.includes('7') || str.includes('７')) return 7.0;
    if (str.includes('6強') || str.includes('６強')) return 6.5;
    if (str.includes('6弱') || str.includes('６弱')) return 6.0;
    if (str.includes('6') || str.includes('６')) return 6.0; // 阪神などの旧震度6
    if (str.includes('5強') || str.includes('５強')) return 5.5;
    if (str.includes('5弱') || str.includes('５弱')) return 5.0;
    if (str.includes('5') || str.includes('５')) return 5.0; // 阪神などの旧震度5
    if (str.includes('4') || str.includes('４')) return 4.0;
    if (str.includes('3') || str.includes('３')) return 3.0;
    if (str.includes('2') || str.includes('２')) return 2.0;
    if (str.includes('1') || str.includes('１')) return 1.0;
    
    return 0;
}

// --- 気象庁震度階級のCUDカラー判定関数 ---
function getIntensityColor(intensity) {
    if (intensity >= 7) return '#960096';   // 紫 (震度7)
    if (intensity >= 6.5) return '#640000'; // 濃赤 (震度6強)
    if (intensity >= 6.0) return '#A50021'; // 赤 (震度6弱)
    if (intensity >= 5.5) return '#FF2800'; // 朱色 (震度5強)
    if (intensity >= 5.0) return '#FFBE00'; // 黄土色 (震度5弱)
    if (intensity >= 4.0) return '#FAE600'; // 黄 (震度4)
    return null;                            
}

// ★旧震度階級（弱強なし）に対応
function getIntensityString(val, isOldScale = false) {
    if (isOldScale) {
        if (val >= 7) return '7';
        if (val >= 6.0) return '6';
        if (val >= 5.0) return '5';
        if (val >= 4.0) return '4';
        return '3以下';
    }
    // 現行の震度階級
    if (val === 7) return '7';
    if (val === 6.5) return '6強';
    if (val === 6.0) return '6弱';
    if (val === 5.5) return '5強';
    if (val === 5.0) return '5弱';
    if (val >= 4.0) return Math.floor(val).toString();
    return '3以下';
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initSheetControls();
    loadAllData();
});

// ★スマホ用ボトムシートのナビゲーション＆開閉コントロール
function initSheetControls() {
    const sheetPanel = document.getElementById('eq-list-panel');
    const btnPrev = document.getElementById('btn-prev-eq');
    const btnNext = document.getElementById('btn-next-eq');
    const summaryCenter = document.getElementById('sheet-summary-center');
    const dragHandle = document.getElementById('sheet-drag-handle');
    const btnExpand = document.getElementById('btn-sheet-expand');
    const mapArea = document.getElementById('map-area-container');

    function toggleSheet(e) {
        if (e) e.stopPropagation();
        if (sheetPanel) sheetPanel.classList.toggle('sheet-expanded');
    }

    if (summaryCenter) summaryCenter.addEventListener('click', toggleSheet);
    if (dragHandle) dragHandle.addEventListener('click', toggleSheet);
    if (btnExpand) btnExpand.addEventListener('click', toggleSheet);

    // ◀ 前の地震へ（1タップでサクサク切替）
    if (btnPrev) {
        btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!intensityData || intensityData.length === 0) return;
            const currentIdx = intensityData.findIndex(d => d.id === currentSelectedEqId);
            const prevIdx = (currentIdx - 1 + intensityData.length) % intensityData.length;
            selectEarthquake(intensityData[prevIdx].id);
        });
    }

    // ▶ 次の地震へ（1タップでサクサク切替）
    if (btnNext) {
        btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!intensityData || intensityData.length === 0) return;
            const currentIdx = intensityData.findIndex(d => d.id === currentSelectedEqId);
            const nextIdx = (currentIdx + 1) % intensityData.length;
            selectEarthquake(intensityData[nextIdx].id);
        });
    }

    // 地図エリアをタップしたらシートを自動で閉じる
    if (mapArea && sheetPanel) {
        mapArea.addEventListener('click', () => {
            if (sheetPanel.classList.contains('sheet-expanded')) {
                sheetPanel.classList.remove('sheet-expanded');
            }
        });
    }
}

// ★スマホ用凡例のトグル開閉コントロール
function initLegendToggle() {
    const container = document.getElementById('intensity-legend-container');
    const toggleBtn = document.getElementById('legend-toggle-btn');
    const mapArea = document.getElementById('map-area-container');

    if (toggleBtn && container) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            container.classList.toggle('is-open');
            toggleBtn.classList.toggle('is-active', container.classList.contains('is-open'));
        });
    }

    // 地図エリアタップ時に凡例が開いていれば自動で閉じる
    if (mapArea && container) {
        mapArea.addEventListener('click', () => {
            if (container.classList.contains('is-open')) {
                container.classList.remove('is-open');
                if (toggleBtn) toggleBtn.classList.remove('is-active');
            }
        });
    }
}

function initMap() {
    map = L.map('intensity-map', {
        zoomControl: false,
        minZoom: 4
    }).setView([38.0, 137.0], 5);

    // PC表示用にズームボタンを追加（スマホ時はCSSで非表示になります）
    L.control.zoom({ position: 'topright' }).addTo(map);

    // --- テーマ連動ベースマップレイヤー管理 (Esri Canvas) ---
    const darkBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> | 出典：<a href="https://www.data.jma.go.jp/eqev/data/index.html" target="_blank" rel="noopener noreferrer">気象庁ホームページ</a>',
        maxZoom: 16
    });

    const darkRefLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        opacity: 0.85
    });

    const lightBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> | 出典：<a href="https://www.data.jma.go.jp/eqev/data/index.html" target="_blank" rel="noopener noreferrer">気象庁ホームページ</a>',
        maxZoom: 16
    });

    const lightRefLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        opacity: 0.85
    });

    // レイヤー切り替え関数
    function applyMapTheme(theme) {
        if (theme === 'light') {
            if (map.hasLayer(darkBaseLayer)) map.removeLayer(darkBaseLayer);
            if (map.hasLayer(darkRefLayer)) map.removeLayer(darkRefLayer);
            if (!map.hasLayer(lightBaseLayer)) lightBaseLayer.addTo(map);
            if (!map.hasLayer(lightRefLayer)) lightRefLayer.addTo(map);
        } else {
            if (map.hasLayer(lightBaseLayer)) map.removeLayer(lightBaseLayer);
            if (map.hasLayer(lightRefLayer)) map.removeLayer(lightRefLayer);
            if (!map.hasLayer(darkBaseLayer)) darkBaseLayer.addTo(map);
            if (!map.hasLayer(darkRefLayer)) darkRefLayer.addTo(map);
        }

        // 震度レイヤーおよび震源マーカーが存在していれば再描画
        if (geojsonLayer && currentSelectedEqId) {
            selectEarthquake(currentSelectedEqId);
        }
    }

    // 初期テーマの適用
    const initialTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme') || 'dark';
    applyMapTheme(initialTheme);

    // テーマ切り替えイベント受信
    document.addEventListener('themechange', (e) => {
        applyMapTheme(e.detail && e.detail.theme ? e.detail.theme : 'dark');
    });

    // 凡例コントロール（スマホ開閉トグルボタン付きラッパー）
    intensityLegend = L.control({ position: 'bottomright' });
    intensityLegend.onAdd = function () {
        this._div = L.DomUtil.create('div', 'intensity-legend-container');
        this._div.id = 'intensity-legend-container';
        this._div.innerHTML = `
            <button type="button" class="legend-toggle-btn" id="legend-toggle-btn" aria-label="震度凡例の表示切替">
                <span>🎨 凡例</span>
            </button>
            <div class="intensity-legend" id="intensity-legend-body"></div>
        `;
        this.update(); // 初期描画
        return this._div;
    };
    
    // 凡例の書き換え関数
    intensityLegend.update = function (isOldScale = false) {
        const bodyEl = this._div.querySelector('#intensity-legend-body') || this._div;
        if (isOldScale) {
            bodyEl.innerHTML = `
                <h4 style="margin-top:0; margin-bottom:8px;">気象庁 震度階級 (1995年当時)</h4>
                <div class="legend-row"><span class="legend-color" style="background:#960096;"></span> 震度 7</div>
                <div class="legend-row"><span class="legend-color" style="background:#A50021;"></span> 震度 6</div>
                <div class="legend-row"><span class="legend-color" style="background:#FF2800;"></span> 震度 5</div>
                <div class="legend-row"><span class="legend-color" style="background:#FAE600;"></span> 震度 4</div>
                <p style="font-size:0.6rem; color:#888; margin:5px 0 0 0;">※当時は強弱の区分がありませんでした</p>
            `;
        } else {
            bodyEl.innerHTML = `
                <h4 style="margin-top:0; margin-bottom:8px;">気象庁 震度階級 (面表示)</h4>
                <div class="legend-row"><span class="legend-color" style="background:#960096;"></span> 震度 7</div>
                <div class="legend-row"><span class="legend-color" style="background:#640000;"></span> 震度 6強</div>
                <div class="legend-row"><span class="legend-color" style="background:#A50021;"></span> 震度 6弱</div>
                <div class="legend-row"><span class="legend-color" style="background:#FF2800;"></span> 震度 5強</div>
                <div class="legend-row"><span class="legend-color" style="background:#FFBE00;"></span> 震度 5弱</div>
                <div class="legend-row"><span class="legend-color" style="background:#FAE600;"></span> 震度 4</div>
            `;
        }
    };
    intensityLegend.addTo(map);

    // 凡例トグルのクリックリスナー初期化
    initLegendToggle();

    // 画面サイズ変更時（PC/スマホ切り替えや回転時）にマップ描画領域を再計算
    window.addEventListener('resize', () => {
        if (map) map.invalidateSize();
    });
}

function loadAllData() {
    Promise.all([
        fetch('./assets/intensity_data.json?v=20261025_clean').then(r => r.json()),
        fetch('./assets/jma_region.geojson').then(r => r.json())
    ])
    .then(([eqData, geoData]) => {
        intensityData = eqData;
        jmaRegionData = geoData;
        renderList();
        if (intensityData.length > 0) {
            selectEarthquake(intensityData[intensityData.length - 1].id);
        }
    })
    .catch(err => {
        console.error('Data load error:', err);
    });
}

function renderList() {
    const container = document.getElementById('eq-list-container');
    container.innerHTML = '';
    intensityData.forEach(eq => {
        const card = document.createElement('div');
        card.className = 'eq-card';
        card.id = `card-${eq.id}`;
        card.innerHTML = `
            <div class="eq-date">${eq.date}</div>
            <div class="eq-name">${eq.name}</div>
            <div class="eq-meta">
                <span style="color:var(--primary-color); font-weight:bold;">${eq.magnitude}</span>
                <span style="color:var(--text-sub);">深さ: ${eq.depth}</span>
            </div>
        `;
        card.addEventListener('click', () => selectEarthquake(eq.id));
        container.appendChild(card);
    });
}

function selectEarthquake(eqId) {
    currentSelectedEqId = eqId;
    document.querySelectorAll('.eq-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`card-${eqId}`);
    if (activeCard) activeCard.classList.add('active');

    const eq = intensityData.find(d => d.id === eqId);
    if (!eq) return;

    // ★スマホ表示時：地震選択時にボトムシートを自動収納（地図に集中させる）
    const sheetPanel = document.getElementById('eq-list-panel');
    if (sheetPanel) {
        sheetPanel.classList.remove('sheet-expanded');
    }

    // 過去地震の比較閲覧履歴を保存（3件以上でバッジ獲得）
    try {
        const viewed = JSON.parse(localStorage.getItem('v2_quake_viewed_eqs') || '[]');
        if (!viewed.includes(eqId)) {
            viewed.push(eqId);
            localStorage.setItem('v2_quake_viewed_eqs', JSON.stringify(viewed));
        }
        if (viewed.length >= 3 && typeof unlockBadge === 'function') {
            unlockBadge('intensity_analyst');
        }
    } catch (e) {
        console.warn('Failed to track viewed earthquakes:', e);
    }

    // 阪神・淡路大震災かどうかを判定して凡例を更新
    const isHanshin = eq.name.includes("阪神") || eq.id.includes("hanshin");
    intensityLegend.update(isHanshin);

    // ★PC用オーバーレイに地震概要と公式震央地名をシンプルに表示
    const overlay = document.getElementById('eq-info-overlay');
    const titleEl = document.getElementById('info-title');
    const epicenterBoxEl = document.getElementById('info-epicenter-box');
    const epicenterNameEl = document.getElementById('info-epicenter-name');
    const magnitudeEl = document.getElementById('info-magnitude');
    const depthEl = document.getElementById('info-depth');
    const dateEl = document.getElementById('info-date');
    const descEl = document.getElementById('info-desc');

    if (titleEl) titleEl.innerText = eq.name;
    if (descEl) descEl.innerText = eq.description;

    if (eq.epicenter_name && epicenterBoxEl) {
        epicenterBoxEl.style.display = 'block';
        if (epicenterNameEl) epicenterNameEl.innerText = eq.epicenter_name;
        if (magnitudeEl) magnitudeEl.innerText = eq.magnitude;
        if (depthEl) depthEl.innerText = eq.depth || '';
        if (dateEl) dateEl.innerText = eq.date || '';
    } else if (epicenterBoxEl) {
        epicenterBoxEl.style.display = 'none';
    }

    if (overlay) overlay.style.display = 'block';

    // ★スマホ用ボトムシート（公式震央地名のみですっきり1行表示）
    const currentIdx = intensityData.findIndex(d => d.id === eqId);
    const sheetIndexEl = document.getElementById('sheet-index');
    const sheetTitleEl = document.getElementById('sheet-title');
    const sheetMagEl = document.getElementById('sheet-mag');
    const sheetSubinfoEl = document.getElementById('sheet-subinfo');
    const sheetDescEl = document.getElementById('sheet-desc');

    if (sheetIndexEl && currentIdx !== -1) {
        sheetIndexEl.innerText = `${currentIdx + 1} / ${intensityData.length}`;
    }
    if (sheetTitleEl) sheetTitleEl.innerText = eq.name;
    if (sheetMagEl) sheetMagEl.innerText = eq.magnitude;
    // 「三陸沖 / 深さ: 24 km」「石川県能登地方 / 深さ: 16 km」など、すっきり1行に統一
    if (sheetSubinfoEl) {
        sheetSubinfoEl.innerText = `${eq.epicenter_name || ''} / 深さ: ${eq.depth || ''}`;
    }
    if (sheetDescEl) sheetDescEl.innerText = eq.description;

    // 既存の細分区域レイヤーを削除
    if (geojsonLayer) {
        map.removeLayer(geojsonLayer);
        geojsonLayer = null;
    }

    // 既存の震源地マーカーを削除
    if (epicenterLayer) {
        map.removeLayer(epicenterLayer);
        epicenterLayer = null;
    }

    // 被災エリアおよび震源地を含む自動フォーカス用バウンディングボックス
    const targetBounds = L.latLngBounds();

    // ★震源地マーカーの生成と描画
    if (typeof eq.lat === 'number' && typeof eq.lng === 'number') {
        targetBounds.extend([eq.lat, eq.lng]);

        const epicenterIcon = L.divIcon({
            className: 'epicenter-div-icon',
            html: `
                <div class="epicenter-marker-wrap">
                    <div class="epicenter-pulse-ring"></div>
                    <div class="epicenter-icon" title="震源: ${eq.epicenter_name || ''}">💥</div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        epicenterLayer = L.marker([eq.lat, eq.lng], {
            icon: epicenterIcon,
            zIndexOffset: 1000
        }).addTo(map);

        // マーカーホバー時の控えめなツールチップ（公式震央名のみ）
        epicenterLayer.bindTooltip(`💥 震源: ${eq.epicenter_name || ''}`, {
            direction: 'top',
            offset: [0, -14],
            opacity: 0.95
        });

        // マーカークリック時：PCはカード発光、スマホはボトムシートを展開して解説を表示
        epicenterLayer.on('click', () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                if (sheetPanel) {
                    sheetPanel.classList.add('sheet-expanded');
                }
            } else if (overlay) {
                overlay.classList.remove('box-highlight');
                void overlay.offsetWidth; // リフロー強制
                overlay.classList.add('box-highlight');
                setTimeout(() => {
                    overlay.classList.remove('box-highlight');
                }, 1300);
            }
        });
    }

    const intensityMap = {};
    eq.points.forEach(pt => {
        intensityMap[pt.region] = parseIntensityString(pt.intensity);
    });

    const isLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme')) === 'light';

    geojsonLayer = L.geoJSON(jmaRegionData, {
        style: function (feature) {
            const regionName = feature.properties.name || feature.properties.NAME || feature.properties.Name;
            const intensity = intensityMap[regionName] || 0;
            const color = getIntensityColor(intensity);

            if (color) {
                return {
                    fillColor: color,
                    weight: 1.2,       
                    color: isLight ? '#111418' : '#ffffff', 
                    opacity: isLight ? 0.6 : 0.5,
                    fillOpacity: isLight ? 0.85 : 0.8 
                };
            } else {
                return {
                    fillColor: 'transparent',
                    weight: 0.5,
                    color: isLight ? '#A0AAB8' : '#555555',
                    opacity: isLight ? 0.5 : 0.3,
                    fillOpacity: 0
                };
            }
        },
        onEachFeature: function (feature, layer) {
            const regionName = feature.properties.name || feature.properties.NAME || feature.properties.Name;
            const intensity = intensityMap[regionName] || 0;
            
            if (intensity >= 4.0) {
                // 震度4以上の被災エリアを自動フォーカスの範囲に含める
                targetBounds.extend(layer.getBounds());

                const color = getIntensityColor(intensity);
                const intensityStr = getIntensityString(intensity, isHanshin);
                
                layer.on({
                    mouseover: (e) => {
                        const l = e.target;
                        l.setStyle({ fillOpacity: 1.0, weight: 2 });
                    },
                    mouseout: (e) => {
                        geojsonLayer.resetStyle(e.target);
                    }
                });

                layer.bindPopup(`
                    <strong style="font-size:1.1rem;">${regionName}</strong><br>
                    最大震度: <span style="font-weight:bold; color:${color}; font-size:1.2rem;">${intensityStr}</span>
                `);
            }
        }
    }).addTo(map);

    // 日本全体ではなく、震源地および震度4以上の被災エリアにスムーズに自動ズーム
    const isMobile = window.innerWidth <= 768;
    const padding = isMobile ? [25, 25] : [40, 40];

    if (targetBounds.isValid()) {
        map.flyToBounds(targetBounds, { padding: padding, maxZoom: 9, duration: 1.2 });
    } else if (geojsonLayer.getBounds().isValid()) {
        map.flyToBounds(geojsonLayer.getBounds(), { padding: [20, 20], maxZoom: 8, duration: 1.5 });
    }
}
