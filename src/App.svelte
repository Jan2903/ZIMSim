<script>
    import { onMount } from 'svelte';
    import { journeyStore, trainDisplay } from './js/core/state/stores.js';
    import { ScreenSyncService } from './js/core/services/screenSyncService.js';
    import { ansagenStore } from './js/audio/ansagenStore.svelte.js';
    import Header from './components/Header.svelte';
    import SettingsPanel from './components/SettingsPanel.svelte';
    import Modals from './components/Modals.svelte';
    import PlayerOverlay from './components/PlayerOverlay.svelte';
    import StatusOverlay from './components/StatusOverlay.svelte';
    import ZimIcon from './components/ZimIcon.svelte';

    let modalsComp = $state();
    let canvasElement = $state();
    let outerContainer = $state();
    let scaleWrapper = $state();
    let displayWrapper = $state();

    // URL-Parameter für Kiosk & Multi-Screen
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const targetScreen = urlParams.get('screen'); // z.B. '1', '2', '3' oder null
    const isKiosk = urlParams.get('kiosk') === '1' || urlParams.get('fullscreen') === '1';
    const is4k = urlParams.get('res') === '4k';

    // Hybrid-Modus für Mobile/Desktop: 'fit' (an Bildschirm anpassen) oder 'scroll' (Mindestbreite mit Scrollbalken)
    let displayScaleMode = $state(localStorage.getItem('zimsim_scale_mode') || 'fit');

    // Optionales Gehäuse (Rahmen & vertikaler Trenner zwischen Monitoren) in der Web-Vorschau
    let showBezel = $state(localStorage.getItem('zimsim_show_bezel') !== 'false');

    // Vollbild-Zustand (Fullscreen API)
    let isFullscreen = $state(false);

    // Auto-Hiding HUD für Vollbild/Kiosk
    let hudVisible = $state(false);
    let hudTimeout = null;

    // Dropdown-Zustand für Multi-Monitor Menü
    let monitorMenuOpen = $state(false);

    /**
     * Schaltet das Gehäuse-Overlay (Rahmen & Steg) um.
     * @returns {void}
     */
    function toggleBezel() {
        showBezel = !showBezel;
        localStorage.setItem('zimsim_show_bezel', String(showBezel));
    }

    /**
     * Schaltet zwischen Fit- und Scroll-Modus um.
     * @returns {void}
     */
    function toggleScaleMode() {
        displayScaleMode = displayScaleMode === 'fit' ? 'scroll' : 'fit';
        localStorage.setItem('zimsim_scale_mode', displayScaleMode);
        setTimeout(handleResize, 20);
    }

    /**
     * Schaltet den Vollbildmodus ein oder aus.
     * @returns {void}
     */
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            const el = displayWrapper || document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(err => {
                    console.warn('[App] requestFullscreen fehlgeschlagen:', err);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    /**
     * Beendet den Vollbildmodus explizit.
     * @returns {void}
     */
    function exitFullscreenMode() {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen();
        } else if (isKiosk) {
            // Im Kiosk-URL-Modus: zurück zur regulären Web-Ansicht
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('kiosk');
            cleanUrl.searchParams.delete('screen');
            cleanUrl.searchParams.delete('fullscreen');
            cleanUrl.searchParams.delete('res');
            window.location.href = cleanUrl.href;
        }
    }

    /**
     * Zeigt das schwebende Exit-HUD bei Nutzeraktivität kurzzeitig an.
     * @returns {void}
     */
    function handleUserActivity() {
        if (!isFullscreen && !isKiosk) return;
        hudVisible = true;
        if (hudTimeout) clearTimeout(hudTimeout);
        hudTimeout = setTimeout(() => {
            hudVisible = false;
        }, 2500);
    }

    /**
     * Öffnet einen spezifischen Monitor in einem neuen Fenster / Pop-Out.
     * @param {number|string} screenIndex - 1, 2 oder 3
     * @param {boolean} [use4k=false]
     */
    function openScreen(screenIndex, use4k = false) {
        monitorMenuOpen = false;
        ScreenSyncService.openScreenWindow(screenIndex, use4k, true);
    }

    /**
     * Erstellt einen PNG-Download des aktuellen Canvas-Zustands.
     * @returns {void}
     */
    function downloadScreenshot() {
        const canvas = document.getElementById('zimCanvas');
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `zim_screenshot_${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();
        }
    }

    // Reaktiver Effekt für Canvas Re-Renders und State-Broadcasts
    $effect(() => {
        // Reaktiver Zugriff auf Store-Werte
        const j = journeyStore.journeys;
        const tm = journeyStore.activeMots;
        const at = journeyStore.activeTracks;
        const pf = journeyStore.platforms;
        const nrw = journeyStore.nrwMode;
        
        trainDisplay.updateAll();

        // Master-Instanz sendet Aktualisierungen an sekundäre Monitore
        if (!targetScreen) {
            ScreenSyncService.broadcastState(journeyStore);
        }
    });

    /**
     * Berechnet die Skalierung des ZIM-Canvas anhand des Viewports bzw. Containers.
     * @returns {void}
     */
    function handleResize() {
        if (!scaleWrapper || !outerContainer) return;

        const layoutWidth = trainDisplay.currentLayout.width;
        const layoutHeight = trainDisplay.currentLayout.height;

        if (isFullscreen || isKiosk) {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const scale = Math.min(winW / layoutWidth, winH / layoutHeight);
            const offsetX = (winW - layoutWidth * scale) / 2;
            const offsetY = (winH - layoutHeight * scale) / 2;

            scaleWrapper.style.transform = `scale(${scale})`;
            scaleWrapper.style.left = `${offsetX}px`;
            scaleWrapper.style.top = `${offsetY}px`;
            scaleWrapper.style.width = `${layoutWidth}px`;
            scaleWrapper.style.height = `${layoutHeight}px`;

            outerContainer.style.width = `${winW}px`;
            outerContainer.style.height = `${winH}px`;
            return;
        }

        scaleWrapper.style.left = '0px';
        scaleWrapper.style.top = '0px';

        const containerWidth = outerContainer.clientWidth;
        if (containerWidth === 0) return;

        const scale = containerWidth / layoutWidth;
        const scaledHeight = layoutHeight * scale;

        scaleWrapper.style.transform = `scale(${scale})`;
        outerContainer.style.height = `${scaledHeight}px`;
        outerContainer.style.width = '100%';
        
        scaleWrapper.style.width = `${layoutWidth}px`;
        scaleWrapper.style.height = `${layoutHeight}px`;
    }

    function onFullscreenChange() {
        isFullscreen = Boolean(document.fullscreenElement);
        if (isFullscreen) {
            handleUserActivity();
        }
        setTimeout(handleResize, 50);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && (isFullscreen || isKiosk)) {
            exitFullscreenMode();
        } else if (e.key === 'F11') {
            e.preventDefault();
            toggleFullscreen();
        }
    }

    function onWindowClick(e) {
        if (monitorMenuOpen && !e.target.closest('.display-toolbar-dropdown-container')) {
            monitorMenuOpen = false;
        }
    }

    onMount(() => {
        // Multi-Screen / Kiosk Setup
        if (targetScreen) {
            trainDisplay.setTargetScreen(targetScreen, is4k);
            if (isKiosk || targetScreen !== '1') {
                ansagenStore.muted = true; // Sekundäre Monitore stumm schalten
            }
            ScreenSyncService.initSlave(journeyStore, trainDisplay);
        } else {
            ScreenSyncService.initMaster(journeyStore);
            trainDisplay.updateAll();
        }
        
        // Verwende ResizeObserver für verlässliche Neuberechnung bei Layout-Änderungen
        let observer = null;
        if (window.ResizeObserver && outerContainer) {
            observer = new ResizeObserver(() => {
                handleResize();
            });
            observer.observe(outerContainer);
        }
        
        window.addEventListener('resize', handleResize);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('click', onWindowClick);
        setTimeout(handleResize, 100);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('click', onWindowClick);
            if (observer) observer.disconnect();
            if (hudTimeout) clearTimeout(hudTimeout);
        };
    });
</script>

{#if !isKiosk}
    <Header />
{/if}

<div 
    bind:this={displayWrapper} 
    class="display-wrapper {isKiosk ? 'kiosk-active' : ''} {isFullscreen ? 'fullscreen-active' : ''}" 
    onmousemove={handleUserActivity}
    style="width: 100%; position: relative; {isFullscreen || isKiosk ? 'height: 100vh; overflow: hidden; background: #000;' : 'overflow-x: auto; overflow-y: hidden;'}"
>
    <!-- Schwebendes Exit-HUD im Vollbild / Kiosk-Modus -->
    {#if isFullscreen || isKiosk}
        <div class="fullscreen-hud" class:hud-visible={hudVisible}>
            <button 
                type="button" 
                class="fullscreen-hud-btn" 
                onclick={exitFullscreenMode}
                title="Vollbild beenden (Esc)"
            >
                <ZimIcon name="fullscreen_exit" size={16} />
                <span>Vollbild beenden</span>
            </button>
        </div>
    {/if}

    <div 
        class="display-container" 
        bind:this={outerContainer} 
        style="position: relative; width: 100%; min-width: {displayScaleMode === 'scroll' && !isFullscreen && !isKiosk ? '850px' : '0'}; overflow: hidden; transition: min-width 0.2s ease;"
    >
        <div 
            bind:this={scaleWrapper} 
            class="scale-wrapper" 
            style="position: absolute; top: 0; left: 0; width: {trainDisplay.currentLayout.width}px; height: {trainDisplay.currentLayout.height}px; transform-origin: top left; background-color: var(--db-dark); overflow: hidden;"
        >
            <!-- Optionales Gehäuse (Rahmen & vertikaler Trenner zwischen Monitoren) in der Web-Vorschau -->
            {#if showBezel && !isFullscreen && !isKiosk}
                <div id="hardware-bezel" class="hardware-bezel-frame"></div>
                {#if trainDisplay.currentLayout.width >= 3840}
                    <!-- Vertikaler Gehäusetrenner zwischen Haupt- und Nebenmonitor (wie im Original DB-Doppel-ZIM) -->
                    <div class="bezel-vertical-divider" title="Hardware-Gehäusetrenner">
                        <div class="bezel-divider-accent"></div>
                    </div>
                {/if}
            {/if}

            <canvas 
                bind:this={canvasElement} 
                id="zimCanvas" 
                width={trainDisplay.currentLayout.width} 
                height={trainDisplay.currentLayout.height} 
                style="position: absolute; top: 0; left: 0; z-index: 10;"
            ></canvas>
        </div>
    </div>
</div>

<!-- Schlanke Display-Steuerungsleiste direkt unter dem Monitor (0% Überdeckung der Bildfläche) -->
{#if !isKiosk}
<div class="display-toolbar">
    <div class="display-toolbar-info">
        <span class="display-toolbar-status">
            Display: <strong>{displayScaleMode === 'fit' ? 'Fit (angepasst)' : '1:1 (scrollbar)'}</strong>
            {#if targetScreen}
                <span class="target-screen-tag">Monitor {targetScreen}</span>
            {/if}
        </span>
    </div>
    <div class="display-toolbar-actions">
        <!-- Gehäuse-Toggle (Rahmen & Steg) -->
        <button 
            type="button" 
            class="display-toolbar-btn"
            class:active-btn={showBezel}
            onclick={toggleBezel}
            title={showBezel ? 'Gehäuse-Simulation ausblenden (Reiner Canvas)' : 'Gehäuse-Simulation einblenden'}
            aria-label="Gehäuse umschalten"
        >
            <ZimIcon name="eye" size={14} />
            <span>Gehäuse: {showBezel ? 'An' : 'Aus'}</span>
        </button>

        <!-- Screenshot Download -->
        <button 
            type="button" 
            class="display-toolbar-btn"
            onclick={downloadScreenshot}
            title="Screenshot des Monitors herunterladen"
            aria-label="Screenshot herunterladen"
        >
            <ZimIcon name="camera" size={14} />
            <span>Screenshot</span>
        </button>

        <!-- Fit / Scroll Toggle -->
        <button 
            type="button" 
            class="display-toolbar-btn"
            onclick={toggleScaleMode}
            title={displayScaleMode === 'fit' ? 'Zur scrollbaren Detailansicht (1:1) wechseln' : 'An Bildschirmbreite anpassen (Fit)'}
            aria-label="Display-Skalierung umschalten"
        >
            <ZimIcon name={displayScaleMode === 'fit' ? 'zoom_scroll' : 'zoom_fit'} size={14} />
            <span>{displayScaleMode === 'fit' ? 'Fit' : '1:1'}</span>
        </button>

        <!-- Vollbild-Modus -->
        <button 
            type="button" 
            class="display-toolbar-btn btn-fullscreen"
            onclick={toggleFullscreen}
            title="In den Vollbildmodus wechseln (F11 / Esc)"
            aria-label="Vollbildmodus"
        >
            <ZimIcon name="fullscreen" size={14} />
            <span>Vollbild</span>
        </button>

        <!-- Multi-Monitor Pop-Out Dropdown -->
        <div class="display-toolbar-dropdown-container">
            <button 
                type="button" 
                class="display-toolbar-btn"
                onclick={() => monitorMenuOpen = !monitorMenuOpen}
                title="Monitore in separaten Vollbild-/Kiosk-Fenstern öffnen"
                aria-expanded={monitorMenuOpen}
            >
                <ZimIcon name="monitors" size={14} />
                <span>Monitore ▾</span>
            </button>
            {#if monitorMenuOpen}
                <div class="display-toolbar-dropdown-menu" role="menu">
                    <div class="dropdown-header">Full-HD (1080p)</div>
                    <button type="button" class="dropdown-item" onclick={() => openScreen(1, false)}>
                        <ZimIcon name="popout" size={14} />
                        <span>Monitor 1 (Hauptmonitor)</span>
                    </button>
                    <button type="button" class="dropdown-item" onclick={() => openScreen(2, false)}>
                        <ZimIcon name="popout" size={14} />
                        <span>Monitor 2 (Nebenmonitore)</span>
                    </button>
                    <button type="button" class="dropdown-item" onclick={() => openScreen(3, false)}>
                        <ZimIcon name="popout" size={14} />
                        <span>Monitor 3 (Zusatzanzeiger)</span>
                    </button>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-header">4K Ultra-HD (2160p)</div>
                    <button type="button" class="dropdown-item" onclick={() => openScreen(1, true)}>
                        <ZimIcon name="popout" size={14} />
                        <span>Monitor 1 (4K)</span>
                    </button>
                    <button type="button" class="dropdown-item" onclick={() => openScreen(2, true)}>
                        <ZimIcon name="popout" size={14} />
                        <span>Monitor 2 (4K)</span>
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

<SettingsPanel {modalsComp} />

<Modals bind:this={modalsComp} />

<PlayerOverlay />

<StatusOverlay />
{/if}

<style>
    /* Display Toolbar */
    .display-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(18, 18, 22, 0.95);
        border-bottom: 1px solid var(--border);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        padding: 6px 16px;
        font-size: 0.8rem;
        color: var(--text-muted);
        box-sizing: border-box;
    }
    .display-toolbar-status strong {
        color: var(--text-main);
        font-weight: 600;
    }
    .target-screen-tag {
        background: var(--accent);
        color: white;
        font-size: 0.7rem;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 8px;
        font-weight: 600;
    }
    .display-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .display-toolbar-btn {
        background: rgba(30, 30, 38, 0.9);
        color: var(--text-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm, 4px);
        padding: 4px 10px;
        font-size: 0.75rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
    }
    .display-toolbar-btn:hover {
        background: rgba(45, 45, 55, 1);
        border-color: var(--accent);
        color: white;
    }
    .active-btn {
        background: rgba(45, 45, 60, 1);
        border-color: var(--accent);
        color: white;
    }
    .btn-fullscreen {
        border-color: rgba(235, 30, 40, 0.5);
    }
    .btn-fullscreen:hover {
        background: var(--accent);
        color: white;
    }

    /* Multi-Monitor Dropdown */
    .display-toolbar-dropdown-container {
        position: relative;
        display: inline-block;
    }
    .display-toolbar-dropdown-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 4px);
        background: rgba(22, 22, 28, 0.98);
        backdrop-filter: blur(12px);
        border: 1px solid var(--border);
        border-radius: var(--radius-md, 6px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
        min-width: 220px;
        z-index: 1000;
        padding: 6px 0;
    }
    .dropdown-header {
        padding: 6px 14px 4px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
    }
    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 14px;
        background: transparent;
        border: none;
        color: var(--text-main);
        font-size: 0.8rem;
        text-align: left;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    .dropdown-item:hover {
        background: rgba(255, 255, 255, 0.08);
        color: white;
    }
    .dropdown-divider {
        height: 1px;
        background: var(--border);
        margin: 4px 0;
    }

    /* Hardware Bezel Simulation (Rahmen & vertikaler Trennsteg) */
    .hardware-bezel-frame {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 20;
        box-sizing: border-box;
        border: 14px solid #1c1d22;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8), 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    .bezel-vertical-divider {
        position: absolute;
        top: 0;
        left: 50%;
        width: 24px;
        height: 100%;
        transform: translateX(-50%);
        background: linear-gradient(to right, #16171b, #2c2e36 40%, #2c2e36 60%, #16171b);
        box-shadow: -2px 0 6px rgba(0, 0, 0, 0.5), 2px 0 6px rgba(0, 0, 0, 0.5);
        z-index: 22;
        pointer-events: none;
        box-sizing: border-box;
    }
    .bezel-divider-accent {
        width: 2px;
        height: 100%;
        margin: 0 auto;
        background: rgba(255, 255, 255, 0.08);
    }

    /* Schwebendes Fullscreen HUD */
    .fullscreen-hud {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
        transform: translateY(-10px);
    }
    .fullscreen-hud.hud-visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
    }
    .fullscreen-hud-btn {
        background: rgba(18, 18, 24, 0.85);
        backdrop-filter: blur(8px);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 10px 18px;
        font-size: 0.9rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
        transition: all 0.2s ease;
    }
    .fullscreen-hud-btn:hover {
        background: rgba(40, 40, 50, 0.95);
        border-color: var(--accent);
        transform: scale(1.02);
    }

    @media (max-width: 768px) {
        .display-toolbar {
            padding: 8px 12px;
            flex-wrap: wrap;
            gap: 8px;
        }
        .display-toolbar-btn {
            padding: 6px 10px;
            min-height: 38px;
        }
    }
</style>
