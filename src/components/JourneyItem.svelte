<script>
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { toastStore } from '../js/core/state/toastStore.svelte.js';
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import { formatDisplayName } from '../js/features/journey/trainNumberFormatter.js';
    import { lineColorService } from '../js/features/journey/services/lineColorService.svelte.js';
    import JourneyDetails from './JourneyDetails.svelte';
    import ZimIcon from './ZimIcon.svelte';
    import { FormationService } from '../js/features/formation/formationService.js';

    let { journey = $bindable(), index = -1 } = $props();

    let isExpanded = $derived(uiState.expandedJourneyId === journey.id);

    let hasFormationLoaded = $derived(
        journey.formation && Array.isArray(journey.formation.groups) && journey.formation.groups.some(g => g.coaches && g.coaches.length > 0)
    );

    async function fetchWagenreihung(e) {
        e.stopPropagation();
        const res = await FormationService.fetchFormationForJourney(journey);
        if (!res.success) {
            toastStore.error(res.message || 'Wagenreihung konnte nicht geladen werden.');
        }
    }

    let formattedDisplayName = $derived(
        formatDisplayName(journey.effectiveDisplayName, journeyStore.nrwMode)
    );

    let lineBadgeStyle = $derived(
        lineColorService.resolveStyle(formattedDisplayName || journey.effectiveDisplayName, {
            operator: journey.operator,
            isAusfall: journey.ausfall
        })
    );

    let customBadgeStyle = $derived(
        lineBadgeStyle.hasMatchedRule ? lineColorService.getCssStyle(lineBadgeStyle, 20) : ''
    );

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
        const idx = index >= 0 ? index : journeyStore.journeys.indexOf(journey);
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

    let isDelayed = $derived(
        !journey.ausfall && Boolean(journey.expectedTime) && journey.expectedTime !== journey.scheduledTime
    );

    let statusTone = $derived.by(() => {
        if (journey.ausfall) return 'cancelled';
        if (isDelayed) return 'delayed';
        if (!journey.infoscreen) return 'ontime';
        return '';
    });

    let statusTitle = $derived.by(() => {
        if (journey.ausfall) return 'Ausfall';
        if (isDelayed) return `Erwartet ${journey.expectedTime}`;
        if (!journey.infoscreen) return 'Pünktlich';
        return '';
    });
</script>

<div id="journey-{journey.id}" class="journey-row {journey.ausfall ? 'journey-cancelled' : ''} {isHidden ? 'mot-hidden' : ''} {isExpanded ? 'is-expanded' : ''}">
    <div class="journey-row-content">
        <div class="journey-col-reorder">
            {#if uiState.enableDragAndDrop}
                <span class="journey-drag-handle" title="Drag & Drop"><ZimIcon name="drag_handle" size={14} /></span>
            {/if}
            <div class="move-arrows">
                <button class="btn-icon arrow-btn" onclick={moveUp} title="Nach oben verschieben">
                    <ZimIcon name="arrow_up" size={12} />
                </button>
                <button class="btn-icon arrow-btn" onclick={moveDown} title="Nach unten verschieben">
                    <ZimIcon name="arrow_down" size={12} />
                </button>
            </div>
        </div>
        <div class="journey-col-visibility">
            <button class="btn-icon visibility-toggle" onclick={toggleVisibility} onpointerdown={(e) => e.stopPropagation()} title="Sichtbarkeit umschalten">
                <ZimIcon name={journey.visible ? 'eye' : 'eye_off'} size={18} color={journey.visible ? 'var(--text-main)' : 'var(--text-muted)'} />
            </button>
        </div>
        <div class="journey-col-coupling {couplingClass}">
            <div class="coupling-line"></div>
        </div>
        <div class="journey-col-main">
            <div class="journey-summary" role="button" tabindex="0" onclick={toggleExpand} onpointerdown={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}>
                <span 
                    class="journey-name" 
                    class:has-custom-badge={lineBadgeStyle.hasMatchedRule}
                    title="{journey.effectiveDisplayName}"
                    style={customBadgeStyle}
                >{formattedDisplayName || '(kein Name)'}</span>
                {#if journey.infoscreen}
                    <span class="badge badge-info" title="Infoscreen">ⓘ</span>
                {:else if journey.ankunft}
                    <span class="badge badge-arrival" title="Ankunft">An</span>
                {:else}
                    <span class="badge badge-departure" title="Abfahrt">Ab</span>
                {/if}
                <span class="journey-destination" title={journey.destination || '—'}>{journey.destination || '—'}</span>
                <span class="journey-time">{journey.scheduledTime || '—'}</span>

                <span class="journey-status {statusTone}" title={statusTitle || undefined}>
                    {#if statusTone}
                        <span class="status-dot"></span>
                    {/if}
                    {#if isDelayed}
                        <span class="status-time">{journey.expectedTime}</span>
                    {/if}
                    {#if statusTitle}
                        <span class="sr-only">{statusTitle}</span>
                    {/if}
                </span>

                <span class="journey-platform">
                    {journey.platform ? 'Gl. ' + journey.platform : ''}
                    {#if journey.ezGleis && journey.ezGleis !== journey.platform}
                        <span class="journey-platform-alt">({journey.ezGleis})</span>
                    {/if}
                </span>

                <div class="journey-badges">
                    {#if linkedJourney}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <span class="badge badge-link"
                              title="{journey.ankunft ? 'Wird zu Abfahrt' : 'Kommt von Ankunft'} (anklicken zum Öffnen)"
                              onclick={(e) => {
                                  e.stopPropagation();
                                  uiState.expandedJourneyId = linkedJourney.id;
                                  setTimeout(() => {
                                      const el = document.getElementById('journey-' + linkedJourney.id);
                                      if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
                                  }, 50);
                              }}>
                            <ZimIcon name="link" size={13} />
                            <span class="badge-link-text">{journey.ankunft ? 'Wird zu' : 'Kommt aus'} {linkedJourney.effectiveDisplayName} ({linkedJourney.scheduledTime})</span>
                        </span>
                    {/if}

                    {#if journey.hasFormation}
                        <span class="badge badge-formation-loaded" title="Wagenreihung vorhanden">
                            <ZimIcon name="train_fast" size={12} />
                            <span>WR</span>
                        </span>
                    {:else if journey.hasFormationAvailable}
                        <button
                            type="button"
                            class="badge badge-formation-available"
                            title="Wagenreihung verfügbar (DB Navigator) - Klicken zum Laden"
                            disabled={journey.isFetchingFormation}
                            onclick={fetchWagenreihung}
                        >
                            <ZimIcon name="train_fast" size={12} />
                            <span>{journey.isFetchingFormation ? 'Lädt...' : '[W]'}</span>
                        </button>
                    {/if}
                </div>

                <button class="btn-icon expand-toggle" title={isExpanded ? 'Einklappen' : 'Ausklappen'}>
                    <ZimIcon name={isExpanded ? 'chevron_down' : 'chevron_right'} size={16} />
                </button>
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
.journey-row { display: flex; flex-direction: column; align-items: stretch; background: var(--bg-input); border-radius: 6px; overflow: hidden; transition: background 0.15s, border 0.15s; border: 2px solid transparent; width: 100%; max-width: 100%; box-sizing: border-box; min-width: 0; }
.journey-row-content { display: flex; align-items: stretch; width: 100%; box-sizing: border-box; min-width: 0; }
.journey-details-fullwidth { padding: 0 12px 12px 12px; width: 100%; max-width: 100%; box-sizing: border-box; min-width: 0; }
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
.journey-summary {
    display: grid;
    grid-template-columns: 132px 34px minmax(0, 1fr) 52px 64px 72px minmax(0, 190px) 28px;
    align-items: center;
    column-gap: 8px;
    cursor: pointer;
    min-width: 0;
}
.journey-name { font-weight: bold; font-size: 1.05em; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.journey-name.has-custom-badge { display: inline-flex; align-items: center; line-height: 1.25; font-size: 0.95em; }
.journey-destination { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.journey-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
.journey-status { display: inline-flex; align-items: center; gap: 5px; justify-self: start; min-width: 0; font-size: 0.85em; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.journey-status.ontime { color: #22c55e; }
.journey-status.delayed { color: #e2001a; }
.journey-status.cancelled { color: #9ca3af; }
.journey-status.ontime .status-dot { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
.journey-status.delayed .status-dot { background: #e2001a; box-shadow: 0 0 8px #e2001a; animation: pulse-red 2s infinite; }
.journey-status.cancelled .status-dot { background: #9ca3af; }
.journey-platform { color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9em; }
.journey-platform-alt { color: #ff6b6b; font-weight: bold; }
.journey-badges { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.badge { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 0.85em; }
.badge-arrival { background: #1e40af; color: #93c5fd; justify-self: start; }
.badge-departure { background: #334155; color: #f8fafc; justify-self: start; }
.badge-info { background: transparent; color: var(--text-muted); font-size: 1.2em; padding: 0 4px; border: 1px solid var(--border); justify-self: start; }
.badge-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.85em;
    background: #4dabf7;
    color: white;
    cursor: pointer;
}
.badge-link-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge-formation-loaded {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.3);
    gap: 4px;
    font-size: 0.75em;
    padding: 2px 6px;
}
.badge-formation-available {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(96, 165, 250, 0.3);
    gap: 4px;
    font-size: 0.75em;
    padding: 2px 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}
.badge-formation-available:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    border-color: #60a5fa;
}
.badge-formation-available:disabled {
    opacity: 0.6;
    cursor: wait;
}
.expand-toggle { justify-self: center; }

@media (max-width: 768px) {
    .journey-col-reorder { width: 30px; }
    .arrow-btn { min-height: 24px; padding: 2px 4px; }
    .journey-col-visibility { min-width: 38px; padding: 8px 2px; }
    .journey-col-main { padding: 6px 8px; }
    .journey-summary {
        grid-template-columns: 70px 24px minmax(0, 1fr) 42px 28px;
        grid-template-areas:
            "name mode dest time toggle"
            "status status platform badges badges";
        column-gap: 4px;
        row-gap: 4px;
    }
    .journey-name { grid-area: name; font-size: 0.95em; }
    .journey-summary > .badge { grid-area: mode; }
    .journey-destination { grid-area: dest; font-size: 0.9em; }
    .journey-time { grid-area: time; }
    .journey-status { grid-area: status; }
    .journey-platform { grid-area: platform; }
    .journey-badges { grid-area: badges; }
    .badge-link-text { display: none; }
    .expand-toggle { grid-area: toggle; min-height: 36px; min-width: 32px; display: flex; align-items: center; justify-content: center; }
    .journey-details-fullwidth { padding: 0 6px 10px 6px; }
}
</style>
