<!-- src/components/SettingsPanel.svelte -->
<script>
    import { journeyStore } from '../js/core/state/stores.js';
    import { irisPollingService, irisConfig } from '../js/core/services/irisPollingService.svelte.js';
    import JourneyList from './JourneyList.svelte';
    import CollapsibleSection from './CollapsibleSection.svelte';
    import ZimIcon from './ZimIcon.svelte';

    // Fachspezifische Einstellungs-Unterkomponenten
    import SettingsStationTime from './settings/SettingsStationTime.svelte';
    import SettingsLiveData from './settings/SettingsLiveData.svelte';
    import SettingsAudio from './settings/SettingsAudio.svelte';
    import SettingsDisplaySystem from './settings/SettingsDisplaySystem.svelte';
    
    /**
     * @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente für Dialog-Aufrufe
     */
    let { modalsComp } = $props();

    // Aktiver Tab: 'fahrten' | 'station' | 'livedata' | 'audio' | 'system'
    let activeTab = $state('fahrten');

    // Status für manuellen IRIS-Schnellabruf
    let isFetchingIris = $state(false);

    /**
     * Fügt eine neue manuelle Fahrt zur Liste hinzu.
     * @returns {void}
     */
    function addManualJourney() {
        journeyStore.addJourney();
    }

    /**
     * Führt eine sofortige IRIS-Aktualisierung aus.
     * @returns {Promise<void>}
     */
    async function fetchIrisData() {
        if (!journeyStore.stationContext.stationId) {
            alert('Bitte zuerst eine Station auswählen!');
            activeTab = 'station';
            return;
        }
        isFetchingIris = true;
        try {
            if (irisConfig.autoUpdateInterval > 0) {
                irisPollingService.start();
            } else {
                await irisPollingService.pollRealtime(true);
            }
        } catch (e) {
            console.error('[SettingsPanel] IRIS-Abruf fehlgeschlagen:', e);
            alert('Fehler beim Abrufen der IRIS-Daten.');
        } finally {
            isFetchingIris = false;
        }
    }
</script>

<div class="settings-container">
    <!-- Einheitliche 5-Tab Hauptnavigation (Desktop & Mobile) -->
    <div class="dashboard-nav-wrapper">
        <div class="dashboard-tabs" role="tablist" aria-label="Einstellungs-Bereiche">
            <!-- Tab 1: Fahrten -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={activeTab === 'fahrten'}
                onclick={() => activeTab = 'fahrten'}
                role="tab"
                aria-selected={activeTab === 'fahrten'}
            >
                <ZimIcon name="train" size={16} />
                <span>Fahrten ({journeyStore.journeys.length})</span>
            </button>

            <!-- Tab 2: Bahnhof & Zeit -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={activeTab === 'station'}
                onclick={() => activeTab = 'station'}
                role="tab"
                aria-selected={activeTab === 'station'}
            >
                <ZimIcon name="station" size={16} />
                <span>Bahnhof & Zeit</span>
            </button>

            <!-- Tab 3: Live-Daten -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={activeTab === 'livedata'}
                onclick={() => activeTab = 'livedata'}
                role="tab"
                aria-selected={activeTab === 'livedata'}
            >
                <ZimIcon name="api" size={16} />
                <span>Live-Daten</span>
            </button>

            <!-- Tab 4: Ansagen & Audio -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={activeTab === 'audio'}
                onclick={() => activeTab = 'audio'}
                role="tab"
                aria-selected={activeTab === 'audio'}
            >
                <ZimIcon name="volume_high" size={16} />
                <span>Ansagen</span>
            </button>

            <!-- Tab 5: Anzeige & System -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={activeTab === 'system'}
                onclick={() => activeTab = 'system'}
                role="tab"
                aria-selected={activeTab === 'system'}
            >
                <ZimIcon name="settings" size={16} />
                <span>Anzeige & System</span>
            </button>
        </div>
    </div>

    <!-- Tab-Inhalte -->
    <div class="dashboard-content">
        <!-- Tab 1: Fahrten (Züge) -->
        {#if activeTab === 'fahrten'}
            <div class="tab-pane">
                {#snippet journeyActions()}
                    <button 
                        type="button"
                        class="btn-secondary btn-sm" 
                        onclick={fetchIrisData} 
                        disabled={isFetchingIris || irisPollingService.isFetching}
                        title="Live-Daten abrufen"
                        style="display: inline-flex; align-items: center; gap: 6px;"
                    >
                        <ZimIcon name="api" size={14} />
                        <span class="btn-text-full">{isFetchingIris || irisPollingService.isFetching ? 'Lädt...' : 'Live-Daten abrufen'}</span>
                        <span class="btn-text-short">{isFetchingIris || irisPollingService.isFetching ? 'Lädt...' : 'Live-Daten'}</span>
                    </button>
                    <button 
                        type="button"
                        id="add_journey_btn" 
                        class="btn-primary btn-sm" 
                        onclick={addManualJourney} 
                        title="Fahrt hinzufügen"
                        style="display: inline-flex; align-items: center; gap: 6px;"
                    >
                        <ZimIcon name="plus" size={14} />
                        <span class="btn-text-full">Fahrt hinzufügen</span>
                        <span class="btn-text-short">Fahrt +</span>
                    </button>
                {/snippet}

                <div id="journey_list_frame">
                    <CollapsibleSection title="Fahrten" isOpen={true} isFrame={true} headerActions={journeyActions}>
                        <div id="journey_list" class="journey-list">
                            <JourneyList />
                        </div>
                    </CollapsibleSection>
                </div>
            </div>

        <!-- Tab 2: Bahnhof & Zeit -->
        {:else if activeTab === 'station'}
            <div class="tab-pane">
                <SettingsStationTime />
            </div>

        <!-- Tab 3: Live-Daten (IRIS & DB Navigator) -->
        {:else if activeTab === 'livedata'}
            <div class="tab-pane">
                <SettingsLiveData {modalsComp} />
            </div>

        <!-- Tab 4: Ansagen & Audio -->
        {:else if activeTab === 'audio'}
            <div class="tab-pane">
                <SettingsAudio />
            </div>

        <!-- Tab 5: Anzeige & System -->
        {:else if activeTab === 'system'}
            <div class="tab-pane">
                <SettingsDisplaySystem {modalsComp} />
            </div>
        {/if}
    </div>
</div>

<style>
    .settings-container {
        max-width: 1600px;
        margin: 20px auto 40px auto;
        padding: 0 20px;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, sans-serif;
    }

    .dashboard-nav-wrapper {
        margin-bottom: 20px;
    }

    .dashboard-tabs {
        display: flex;
        background: var(--bg-card, #1e293b);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-md, 8px);
        padding: 4px;
        gap: 6px;
        overflow-x: auto;
        box-shadow: var(--shadow-card, 0 4px 12px rgba(0, 0, 0, 0.2));
    }

    .tab-btn {
        flex: 1;
        min-width: 140px;
        min-height: 42px;
        padding: 8px 14px;
        background: transparent;
        color: var(--text-muted, #94a3b8);
        border: none;
        border-radius: var(--radius-sm, 6px);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 0.88rem;
        font-weight: 500;
        transition: all 0.2s ease;
        white-space: nowrap;
        user-select: none;
    }

    .tab-btn:hover {
        color: var(--text-main, #f8fafc);
        background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
        background: var(--accent, #3b82f6);
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
    }

    .dashboard-content {
        width: 100%;
    }

    .tab-pane {
        width: 100%;
        animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .btn-text-short {
        display: none;
    }

    @media (max-width: 768px) {
        .settings-container {
            padding: 0 10px;
            margin: 12px auto 30px auto;
        }
        .dashboard-nav-wrapper {
            position: relative;
        }
        .dashboard-tabs {
            justify-content: flex-start;
            scrollbar-width: thin;
        }
        .tab-btn {
            min-width: 110px;
            font-size: 0.8rem;
            padding: 6px 10px;
        }
    }

    @media (max-width: 600px) {
        .btn-text-full {
            display: none;
        }
        .btn-text-short {
            display: inline;
        }
    }
</style>
