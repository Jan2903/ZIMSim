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
    import HardwareBezel from './components/HardwareBezel.svelte';

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

    // Gehäuse-Zustand & dynamische Abmessungen für Gehäuse vs. Reines Display
    let isCasingActive = $derived(
        showBezel && 
        !isFullscreen && 
        !isKiosk && 
        Boolean(trainDisplay.currentLayout?.casingWidth)
    );

    let wrapperWidth = $derived(
        isCasingActive 
            ? trainDisplay.currentLayout.casingWidth 
            : trainDisplay.currentLayout.width
    );

    let wrapperHeight = $derived(
        isCasingActive 
            ? trainDisplay.currentLayout.casingHeight 
            : trainDisplay.currentLayout.height
    );

    let canvasOffsetX = $derived(
        isCasingActive 
            ? (trainDisplay.currentLayout.casingOffsetX || 270) 
            : 0
    );

    let canvasOffsetY = $derived(
        isCasingActive 
            ? (trainDisplay.currentLayout.casingOffsetY || 260) 
            : 0
    );

    /**
     * Schaltet das Gehäuse-Overlay (Rahmen & Steg) um.
     * Wechselt dynamisch zwischen dem Standard-Layout mit 50px Steg und dem randlosen Profil.
     * @returns {void}
     */
    function toggleBezel() {
        showBezel = !showBezel;
        localStorage.setItem('zimsim_show_bezel', String(showBezel));
        
        // Wenn kein Einzelschirm-Profil aktiv ist, zwischen Gehäuse-Layout (mit 50px Steg) und randlosem Layout wechseln
        if (!targetScreen && trainDisplay.currentLayout && trainDisplay.currentLayout.family === 'standard' && !is4k) {
            const is3Screen = trainDisplay.currentLayout.width >= 5700;
            if (is3Screen) {
                trainDisplay.switchLayout(showBezel ? 'standard_3screen' : 'standard_3screen_frameless');
            } else {
                trainDisplay.switchLayout(showBezel ? 'standard' : 'standard_frameless');
            }
        } else {
            trainDisplay.updateAll();
        }
        setTimeout(() => {
            handleResize();
            trainDisplay.updateAll();
        }, 50);
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
     * Erstellt einen PNG-Download des aktuellen Monitors.
     * Arbeitet kontextsensitiv und dynamisch:
     * - Bei sichtbarem Gehäuse: Komponierter High-Res-Screenshot mit Vektor-Gehäuse (z.B. 4430×1600 bei 2 Screens, 6400×1600 bei 3 Screens)
     * - Ohne Gehäuse oder im Vollbild/Kiosk: Reines, randloses Display-Canvas (z.B. 3840×1080 oder 3890×1080)
     * @returns {void}
     */
    function downloadScreenshot() {
        const canvas = document.getElementById('zimCanvas');
        if (!canvas) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `zim_screenshot_${timestamp}.png`;

        if (!isCasingActive) {
            // Reiner nativer Canvas-Export ohne Gehäuse
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.click();
            return;
        }

        // Gehäuse ist aktiv: Composed Screenshot (Gehäuse + Displays)
        const svgElement = document.querySelector('.hardware-bezel-svg');
        if (!svgElement) {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.click();
            return;
        }

        try {
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();

            img.onload = () => {
                try {
                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = wrapperWidth;
                    offCanvas.height = wrapperHeight;
                    const offCtx = offCanvas.getContext('2d');

                    // 1. Vektor-Gehäuse zeichnen
                    offCtx.drawImage(img, 0, 0, wrapperWidth, wrapperHeight);
                    URL.revokeObjectURL(url);

                    // 2. Display-Canvas an exakter Offset-Position einbetten
                    offCtx.drawImage(canvas, canvasOffsetX, canvasOffsetY);

                    // 3. Download anstoßen
                    const dataUrl = offCanvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = dataUrl;
                    link.click();
                } catch (err) {
                    console.warn('[Screenshot] Fehler beim Composing mit Gehäuse, Fallback:', err);
                    const fallbackUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = fallbackUrl;
                    link.click();
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                link.click();
            };

            img.src = url;
        } catch (e) {
            console.warn('[Screenshot] Fehler:', e);
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = filename;
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

    // Reaktiver Effekt für dynamische Größenanpassung und Re-Render bei Gehäuse- oder Layout-Wechsel
    $effect(() => {
        const _b = showBezel;
        const _w = wrapperWidth;
        const _h = wrapperHeight;
        const _c = isCasingActive;

        handleResize();

        // Nach Abschluss aller Svelte-DOM-Updates Canvas zuverlässig neu zeichnen
        requestAnimationFrame(() => {
            trainDisplay.updateAll();
        });
    });

    /**
     * Berechnet die Skalierung des ZIM-Canvas bzw. Gehäuses anhand des Viewports bzw. Containers.
     * @returns {void}
     */
    function handleResize() {
        if (!scaleWrapper || !outerContainer) return;

        const targetW = wrapperWidth;
        const targetH = wrapperHeight;

        if (isFullscreen || isKiosk) {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const scale = Math.min(winW / targetW, winH / targetH);
            const offsetX = (winW - targetW * scale) / 2;
            const offsetY = (winH - targetH * scale) / 2;

            scaleWrapper.style.transform = `scale(${scale})`;
            scaleWrapper.style.left = `${offsetX}px`;
            scaleWrapper.style.top = `${offsetY}px`;
            scaleWrapper.style.width = `${targetW}px`;
            scaleWrapper.style.height = `${targetH}px`;

            outerContainer.style.width = `${winW}px`;
            outerContainer.style.height = `${winH}px`;
            return;
        }

        scaleWrapper.style.left = '0px';
        scaleWrapper.style.top = '0px';

        const containerWidth = outerContainer.clientWidth;
        if (containerWidth === 0) return;

        const scale = containerWidth / targetW;
        const scaledHeight = targetH * scale;

        scaleWrapper.style.transform = `scale(${scale})`;
        outerContainer.style.height = `${scaledHeight}px`;
        outerContainer.style.width = '100%';
        
        scaleWrapper.style.width = `${targetW}px`;
        scaleWrapper.style.height = `${targetH}px`;
    }

    function onFullscreenChange() {
        isFullscreen = Boolean(document.fullscreenElement);
        if (isFullscreen) {
            handleUserActivity();
            // Im Vollbildmodus randloses Layout aktivieren
            if (!targetScreen && trainDisplay.currentLayout && trainDisplay.currentLayout.family === 'standard' && trainDisplay.currentLayout.hasBezelGap && !is4k) {
                const is3Screen = trainDisplay.currentLayout.width >= 5700;
                trainDisplay.switchLayout(is3Screen ? 'standard_3screen_frameless' : 'standard_frameless');
            }
        } else {
            // Nach Beenden des Vollbildmodus Gehäuse-Layout (mit 50px Steg) wiederherstellen falls Gehäuse aktiv
            if (!targetScreen && showBezel && trainDisplay.currentLayout && trainDisplay.currentLayout.family === 'standard' && !trainDisplay.currentLayout.hasBezelGap && !isKiosk && !is4k) {
                const is3Screen = trainDisplay.currentLayout.width >= 5700;
                trainDisplay.switchLayout(is3Screen ? 'standard_3screen' : 'standard');
            }
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
            trainDisplay.setTargetScreen(targetScreen, is4k, false);
            if (isKiosk || targetScreen !== '1') {
                ansagenStore.muted = true; // Sekundäre Monitore stumm schalten
            }
            ScreenSyncService.initSlave(journeyStore, trainDisplay);
        } else {
            // Initiales Layout festlegen: Im Kiosk randlos, ansonsten nach Gehäuse-Einstellung
            if (isKiosk) {
                trainDisplay.switchLayout(is4k ? 'standard_4k' : 'standard_frameless');
            } else {
                trainDisplay.switchLayout(is4k ? 'standard_4k' : (showBezel ? 'standard' : 'standard_frameless'));
            }
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
    <Header onScreenshot={downloadScreenshot} />
{/if}

<div 
    bind:this={displayWrapper} 
    class="display-wrapper {isKiosk ? 'kiosk-active' : ''} {isFullscreen ? 'fullscreen-active' : ''}" 
    onmousemove={handleUserActivity}
    ontouchstart={handleUserActivity}
    onpointerdown={handleUserActivity}
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
            style="position: absolute; top: 0; left: 0; width: {wrapperWidth}px; height: {wrapperHeight}px; transform-origin: top left; background-color: transparent; overflow: visible;"
        >
            <!-- Optionales Gehäuse (Rahmen in authentischem DB-Nachtblau RAL 5022) in der Web-Vorschau -->
            {#if isCasingActive}
                <HardwareBezel 
                    width={wrapperWidth} 
                    height={wrapperHeight} 
                    paddingX={canvasOffsetX} 
                    paddingY={canvasOffsetY} 
                    layout={trainDisplay.currentLayout} 
                />
                <div 
                    class="display-bezel-lip" 
                    style="left: {canvasOffsetX}px; top: {canvasOffsetY}px; width: {trainDisplay.currentLayout.width}px; height: {trainDisplay.currentLayout.height}px;"
                ></div>
            {/if}

            <canvas 
                bind:this={canvasElement} 
                id="zimCanvas" 
                style="position: absolute; top: {canvasOffsetY}px; left: {canvasOffsetX}px; z-index: 10;"
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

        <!-- Multi-Monitor Pop-Out Dropdown (nur Desktop) -->
        <div class="display-toolbar-dropdown-container desktop-only">
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

    /* Subtiler Innenrahmen/Fase um die Bildschirme (Display-Einbau) */
    .display-bezel-lip {
        position: absolute;
        pointer-events: none;
        z-index: 15;
        box-sizing: border-box;
        border: 2px solid rgba(0, 0, 0, 0.7);
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8), 0 0 4px rgba(0, 0, 0, 0.5);
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
        .desktop-only {
            display: none !important;
        }
        .display-toolbar {
            padding: 6px 10px;
            flex-wrap: wrap;
            gap: 6px;
        }
        .display-toolbar-btn {
            padding: 5px 8px;
            font-size: 0.72rem;
            min-height: 34px;
        }
        .display-toolbar-status {
            font-size: 0.75rem;
        }
    }
</style>
