<!-- src/components/DisplayToolbar.svelte -->
<script>
    import { onMount } from 'svelte';
    import ZimIcon from './ZimIcon.svelte';
    import { displayConfigStore } from '../js/displays/core/displayConfigStore.svelte.js';
    import { LAYOUT_TYPES } from '../js/displays/core/displayLayoutService.js';
    import { trainDisplay } from '../js/core/state/stores.js';
    import { selectTab } from '../js/core/state/uiState.svelte.js';
    import { watchReducedTransparency } from '../js/core/utils/systemPreferences.js';

    /**
     * @typedef {Object} Props
     * @property {string} displayScaleMode - 'fit' oder 'scroll'
     * @property {string|null} targetScreen - Zielmonitor für Pop-Outs
     * @property {() => void} onToggleScaleMode - Wechselt zwischen Fit und 1:1 Scroll
     */
    let {
        displayScaleMode = 'fit',
        targetScreen = null,
        onToggleScaleMode
    } = $props();

    // Aktiver Wagenreihungs-Modus ('rotierend' | 'wagennummern' | 'ausstattung' | 'klasse')
    let activeFeature = $state('wagennummern');

    // Ob aktuell ein Abfahrts-/Anschlusstafel-Layout aktiv ist
    let isAnschlusstafelLayout = $derived(
        ['anschlusstafel', 'anschlusstafel_zoom', 'anschlusstafel_zoom_icons'].includes(displayConfigStore.layoutType)
    );

    // Reduce Transparency State für CSS-Fallback
    let reduceTransparency = $state(false);

    /**
     * Behandelt den Wechsel des DB-Anzeigetyps.
     * @param {string} typeId
     * @returns {void}
     */
    function handleLayoutChange(typeId) {
        displayConfigStore.setLayoutType(typeId);
        trainDisplay.updateAll();
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * Schaltet den Wagenreihungs-Anzeigemodus um.
     * @param {string} featureVal
     * @returns {void}
     */
    function handleFeatureChange(featureVal) {
        activeFeature = featureVal;
        trainDisplay.onFeatureButtonChange(featureVal);
    }

    /**
     * Öffnet den Tab 'Anzeige & System' in den Einstellungen.
     * @returns {void}
     */
    function openDisplaySettings() {
        selectTab('system');
        const el = document.querySelector('.settings-container');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    onMount(() => {
        // Systemeinstellung "Transparenz reduzieren" beobachten (CSS-Media-Query)
        return watchReducedTransparency((value) => {
            reduceTransparency = value;
        });
    });
</script>

<div class="display-toolbar-wrapper" class:reduce-transparency={reduceTransparency}>
    <div class="display-toolbar">
        <!-- Linker Bereich: Tafel-Auswahl & Wagenreihungs-Modus -->
        <div class="display-toolbar-direct-controls">
            <!-- DB-Board Schnellwahl -->
            <div class="toolbar-control-group" title="DB-Anzeigetyp wählen">
                <span class="toolbar-label">
                    <ZimIcon name="board" size={14} />
                    <span class="label-text">Tafel:</span>
                </span>
                <select 
                    class="toolbar-select board-select" 
                    value={displayConfigStore.layoutType}
                    onchange={(e) => handleLayoutChange(e.currentTarget.value)}
                    aria-label="DB-Anzeigetyp auswählen"
                >
                    {#each LAYOUT_TYPES as lt}
                        <option value={lt.id}>{lt.name}</option>
                    {/each}
                </select>
            </div>

            <!-- Wagenreihungs-Modus (nur beim Zuganzeiger aktiv) -->
            {#if displayConfigStore.layoutType === 'zuganzeiger'}
                <div class="toolbar-control-group feature-control-group" title="Wagenreihungs-Anzeige wählen">
                    <span class="toolbar-label">
                        <ZimIcon name="train_fast" size={14} />
                        <span class="label-text">WR:</span>
                    </span>
                    
                    <!-- Desktop: Segment-Buttons -->
                    <div class="segment-switch-compact feature-segment-desktop" role="group" aria-label="Wagenreihungs-Anzeigemodus">
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'wagennummern'}
                            onclick={() => handleFeatureChange('wagennummern')}
                            title="Wagennummern anzeigen"
                            aria-pressed={activeFeature === 'wagennummern'}
                        >
                            Nummern
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'ausstattung'}
                            onclick={() => handleFeatureChange('ausstattung')}
                            title="Ausstattungs-Piktogramme anzeigen"
                            aria-pressed={activeFeature === 'ausstattung'}
                        >
                            Icons
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'klasse'}
                            onclick={() => handleFeatureChange('klasse')}
                            title="Wagenklassen anzeigen"
                            aria-pressed={activeFeature === 'klasse'}
                        >
                            Klasse
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'rotierend'}
                            onclick={() => handleFeatureChange('rotierend')}
                            title="Automatisch rotieren"
                            aria-pressed={activeFeature === 'rotierend'}
                        >
                            Rotierend
                        </button>
                    </div>

                    <!-- Mobile: Kompaktes Dropdown -->
                    <div class="feature-select-mobile">
                        <select 
                            class="toolbar-select wr-select" 
                            value={activeFeature}
                            onchange={(e) => handleFeatureChange(e.currentTarget.value)}
                            aria-label="Wagenreihungs-Modus wählen"
                        >
                            <option value="wagennummern">WR: Nummern</option>
                            <option value="ausstattung">WR: Icons</option>
                            <option value="klasse">WR: Klasse</option>
                            <option value="rotierend">WR: Rotierend</option>
                        </select>
                    </div>
                </div>
            {/if}

            <!-- Paginierung für Anschlusstafeln (Seiten blättern) -->
            {#if isAnschlusstafelLayout}
                <div class="toolbar-control-group paging-control-group" title="Seiten blättern (Pfeiltasten Links / Rechts)">
                    <span class="toolbar-label">
                        <ZimIcon name="board" size={14} />
                        <span class="label-text">Seite:</span>
                    </span>
                    
                    <div class="segment-switch-compact paging-segment" role="group" aria-label="Seiten-Navigation">
                        <button 
                            type="button" 
                            class="segment-compact-btn paging-btn" 
                            disabled={displayConfigStore.totalDeparturePages <= 1}
                            onclick={() => {
                                displayConfigStore.prevDeparturePage();
                                trainDisplay.updateAll();
                            }}
                            title="Vorherige Seite (Pfeil links)"
                            aria-label="Vorherige Seite"
                        >
                            <ZimIcon name="chevron_left" size={13} />
                        </button>
                        
                        <span class="paging-counter-text" aria-live="polite">
                            {displayConfigStore.departurePageIndex + 1} / {displayConfigStore.totalDeparturePages}
                        </span>

                        <button 
                            type="button" 
                            class="segment-compact-btn paging-btn" 
                            disabled={displayConfigStore.totalDeparturePages <= 1}
                            onclick={() => {
                                displayConfigStore.nextDeparturePage();
                                trainDisplay.updateAll();
                            }}
                            title="Nächste Seite (Pfeil rechts)"
                            aria-label="Nächste Seite"
                        >
                            <ZimIcon name="chevron_right" size={13} />
                        </button>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Rechter Bereich: Display-Ansicht & Schnelleinstieg -->
        <div class="display-toolbar-actions">
            <!-- Status-Tag bei Pop-Out Monitor -->
            {#if targetScreen}
                <span class="target-screen-tag">Monitor {targetScreen}</span>
            {/if}

            <!-- Fit / Scroll Toggle -->
            <button 
                type="button" 
                class="display-toolbar-btn"
                class:active-scale={displayScaleMode === 'scroll'}
                onclick={onToggleScaleMode}
                title={displayScaleMode === 'fit' ? 'Zur scrollbaren Detailansicht (1:1) wechseln (Cmd+1)' : 'An Bildschirmbreite anpassen (Fit) (Cmd+0)'}
                aria-label="Display-Skalierung umschalten"
                aria-pressed={displayScaleMode === 'scroll'}
            >
                <ZimIcon name={displayScaleMode === 'fit' ? 'zoom_scroll' : 'zoom_fit'} size={14} />
                <span>{displayScaleMode === 'fit' ? 'Fit' : '1:1'}</span>
            </button>
        </div>
    </div>
</div>

<style>
    .display-toolbar-wrapper {
        width: 100%;
        background: var(--bg-card);
        border-bottom: 1px solid var(--border);
        border-top: 1px solid var(--border);
        box-sizing: border-box;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    .display-toolbar-wrapper.reduce-transparency {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }

    .display-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        max-width: 1600px;
        margin: 0 auto;
        padding: 6px 16px;
        box-sizing: border-box;
    }

    .display-toolbar-direct-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }

    .toolbar-control-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .toolbar-label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 600;
        user-select: none;
        white-space: nowrap;
    }

    .toolbar-select {
        background: var(--bg-input);
        color: var(--text-main);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 8px 12px;
        font-size: 0.85rem;
        cursor: pointer;
        outline: none;
        transition: border-color 0.2s ease;
        max-width: 220px;
        min-height: 44px;
    }

    .toolbar-select:focus,
    .toolbar-select:hover {
        border-color: var(--accent);
    }

    .toolbar-select:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
    }

    .segment-switch-compact {
        display: inline-flex;
        background: var(--bg-input);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 4px;
        gap: 4px;
    }

    .segment-compact-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 8px 14px;
        font-size: 0.82rem;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
        min-height: 44px;
        min-width: 44px;
    }

    .segment-compact-btn:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.05);
    }

    .segment-compact-btn.active {
        background: var(--accent);
        color: #fff;
        font-weight: 600;
    }

    .segment-compact-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
    }

    .segment-compact-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .paging-counter-text {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-main);
        padding: 0 8px;
        white-space: nowrap;
        user-select: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 48px;
    }

    .display-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .display-toolbar-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--bg-input);
        color: var(--text-muted);
        border: 1px solid var(--border);
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        font-size: 0.82rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
        white-space: nowrap;
        min-height: 44px;
        min-width: 44px;
    }

    .display-toolbar-btn:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .display-toolbar-btn.active-scale {
        background: rgba(226, 0, 26, 0.2);
        border-color: var(--accent);
        color: #fff;
    }

    .display-toolbar-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
    }

    .target-screen-tag {
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--accent-status);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .feature-select-mobile {
        display: none;
    }

    @media (max-width: 900px) {
        .feature-segment-desktop {
            display: none !important;
        }
        .feature-select-mobile {
            display: inline-flex !important;
        }
    }

    @media (max-width: 640px) {
        .display-toolbar {
            padding: 5px 10px;
            gap: 6px;
        }
        .display-toolbar-direct-controls {
            gap: 6px;
        }
        .toolbar-select {
            max-width: 140px;
            font-size: 0.8rem;
            padding: 6px 8px;
        }
        .wr-select {
            max-width: 110px;
        }
        .label-text {
            display: none;
        }
        .display-toolbar-btn {
            min-height: 44px;
            min-width: 44px;
            padding: 8px;
            justify-content: center;
        }
        .segment-compact-btn {
            min-height: 44px;
            min-width: 44px;
            padding: 8px;
        }
    }

    @media (max-width: 400px) {
        .toolbar-select {
            max-width: 115px;
            font-size: 0.76rem;
        }
        .wr-select {
            max-width: 95px;
            font-size: 0.76rem;
        }
    }
</style>
