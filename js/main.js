/**
 * Quake Interactive Archive - Main Application Logic
 * * [機能一覧]
 * 1. ユーザーIDの自動生成とLocalStorage保存（研究データ紐付け用）
 * 2. Leafletを用いた過去24時間の地震データ（USGS）のマッピング
 * 3. 震源の深さとマグニチュードに応じたCUD（カラーユニバーサルデザイン）対応の可視化
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Leafletマップの初期化
    initializeRecentQuakeMap('leaflet-map');      // index.html用（ダッシュボードの小マップ）
    initializeRecentQuakeMap('leaflet-map-full'); // live-map.html用（全画面マップ）
    
    // 2. 3Dアーカイブマップの初期化
    initializeArchive3DMap('map-3d-container'); // index.html用
    initializeArchive3DMap('map-3d-full');      // archive-3d.html用
});

/**
 * 震源の深さ(km)に応じてCUD推奨カラーを返す関数
 */
function getDepthColor(depth) {
    if (depth <= 33) return '#D55E00';  // 朱色 (浅い)
    if (depth <= 70) return '#E69F00';  // 黄橙
    if (depth <= 150) return '#56B4E9'; // 空色
    return '#0072B2';                   // 濃い青 (深い)
}

/**
 * Leafletマップの初期化とUSGSデータの描画を行う関数
 */
function initializeRecentQuakeMap(containerId) {
    const mapContainer = document.getElementById(containerId);
    if (!mapContainer) return; 

    const isFullScreen = containerId === 'leaflet-map-full';
    const worldBounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));

    const map = L.map(containerId, { 
        zoomControl: false,          
        maxBounds: worldBounds,      
        maxBoundsViscosity: 1.0,     
        minZoom: 2                   
    }).setView([37.5, 137.5], isFullScreen ? 5 : 4.5); 

    L.control.zoom({ position: 'topright' }).addTo(map);

    // 全画面（フルスクリーン）表示ボタン
    const fullscreenControl = L.control({ position: 'topright' });
    fullscreenControl.onAdd = function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control');
        btn.innerHTML = '⛶'; 
        btn.title = "全画面表示の切り替え";
        btn.style.width = '34px';
        btn.style.height = '34px';
        btn.style.fontSize = '18px';
        btn.style.cursor = 'pointer';
        btn.style.backgroundColor = 'white';
        btn.style.color = '#333';
        btn.style.border = 'none';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';

        btn.onclick = function (e) {
            e.preventDefault();
            const mapEl = document.getElementById(containerId);
            if (!document.fullscreenElement) {
                if (mapEl.requestFullscreen) mapEl.requestFullscreen();
                else if (mapEl.webkitRequestFullscreen) mapEl.webkitRequestFullscreen(); 
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
        };
        return btn;
    };
    fullscreenControl.addTo(map);

    // --- テーマ連動ベースマップレイヤー管理 (Esri Canvas) ---
    const darkBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> | 出典：<a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">USGS (アメリカ地質調査所)</a>',
        maxZoom: 16,
        bounds: worldBounds,
        noWrap: true
    });

    const darkRefLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        bounds: worldBounds,
        noWrap: true,
        opacity: 0.85
    });

    const lightBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> | 出典：<a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">USGS (アメリカ地質調査所)</a>',
        maxZoom: 16,
        bounds: worldBounds,
        noWrap: true
    });

    const lightRefLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        bounds: worldBounds,
        noWrap: true,
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
    }

    // 初期テーマの適用
    const initialTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme') || 'dark';
    applyMapTheme(initialTheme);

    // テーマ切り替えイベントをリッスンして即時切り替え
    document.addEventListener('themechange', (e) => {
        applyMapTheme(e.detail && e.detail.theme ? e.detail.theme : 'dark');
    });

    const usgsUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

    fetch(usgsUrl)
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    const mag = feature.properties.mag;
                    const depth = feature.geometry.coordinates[2]; 
                    return L.circleMarker(latlng, {
                        radius: Math.max(mag * 2.5, 3),
                        fillColor: getDepthColor(depth),
                        color: "#ffffff",
                        weight: 1.5,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.place) {
                        const time = new Date(feature.properties.time).toLocaleString('ja-JP');
                        const placeEscaped = typeof escapeHTML === 'function' ? escapeHTML(feature.properties.place) : feature.properties.place.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
                        layer.bindPopup(`
                            <strong style="font-family: var(--font-sans); font-size: 1.1rem; color: #333;">M ${feature.properties.mag.toFixed(1)}</strong><br>
                            <span style="font-size:0.8rem; color: #666;">深さ: ${feature.geometry.coordinates[2].toFixed(1)} km</span><br>
                            <span style="font-size:0.8rem; color: #666;">${placeEscaped}</span><br>
                            <span style="font-size:0.75rem; color: #666;">${time}</span>
                        `);
                    }
                }
            }).addTo(map);

            // ★ 修正点：テーマ連動凡例パネル（.quake-legendクラスを適用）
            const legend = L.control({ position: 'bottomright' });
            legend.onAdd = function () {
                const div = L.DomUtil.create('div', 'quake-legend');
                div.innerHTML = `
                    <h4>震源の深さ</h4>
                    <div class="legend-row"><span class="legend-dot" style="background:#D55E00;"></span> 0 - 33 km (浅い)</div>
                    <div class="legend-row"><span class="legend-dot" style="background:#E69F00;"></span> 33 - 70 km</div>
                    <div class="legend-row"><span class="legend-dot" style="background:#56B4E9;"></span> 70 - 150 km</div>
                    <div class="legend-row"><span class="legend-dot" style="background:#0072B2;"></span> 150 km以上 (深い)</div>
                `;
                return div;
            };
            legend.addTo(map);

            // ※もし以前あった「リスト表示機能」を live-map.html で使用する場合は
            // この下に if (isFullScreen) { ... リスト描画処理 ... } を追加してください。
        })
        .catch(err => console.error('USGS Data fetch error:', err));
}

/**
 * Three.jsを用いた1995年以降の3D震源分布マップの初期化
 */
function initializeArchive3DMap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const placeholder = container.querySelector('.map-placeholder');
    const slicerUI = document.getElementById('time-slicer-ui'); 

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 1000);
    camera.position.set(0, 80, 140); 

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) existingCanvas.remove();
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    let gridHelper = null;
    let coastlineLines = null;
    let lineMaterial = null;
    let prefLines = null;
    let prefLineMaterial = null;

    // 3Dシーンのテーマ適用関数
    function apply3DSceneTheme(theme) {
        const isLight = theme === 'light';
        // 1. 背景色（ダーク: #050505 / ライト: #F5F6F8）
        scene.background = new THREE.Color(isLight ? '#F5F6F8' : '#050505');

        // 2. グリッドの再生成（ダーク: 0x333333, 0x111111 / ライト: 0xC8CDD4, 0xDFE3E8）
        if (gridHelper) scene.remove(gridHelper);
        gridHelper = new THREE.GridHelper(
            150, 
            30, 
            isLight ? 0x9AA2AF : 0x333333, 
            isLight ? 0xD0D5DD : 0x111111
        );
        scene.add(gridHelper);

        // 3. 日本列島海岸線マテリアル（ダーク: 0xE8F4F8 / ライト: 0x111418）
        if (lineMaterial) {
            lineMaterial.color.setHex(isLight ? 0x111418 : 0xE8F4F8);
            lineMaterial.opacity = isLight ? 0.95 : 0.9;
        }

        // 4. 都道府県境マテリアル（ダーク: CUD鮮明シアン 0x00E5FF / ライト: CUD深緑 0x008744）
        if (prefLineMaterial) {
            prefLineMaterial.color.setHex(isLight ? 0x008744 : 0x00E5FF);
            prefLineMaterial.opacity = isLight ? 0.75 : 0.85;
        }
    }

    // 初期テーマの適用
    const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme') || 'dark';
    apply3DSceneTheme(currentTheme);

    // テーマ切り替えイベントの受信
    document.addEventListener('themechange', (e) => {
        apply3DSceneTheme(e.detail && e.detail.theme ? e.detail.theme : 'dark');
    });

    let rawEarthquakeData = [];
    let particlesMesh = null;
    const centerLon = 138.0;
    const centerLat = 38.0;

    Promise.all([
        fetch('./assets/japan_eq_archive.geojson').then(res => res.json()),
        fetch('./assets/japan_coastline.geojson').then(res => { if (!res.ok) throw new Error('Failed to load japan_coastline.geojson'); return res.json(); }),
        fetch('./assets/prefectures_light.geojson').then(res => { if (!res.ok) throw new Error('Failed to load prefectures_light.geojson'); return res.json(); })
    ])
    .then(([eqData, coastlineData, prefData]) => {
        if (placeholder) placeholder.style.display = 'none';

        rawEarthquakeData = eqData.features.sort((a, b) => a.properties.time - b.properties.time);

        const lineVertices = [];
        coastlineData.features.forEach(feature => {
            if (!feature.geometry) return;
            const type = feature.geometry.type;
            const coords = feature.geometry.coordinates;

            const processRing = (ring) => {
                for (let i = 0; i < ring.length - 1; i++) {
                    const lon1 = ring[i][0]; const lat1 = ring[i][1];
                    const lon2 = ring[i+1][0]; const lat2 = ring[i+1][1];
                    if (lon1 < 120 || lon1 > 155 || lat1 < 20 || lat1 > 50) continue;
                    const x1 = (lon1 - centerLon) * 6; const z1 = -(lat1 - centerLat) * 7.5;
                    const x2 = (lon2 - centerLon) * 6; const z2 = -(lat2 - centerLat) * 7.5;
                    lineVertices.push(x1, 0, z1, x2, 0, z2);
                }
            };

            if (type === 'Polygon') coords.forEach(ring => processRing(ring));
            else if (type === 'MultiPolygon') coords.forEach(polygon => polygon.forEach(ring => processRing(ring)));
        });

        if (lineVertices.length > 0) {
            // 視認性向上のため、中心線＋微小オフセット重層線（疑似太線化）＋鮮明なシアン/白のネオン発光マテリアル
            const boldVertices = [];
            const offset = 0.08; // X, Z 平面でのオフセット幅

            for (let i = 0; i < lineVertices.length; i += 6) {
                const x1 = lineVertices[i], y1 = lineVertices[i+1], z1 = lineVertices[i+2];
                const x2 = lineVertices[i+3], y2 = lineVertices[i+4], z2 = lineVertices[i+5];

                // 1. メインの中心線
                boldVertices.push(x1, y1, z1, x2, y2, z2);

                // 2. 水平・垂直方向のマルチパス線（線幅を肉太にする）
                boldVertices.push(x1 + offset, y1, z1, x2 + offset, y2, z2);
                boldVertices.push(x1 - offset, y1, z1, x2 - offset, y2, z2);
                boldVertices.push(x1, y1, z1 + offset, x2, y2, z2 + offset);
                boldVertices.push(x1, y1, z1 - offset, x2, y2, z2 - offset);

                // 3. 斜めオフセット（角の隙間を埋める）
                boldVertices.push(x1 + offset, y1, z1 + offset, x2 + offset, y2, z2 + offset);
                boldVertices.push(x1 - offset, y1, z1 - offset, x2 - offset, y2, z2 - offset);
            }

            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(boldVertices, 3));
            
            // テーマに応じた初期色（ライト: 漆黒 0x111418 / ダーク: アイシーホワイト 0xE8F4F8）
            const isInitLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme')) === 'light';
            lineMaterial = new THREE.LineBasicMaterial({ 
                color: isInitLight ? 0x111418 : 0xE8F4F8, 
                transparent: true, 
                opacity: isInitLight ? 0.95 : 0.9 
            });
            coastlineLines = new THREE.LineSegments(lineGeometry, lineMaterial);
            scene.add(coastlineLines);
        }

        // --- 都道府県境の3D描画（Zファイティング防止のため y=0.03 に微小浮上、視認性の高いデュアルパス線） ---
        if (prefData && prefData.features) {
            const prefLineVertices = [];
            prefData.features.forEach(feature => {
                if (!feature.geometry) return;
                const type = feature.geometry.type;
                const coords = feature.geometry.coordinates;

                const processRing = (ring) => {
                    for (let i = 0; i < ring.length - 1; i++) {
                        const lon1 = ring[i][0]; const lat1 = ring[i][1];
                        const lon2 = ring[i+1][0]; const lat2 = ring[i+1][1];
                        if (lon1 < 120 || lon1 > 155 || lat1 < 20 || lat1 > 50) continue;
                        const x1 = (lon1 - centerLon) * 6; const z1 = -(lat1 - centerLat) * 7.5;
                        const x2 = (lon2 - centerLon) * 6; const z2 = -(lat2 - centerLat) * 7.5;
                        const yElev = 0.03; // 地面グリッドとの干渉を防ぐ微小オフセット
                        // メイン線
                        prefLineVertices.push(x1, yElev, z1, x2, yElev, z2);
                        // 視認性向上の微小デュアルパス
                        const prefOff = 0.04;
                        prefLineVertices.push(x1 + prefOff, yElev, z1, x2 + prefOff, yElev, z2);
                        prefLineVertices.push(x1, yElev, z1 + prefOff, x2, yElev, z2 + prefOff);
                    }
                };

                if (type === 'Polygon') coords.forEach(ring => processRing(ring));
                else if (type === 'MultiPolygon') coords.forEach(polygon => polygon.forEach(ring => processRing(ring)));
            });

            if (prefLineVertices.length > 0) {
                const prefGeometry = new THREE.BufferGeometry();
                prefGeometry.setAttribute('position', new THREE.Float32BufferAttribute(prefLineVertices, 3));
                
                const isInitLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('v2_portal_theme')) === 'light';
                prefLineMaterial = new THREE.LineBasicMaterial({
                    color: isInitLight ? 0x008744 : 0x00E5FF,
                    transparent: true,
                    opacity: isInitLight ? 0.75 : 0.85
                });
                prefLines = new THREE.LineSegments(prefGeometry, prefLineMaterial);
                scene.add(prefLines);
            }
        }

        function updateParticles(maxTimestamp) {
            if (particlesMesh) scene.remove(particlesMesh); 

            const positions = [];
            const colors = [];

            const filteredData = rawEarthquakeData.filter(f => f.properties.time <= maxTimestamp);

            filteredData.forEach(f => {
                const depth = f.geometry.coordinates[2]; 
                positions.push(
                    (f.geometry.coordinates[0] - centerLon) * 6, 
                    depth * -0.2, 
                    -(f.geometry.coordinates[1] - centerLat) * 7.5
                );
                const color = new THREE.Color(getDepthColor(depth));
                colors.push(color.r, color.g, color.b);
            });

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            // 震源プロット（粒子サイズ）を 0.8 から 1.3 に拡大し、より明瞭に視認できるように調整
            const material = new THREE.PointsMaterial({
                size: 1.3, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true
            });
            particlesMesh = new THREE.Points(geometry, material);
            scene.add(particlesMesh);
        }

        updateParticles(Date.now());

        if (slicerUI) {
            slicerUI.style.display = 'block'; 
            
            const slider = document.getElementById('time-slider');
            const labelCurrent = document.getElementById('label-current');
            const labelStart = document.getElementById('label-start');
            
            const btnPlay = document.getElementById('btn-play');
            const btnPause = document.getElementById('btn-pause');
            const btnShowAll = document.getElementById('btn-show-all');

            const minTime = rawEarthquakeData[0].properties.time;
            const maxTime = rawEarthquakeData[rawEarthquakeData.length - 1].properties.time;

            slider.min = minTime;
            slider.max = maxTime;
            slider.value = maxTime;
            labelStart.innerText = new Date(minTime).getFullYear() + "年";

            function updateSliderUI(timestamp) {
                const date = new Date(timestamp);
                labelCurrent.innerText = `${date.getFullYear()}年${date.getMonth() + 1}月`;
                updateParticles(timestamp);
            }

            slider.addEventListener('input', (e) => {
                pausePlayback(); 
                controls.autoRotate = false;
                updateSliderUI(parseInt(e.target.value, 10));
            });

            let playInterval = null;
            const timeStep = 1000 * 60 * 60 * 24 * 20; 

            function startPlayback() {
                if (parseInt(slider.value, 10) >= maxTime) {
                    slider.value = minTime;
                }
                
                btnPlay.style.display = 'none';
                btnPause.style.display = 'inline-flex';
                controls.autoRotate = false;

                playInterval = setInterval(() => {
                    let nextTime = parseInt(slider.value, 10) + timeStep;
                    
                    if (nextTime >= maxTime) {
                        nextTime = maxTime;
                        pausePlayback(); 
                    }
                    
                    slider.value = nextTime;
                    updateSliderUI(nextTime);
                }, 50); 
            }

            function pausePlayback() {
                if (playInterval) {
                    clearInterval(playInterval);
                    playInterval = null;
                }
                btnPlay.style.display = 'inline-flex';
                btnPause.style.display = 'none';
            }

            btnPlay.addEventListener('click', startPlayback);
            btnPause.addEventListener('click', pausePlayback);
            
            btnShowAll.addEventListener('click', () => {
                pausePlayback();
                slider.value = maxTime;
                updateSliderUI(maxTime);
                labelCurrent.innerText = '全期間';
            });

            // 「はじめの位置に戻る」ボタン
            const btnResetView = document.getElementById('btn-reset-view');
            if (btnResetView) {
                btnResetView.addEventListener('click', () => {
                    pausePlayback();
                    // カメラの初期座標 (0, 80, 140) にリセット
                    camera.position.set(0, 80, 140);
                    controls.target.set(0, 0, 0);
                    controls.update();
                    controls.autoRotate = true; // 自動回転を再開
                });
            }
        }

        controls.addEventListener('start', () => { controls.autoRotate = false; });
    })
    .catch(err => console.error('Data load error:', err));

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// ==========================================
// SFJ Tutorial Spotlight Logic & Onboarding (全6ステップ折衷案: バッジ連携・スマート集約型)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnTutorial = document.getElementById('btn-tutorial'); 
    const overlay = document.getElementById('tut-overlay');
    const tooltip = document.getElementById('tut-tooltip');
    const btnClose = document.getElementById('tut-close');
    const btnNext = document.getElementById('tut-next');
    const btnPrev = document.getElementById('tut-prev');
    
    if (!overlay || !tooltip) return;

    // 全6ステップの定義
    const tutorialSteps = [
        {
            type: 'center',
            title: '🌐 実験へようこそ',
            desc: `このシステムは、過去の巨大地震データや防災行動についてインタラクティブに学ぶためのシミュレーターです。<br><br>
まずはシステムの基本的な使い方と、実験の進め方についてご案内します。`
        },
        {
            targetId: 'btn-post-survey',
            title: '⏱️ 10分間の探索とタイマー',
            desc: `・画面右上に学習タイマーが表示されています。<br>
・どの訓練やアーカイブを見ても時間は累積されますが、<strong>30秒間操作がないとタイマーは一時停止</strong>します。<br>
・直感的に「面白そう」「役に立ちそう」と思うものを中心に、<strong>10分間</strong>自由にサイト内を探索・プレイしてください。`
        },
        {
            targetSelector: '.content-section',
            title: '📚 多彩な防災訓練 ＆ 過去のアーカイブ',
            desc: `・<strong>地震に備える訓練</strong>：サバイバルクイズ、空間シェイクアウト、デマ見極め、ハザードマップの4種。<br>
・<strong>過去を知るアーカイブ</strong>：震度分布図、3D震源マップ、3.11記憶の追体験の3種。<br>
興味のあるコンテンツから自由に学習を進めていただけます。`
        },
        {
            targetSelector: 'a.btn-mypage[href="mypage.html"]',
            title: '🏆 防災バッジを獲得しよう！',
            desc: `・各訓練のクリアやアーカイブの探索を行うと、条件に応じて<strong>全9種類の防災バッジ</strong>を獲得できます！<br>
・獲得状況や進捗は、右上の「<strong>MY PAGE</strong>」からいつでも確認できます。ぜひコンプリートを目指してみてください！`
        },
        {
            type: 'center',
            title: '🎉 実験の終了手順',
            desc: `・10分が経過すると、右上のボタンが「<strong>完了コードを発行する</strong>」に点灯します。<br>
・発行された完了コードは、<strong>事後アンケートとランサーズの両方に入力</strong>してください。<br>
・※完了画面およびマイページから、任意で学習ログ（CSV）のダウンロードも可能です。`
        },
        {
            type: 'center',
            title: '🚀 実験スタート！',
            desc: `事前説明は以上となります。<br><br>
「<strong>FINISH ✔</strong>」をクリックして、興味のあるコンテンツから自由に学習を開始してください！<br><br>
<span style="font-size:0.8rem; color:var(--text-sub);">※この説明は「MY PAGE」の「チュートリアルを再生する」からいつでも再確認できます。</span>`
        }
    ];

    let currentStep = 0;

    // チュートリアルを開始する関数
    function startTutorial() {
        console.log("--- チュートリアルを開始します（全6ステップ） ---");
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

    // チュートリアルを閉じる関数（マイページへのリダイレクトは行わず、トップ画面にとどまる）
    function closeTutorial() {
        overlay.style.opacity = '0';
        tooltip.style.opacity = '0';
        clearHighlight();
        setTimeout(() => {
            overlay.style.display = 'none';
            tooltip.style.display = 'none';
        }, 300);
        
        localStorage.setItem('v2_tutorialCompleted', 'true');
        localStorage.removeItem('v2_is_replaying_tutorial'); // リプレイフラグを消去
        localStorage.removeItem('v2_start_tutorial_now');
        console.log("チュートリアル完了フラグを保存しました。");
    }

    // オンボーディング・チュートリアル制御
    const isTutorialDone = localStorage.getItem('v2_tutorialCompleted');

    if (!isTutorialDone || isTutorialDone !== 'true') {
        startTutorial();
    } else if (localStorage.getItem('v2_start_tutorial_now') === 'true') {
        localStorage.removeItem('v2_start_tutorial_now');
        startTutorial();
    }

    // ボタンのイベントリスナー設定
    if (btnTutorial) btnTutorial.addEventListener('click', startTutorial);
    btnClose.addEventListener('click', closeTutorial);

    btnNext.addEventListener('click', () => {
        if (currentStep < tutorialSteps.length - 1) {
            currentStep++;
            showStep(currentStep);
        } else {
            // STEP 6 (最後) で FINISH を押した場合はトップ画面で学習開始
            closeTutorial();
        }
    });

    btnPrev.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    });

    // 座標計算および吹き出し表示を行う関数
    function showStep(index) {
        clearHighlight();
        
        const stepData = tutorialSteps[index];
        if (!stepData) return;

        // 幅設定（レスポンシブ対応: 最大480px、幅狭端末では90vw）
        tooltip.style.width = 'min(480px, 90vw)';
        
        const counterEl = document.querySelector('.tut-step-counter');
        if (counterEl) {
            counterEl.innerText = `STEP ${index + 1} / ${tutorialSteps.length}`;
        }
        btnPrev.style.visibility = index === 0 ? 'hidden' : 'visible';
        btnNext.innerText = index === tutorialSteps.length - 1 ? 'FINISH ✔' : 'NEXT ▶';

        document.getElementById('tut-title').innerText = stepData.title;
        document.getElementById('tut-desc').innerHTML = stepData.desc;

        if (stepData.type === 'center') {
            // 中央配置
            tooltip.style.position = 'fixed';
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            return;
        }

        // ターゲット要素を取得
        let target = null;
        if (stepData.targetId) {
            target = document.getElementById(stepData.targetId);
        } else if (stepData.targetSelector) {
            target = document.querySelector(stepData.targetSelector);
        }

        if (!target) {
            // ターゲットが存在しない場合は中央配置にフォールバック
            tooltip.style.position = 'fixed';
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            return;
        }

        target.classList.add('tut-highlight');

        const rect = target.getBoundingClientRect();
        window.scrollTo({
            top: window.scrollY + rect.top - 100,
            behavior: 'smooth'
        });

        setTimeout(() => {
            tooltip.style.position = 'absolute';
            tooltip.style.transform = 'none';

            const updatedRect = target.getBoundingClientRect();
            let topPos = updatedRect.bottom + window.scrollY + 15;
            let leftPos = updatedRect.left + window.scrollX;
            
            // 下にはみ出す場合はターゲットの上側に配置
            if (topPos + tooltip.offsetHeight > window.scrollY + window.innerHeight) {
                topPos = updatedRect.top + window.scrollY - tooltip.offsetHeight - 15;
            }
            
            // 上にはみ出しヘッダー等に被る場合の最小マージン
            const safeTopMargin = 80;
            if (topPos < window.scrollY + safeTopMargin) {
                topPos = window.scrollY + safeTopMargin;
            }
            
            // 画面左端のはみ出し防止
            if (leftPos < 10) {
                leftPos = 10;
            }
            
            // 画面右端のはみ出し防止
            if (leftPos + tooltip.offsetWidth > window.innerWidth - 10) {
                leftPos = window.innerWidth - tooltip.offsetWidth - 10;
            }

            tooltip.style.top = `${topPos}px`;
            tooltip.style.left = `${leftPos}px`;
        }, 300);
    }

    function clearHighlight() {
        document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    }
});

// ==========================================
// 事後アンケート完了コード発行＆カウントダウン処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnPostSurvey = document.getElementById('btn-post-survey');
    if (!btnPostSurvey) return;

    // タイマー更新関数
    function updateTimer() {
        const elapsed = (typeof getValidatedElapsedTime === 'function') ? getValidatedElapsedTime() : parseInt(localStorage.getItem('v2_accumulated_elapsed_time') || '0', 10);
        const limit = 10 * 60 * 1000; // 10分（600,000ミリ秒）
        const remaining = limit - elapsed;

        if (remaining > 0) {
            btnPostSurvey.disabled = true;
            
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const displayTime = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
            btnPostSurvey.textContent = `完了コード発行まで ${displayTime}`;
        } else {
            btnPostSurvey.disabled = false;
            btnPostSurvey.style.backgroundColor = 'var(--cud-orange)';
            btnPostSurvey.style.borderColor = 'var(--cud-orange)';
            btnPostSurvey.style.color = '#000';
            btnPostSurvey.textContent = '完了コードを発行する';
            clearInterval(timerInterval);
        }
    }

    const timerInterval = setInterval(updateTimer, 1000);
    updateTimer(); // 初回実行

    // ボタンクリック時の処理
    btnPostSurvey.addEventListener('click', () => {
        // 完了モーダルの表示
        const modal = document.getElementById('completion-modal');
        const codeVal = document.getElementById('completion-code-val');
        const warningEl = document.getElementById('completion-warning');
        if (warningEl) warningEl.style.display = 'none'; // 警告を非表示
        if (modal && codeVal) {
            const userId = localStorage.getItem('v2_research_user_id') || 'User-unknown';
            codeVal.textContent = userId;
            modal.style.display = 'flex';
        }
    });

    // コピー機能の実装
    const btnCopy = document.getElementById('btn-copy-completion');
    
    // モーダル内のCSVダウンロードボタン
    const btnDownloadLogModal = document.getElementById('btn-download-log-modal');
    if (btnDownloadLogModal) {
        btnDownloadLogModal.addEventListener('click', () => {
            if (typeof exportLogsAsCSV === 'function') {
                exportLogsAsCSV();
                const origText = btnDownloadLogModal.textContent;
                btnDownloadLogModal.textContent = '✓ ダウンロード完了！';
                btnDownloadLogModal.style.borderColor = 'var(--cud-green)';
                btnDownloadLogModal.style.color = 'var(--cud-green)';
                setTimeout(() => {
                    btnDownloadLogModal.textContent = origText;
                    btnDownloadLogModal.style.borderColor = 'var(--border-color)';
                    btnDownloadLogModal.style.color = 'var(--text-main)';
                }, 2000);
            }
        });
    }

    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            const userId = localStorage.getItem('v2_research_user_id') || 'User-unknown';
            navigator.clipboard.writeText(userId).then(() => {
                const originalText = btnCopy.textContent;
                btnCopy.textContent = '✓ コピーしました！';
                btnCopy.style.background = '#00B45A';
                setTimeout(() => {
                    btnCopy.textContent = originalText;
                    btnCopy.style.background = 'var(--cud-green)';
                }, 2000);
            }).catch(err => {
                console.error("Failed to copy:", err);
                alert('コピーに失敗しました。手動でコピーしてください: ' + userId);
            });
        });
    }

    // 閉じるボタンの実装
    const btnCloseModal = document.getElementById('btn-close-completion');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            const modal = document.getElementById('completion-modal');
            if (modal) modal.style.display = 'none';
        });
    }
});