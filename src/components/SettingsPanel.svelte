<!-- src/components/SettingsPanel.svelte -->
<script>
    import { journeyStore } from '../js/core/state/stores.js';
    import { irisPollingService, irisConfig } from '../js/core/services/irisPollingService.svelte.js';
    import { uiState, selectTab, finishTabEnter, TAB_ORDER } from '../js/core/state/uiState.svelte.js';
    import { toastStore } from '../js/core/state/toastStore.svelte.js';
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

    // Status für manuellen IRIS-Schnellabruf
    let isFetchingIris = $state(false);

    /**
     * Tastaturnavigation der Tab-Leiste (Pfeiltasten, Home/End).
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    function onTablistKeydown(e) {
        const navKeys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
        if (!navKeys.includes(e.key)) return;
        e.preventDefault();
        let idx = TAB_ORDER.indexOf(uiState.activeTab);
        if (idx === -1) idx = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            idx = (idx + 1) % TAB_ORDER.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            idx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
        } else if (e.key === 'Home') {
            idx = 0;
        } else if (e.key === 'End') {
            idx = TAB_ORDER.length - 1;
        }
        const next = TAB_ORDER[idx];
        selectTab(next);
        const el = document.getElementById(`tab-${next}`);
        if (el) el.focus();
    }

    /**
     * Entfernt den Einblend-Marker eines Tab-Panels, sobald dessen Animation endet.
     * @param {string} tab - Tab-ID
     * @param {AnimationEvent} e - Animationsevent des Panels
     * @returns {void}
     */
    function onPaneAnimationEnd(tab, e) {
        if (e.target === e.currentTarget) {
            finishTabEnter(tab);
        }
    }

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
            toastStore.warning('Bitte zuerst eine Station auswählen!');
            selectTab('station');
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
            toastStore.error('Fehler beim Abrufen der IRIS-Daten.');
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
                class:active={uiState.activeTab === 'fahrten'}
                onclick={() => selectTab('fahrten')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-fahrten"
                aria-controls="panel-fahrten"
                aria-selected={uiState.activeTab === 'fahrten'}
                tabindex={uiState.activeTab === 'fahrten' ? 0 : -1}
            >
                <ZimIcon name="train" size={16} />
                <span>Fahrten ({journeyStore.journeys.length})</span>
            </button>

            <!-- Tab 2: Bahnhof & Zeit -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'station'}
                onclick={() => selectTab('station')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-station"
                aria-controls="panel-station"
                aria-selected={uiState.activeTab === 'station'}
                tabindex={uiState.activeTab === 'station' ? 0 : -1}
            >
                <ZimIcon name="station" size={16} />
                <span>Bahnhof & Zeit</span>
            </button>

            <!-- Tab 3: Live-Daten -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'livedata'}
                onclick={() => selectTab('livedata')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-livedata"
                aria-controls="panel-livedata"
                aria-selected={uiState.activeTab === 'livedata'}
                tabindex={uiState.activeTab === 'livedata' ? 0 : -1}
            >
                <ZimIcon name="api" size={16} />
                <span>Live-Daten</span>
            </button>

            <!-- Tab 4: Ansagen & Audio -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'audio'}
                onclick={() => selectTab('audio')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-audio"
                aria-controls="panel-audio"
                aria-selected={uiState.activeTab === 'audio'}
                tabindex={uiState.activeTab === 'audio' ? 0 : -1}
            >
                <ZimIcon name="volume_high" size={16} />
                <span>Ansagen</span>
            </button>

            <!-- Tab 5: Anzeige & System -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'system'}
                onclick={() => selectTab('system')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-system"
                aria-controls="panel-system"
                aria-selected={uiState.activeTab === 'system'}
                tabindex={uiState.activeTab === 'system' ? 0 : -1}
            >
                <ZimIcon name="settings" size={16} />
                <span>Anzeige & System</span>
            </button>
        </div>
    </div>

    <!-- Aktions-Buttons der Fahrten-Liste (Snippet für den Header der CollapsibleSection) -->
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

    <!-- Tab-Inhalte: Panels werden beim ersten Öffnen gemountet und danach persistent im DOM
         gehalten (inaktive Panels via [hidden] ausgeblendet). Der Wechsel ist dadurch ein
         reiner Attributwechsel ohne DOM-Neuaufbau - der Inhalt ist sofort sichtbar. -->
    <div class="dashboard-content">
        <!-- Tab 1: Fahrten (Züge) -->
        {#if uiState.mountedTabs.includes('fahrten')}
            <div
                class="tab-pane"
                class:entering={uiState.enteringTabs.includes('fahrten')}
                id="panel-fahrten"
                role="tabpanel"
                aria-labelledby="tab-fahrten"
                tabindex="0"
                hidden={uiState.activeTab !== 'fahrten'}
                onanimationend={(e) => onPaneAnimationEnd('fahrten', e)}
            >
                <div id="journey_list_frame">
                    <CollapsibleSection title="Fahrten" isOpen={true} isFrame={true} headerActions={journeyActions}>
                        <div id="journey_list" class="journey-list">
                            <JourneyList />
                        </div>
                    </CollapsibleSection>
                </div>
            </div>
        {/if}

        <!-- Tab 2: Bahnhof & Zeit -->
        {#if uiState.mountedTabs.includes('station')}
            <div
                class="tab-pane"
                class:entering={uiState.enteringTabs.includes('station')}
                id="panel-station"
                role="tabpanel"
                aria-labelledby="tab-station"
                tabindex="0"
                hidden={uiState.activeTab !== 'station'}
                onanimationend={(e) => onPaneAnimationEnd('station', e)}
            >
                <SettingsStationTime />
            </div>
        {/if}

        <!-- Tab 3: Live-Daten (IRIS & DB Navigator) -->
        {#if uiState.mountedTabs.includes('livedata')}
            <div
                class="tab-pane"
                class:entering={uiState.enteringTabs.includes('livedata')}
                id="panel-livedata"
                role="tabpanel"
                aria-labelledby="tab-livedata"
                tabindex="0"
                hidden={uiState.activeTab !== 'livedata'}
                onanimationend={(e) => onPaneAnimationEnd('livedata', e)}
            >
                <SettingsLiveData />
            </div>
        {/if}

        <!-- Tab 4: Ansagen & Audio -->
        {#if uiState.mountedTabs.includes('audio')}
            <div
                class="tab-pane"
                class:entering={uiState.enteringTabs.includes('audio')}
                id="panel-audio"
                role="tabpanel"
                aria-labelledby="tab-audio"
                tabindex="0"
                hidden={uiState.activeTab !== 'audio'}
                onanimationend={(e) => onPaneAnimationEnd('audio', e)}
            >
                <SettingsAudio />
            </div>
        {/if}

        <!-- Tab 5: Anzeige & System -->
        {#if uiState.mountedTabs.includes('system')}
            <div
                class="tab-pane"
                class:entering={uiState.enteringTabs.includes('system')}
                id="panel-system"
                role="tabpanel"
                aria-labelledby="tab-system"
                tabindex="0"
                hidden={uiState.activeTab !== 'system'}
                onanimationend={(e) => onPaneAnimationEnd('system', e)}
            >
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
        background: var(--accent);
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(226, 0, 26, 0.35);
    }

    .dashboard-content {
        width: 100%;
    }

    .tab-pane {
        width: 100%;
    }

    /* Inaktive Panels bleiben im DOM, werden aber vollständig ausgeblendet */
    .tab-pane[hidden] {
        display: none;
    }

    /* Einblend-Animation nur beim ersten Öffnen eines Panels.
       Startet bewusst nicht bei opacity 0, damit der Inhalt nie als leerer
       Bereich erscheint - der Panel-Aufbau blockiert sonst die Animations-Frames. */
    .tab-pane.entering {
        animation: tabPaneEnter 0.12s ease-out;
    }

    @keyframes tabPaneEnter {
        from {
            opacity: 0.4;
            transform: translateY(2px);
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
