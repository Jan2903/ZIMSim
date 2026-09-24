<!-- src/components/settings/SettingsLiveData.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { irisPollingService, irisConfig } from '../../js/core/services/irisPollingService.svelte.js';
    import { isTauri, isGitHubPages } from '../../js/core/services/apiClient.js';
    import ZimIcon from '../ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente für den DB-Import
     */
    let { modalsComp = null } = $props();

    // Aktive Datenquelle: 'iris' | 'db_navigator' | 'manual'
    let selectedDataSource = $state('iris');

    // DB Navigator & bahn.de Konfiguration (UI-Vorbereitung für künftige Schnittstelle)
    let dbNavConfig = $state({
        queryType: 'departures', // 'departures' | 'arrivals' | 'both'
        fetchDetails: true,      // Details/Zuglauf pro Fahrt abrufen
        fetchFormation: true,    // Wagenreihung pro Fahrt abrufen
        includeNearby: false     // Nahverkehr / Ersatzverkehr einschließen
    });

    // Manuelle / erweiterte Stationssuche (für ÖPNV, Bus, Tram, Ausland)
    let extendedStationQuery = $state('');
    let isExtendedSearching = $state(false);

    // Lade-Status für manuelle IRIS-Abfrage
    let isFetchingIris = $state(false);

    /**
     * Führt eine sofortige Aktualisierung der IRIS-Daten aus.
     * @returns {Promise<void>}
     */
    async function triggerIrisFetch() {
        if (!journeyStore.stationContext.stationId) {
            alert('Bitte zuerst eine Station auswählen!');
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
            console.error('[SettingsLiveData] Fehler beim Abrufen der IRIS-Daten:', e);
            alert('Fehler beim Abrufen der IRIS-Daten.');
        } finally {
            isFetchingIris = false;
        }
    }

    /**
     * Vorbereitung für die erweiterte Haltestellensuche (DB Navigator / bahn.de Location API).
     * Sucht Stationen außerhalb des DB-Kernnetzes (U-Bahnen, Trams, Busse).
     * @returns {Promise<void>}
     */
    async function searchExtendedStations() {
        if (!extendedStationQuery.trim()) return;
        isExtendedSearching = true;

        try {
            // UI-Vorbereitung: Simulierter / vorbereiteter Hook für die künftige API
            console.log('[SettingsLiveData] Erweiterte Stationssuche vorbereitet für:', extendedStationQuery);
            if (!isTauri) {
                // Hinweis im Browser-Modus auf CORS-Restriktion
                console.warn('[SettingsLiveData] Lokale DB Navigator API benötigt lokalen Proxy oder Tauri-Build.');
            }
        } finally {
            setTimeout(() => {
                isExtendedSearching = false;
            }, 400);
        }
    }
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Datenquellen-Auswahl & Plattform-Status -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="api" size={18} />
            <h3>Datenquelle & Schnittstelle</h3>
        </div>
        <div class="card-body">
            <!-- Datenquellen-Segment -->
            <label class="field-label">Aktive Schnittstelle:</label>
            <div class="source-selector">
                <label class="source-card" class:active={selectedDataSource === 'iris'}>
                    <input type="radio" name="data_source" value="iris" bind:group={selectedDataSource}>
                    <div class="source-title">
                        <ZimIcon name="train" size={16} />
                        <strong>DB IRIS (Timetable API)</strong>
                    </div>
                    <div class="source-desc">
                        Offizielle Echtzeit-Fahrplandaten für DB Fern- und Regionalverkehr. Direkt im Browser und Desktop verfügbar.
                    </div>
                </label>

                <label class="source-card" class:active={selectedDataSource === 'db_navigator'}>
                    <input type="radio" name="data_source" value="db_navigator" bind:group={selectedDataSource}>
                    <div class="source-title">
                        <ZimIcon name="train_fast" size={16} />
                        <strong>DB Navigator / bahn.de API</strong>
                        <span class="badge-status">Neu / Vorbereitung</span>
                    </div>
                    <div class="source-desc">
                        Erweiterte Fahrplandetails, Zwischenhalte, Ankunft & Abfahrt kombiniert sowie Wagenreihung (Formationen).
                    </div>
                </label>

                <label class="source-card" class:active={selectedDataSource === 'manual'}>
                    <input type="radio" name="data_source" value="manual" bind:group={selectedDataSource}>
                    <div class="source-title">
                        <ZimIcon name="save" size={16} />
                        <strong>Manuell / Offline</strong>
                    </div>
                    <div class="source-desc">
                        Keine automatischen Netzwerkanfragen. Fahrten manuell anlegen oder per JSON-Datei laden.
                    </div>
                </label>
            </div>

            <!-- Plattform- und CORS-Status-Banner -->
            <div class="platform-status-box" class:tauri-mode={isTauri} class:web-mode={!isTauri}>
                <div class="status-indicator">
                    <span class="status-dot"></span>
                    <strong>{isTauri ? 'Tauri Desktop-App aktiv' : 'Web-Browser Modus'}</strong>
                </div>
                <div class="status-details">
                    {#if isTauri}
                        Native HTTP-Sockets aktiv. Keine CORS-Einschränkungen für externe APIs (IRIS und DB Navigator direkt nutzbar).
                    {:else if isGitHubPages}
                        Gehostet auf GitHub Pages. IRIS-API ist direkt verfügbar. DB Navigator erfordert die Desktop-App oder lokalen Build mit Proxy.
                    {:else}
                        Lokale Browser-Umgebung. IRIS ist direkt aktiv. Nicht-CORS-APIs (DB Navigator) erfordern lokalen Proxy oder Tauri.
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Spalte 2: Konfiguration der gewählten Datenquelle -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="settings" size={18} />
            <h3>
                {#if selectedDataSource === 'iris'}
                    DB IRIS Einstellungen
                {:else if selectedDataSource === 'db_navigator'}
                    DB Navigator / bahn.de Optionen
                {:else}
                    Manuelle Daten-Werkzeuge
                {/if}
            </h3>
        </div>
        <div class="card-body">
            {#if selectedDataSource === 'iris'}
                <!-- IRIS Polling & Zeitfenster -->
                <div class="form-row column-layout">
                    <label class="field-label">
                        Automatisches Polling (Intervall):
                        <select 
                            class="form-select" 
                            style="margin-top: 4px;"
                            bind:value={irisConfig.autoUpdateInterval} 
                            onchange={() => irisPollingService.restart()}
                        >
                            <option value={0}>Aus (Nur manueller Abruf)</option>
                            <option value={20}>Alle 20 Sekunden</option>
                            <option value={30}>Alle 30 Sekunden</option>
                            <option value={60}>Alle 60 Sekunden</option>
                        </select>
                    </label>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
                        <label class="field-label">
                            Zukunft (Std.):
                            <input 
                                type="number" 
                                class="form-input" 
                                min="0" 
                                max="10" 
                                bind:value={irisConfig.futureWindowHours} 
                                onchange={() => irisPollingService.pollRealtime()}
                            >
                        </label>
                        <label class="field-label">
                            Vergangenheit (Min.):
                            <input 
                                type="number" 
                                class="form-input" 
                                min="0" 
                                max="180" 
                                bind:value={irisConfig.lookbehindMinutes} 
                                onchange={() => irisPollingService.pollRealtime()}
                            >
                        </label>
                    </div>

                    <div class="checkbox-group" style="margin-top: 16px;">
                        <label class="checkbox-label">
                            <input type="checkbox" bind:checked={irisConfig.autoAnnouncements}>
                            <span>Automatische Ansagen bei Verspätungen & Gleiswechseln</span>
                        </label>
                        <label class="checkbox-label">
                            <input 
                                type="checkbox" 
                                bind:checked={irisConfig.autoSort} 
                                onchange={() => { if (irisConfig.autoSort) journeyStore.sortJourneys(); }}
                            >
                            <span>Züge automatisch nach Echtzeit sortieren</span>
                        </label>
                    </div>

                    <div style="margin-top: 18px;">
                        <button 
                            type="button" 
                            class="btn-primary" 
                            style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                            onclick={triggerIrisFetch} 
                            disabled={isFetchingIris || irisPollingService.isFetching}
                        >
                            <ZimIcon name="restart" size={14} />
                            <span>{isFetchingIris || irisPollingService.isFetching ? 'Lade IRIS-Daten...' : 'Jetzt IRIS-Daten abrufen'}</span>
                        </button>
                    </div>
                </div>

            {:else if selectedDataSource === 'db_navigator'}
                <!-- DB Navigator / bahn.de spezifische Einstellungen (Vorbereitung) -->
                <div class="form-row column-layout">
                    <label class="field-label">Abfrage-Modus für Bahnhofstafel:</label>
                    <div class="segment-switch" style="width: 100%; margin-bottom: 14px;">
                        <label>
                            <input type="radio" name="dbnav_query_type" value="departures" bind:group={dbNavConfig.queryType}>
                            <span>Abfahrten</span>
                        </label>
                        <label>
                            <input type="radio" name="dbnav_query_type" value="arrivals" bind:group={dbNavConfig.queryType}>
                            <span>Ankünfte</span>
                        </label>
                        <label>
                            <input type="radio" name="dbnav_query_type" value="both" bind:group={dbNavConfig.queryType}>
                            <span>Beides</span>
                        </label>
                    </div>

                    <div class="checkbox-group" style="margin-top: 6px;">
                        <label class="checkbox-label">
                            <input type="checkbox" bind:checked={dbNavConfig.fetchDetails}>
                            <span>Zuglauf & Zwischenhalte automatisch laden (Stopp-Details)</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" bind:checked={dbNavConfig.fetchFormation}>
                            <span>Wagenreihung / Formation automatisch abrufen (wenn verfügbar)</span>
                        </label>
                    </div>

                    <!-- Erweiterte Haltestellensuche -->
                    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
                        <label class="field-label" for="ext_station_input">
                            Erweiterte Haltestellensuche (ÖPNV, Bus, Tram, Ausland):
                        </label>
                        <div style="display: flex; gap: 6px; margin-top: 4px;">
                            <input 
                                type="text" 
                                id="ext_station_input"
                                class="form-input" 
                                placeholder="z.B. Berlin Alexanderplatz (U) oder Zürich HB" 
                                bind:value={extendedStationQuery}
                                onkeydown={(e) => { if (e.key === 'Enter') searchExtendedStations(); }}
                            >
                            <button 
                                type="button" 
                                class="btn-secondary" 
                                onclick={searchExtendedStations}
                                disabled={isExtendedSearching || !extendedStationQuery.trim()}
                                style="white-space: nowrap;"
                            >
                                {isExtendedSearching ? 'Sucht...' : 'API Suche'}
                            </button>
                        </div>
                        <div class="hint-text" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">
                            Ermöglicht das Auffinden von Haltestellen, die nicht in der lokalen DB-Bahnhofsliste enthalten sind.
                        </div>
                    </div>
                </div>

            {:else}
                <!-- Manuelle Tools & Importe -->
                <div class="form-row column-layout">
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0;">
                        Im manuellen Modus werden keine Netzwerkanfragen gesendet. Sie können JSON-Rohdaten importieren oder Fahrten im Reiter „Fahrten“ bearbeiten.
                    </p>
                    <button 
                        type="button" 
                        class="btn-secondary" 
                        style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;"
                        onclick={() => modalsComp?.openDbImport()}
                    >
                        <ZimIcon name="train_fast" size={16} />
                        <span>DB-Rohdaten importieren (JSON)</span>
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .settings-tab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 20px;
        align-items: start;
    }

    .settings-card {
        background: var(--bg-card, #1e293b);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-md, 8px);
        overflow: hidden;
        box-shadow: var(--shadow-card, 0 4px 12px rgba(0, 0, 0, 0.2));
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid var(--border, #334155);
    }

    .card-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-main, #f8fafc);
    }

    .card-body {
        padding: 18px;
    }

    .field-label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
        margin-bottom: 6px;
    }

    .source-selector {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
    }

    .source-card {
        display: flex;
        flex-direction: column;
        padding: 12px 14px;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .source-card:hover {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .source-card.active {
        border-color: var(--accent, #3b82f6);
        background: rgba(59, 130, 246, 0.08);
    }

    .source-card input {
        display: none;
    }

    .source-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.88rem;
        color: var(--text-main, #f8fafc);
        margin-bottom: 4px;
    }

    .source-desc {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.4;
    }

    .badge-status {
        font-size: 0.68rem;
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
    }

    .platform-status-box {
        border-radius: 6px;
        padding: 12px;
        border: 1px solid var(--border, #334155);
        background: rgba(0, 0, 0, 0.25);
    }

    .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.84rem;
        color: var(--text-main, #f8fafc);
        margin-bottom: 6px;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
    }

    .web-mode .status-dot {
        background: #f59e0b;
    }

    .status-details {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.45;
    }

    .form-input,
    .form-select {
        width: 100%;
        background: var(--bg-input, #0f172a);
        color: var(--text-main, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 8px 12px;
        font-size: 0.85rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s ease;
    }

    .form-input:focus,
    .form-select:focus {
        border-color: var(--accent, #3b82f6);
    }
</style>
