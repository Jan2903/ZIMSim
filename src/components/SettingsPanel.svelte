<!-- src/components/SettingsPanel.svelte -->
<script>
    import { onMount } from 'svelte';
    import { journeyStore } from '../js/core/state/stores.js';
    import { irisPollingService, irisConfig } from '../js/core/services/irisPollingService.svelte.js';
    import { uiState, selectTab, finishTabEnter, TAB_ORDER } from '../js/core/state/uiState.svelte.js';
    import { toastStore } from '../js/core/state/toastStore.svelte.js';
    import JourneyList from './JourneyList.svelte';
    import CollapsibleSection from './CollapsibleSection.svelte';
    import ZimIcon from './ZimIcon.svelte';
    import { watchReducedTransparency } from '../js/core/utils/systemPreferences.js';

    // Fachspezifische Einstellungs-Unterkomponenten
    import SettingsStationTime from './settings/SettingsStationTime.svelte';
    import SettingsLiveData from './settings/SettingsLiveData.svelte';
    import SettingsAudio from './settings/SettingsAudio.svelte';
    import SettingsDisplay from './settings/SettingsDisplay.svelte';
    import SettingsSystem from './settings/SettingsSystem.svelte';
    
    /** @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente für Dialog-Aufrufe
     */
    let { modalsComp } = $props();

    // Status für manuellen IRIS-Schnellabruf
    let isFetchingIris = $state(false);

    // Reduce Transparency State für CSS-Fallback
    let reduceTransparency = $state(false);

    // Ausrichtung der Tab-Leiste: ab 1100 px vertikale Spalte, darunter horizontal.
    // Wird per matchMedia gepflegt, damit aria-orientation zur Darstellung passt.
    let isVerticalNav = $state(false);

    // Referenz auf die Inhaltsfläche für das Nachscrollen beim Tab-Wechsel
    let contentEl = $state(null);

    /**
     * Aktiviert einen Tab und holt dessen Inhalt in den sichtbaren Bereich, wenn die
     * Inhaltsfläche durch vorheriges Scrollen oberhalb des Viewports liegt.
     * @param {string} tab - Tab-ID
     * @returns {void}
     */
    function handleTabSelect(tab) {
        selectTab(tab);
        if (!contentEl) return;
        if (contentEl.getBoundingClientRect().top < 0) {
            contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

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
        handleTabSelect(next);
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

    onMount(() => {
        // Ausrichtung der Navigationsleiste an den Desktop-Breakpoint koppeln
        const mediaQuery = window.matchMedia('(min-width: 1100px)');
        const updateOrientation = () => {
            isVerticalNav = mediaQuery.matches;
        };
        updateOrientation();
        mediaQuery.addEventListener('change', updateOrientation);
        return () => mediaQuery.removeEventListener('change', updateOrientation);
    });

    onMount(() => {
        // Systemeinstellung "Transparenz reduzieren" beobachten (CSS-Media-Query)
        return watchReducedTransparency((value) => {
            reduceTransparency = value;
        });
    });
</script>

<div class="settings-container" class:reduce-transparency={reduceTransparency}>
    <!-- Einheitliche 6-Tab Hauptnavigation (Desktop & Mobile) -->
    <div class="dashboard-nav-wrapper">
        <div class="dashboard-tabs" role="tablist" aria-label="Einstellungs-Bereiche" aria-orientation={isVerticalNav ? 'vertical' : 'horizontal'}>
            <!-- Tab 1: Fahrten -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'fahrten'}
                onclick={() => handleTabSelect('fahrten')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-fahrten"
                aria-controls="panel-fahrten"
                aria-selected={uiState.activeTab === 'fahrten'}
                tabindex={uiState.activeTab === 'fahrten' ? 0 : -1}
            >
                <ZimIcon name="train" size={16} />
                <span class="tab-label-full">Fahrten ({journeyStore.journeys.length})</span>
                <span class="tab-label-short">Fahrten</span>
            </button>

            <!-- Tab 2: Bahnhof & Zeit -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'station'}
                onclick={() => handleTabSelect('station')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-station"
                aria-controls="panel-station"
                aria-selected={uiState.activeTab === 'station'}
                tabindex={uiState.activeTab === 'station' ? 0 : -1}
            >
                <ZimIcon name="station" size={16} />
                <span class="tab-label-full">Bahnhof & Zeit</span>
                <span class="tab-label-short">Bahnhof</span>
            </button>

            <!-- Tab 3: Live-Daten -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'livedata'}
                onclick={() => handleTabSelect('livedata')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-livedata"
                aria-controls="panel-livedata"
                aria-selected={uiState.activeTab === 'livedata'}
                tabindex={uiState.activeTab === 'livedata' ? 0 : -1}
            >
                <ZimIcon name="api" size={16} />
                <span class="tab-label-full">Live-Daten</span>
                <span class="tab-label-short">Live</span>
            </button>

            <!-- Tab 4: Ansagen & Audio -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'audio'}
                onclick={() => handleTabSelect('audio')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-audio"
                aria-controls="panel-audio"
                aria-selected={uiState.activeTab === 'audio'}
                tabindex={uiState.activeTab === 'audio' ? 0 : -1}
            >
                <ZimIcon name="volume_high" size={16} />
                <span class="tab-label-full">Ansagen</span>
                <span class="tab-label-short">Ansagen</span>
            </button>

            <!-- Tab 5: Anzeige -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'display'}
                onclick={() => handleTabSelect('display')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-display"
                aria-controls="panel-display"
                aria-selected={uiState.activeTab === 'display'}
                tabindex={uiState.activeTab === 'display' ? 0 : -1}
            >
                <ZimIcon name="board" size={16} />
                <span class="tab-label-full">Anzeige</span>
                <span class="tab-label-short">Anzeige</span>
            </button>

            <!-- Tab 6: System -->
            <button 
                type="button" 
                class="tab-btn" 
                class:active={uiState.activeTab === 'system'}
                onclick={() => handleTabSelect('system')}
                onkeydown={onTablistKeydown}
                role="tab"
                id="tab-system"
                aria-controls="panel-system"
                aria-selected={uiState.activeTab === 'system'}
                tabindex={uiState.activeTab === 'system' ? 0 : -1}
            >
                <ZimIcon name="settings" size={16} />
                <span class="tab-label-full">System</span>
                <span class="tab-label-short">System</span>
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
         gehalten (inaktive Panels über das hidden-Attribut ausgeblendet). Der Wechsel ist dadurch
         ein reiner Attributwechsel ohne DOM-Neuaufbau - der Inhalt ist sofort sichtbar. -->
    <div class="dashboard-content" bind:this={contentEl}>
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

        <!-- Tab 3: Live-Daten (IRIS, DB Navigator & DBweb) -->
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

        <!-- Tab 5: Anzeige -->
        {#if uiState.mountedTabs.includes('display')}
            <div
                class="tab-pane"
                class:entering={uiState.enteringTabs.includes('display')}
                id="panel-display"
                role="tabpanel"
                aria-labelledby="tab-display"
                tabindex="0"
                hidden={uiState.activeTab !== 'display'}
                onanimationend={(e) => onPaneAnimationEnd('display', e)}
            >
                <SettingsDisplay />
            </div>
        {/if}

        <!-- Tab 6: System -->
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
                <SettingsSystem {modalsComp} />
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
        /* Ab 1100 px: feste Navigationsspalte links, Inhalt rechts */
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
        column-gap: 24px;
        align-items: start;
    }

    .settings-container.reduce-transparency .dashboard-tabs {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }

    /* Navigationsspalte bleibt beim Scrollen der Einstellungen sichtbar,
       endet aber mit dem Settings-Bereich (kein Overlap mit dem Footer). */
    .dashboard-nav-wrapper {
        position: sticky;
        top: 12px;
        align-self: start;
        max-height: calc(100vh - 24px);
        overflow-y: auto;
    }

    .dashboard-tabs {
        display: flex;
        flex-direction: column;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 6px;
        gap: 2px;
        box-shadow: var(--shadow-card);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    .tab-btn {
        flex: initial;
        width: 100%;
        min-width: 0;
        min-height: 44px;
        padding: 10px 12px;
        background: transparent;
        color: var(--text-muted);
        border: none;
        border-left: 3px solid transparent;
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        font-size: 0.88rem;
        font-weight: 500;
        text-align: left;
        transition: all 0.2s ease;
        white-space: nowrap;
        user-select: none;
    }

    .tab-btn:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.05);
    }

    /* Aktiver Eintrag: Accent-Balken links + getönter Hintergrund */
    .tab-btn.active {
        background: rgba(226, 0, 26, 0.14);
        color: var(--text-main);
        border-left-color: var(--accent);
        font-weight: 600;
    }

    .tab-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
    }

    /* Kurzlabel wird nur in der kompakten Mobil-Leiste eingeblendet */
    .tab-label-short {
        display: none;
    }

    .dashboard-content {
        width: 100%;
        min-width: 0;
        scroll-margin-top: 12px;
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

    /* 768–1099 px: horizontale Leiste mit Icon + vollem Label */
    @media (max-width: 1099px) {
        .settings-container {
            display: block;
        }
        .dashboard-nav-wrapper {
            position: sticky;
            top: 0;
            z-index: var(--z-sticky-nav);
            max-height: none;
            overflow: visible;
            margin-bottom: 20px;
            padding-block: 6px;
            background: var(--bg-page);
        }
        .dashboard-tabs {
            flex-direction: row;
            gap: 4px;
            padding: 4px;
            overflow: visible;
        }
        .tab-btn {
            flex: 1;
            width: auto;
            justify-content: center;
            gap: 6px;
            padding: 8px 6px;
            font-size: 0.78rem;
            border-left: none;
            border-top: 2px solid transparent;
        }
        .tab-btn.active {
            border-top-color: var(--accent);
        }
    }

    /* < 768 px: kompakte Leiste, Icon über Kurzlabel, 6 gleich breite Spalten */
    @media (max-width: 768px) {
        .settings-container {
            padding: 0 10px;
            margin: 12px auto 30px auto;
        }
        .dashboard-nav-wrapper {
            /* Full-bleed, damit beim Scrollen nichts an den Rändern vorbeischeint */
            margin-inline: -10px;
            padding-inline: 10px;
            padding-block: 6px;
            margin-bottom: 12px;
        }
        .dashboard-tabs {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 2px;
        }
        .tab-btn {
            flex-direction: column;
            justify-content: center;
            gap: 3px;
            padding: 6px 2px;
            min-height: 52px;
            font-size: 0.62rem;
            line-height: 1.1;
        }
        .tab-label-full {
            display: none;
        }
        .tab-label-short {
            display: inline;
        }
        .dashboard-content {
            scroll-margin-top: 76px;
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
