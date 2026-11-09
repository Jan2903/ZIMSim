<script>
    import { onMount } from 'svelte';
    import { journeyStore, trainDisplay } from './js/core/state/stores.js';
    import { downloadDisplayScreenshot } from './js/core/utils/screenshot.js';
    import { watchReducedTransparency } from './js/core/utils/systemPreferences.js';
    import { ScreenSyncService } from './js/core/services/screenSyncService.js';
    import { ansagenStore } from './js/audio/ansagenStore.svelte.js';
    import { displayConfigStore } from './js/displays/core/displayConfigStore.svelte.js';
    import { selectTab } from './js/core/state/uiState.svelte.js';
    import Header from './components/Header.svelte';
    import DisplayToolbar from './components/DisplayToolbar.svelte';
    import SettingsPanel from './components/SettingsPanel.svelte';
    import Modals from './components/Modals.svelte';
    import PlayerOverlay from './components/PlayerOverlay.svelte';
    import StatusOverlay from './components/StatusOverlay.svelte';
    import ToastContainer from './components/ToastContainer.svelte';
    import ConfirmDialog from './components/ConfirmDialog.svelte';
    import ZimIcon from './components/ZimIcon.svelte';
    import HardwareBezel from './components/HardwareBezel.svelte';
    import { lineColorService } from './js/core/services/lineColorService.svelte.js';

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
    const targetLayout = urlParams.get('layout');

    // Hybrid-Modus für Mobile/Desktop: 'fit' (an Bildschirm anpassen) oder 'scroll' (Mindestbreite mit Scrollbalken)
    // Wird im displayConfigStore verwaltet und dort persistiert.
    const displayScaleMode = $derived(displayConfigStore.scaleMode);

    // Vollbild-Zustand (Fullscreen API)
    let isFullscreen = $state(false);

    // Auto-Hiding HUD für Vollbild/Kiosk
    let hudVisible = $state(false);
    let hudTimeout = null;

    // Reduce Transparency State für CSS-Fallback
    let reduceTransparency = $state(false);

    // Gehäuse-Zustand & dynamische Abmessungen für Gehäuse vs. Reines Display via Store
    let showBezel = $derived(displayConfigStore.showBezel);
    let isCasingActive = $derived(displayConfigStore.isCasingActive);
    let wrapperWidth = $derived(displayConfigStore.wrapperWidth);
    let wrapperHeight = $derived(displayConfigStore.wrapperHeight);
    let canvasOffsetX = $derived(displayConfigStore.canvasOffsetX);
    let canvasOffsetY = $derived(displayConfigStore.canvasOffsetY);
    let currentLayout = $derived(displayConfigStore.currentLayout);

    /**
     * Schaltet zwischen Fit- und Scroll-Modus um.
     * @returns {void}
     */
    function toggleScaleMode() {
        displayConfigStore.toggleScaleMode();
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
        ScreenSyncService.openScreenWindow(screenIndex, use4k, true, displayConfigStore.layoutType);
    }

    /**
     * Erstellt einen PNG-Download des aktuellen Monitors.
     * Arbeitet kontextsensitiv und dynamisch:
     * - Bei sichtbarem Gehäuse: Komponierter High-Res-Screenshot mit Vektor-Gehäuse (z.B. 4430×1600 bei 2 Screens, 6400×1600 bei 3 Screens)
     * - Ohne Gehäuse oder im Vollbild/Kiosk: Reines, randloses Display-Canvas (z.B. 3840×1080 oder 3890×1080)
     * @returns {Promise<void>}
     */
    async function downloadScreenshot() {
        const canvas = document.getElementById('zimCanvas');
        if (!canvas) return;
        const overlayCanvas = document.getElementById('zimDynamicCanvas');

        const svgElement = isCasingActive ? document.querySelector('.hardware-bezel-svg') : null;

        await downloadDisplayScreenshot({
            canvas,
            overlayCanvas,
            casing: svgElement
                ? { svgElement, width: wrapperWidth, height: wrapperHeight, offsetX: canvasOffsetX, offsetY: canvasOffsetY }
                : null
        });
    }

    // Reaktiver Effekt für Canvas Re-Renders und State-Broadcasts
    $effect(() => {
        // Reaktiver Zugriff auf Store-Werte
        const j = journeyStore.journeys;
        const tm = journeyStore.activeMots;
        const at = journeyStore.activeTracks;
        const pf = journeyStore.platforms;
        const plat = journeyStore.stationContext.platform;
        const pName = journeyStore.stationContext.activePlatformName;
        const nrw = journeyStore.nrwMode;
        const lr = lineColorService.rules;
        const lac = lineColorService.autoColorsEnabled;
        const lacl = lineColorService.isAutoColorsLoaded;

        trainDisplay.scheduleUpdateAll();

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
        const _layout = displayConfigStore.currentLayout;
        const _mode = displayScaleMode;

        // Layout im TrainDisplay synchronisieren (wichtig bei Monitor/Typ/Bezel-Wechsel)
        trainDisplay.setLayout(displayConfigStore.currentLayout);

        handleResize();

        // Nach Abschluss aller Svelte-DOM-Updates Canvas zuverlässig neu zeichnen
        trainDisplay.scheduleUpdateAll();
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

        if (displayScaleMode === 'scroll') {
            // 1:1 Modus: Native Pixel mit horizontalem Scrollen
            scaleWrapper.style.transform = 'scale(1)';
            scaleWrapper.style.width = `${targetW}px`;
            scaleWrapper.style.height = `${targetH}px`;

            outerContainer.style.width = `${targetW}px`;
            outerContainer.style.height = `${targetH}px`;
            outerContainer.style.minWidth = `${targetW}px`;
        } else {
            // 'fit' Modus: Proportional an die verfuegbare Breite anpassen
            const availWidth = displayWrapper && displayWrapper.clientWidth > 0
                ? displayWrapper.clientWidth
                : (window.visualViewport ? window.visualViewport.width : window.innerWidth);

            if (availWidth === 0) return;

            const scale = availWidth / targetW;
            const scaledHeight = targetH * scale;

            scaleWrapper.style.transform = `scale(${scale})`;
            scaleWrapper.style.width = `${targetW}px`;
            scaleWrapper.style.height = `${targetH}px`;

            outerContainer.style.width = `${availWidth}px`;
            outerContainer.style.height = `${scaledHeight}px`;
            outerContainer.style.minWidth = '0px';
        }
    }

    function onFullscreenChange() {
        isFullscreen = Boolean(document.fullscreenElement);
        displayConfigStore.isFullscreen = isFullscreen;
        if (isFullscreen) {
            handleUserActivity();
        }
        setTimeout(handleResize, 50);
    }

    /**
     * Schaltet das Gehäuse-Overlay (Rahmen & Steg) um.
     * @returns {void}
     */
    function toggleBezel() {
        displayConfigStore.toggleBezel();
        setTimeout(() => {
            handleResize();
            trainDisplay.updateAll();
        }, 50);
    }

    /**
     * Prüft, ob aktuell ein Texteingabefeld den Fokus hat.
     * Verhindert, dass Menü-Shortcuts das Tippen in Formularfeldern stören.
     * @returns {boolean}
     */
    function isTextInputFocused() {
        const el = document.activeElement;
        if (!el) return false;
        return el.tagName === 'INPUT'
            || el.tagName === 'TEXTAREA'
            || el.tagName === 'SELECT'
            || el.isContentEditable;
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && (isFullscreen || isKiosk)) {
            exitFullscreenMode();
        } else if (e.key === 'F11') {
            e.preventDefault();
            toggleFullscreen();
        } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
            e.preventDefault();
            selectTab('system');
            const el = document.querySelector('.settings-container');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '4') {
            e.preventDefault();
            downloadScreenshot();
        } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && !isTextInputFocused()) {
            // Shortcuts, die früher über die Accelerators des nativen Menüs liefen
            const key = e.key.toLowerCase();
            if (key === '0') {
                e.preventDefault();
                displayConfigStore.setScaleMode('fit');
            } else if (key === '1') {
                e.preventDefault();
                displayConfigStore.setScaleMode('scroll');
            } else if (key === 'b') {
                e.preventDefault();
                toggleBezel();
            } else if (key === 'n') {
                e.preventDefault();
                journeyStore.addJourney();
            }
        }
    }

    onMount(() => {
        displayConfigStore.isKiosk = isKiosk;
        if (targetLayout) {
            displayConfigStore.setLayoutType(targetLayout);
        }

        // Multi-Screen / Kiosk Setup
        if (targetScreen) {
            displayConfigStore.setTargetScreen(targetScreen, is4k);
            trainDisplay.setTargetScreen(targetScreen, is4k, false);
            if (isKiosk || targetScreen !== '1') {
                ansagenStore.muted = true; // Sekundäre Monitore stumm schalten
            }
            ScreenSyncService.initSlave(journeyStore, trainDisplay);
        } else {
            displayConfigStore.setTargetScreen(null, is4k);
            ScreenSyncService.initMaster(journeyStore);
            trainDisplay.updateAll();
        }
        
        // Verwende ResizeObserver für verlässliche Neuberechnung bei Viewport-/Wrapper-Änderungen
        let observer = null;
        if (window.ResizeObserver && displayWrapper) {
            observer = new ResizeObserver(() => {
                handleResize();
            });
            observer.observe(displayWrapper);
        }

        const onViewportResize = () => handleResize();
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onViewportResize);
        }
        
        window.addEventListener('resize', handleResize);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        window.addEventListener('keydown', onKeyDown);
        setTimeout(handleResize, 100);
        
        // Systemeinstellung "Transparenz reduzieren" beobachten (CSS-Media-Query)
        const unwatchReducedTransparency = watchReducedTransparency((value) => {
            reduceTransparency = value;
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', onViewportResize);
            }
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            window.removeEventListener('keydown', onKeyDown);
            if (observer) observer.disconnect();
            if (hudTimeout) clearTimeout(hudTimeout);
            unwatchReducedTransparency();
        };
    });
</script>

{#if !isKiosk}
    <Header 
        onScreenshot={downloadScreenshot} 
        onToggleFullscreen={toggleFullscreen}
        {isFullscreen}
        onOpenScreen={openScreen}
    />
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
    bind:this={displayWrapper} 
    class="display-wrapper {isKiosk ? 'kiosk-active' : ''} {isFullscreen ? 'fullscreen-active' : ''}" 
    onmousemove={handleUserActivity}
    ontouchstart={handleUserActivity}
    onpointerdown={handleUserActivity}
    role="presentation"
    style="width: 100%; position: relative; {isFullscreen || isKiosk ? 'height: 100vh; overflow: hidden; background: #000;' : (displayScaleMode === 'fit' ? 'overflow: hidden;' : 'overflow-x: auto; overflow-y: hidden;')}"
>
    <!-- Schwebendes Exit-HUD im Vollbild / Kiosk-Modus -->
    {#if isFullscreen || isKiosk}
        <div class="fullscreen-hud" class:hud-visible={hudVisible} class:reduce-transparency={reduceTransparency}>
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
        style="position: relative; width: 100%; overflow: hidden;"
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
                    layout={currentLayout} 
                />
                <div 
                    class="display-bezel-lip" 
                    style="left: {canvasOffsetX}px; top: {canvasOffsetY}px; width: {currentLayout.width}px; height: {currentLayout.height}px;"
                ></div>
            {/if}

            <canvas 
                bind:this={canvasElement} 
                id="zimCanvas" 
                style="position: absolute; top: {canvasOffsetY}px; left: {canvasOffsetX}px; z-index: 10;"
            ></canvas>
            <canvas 
                id="zimDynamicCanvas" 
                aria-hidden="true"
                style="position: absolute; top: {canvasOffsetY}px; left: {canvasOffsetX}px; z-index: 11; pointer-events: none; background: transparent;"
            ></canvas>
        </div>
    </div>
</div>

<!-- Schlanke Display-Steuerungsleiste direkt unter dem Monitor (0% Überdeckung der Bildfläche) -->
{#if !isKiosk}
<DisplayToolbar 
    {displayScaleMode}
    {targetScreen}
    onToggleScaleMode={toggleScaleMode}
/>

<SettingsPanel {modalsComp} />

<Modals bind:this={modalsComp} />

<PlayerOverlay />

<StatusOverlay />
{/if}

<ToastContainer />
<ConfirmDialog />

<style>
    /* Subtiler Innenrahmen/Fase um die Bildschirme (Display-Einbau) */
    .display-bezel-lip {
        position: absolute;
        pointer-events: none;
        z-index: 15;
        box-sizing: border-box;
        /* Nur ein solider Rahmen statt Inset-/Außen-Schatten: Schatten auf
           einem 1920-5860 px breiten Element erzeugen einen Rasterpuffer in
           Elementgröße, den Chromium auf Android abschneidet (fehlender rechter
           Teil der Anzeigefläche). Der Rahmen erzielt dieselbe optische Fuge. */
        border: 3px solid rgba(0, 0, 0, 0.8);
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
    .fullscreen-hud.reduce-transparency .fullscreen-hud-btn {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        background: var(--bg-card);
    }
    .fullscreen-hud-btn {
        background: rgba(18, 18, 24, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 12px 20px;
        font-size: 0.9rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
        transition: all 0.2s ease;
        min-height: 44px;
        min-width: 44px;
    }
    .fullscreen-hud-btn:hover {
        background: rgba(40, 40, 50, 0.95);
        border-color: var(--accent);
        transform: scale(1.02);
    }
    .fullscreen-hud-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
    }
</style>
