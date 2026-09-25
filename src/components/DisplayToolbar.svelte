<!-- src/components/DisplayToolbar.svelte -->
<script>
    import ZimIcon from './ZimIcon.svelte';
    import { displayConfigStore } from '../js/displays/core/displayConfigStore.svelte.js';
    import { LAYOUT_TYPES } from '../js/displays/core/displayLayoutService.js';
    import { trainDisplay } from '../js/core/state/stores.js';
    import { uiState } from '../js/core/state/uiState.svelte.js';

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
        uiState.activeTab = 'system';
        const el = document.querySelector('.settings-container');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
</script>

<div class="display-toolbar-wrapper">
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
                    <div class="segment-switch-compact feature-segment-desktop">
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'wagennummern'}
                            onclick={() => handleFeatureChange('wagennummern')}
                            title="Wagennummern anzeigen"
                        >
                            Nummern
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'ausstattung'}
                            onclick={() => handleFeatureChange('ausstattung')}
                            title="Ausstattungs-Piktogramme anzeigen"
                        >
                            Icons
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'klasse'}
                            onclick={() => handleFeatureChange('klasse')}
                            title="Wagenklassen anzeigen"
                        >
                            Klasse
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'rotierend'}
                            onclick={() => handleFeatureChange('rotierend')}
                            title="Automatisch rotieren"
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
                onclick={onToggleScaleMode}
                title={displayScaleMode === 'fit' ? 'Zur scrollbaren Detailansicht (1:1) wechseln' : 'An Bildschirmbreite anpassen (Fit)'}
                aria-label="Display-Skalierung umschalten"
            >
                <ZimIcon name={displayScaleMode === 'fit' ? 'zoom_scroll' : 'zoom_fit'} size={14} />
                <span>{displayScaleMode === 'fit' ? 'Fit' : '1:1'}</span>
            </button>

            <!-- Schnelleinstieg: Hardware & Gehäuse in Einstellungen anpassen -->
            <button 
                type="button" 
                class="display-toolbar-btn btn-settings-shortcut"
                onclick={openDisplaySettings}
                title="Hardware-Profil & Gehäuse-Optionen in den Einstellungen anpassen"
                aria-label="Hardware und Gehäuse konfigurieren"
            >
                <ZimIcon name="settings" size={14} />
                <span class="shortcut-text">Hardware...</span>
            </button>
        </div>
    </div>
</div>

<style>
    .display-toolbar-wrapper {
        width: 100%;
        background: #11141a;
        border-bottom: 1px solid var(--border, #2d3748);
        border-top: 1px solid var(--border, #2d3748);
        box-sizing: border-box;
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
        color: var(--text-muted, #94a3b8);
        font-weight: 600;
        user-select: none;
        white-space: nowrap;
    }

    .toolbar-select {
        background: var(--bg-input, #1e293b);
        color: var(--text-main, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 4px 8px;
        font-size: 0.82rem;
        cursor: pointer;
        outline: none;
        transition: border-color 0.2s ease;
        max-width: 220px;
    }

    .toolbar-select:focus,
    .toolbar-select:hover {
        border-color: var(--accent, #3b82f6);
    }

    .segment-switch-compact {
        display: inline-flex;
        background: var(--bg-input, #1e293b);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 2px;
        gap: 2px;
    }

    .segment-compact-btn {
        background: transparent;
        border: none;
        color: var(--text-muted, #94a3b8);
        padding: 3px 8px;
        font-size: 0.78rem;
        font-weight: 500;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
    }

    .segment-compact-btn:hover {
        color: var(--text-main, #f8fafc);
        background: rgba(255, 255, 255, 0.05);
    }

    .segment-compact-btn.active {
        background: var(--accent, #3b82f6);
        color: #fff;
        font-weight: 600;
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
        background: var(--bg-input, #1e293b);
        color: var(--text-muted, #94a3b8);
        border: 1px solid var(--border, #334155);
        padding: 5px 10px;
        border-radius: var(--radius-sm, 4px);
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
        white-space: nowrap;
    }

    .display-toolbar-btn:hover {
        color: var(--text-main, #f8fafc);
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .target-screen-tag {
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--accent, #3b82f6);
        color: #fff;
        padding: 2px 6px;
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
            padding: 4px 6px;
        }
        .wr-select {
            max-width: 110px;
        }
        .label-text {
            display: none;
        }
        .shortcut-text {
            display: none;
        }
        .display-toolbar-btn {
            min-height: 34px;
            padding: 5px 8px;
            justify-content: center;
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
