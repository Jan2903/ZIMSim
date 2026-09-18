<script>
    import { onMount } from 'svelte';
    import { journeyStore, trainDisplay } from './js/core/state/stores.js';
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
    
    // Hybrid-Modus für Mobile/Desktop: 'fit' (an Bildschirm anpassen) oder 'scroll' (Mindestbreite mit Scrollbalken)
    let displayScaleMode = $state(localStorage.getItem('zimsim_scale_mode') || 'fit');

    /**
     * Schaltet zwischen Fit- und Scroll-Modus um.
     * @returns {void}
     */
    function toggleScaleMode() {
        displayScaleMode = displayScaleMode === 'fit' ? 'scroll' : 'fit';
        localStorage.setItem('zimsim_scale_mode', displayScaleMode);
        // Nach DOM-Update neu berechnen
        setTimeout(handleResize, 20);
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

    // Reactive effect to trigger canvas re-renders when journeyStore state changes
    $effect(() => {
        // Deeply accessing some store values to trigger reactivity
        const j = journeyStore.journeys;
        const tm = journeyStore.activeMots;
        const at = journeyStore.activeTracks;
        const pf = journeyStore.platforms;
        const nrw = journeyStore.nrwMode;
        
        trainDisplay.updateAll();
    });

    /**
     * Berechnet die Skalierung des ZIM-Canvas anhand der aktuellen Container-Breite.
     * @returns {void}
     */
    function handleResize() {
        if (!scaleWrapper || !outerContainer) return;

        const layoutWidth = trainDisplay.currentLayout.width;
        const layoutHeight = trainDisplay.currentLayout.height;
        const containerWidth = outerContainer.clientWidth;
        if (containerWidth === 0) return;

        const scale = containerWidth / layoutWidth;
        const scaledHeight = layoutHeight * scale;

        scaleWrapper.style.transform = `scale(${scale})`;
        outerContainer.style.height = `${scaledHeight}px`;
        
        // WICHTIG: Die Breite muss festgesetzt werden, da sich das Layout ändern kann
        scaleWrapper.style.width = `${layoutWidth}px`;
        scaleWrapper.style.height = `${layoutHeight}px`;
    }

    onMount(() => {
        trainDisplay.updateAll();
        
        // Verwende ResizeObserver für verlässliche Neuberechnung bei Layout-Änderungen
        let observer = null;
        if (window.ResizeObserver && outerContainer) {
            observer = new ResizeObserver(() => {
                handleResize();
            });
            observer.observe(outerContainer);
        }
        
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 100);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            if (observer) observer.disconnect();
        };
    });
</script>

<Header />

<div class="display-wrapper" style="width: 100%; overflow-x: auto; overflow-y: hidden; position: relative;">
    <div 
        class="display-container" 
        bind:this={outerContainer} 
        style="position: relative; width: 100%; min-width: {displayScaleMode === 'scroll' ? '850px' : '0'}; overflow: hidden; transition: min-width 0.2s ease;"
    >
        <div bind:this={scaleWrapper} class="scale-wrapper" style="position: absolute; top: 0; left: 0; width: 4428px; height: 1600px; transform-origin: top left; background-color: var(--db-dark); overflow: hidden;">
            <div id="hardware-bezel" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 20; pointer-events: none;"></div>
            <canvas bind:this={canvasElement} id="zimCanvas" width="4428" height="1600" style="position: absolute; top: 0; left: 0; z-index: 10;"></canvas>
        </div>
    </div>
    
</div>

<!-- Schlanke Display-Steuerungsleiste direkt unter dem Monitor (0% Überdeckung der Bildfläche) -->
<div class="display-toolbar">
    <div class="display-toolbar-info">
        <span class="display-toolbar-status">
            Display: <strong>{displayScaleMode === 'fit' ? 'Fit (angepasst)' : '1:1 (scrollbar)'}</strong>
        </span>
    </div>
    <div class="display-toolbar-actions">
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
    </div>
</div>

<SettingsPanel {modalsComp} />

<Modals bind:this={modalsComp} />

<PlayerOverlay />

<StatusOverlay />

<style>
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
    @media (max-width: 768px) {
        .display-toolbar {
            padding: 8px 12px;
        }
        .display-toolbar-btn {
            padding: 6px 10px;
            min-height: 38px;
        }
    }
</style>

