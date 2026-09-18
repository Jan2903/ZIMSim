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
    
    <!-- Diskreter Umschalter für Display-Skalierungsmodus -->
    <button 
        type="button" 
        class="scale-mode-toggle"
        onclick={toggleScaleMode}
        title={displayScaleMode === 'fit' ? 'Zur scrollbaren Detailansicht (1:1) wechseln' : 'An Bildschirmbreite anpassen (Fit)'}
        aria-label="Display-Skalierung umschalten"
    >
        <ZimIcon name={displayScaleMode === 'fit' ? 'zoom_scroll' : 'zoom_fit'} size={15} />
        <span>{displayScaleMode === 'fit' ? 'Fit' : 'Scroll'}</span>
    </button>
</div>

<SettingsPanel {modalsComp} />

<Modals bind:this={modalsComp} />

<PlayerOverlay />

<StatusOverlay />

<style>
    .scale-mode-toggle {
        position: absolute;
        bottom: 8px;
        right: 8px;
        z-index: 30;
        background: rgba(20, 20, 25, 0.85);
        color: var(--text-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm, 4px);
        padding: 4px 8px;
        font-size: 0.75rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        backdrop-filter: blur(6px);
        transition: all 0.2s ease;
        opacity: 0.75;
    }
    .scale-mode-toggle:hover {
        opacity: 1;
        background: rgba(30, 30, 40, 0.95);
        border-color: var(--accent);
    }
</style>

