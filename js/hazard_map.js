document.addEventListener('DOMContentLoaded', () => {
    initHazardMap();
});

function initHazardMap() {
    const map = L.map('hazard-map', {
        zoomControl: false, 
        minZoom: 5,
        maxZoom: 18,
        zoomSnap: 0.5 // 0.5刻みの滑らかなズームに対応
    }).setView([35.62, 139.80], 9.5); 

    // ★追加：地図右下に国土地理院の全体クレジットを強制表示
    map.attributionControl.addAttribution('出典: <a href="https://www.gsi.go.jp/" target="_blank" rel="noopener noreferrer">国土地理院</a>');

    // --- 背景地図レイヤー（国土地理院 淡色地図 × ダーク反転フィルター：高精細な日本語地名と漆黒テーマを両立） ---
    const darkMap = L.tileLayer('https://maps.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院 (淡色地図)</a>',
        className: 'dark-gsi-tiles',
        minZoom: 5,
        maxZoom: 18
    });

    darkMap.addTo(map);

    // --- 面情報：ハザードマップレイヤー ---
    const tsunamiLayer = L.tileLayer('https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png', { 
        opacity: 0.85,
        className: 'hazard-overlay-tile'
    });
    const floodLayer = L.tileLayer('https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png', { 
        opacity: 0.85,
        className: 'hazard-overlay-tile'
    });
    const debrisFlowLayer = L.tileLayer('https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png', { 
        opacity: 0.95,
        className: 'landslide-overlay-tile'
    });
    const steepSlopeLayer = L.tileLayer('https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png', { 
        opacity: 0.95,
        className: 'landslide-overlay-tile'
    });
    const landslideLayer = L.layerGroup([debrisFlowLayer, steepSlopeLayer]);

    // --- 都道府県境界レイヤー（軽量化版 GeoJSON を使用） ---
    let prefectureLayer = null;
    function getPrefectureStyle() {
        const isLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme')) === 'light';
        return {
            color: isLight ? '#008744' : '#00E676', // CUDグリーン
            weight: isLight ? 1.8 : 1.5,
            opacity: isLight ? 0.85 : 0.7,
            fillOpacity: 0.0,
            dashArray: '4, 4'
        };
    }

    fetch('./assets/prefectures_light.geojson')
        .then(res => {
            if (!res.ok) throw new Error('Prefectures geojson load failed');
            return res.json();
        })
        .then(geoData => {
            prefectureLayer = L.geoJSON(geoData, {
                style: getPrefectureStyle,
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.name || feature.properties.nam_ja || '都道府県';
                    layer.bindTooltip(name, {
                        permanent: false,
                        direction: 'center',
                        className: 'pref-boundary-tooltip'
                    });
                }
            });
            // デフォルトで表示
            prefectureLayer.addTo(map);
            
            // レイヤーコントロールに動的追加
            if (layerControl) {
                layerControl.addOverlay(prefectureLayer, "🗺️ 都道府県境 (Line)");
            }
        })
        .catch(err => {
            console.warn('Could not load prefecture boundaries:', err);
        });

    // テーマ切り替え時に都道府県境界線の色を更新
    document.addEventListener('themechange', () => {
        if (prefectureLayer) {
            prefectureLayer.setStyle(getPrefectureStyle());
        }
    });

    // 初期状態では津波のみオン
    tsunamiLayer.addTo(map);

    // --- 点情報：避難所の本物データ（クラスタリング対応） ---
    const shelterIcon = L.divIcon({
        className: 'sfj-shelter-marker',
        html: '🏃', 
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    });

    const markersCluster = L.markerClusterGroup({
        maxClusterRadius: 40,
        disableClusteringAtZoom: 15,
        chunkedLoading: true,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = count < 100 ? 32 : 42; 
            
            return L.divIcon({ 
                html: `<div>${count}</div>`, 
                className: 'sfj-cluster-marker', 
                iconSize: L.point(size, size) 
            });
        }
    });

    const loadedPrefectures = new Set();
    const prefectureShelterCache = new Map();
    
    // 複数選択フィルター（初期状態は全災害が有効）
    const ALL_FILTER_CODES = ['J', 'T', 'F', 'S', 'H'];
    let activeFilters = new Set(ALL_FILTER_CODES);
    let filterMatchMode = 'OR';
    let isClusterAdded = false;
    let isShelterEnabled = true; // 避難所全体の表示ON/OFF

    const DISASTER_ORDER = [
        { code: "J", name: "地震", icon: "🏚️" },
        { code: "T", name: "津波", icon: "🌊" },
        { code: "F", name: "洪水", icon: "💧" },
        { code: "S", name: "土砂", icon: "⛰️" },
        { code: "H", name: "火災", icon: "🔥" },
        { code: "N", name: "内水", icon: "🌧️" },
        { code: "K", name: "高潮", icon: "🌊" }
    ];

    function matchesFilter(shelter) {
        if (!shelter.d) return false;
        if (activeFilters.size === 0) return false;
        
        if (activeFilters.size === ALL_FILTER_CODES.length && filterMatchMode === 'OR') {
            return true;
        }

        const shelterCodes = shelter.d;
        if (filterMatchMode === 'OR') {
            for (let code of activeFilters) {
                if (shelterCodes.includes(code)) return true;
            }
            return false;
        } else {
            for (let code of activeFilters) {
                if (!shelterCodes.includes(code)) return false;
            }
            return true;
        }
    }

    function createMarkerForShelter(s) {
        const latlng = L.latLng(s.c[1], s.c[0]);
        const marker = L.marker(latlng, { icon: shelterIcon });

        marker.bindPopup(function() {
            if (typeof unlockBadge === 'function') {
                unlockBadge('hazard_navigator');
            }

            const badgesHtml = DISASTER_ORDER.map(d => {
                const isSupported = s.d && s.d.includes(d.code);
                const statusClass = isSupported ? 'ok' : 'ng';
                const statusMark = isSupported ? '〇 対応' : '× 不可';
                return `
                    <div class="shelter-badge-item ${statusClass}">
                        <span>${d.icon} ${d.name}</span>
                        <span class="badge-status">${statusMark}</span>
                    </div>
                `;
            }).join('');

            return `
                <div style="min-width: 220px;">
                    <div style="font-size:0.7rem; color:var(--cud-green); font-weight:bold; letter-spacing:0.05em; margin-bottom:4px;">
                        🛡️ 国土数値情報 指定緊急避難場所
                    </div>
                    <div style="font-weight:bold; font-size:1.05rem; line-height:1.4; color:var(--text-main); margin-bottom:10px; border-bottom:1px solid var(--border-color); padding-bottom:6px;">
                        ${typeof escapeHTML === 'function' ? escapeHTML(s.n) : s.n}
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-sub); font-weight:bold;">災害別 適応状況:</div>
                    <div class="shelter-badge-grid">
                        ${badgesHtml}
                    </div>
                </div>
            `;
        });

        return marker;
    }

    const SHELTER_VISIBLE_ZOOM = 13;

    function rebuildShelterMarkers() {
        markersCluster.clearLayers();
        if (!isShelterEnabled) {
            updateShelterCountIndicators(0);
            return;
        }

        const markersArray = [];
        let totalCount = 0;

        prefectureShelterCache.forEach((shelters) => {
            shelters.forEach(s => {
                if (matchesFilter(s)) {
                    markersArray.push(createMarkerForShelter(s));
                    totalCount++;
                }
            });
        });

        if (markersArray.length > 0) {
            markersCluster.addLayers(markersArray);
        }

        updateShelterCountIndicators(totalCount);
    }

    function updateShelterCountIndicators(totalCount) {
        const currentZoom = map.getZoom();
        const countBadge = document.getElementById('shelter-count-badge');
        const controlCount = document.getElementById('shelter-control-count');
        const zoomNotice = document.getElementById('shelter-zoom-notice');
        const mZoomHint = document.getElementById('m-shelter-zoom-hint');

        if (!isShelterEnabled) {
            if (countBadge) countBadge.innerHTML = `表示中: <span style="color:#aaa;">非表示</span>`;
            if (controlCount) controlCount.innerHTML = `<span style="color:#aaa; font-size:0.68rem;">(OFF)</span>`;
            if (zoomNotice) zoomNotice.style.display = 'none';
            if (mZoomHint) mZoomHint.style.display = 'none';
            return;
        }

        if (currentZoom < SHELTER_VISIBLE_ZOOM) {
            if (countBadge) {
                countBadge.innerHTML = `<span style="color:#E69F00;">🔍 拡大して表示 (Lv13〜)</span>`;
            }
            if (controlCount) {
                controlCount.innerHTML = `<span style="color:#E69F00; font-size:0.68rem;">(拡大で表示)</span>`;
            }
            if (zoomNotice) {
                zoomNotice.style.display = 'block';
            }
            if (mZoomHint) {
                mZoomHint.style.display = 'block';
            }
        } else {
            const countText = totalCount !== undefined 
                ? totalCount.toLocaleString() 
                : markersCluster.getLayers().length.toLocaleString();

            if (countBadge) {
                countBadge.innerHTML = `表示中: <span style="color:var(--cud-green); font-weight:bold;">${countText}</span> 件`;
            }
            if (controlCount) {
                controlCount.innerHTML = `<span style="color:var(--cud-green); font-size:0.68rem;">(${countText}件)</span>`;
            }
            if (zoomNotice) {
                zoomNotice.style.display = 'none';
            }
            if (mZoomHint) {
                mZoomHint.style.display = 'none';
            }
        }
    }

    function updateVisibleShelters() {
        if (!isShelterEnabled) {
            if (isClusterAdded) {
                map.removeLayer(markersCluster);
                isClusterAdded = false;
            }
            updateShelterCountIndicators();
            return;
        }

        const currentZoom = map.getZoom();
        
        if (currentZoom < SHELTER_VISIBLE_ZOOM) {
            if (isClusterAdded) {
                map.removeLayer(markersCluster);
                isClusterAdded = false;
            }
            updateShelterCountIndicators();
            return;
        }

        if (!isClusterAdded) {
            map.addLayer(markersCluster);
            isClusterAdded = true;
        }

        const mapBounds = map.getBounds();
        const pendingLoads = [];

        PREFECTURES_CONFIG.forEach(pref => {
            const southWest = L.latLng(pref.bounds[0][0], pref.bounds[0][1]);
            const northEast = L.latLng(pref.bounds[1][0], pref.bounds[1][1]);
            const prefBounds = L.latLngBounds(southWest, northEast);

            if (mapBounds.intersects(prefBounds) && !loadedPrefectures.has(pref.code)) {
                loadedPrefectures.add(pref.code);
                pendingLoads.push(fetchPrefectureShelters(pref.code));
            }
        });

        updateShelterCountIndicators();
    }

    function fetchPrefectureShelters(prefCode) {
        return fetch(`./assets/shelters/shelters_${prefCode}.json`)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load prefecture: ${prefCode}`);
                return response.json();
            })
            .then(shelters => {
                prefectureShelterCache.set(prefCode, shelters);
                
                if (isShelterEnabled) {
                    const newMarkers = [];
                    shelters.forEach(s => {
                        if (matchesFilter(s)) {
                            newMarkers.push(createMarkerForShelter(s));
                        }
                    });

                    if (newMarkers.length > 0) {
                        markersCluster.addLayers(newMarkers);
                    }
                }

                updateShelterCountIndicators();
            })
            .catch(error => {
                console.warn(`Error loading shelters for code ${prefCode}:`, error);
                loadedPrefectures.delete(prefCode);
            });
    }

    map.on('moveend', updateVisibleShelters);
    updateVisibleShelters();

    // --- レイヤーコントロール（右上：PC用コントロール） ---
    const overlayMaps = {
        "🏃 指定緊急避難場所 (Point)": markersCluster,
        "🌊 津波浸水想定 (Area)": tsunamiLayer,
        "💧 洪水浸水想定 (Area)": floodLayer,
        "⛰️ 土砂災害警戒区域 (Area)": landslideLayer
    };

    if (prefectureLayer) {
        overlayMaps["🗺️ 都道府県境 (Line)"] = prefectureLayer;
    }

    const layerControl = L.control.layers(null, overlayMaps, { collapsed: false, position: 'topright' }).addTo(map);

    // --- 避難所 災害種別複数選択コントロール（右上直下：PC用コントロール） ---
    const shelterFilterControl = L.control({ position: 'topright' });
    shelterFilterControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'leaflet-shelter-filter');
        
        div.innerHTML = `
            <div class="leaflet-shelter-filter-title">
                <span>🏃 避難所 災害絞り込み</span>
                <span id="shelter-control-count" style="font-size:0.7rem; color:#aaa; font-weight:normal;"></span>
            </div>
            <div class="leaflet-shelter-filter-options">
                <label class="leaflet-shelter-filter-item">
                    <input type="checkbox" class="pc-shelter-cb" data-disaster="J" checked>
                    <span>🏚️ 地震</span>
                </label>
                <label class="leaflet-shelter-filter-item">
                    <input type="checkbox" class="pc-shelter-cb" data-disaster="T" checked>
                    <span>🌊 津波</span>
                </label>
                <label class="leaflet-shelter-filter-item">
                    <input type="checkbox" class="pc-shelter-cb" data-disaster="F" checked>
                    <span>💧 洪水</span>
                </label>
                <label class="leaflet-shelter-filter-item">
                    <input type="checkbox" class="pc-shelter-cb" data-disaster="S" checked>
                    <span>⛰️ 土砂</span>
                </label>
                <label class="leaflet-shelter-filter-item">
                    <input type="checkbox" class="pc-shelter-cb" data-disaster="H" checked>
                    <span>🔥 火災</span>
                </label>
            </div>
            <div id="shelter-zoom-notice" style="display:none; margin-top:8px; padding:6px; background:rgba(230,159,0,0.15); border:1px solid rgba(230,159,0,0.4); border-radius:4px; font-size:0.7rem; color:#E69F00; line-height:1.4;">
                <span>⚠️ 広域ではハザード面情報を優先表示しています。</span><br>
                <a href="#" id="link-zoom-in-shelter" style="color:#56B4E9; text-decoration:underline; font-weight:bold; display:inline-block; margin-top:3px;">
                    🔍 この地域を拡大して避難所を表示
                </a>
            </div>
            <div class="leaflet-shelter-filter-mode-note">
                ※ チェックを入れた災害に対応している避難所を表示（複数選択可）
            </div>
        `;

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        div.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'link-zoom-in-shelter') {
                e.preventDefault();
                map.setZoom(SHELTER_VISIBLE_ZOOM);
            }
        });

        const checkboxes = div.querySelectorAll('.pc-shelter-cb');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const code = cb.getAttribute('data-disaster');
                if (cb.checked) {
                    activeFilters.add(code);
                } else {
                    activeFilters.delete(code);
                }
                syncMobileFilterCheckboxes();
                rebuildShelterMarkers();

                if (window.logUserAction) {
                    window.logUserAction(`避難所複数フィルター更新(PC): [${Array.from(activeFilters).join(',')}]`);
                }
            });
        });

        return div;
    };
    shelterFilterControl.addTo(map);

    // --- 左上コントロール群（PC用：上: 📍現在地、下: ＋/ー 拡大縮小） ---
    const locateControl = L.control({ position: 'topleft' });
    locateControl.onAdd = function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control pc-locate-control');
        btn.innerHTML = '📍 現在地';
        btn.title = '現在地を取得して表示';
        btn.style.padding = '6px 12px';
        btn.style.cursor = 'pointer';
        btn.style.background = 'var(--surface-color)';
        btn.style.border = '1px solid var(--border-color)';
        btn.style.borderRadius = '4px';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '0.78rem';
        btn.style.color = 'var(--text-main)';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '4px';
        btn.style.boxShadow = 'var(--card-shadow)';
        btn.style.marginBottom = '6px';
        btn.style.transition = 'all 0.15s ease';

        btn.onmouseover = () => { 
            btn.style.background = 'var(--surface-hover)'; 
            btn.style.borderColor = 'var(--cud-green)'; 
            btn.style.color = 'var(--cud-green)'; 
        };
        btn.onmouseout = () => { 
            btn.style.background = 'var(--surface-color)'; 
            btn.style.borderColor = 'var(--border-color)'; 
            btn.style.color = 'var(--text-main)'; 
        };

        btn.onclick = function (e) {
            e.preventDefault();
            map.locate({ setView: true, maxZoom: 15 });
        };
        return btn;
    };
    locateControl.addTo(map);

    // 拡大縮小ボタン（PC用、スマホではCSSで非表示）
    L.control.zoom({ position: 'topleft' }).addTo(map);

    map.on('locationfound', function(e) {
        L.marker(e.latlng).addTo(map)
            .bindPopup("<div style='font-weight:bold; color:#56B4E9; font-size:1.1rem; text-align:center;'>📍 あなたの現在地</div>").openPopup();
    });

    // ========================================================
    // ★スマホ専用下部コントロール ＆ ボトムシート連携ロジック
    // ========================================================
    const mobileLocateBtn = document.getElementById('btn-mobile-locate');
    const toggleBtn = document.getElementById('btn-hazard-settings-toggle');
    const bottomSheet = document.getElementById('hazard-bottom-sheet');
    const backdrop = document.getElementById('hazard-sheet-backdrop');
    const closeBtn = document.getElementById('btn-hazard-sheet-close');
    const applyBtn = document.getElementById('btn-hazard-sheet-apply');
    const dragHandle = document.getElementById('hazard-sheet-handle');
    const mZoomLink = document.getElementById('m-link-zoom-shelter');

    // スマホ用「📍 現在地」クリック時
    if (mobileLocateBtn) {
        mobileLocateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            map.locate({ setView: true, maxZoom: 15 });
        });
    }

    function openBottomSheet() {
        if (bottomSheet) bottomSheet.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
    }

    function closeBottomSheet() {
        if (bottomSheet) bottomSheet.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', openBottomSheet);
    if (closeBtn) closeBtn.addEventListener('click', closeBottomSheet);
    if (applyBtn) applyBtn.addEventListener('click', closeBottomSheet);
    if (backdrop) backdrop.addEventListener('click', closeBottomSheet);
    if (dragHandle) dragHandle.addEventListener('click', closeBottomSheet);

    if (mZoomLink) {
        mZoomLink.addEventListener('click', (e) => {
            e.preventDefault();
            map.setZoom(SHELTER_VISIBLE_ZOOM);
            closeBottomSheet();
        });
    }

    // --- スマホ用ハザードレイヤーチェックボックス同期 ---
    const mChkTsunami = document.getElementById('m-layer-tsunami');
    const mChkFlood = document.getElementById('m-layer-flood');
    const mChkLandslide = document.getElementById('m-layer-landslide');
    const mChkPref = document.getElementById('m-layer-pref');
    const mChkShelter = document.getElementById('m-layer-shelter');

    if (mChkTsunami) {
        mChkTsunami.addEventListener('change', () => {
            if (mChkTsunami.checked) {
                map.addLayer(tsunamiLayer);
            } else {
                map.removeLayer(tsunamiLayer);
            }
        });
    }

    if (mChkFlood) {
        mChkFlood.addEventListener('change', () => {
            if (mChkFlood.checked) {
                map.addLayer(floodLayer);
            } else {
                map.removeLayer(floodLayer);
            }
        });
    }

    if (mChkLandslide) {
        mChkLandslide.addEventListener('change', () => {
            if (mChkLandslide.checked) {
                map.addLayer(landslideLayer);
            } else {
                map.removeLayer(landslideLayer);
            }
        });
    }

    if (mChkPref) {
        mChkPref.addEventListener('change', () => {
            if (!prefectureLayer) return;
            if (mChkPref.checked) {
                map.addLayer(prefectureLayer);
            } else {
                map.removeLayer(prefectureLayer);
            }
        });
    }

    if (mChkShelter) {
        mChkShelter.addEventListener('change', () => {
            isShelterEnabled = mChkShelter.checked;
            updateVisibleShelters();
        });
    }

    // --- スマホ用避難所災害種別フィルターチェックボックス同期 ---
    const mobileShelterCbs = document.querySelectorAll('.m-shelter-filter-cb');
    mobileShelterCbs.forEach(cb => {
        cb.addEventListener('change', () => {
            const code = cb.getAttribute('data-disaster');
            if (cb.checked) {
                activeFilters.add(code);
            } else {
                activeFilters.delete(code);
            }
            syncPcFilterCheckboxes();
            rebuildShelterMarkers();

            if (window.logUserAction) {
                window.logUserAction(`避難所複数フィルター更新(Mobile): [${Array.from(activeFilters).join(',')}]`);
            }
        });
    });

    function syncMobileFilterCheckboxes() {
        mobileShelterCbs.forEach(cb => {
            const code = cb.getAttribute('data-disaster');
            cb.checked = activeFilters.has(code);
        });
    }

    function syncPcFilterCheckboxes() {
        const pcCbs = document.querySelectorAll('.pc-shelter-cb');
        pcCbs.forEach(cb => {
            const code = cb.getAttribute('data-disaster');
            cb.checked = activeFilters.has(code);
        });
    }

    // 画面サイズ変更時（PC/スマホ切り替えや回転時）にマップ描画領域を再計算
    window.addEventListener('resize', () => {
        if (map) map.invalidateSize();
    });
}
