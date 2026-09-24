<script>
    import { onMount } from 'svelte';
    import { journeyStore, trainDisplay } from './js/core/state/stores.js';
    import { ScreenSyncService } from './js/core/services/screenSyncService.js';
    import { ansagenStore } from './js/audio/ansagenStore.svelte.js';
    import Header from './components/Header.svelte';
    import DisplayToolbar from './components/DisplayToolbar.svelte';
    import SettingsPanel from './components/SettingsPanel.svelte';
    import Modals from './components/Modals.svelte';
    import PlayerOverlay from './components/PlayerOverlay.svelte';
    import StatusOverlay from './components/StatusOverlay.svelte';
    import ZimIcon from './components/ZimIcon.svelte';
    import HardwareBezel from './components/HardwareBezel.svelte';
    import { displayConfigStore } from './js/displays/core/displayConfigStore.svelte.js';
    import { lineColorService } from './js/features/journey/services/lineColorService.svelte.js';

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
    let displayScaleMode = $state(localStorage.getItem('zimsim_scale_mode') || 'fit');

    // Vollbild-Zustand (Fullscreen API)
    let isFullscreen = $state(false);

    // Auto-Hiding HUD für Vollbild/Kiosk
    let hudVisible = $state(false);
    let hudTimeout = null;

    // Gehäuse-Zustand & dynamische Abmessungen für Gehäuse vs. Reines Display via Store
    let showBezel = $derived(displayConfigStore.showBezel);
    let isCasingActive = $derived(displayConfigStore.isCasingActive);
    let wrapperWidth = $derived(displayConfigStore.wrapperWidth);
    let wrapperHeight = $derived(displayConfigStore.wrapperHeight);
    let canvasOffsetX = $derived(displayConfigStore.canvasOffsetX);
    let canvasOffsetY = $derived(displayConfigStore.canvasOffsetY);

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
        ScreenSyncService.openScreenWindow(screenIndex, use4k, true, displayConfigStore.layoutType);
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
        const lr = lineColorService.rules;
        
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
        displayConfigStore.isFullscreen = isFullscreen;
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
        setTimeout(handleResize, 100);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            window.removeEventListener('keydown', onKeyDown);
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
<DisplayToolbar 
    {displayScaleMode}
    {targetScreen}
    onToggleBezel={toggleBezel}
    onScreenshot={downloadScreenshot}
    onToggleScaleMode={toggleScaleMode}
    onToggleFullscreen={toggleFullscreen}
    onOpenScreen={openScreen}
/>

<SettingsPanel {modalsComp} />

<Modals bind:this={modalsComp} />

<PlayerOverlay />

<StatusOverlay />
{/if}

<style>
    /* Fullscreen HUD & Display Wrapper */
    .fullscreen-hud {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    .fullscreen-hud.hud-visible {
        opacity: 1;
        pointer-events: auto;
    }
    .fullscreen-hud-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(20, 20, 25, 0.85);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        transition: all 0.2s ease;
    }
    .fullscreen-hud-btn:hover {
        background: rgba(40, 40, 50, 0.95);
        border-color: rgba(255, 255, 255, 0.4);
    }
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
</style>
