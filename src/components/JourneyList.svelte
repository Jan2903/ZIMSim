<script>
    import { dndzone } from 'svelte-dnd-action';
    import { safeFlip as flip } from '../js/core/utils/animationUtils.js';
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import JourneyItem from './JourneyItem.svelte';
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { irisPollingService } from '../js/core/services/irisPollingService.svelte.js';

    const flipDurationMs = 200;
    // Performance: FLIP-Animationen bei großen Listen (> 50 Fahrten) abschalten
    let enableFlip = $derived(journeyStore.journeys.length <= 50);

    function handleDndConsider(e) {
        journeyStore.journeys = e.detail.items;
    }

    function handleDndFinalize(e) {
        journeyStore.journeys = e.detail.items;
        trainDisplay.updateAll();
    }
</script>

<div class="journey-list-inner"
     use:dndzone={{
         items: journeyStore.journeys, 
         flipDurationMs: enableFlip ? flipDurationMs : 0, 
         type: 'journey',
         dragDisabled: uiState.expandedJourneyId !== null || !uiState.enableDragAndDrop || irisPollingService.isActive
     }}
     onconsider={handleDndConsider}
     onfinalize={handleDndFinalize}>
    {#each journeyStore.journeys as journey, i (journey.id)}
        {#if enableFlip}
            <div animate:flip={{duration: flipDurationMs}}>
                <JourneyItem bind:journey={journeyStore.journeys[i]} index={i} />
            </div>
        {:else}
            <div>
                <JourneyItem bind:journey={journeyStore.journeys[i]} index={i} />
            </div>
        {/if}
    {/each}
</div>
