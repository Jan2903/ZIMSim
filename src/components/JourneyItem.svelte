<script>
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import { formatDisplayName } from '../js/features/journey/trainNumberFormatter.js';
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
    
    function moveUp() {
        if (journeyStore.moveJourneyGroupUp(journey.id)) {
            trainDisplay.updateAll();
        }
    }
    
    function moveDown() {
        if (journeyStore.moveJourneyGroupDown(journey.id)) {
            trainDisplay.updateAll();
        }
    }

    let isHidden = $derived(
        journeyStore.isJourneyHidden(journey, uiState.hideLinkedArrivals, isExpanded)
    );

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

    let linkedJourney = $derived(journeyStore.getLinkedJourney(journey.id));
</script>

<div id="journey-{journey.id}" class="journey-row {journey.ausfall ? 'journey-cancelled' : ''} {isHidden ? 'mot-hidden' : ''} {isExpanded ? 'is-expanded' : ''}">
    <div class="journey-row-content">
        <div class="journey-col-reorder">
            {#if uiState.enableDragAndDrop}
                <span class="journey-drag-handle" title="Drag & Drop">⠿</span>
            {/if}
            <div class="move-arrows">
                <button class="btn-icon arrow-btn" onclick={moveUp} title="Nach oben verschieben">↑</button>
                <button class="btn-icon arrow-btn" onclick={moveDown} title="Nach unten verschieben">↓</button>
            </div>
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
                <span class="journey-name" title="{journey.effectiveDisplayName}">{formatDisplayName(journey.effectiveDisplayName, journeyStore.nrwMode) || '(kein Name)'}</span>
                {#if journey.infoscreen}
                    <span class="badge badge-info" title="Infoscreen">ⓘ</span>
                {:else if journey.ankunft}
                    <span class="badge badge-arrival" title="Ankunft">An</span>
                {:else}
                    <span class="badge badge-departure" title="Abfahrt">Ab</span>
                {/if}
                <span class="journey-destination">{journey.destination || '—'}</span>
                <span class="journey-time">{journey.scheduledTime || '—'}</span>
                
                {#if journey.ausfall}
                    <span class="status-badge status-cancelled">
                        <span class="status-dot"></span>
                        Ausfall
                    </span>
                {:else if journey.expectedTime && journey.expectedTime !== journey.scheduledTime}
                    <span class="status-badge status-delayed">
                        <span class="status-dot"></span>
                        {journey.expectedTime}
                    </span>
                {:else if !journey.infoscreen}
                    <span class="status-badge status-ontime">
                        <span class="status-dot"></span>
                        Pünktlich
                    </span>
                {/if}
                
                <span class="journey-platform">
                    {journey.platform ? 'Gl. ' + journey.platform : ''}
                    {#if journey.ezGleis && journey.ezGleis !== journey.platform}
                        <span style="color: #ff6b6b; font-weight: bold;">({journey.ezGleis})</span>
                    {/if}
                </span>
                
                {#if linkedJourney}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span class="badge badge-link" 
                          title="{journey.ankunft ? 'Wird zu Abfahrt' : 'Kommt von Ankunft'} (anklicken zum Öffnen)" 
                          style="cursor: pointer; background: #4dabf7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-right: 8px;"
                          onclick={(e) => {
                              e.stopPropagation();
                              uiState.expandedJourneyId = linkedJourney.id;
                              setTimeout(() => {
                                  const el = document.getElementById('journey-' + linkedJourney.id);
                                  if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
                              }, 50);
                          }}>
                        🔗 {journey.ankunft ? 'Wird zu' : 'Kommt aus'} {linkedJourney.effectiveDisplayName} ({linkedJourney.scheduledTime})
                    </span>
                {/if}
                
                <button class="btn-icon expand-toggle">{isExpanded ? '▾' : '▸'}</button>
            </div>
        </div>
    </div>
    
    {#if isExpanded}
        <div class="journey-details-fullwidth">
            <JourneyDetails bind:journey />
        </div>
    {/if}
</div>

<style>
.journey-row { display: flex; flex-direction: column; align-items: stretch; background: var(--bg-input); border-radius: 6px; overflow: hidden; transition: background 0.15s, border 0.15s; border: 2px solid transparent; }
.journey-row-content { display: flex; align-items: stretch; width: 100%; }
.journey-details-fullwidth { padding: 0 12px 12px 12px; }
.journey-row:hover { background: #1a2744; }
.journey-row.journey-cancelled { opacity: 0.6; }
.journey-row.mot-hidden { display: none !important; }
.journey-row.journey-cancelled .journey-name { text-decoration: line-through; }
.journey-row:global(.dragging) { opacity: 0.5; border-color: var(--accent); }
.journey-row:global(.drag-over-top) { border-top-color: var(--accent); }
.journey-row:global(.drag-over-bottom) { border-bottom-color: var(--accent); }

.journey-col-reorder { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; background: rgba(0,0,0,0.15); width: 28px; }
.journey-drag-handle { cursor: grab; font-size: 14px; color: var(--text-muted); margin-bottom: 4px; user-select: none; }
.journey-drag-handle:active { cursor: grabbing; }
.move-arrows { display: flex; flex-direction: column; gap: 2px; }
.arrow-btn { padding: 0 4px; font-size: 0.8em; color: var(--text-muted); }
.arrow-btn:hover { color: var(--text-main); }

.journey-col-visibility { display: flex; align-items: flex-start; padding: 8px 4px 8px 8px; min-width: 36px; }

.journey-col-coupling { position: relative; width: 20px; min-height: 100%; }
.coupling-line { position: absolute; left: 50%; transform: translateX(-50%); width: 3px; background: var(--accent); }
:global(.coupling-start) .coupling-line { top: 50%; bottom: 0; border-radius: 3px 3px 0 0; }
:global(.coupling-middle) .coupling-line { top: 0; bottom: 0; }
:global(.coupling-end) .coupling-line { top: 0; bottom: 50%; border-radius: 0 0 3px 3px; }
:global(.coupling-single) .coupling-line { display: none; }

.journey-col-main { flex: 1; padding: 8px 12px; min-width: 0; }
.journey-summary { display: flex; align-items: center; gap: 10px; cursor: pointer; flex-wrap: wrap; }
.journey-name { font-weight: bold; font-size: 1.05em; color: var(--text-main); white-space: nowrap; }
.journey-destination { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 80px; }
.journey-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
.journey-platform { color: var(--text-muted); white-space: nowrap; font-size: 0.9em; }

.badge { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 0.85em; }
.badge-arrival { background: #1e40af; color: #93c5fd; }
.badge-departure { background: #334155; color: #f8fafc; }
.badge-info { background: transparent; color: var(--text-muted); font-size: 1.2em; padding: 0 4px; border: 1px solid var(--border); }
.expand-toggle { margin-left: auto; }
</style>
