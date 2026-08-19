<script>
    import { dndzone } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { journeyStore, trainDisplay } from '../js/main.js';
    import JourneyItem from './JourneyItem.svelte';
    import { uiState } from '../js/models/uiState.svelte.js';

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
     use:dndzone={{items: journeyStore.journeys, flipDurationMs}}
     onconsider={handleDndConsider}
     onfinalize={handleDndFinalize}>
    {#each journeyStore.journeys as journey (journey.id)}
        <div animate:flip={{duration: flipDurationMs}}>
            <JourneyItem {journey} />
        </div>
    {/each}
</div>
