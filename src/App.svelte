<script>
    import { onMount } from 'svelte';
    import { journeyStore, trainDisplay } from './js/stores.js';
    import Header from './components/Header.svelte';
    import SettingsPanel from './components/SettingsPanel.svelte';
    import Modals from './components/Modals.svelte';
    import PlayerOverlay from './components/PlayerOverlay.svelte';

    let modalsComp = $state();
    let canvasElement = $state();
    let containerElement = $state();

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

    onMount(() => {
        trainDisplay.updateAll();
        
        function handleResize() {
            if (!canvasElement || !containerElement) return;

            const layoutWidth = trainDisplay.currentLayout.width;
            const layoutHeight = trainDisplay.currentLayout.height;
            const containerWidth = containerElement.clientWidth;
            if (containerWidth === 0) return;

            const scale = containerWidth / layoutWidth;
            const scaledHeight = layoutHeight * scale;

            canvasElement.style.transform = `scale(${scale})`;
            canvasElement.style.transformOrigin = 'top left';
            containerElement.style.height = `${scaledHeight}px`;
        }
        
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 100);
        
        return () => window.removeEventListener('resize', handleResize);
    });
</script>

<Header />

<div class="display-container">
    <div bind:this={containerElement} id="display-container" style="position: relative; width: 100%; height: 100%; background-color: var(--db-dark); overflow: hidden;">
        <div id="hardware-bezel" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 20; pointer-events: none;"></div>
        <canvas bind:this={canvasElement} id="zimCanvas" width="4428" height="1600" style="position: absolute; top: 0; left: 0; z-index: 10;"></canvas>
    </div>
</div>

<SettingsPanel {modalsComp} />

<Modals bind:this={modalsComp} />

<PlayerOverlay />
