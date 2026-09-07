<script>
    import { dndzone } from 'svelte-dnd-action';
    import { safeFlip as flip } from '../js/core/utils/animationUtils.js';
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import JourneyItem from './JourneyItem.svelte';
    import { uiState } from '../js/core/state/uiState.svelte.js';

    const flipDurationMs = 200;

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
         flipDurationMs, 
         type: 'journey',
         dragDisabled: uiState.expandedJourneyId !== null || !uiState.enableDragAndDrop
     }}
     onconsider={handleDndConsider}
     onfinalize={handleDndFinalize}>
    {#each journeyStore.journeys as journey, i (journey.id)}
        <div animate:flip={{duration: flipDurationMs}}>
            <JourneyItem bind:journey={journeyStore.journeys[i]} />
        </div>
    {/each}
</div>
