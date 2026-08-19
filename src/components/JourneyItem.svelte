<script>
    import { uiState } from '../js/models/uiState.svelte.js';
    import { journeyStore, trainDisplay } from '../js/main.js';
    import { getMotForCategory } from '../js/utils/motManager.js';
    import JourneyDetails from './JourneyDetails.svelte';

    let { journey = $bindable() } = $props();

    let isExpanded = $derived(uiState.expandedJourneyId === journey.id);

    function toggleExpand() {
        if (uiState.expandedJourneyId === journey.id) {
            uiState.expandedJourneyId = null;
        } else {
            uiState.expandedJourneyId = journey.id;
        }
    }

    function toggleVisibility() {
        journey.visible = !journey.visible;
        trainDisplay.updateAll();
    }

    let isHidden = $derived.by(() => {
        const mot = getMotForCategory(journey.produktGattung || journey.name);
        if (mot && !journeyStore.activeMots.includes(mot)) return true;
        
        if (journeyStore.activeTracks.length > 0) {
            const hasPlatform = journey.platform && journeyStore.activeTracks.includes(journey.platform.toString());
            const hasEzGleis = journey.ezGleis && journeyStore.activeTracks.includes(journey.ezGleis.toString());
            const hasNoTrackCondition = (!journey.platform && !journey.ezGleis && journeyStore.activeTracks.includes('Ohne Gleis'));
            
            if (!hasPlatform && !hasEzGleis && !hasNoTrackCondition) return true;
        }
        return false;
    });

    let couplingClass = $derived.by(() => {
        if (!journey.couplingGroupId) return '';
        const idx = journeyStore.journeys.indexOf(journey);
        const prev = journeyStore.journeys[idx - 1];
        const next = journeyStore.journeys[idx + 1];
        
        const isFirst = !prev || prev.couplingGroupId !== journey.couplingGroupId;
        const isLast = !next || next.couplingGroupId !== journey.couplingGroupId;
        
        if (isFirst && isLast) return 'coupling-single';
        if (isFirst) return 'coupling-start';
        if (isLast) return 'coupling-end';
        return 'coupling-middle';
    });

    function getLinkedArrival() {
        return journeyStore.getJourney(journey.linkedArrivalJourneyId);
    }
    
    function getLinkedDeparture() {
        return journeyStore.journeys.find(j => j.linkedArrivalJourneyId === journey.id);
    }
</script>

<div class="journey-row {journey.ausfall ? 'journey-cancelled' : ''} {isHidden ? 'mot-hidden' : ''}">
    <div class="journey-col-reorder">
        <span class="journey-drag-handle" title="Drag & Drop">⠿</span>
    </div>
    <div class="journey-col-visibility">
        <button class="btn-icon visibility-toggle" onclick={toggleVisibility} onpointerdown={(e) => e.stopPropagation()} title="Sichtbarkeit umschalten">
            {journey.visible ? '👁' : '○'}
        </button>
    </div>
    <div class="journey-col-coupling {couplingClass}">
        <div class="coupling-line"></div>
    </div>
    <div class="journey-col-main">
        <div class="journey-summary" role="button" tabindex="0" onclick={toggleExpand} onpointerdown={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}>
            <span class="journey-name">{journey.displayNameOverride || journey.name || '(kein Name)'}</span>
            {#if journey.ankunft}
                <span class="badge badge-arrival">ⓐ</span>
            {/if}
            <span class="journey-destination">{journey.destination || '—'}</span>
            <span class="journey-time">{journey.scheduledTime || '—'}</span>
            
            {#if journey.expectedTime && journey.expectedTime !== journey.scheduledTime}
                <span class="delay-indicator">{journey.expectedTime}</span>
            {/if}
            
            <span class="journey-platform">
                {journey.platform ? 'Gl. ' + journey.platform : ''}
                {#if journey.ezGleis && journey.ezGleis !== journey.platform}
                    <span style="color: #ff6b6b; font-weight: bold;">({journey.ezGleis})</span>
                {/if}
            </span>
            
            {#if journey.linkedArrivalJourneyId}
                {#if getLinkedArrival()}
                    <span class="badge badge-link" title="Kommt von Ankunft (anklicken zum Öffnen)" style="cursor: pointer; background: #4dabf7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-right: 8px;">
                        🔗 Kommt aus {getLinkedArrival().effectiveDisplayName} ({getLinkedArrival().scheduledTime})
                    </span>
                {/if}
            {:else if journey.ankunft}
                {#if getLinkedDeparture()}
                    <span class="badge badge-link" title="Wird zu Abfahrt (anklicken zum Öffnen)" style="cursor: pointer; background: #4dabf7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-right: 8px;">
                        🔗 Wird zu {getLinkedDeparture().effectiveDisplayName} ({getLinkedDeparture().scheduledTime})
                    </span>
                {/if}
            {/if}
            
            <button class="btn-icon expand-toggle">{isExpanded ? '▾' : '▸'}</button>
        </div>
        
        {#if isExpanded}
            <JourneyDetails bind:journey />
        {/if}
    </div>
</div>
