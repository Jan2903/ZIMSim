<!-- src/components/settings/SettingsLiveData.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { irisPollingService, irisConfig } from '../../js/core/services/irisPollingService.svelte.js';
    import { isTauri, isGitHubPages } from '../../js/core/services/apiClient.js';
    import { DbNavApiService } from '../../js/core/services/dbNavApiService.js';
    import { JourneyDbNavSyncService } from '../../js/features/journey/services/journeyDbNavSyncService.js';
    import ZimIcon from '../ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente für den DB-Import
     */
    let { modalsComp = null } = $props();

    // Aktive Datenquelle: 'iris' | 'db_navigator' | 'manual'
    let selectedDataSource = $state('iris');

    // DB Navigator & bahn.de Konfiguration
    let dbNavConfig = $state({
        queryType: 'departures', // 'departures' | 'arrivals'
        fetchDetails: true,      // Details/Zuglauf pro Fahrt abrufen
        fetchFormation: true,    // Wagenreihung pro Fahrt abrufen
        includeNearby: false     // Nahverkehr / Ersatzverkehr einschließen
    });

    // Manuelle / erweiterte Stationssuche (für ÖPNV, Bus, Tram, Ausland)
    let extendedStationQuery = $state('');
    let isExtendedSearching = $state(false);
    let extendedSearchResults = $state([]);

    // Lade-Status für manuelle IRIS-Abfrage
    let isFetchingIris = $state(false);

    // Status für DBNav Sync und Board Fetch
    let isSyncingDbNav = $state(false);
    let dbNavSyncResult = $state(null);
    let isFetchingDbNavBoard = $state(false);
    let autoFetchActiveFormations = $state(false);

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
     * Gleicht die aktuellen Fahrten mit der DB Navigator Abfahrtstafel ab.
     * Ermittelt die Verfügbarkeit von Wagenreihungen ([W]) und lädt optional die Formation für aktive Züge.
     * @returns {Promise<void>}
     */
    async function syncWithDbNav() {
        if (!journeyStore.stationContext.stationId) {
            alert('Bitte zuerst eine Station auswählen!');
            return;
        }
        isSyncingDbNav = true;
        dbNavSyncResult = null;
        try {
            const res = await JourneyDbNavSyncService.enrichJourneysWithDbNav(null, null, {
                lookbehindMinutes: irisConfig.lookbehindMinutes ?? 30,
                maxChunks: 2
            });
            let extraMsg = '';
            if (autoFetchActiveFormations && res.matchedCount > 0) {
                const fetched = await JourneyDbNavSyncService.autoFetchActiveFormations(2);
                if (fetched > 0) {
                    extraMsg = ` (${fetched} Wagenreihung(en) für Anzeige geladen)`;
                }
            }
            dbNavSyncResult = {
                success: true,
                message: `${res.matchedCount} von ${res.totalDepartures} DB Navigator Fahrten abgeglichen, [W] Verfügbarkeit aktualisiert.${extraMsg}`
            };
        } catch (e) {
            console.error('[SettingsLiveData] Fehler beim DBNav-Abgleich:', e);
            dbNavSyncResult = {
                success: false,
                message: 'Fehler beim DB Navigator Abgleich.'
            };
        } finally {
            isSyncingDbNav = false;
        }
    }

    /**
     * Lädt die Abfahrts- oder Ankunftstafel direkt über DB Navigator.
     * @param {boolean} [replace=true]
     * @returns {Promise<void>}
     */
    async function triggerDbNavBoardFetch(replace = true) {
        if (!journeyStore.stationContext.stationId) {
            alert('Bitte zuerst eine Station auswählen!');
            return;
        }
        isFetchingDbNavBoard = true;
        try {
            const isArrival = dbNavConfig.queryType === 'arrivals';
            const res = await JourneyDbNavSyncService.loadStationBoard(null, isArrival, replace, {
                lookbehindMinutes: irisConfig.lookbehindMinutes ?? 30,
                chunks: 2
            });
            if (res.success) {
                if (dbNavConfig.fetchFormation) {
                    await JourneyDbNavSyncService.autoFetchActiveFormations(2);
                }
                alert(`${res.count} Fahrten über DB Navigator geladen.`);
            } else {
                alert(res.message || 'Fehler beim Laden der DB Navigator Daten.');
            }
        } catch (e) {
            console.error('[SettingsLiveData] Fehler beim Abrufen der DBNav-Tafel:', e);
            alert('Fehler beim Abrufen der DB Navigator Daten.');
        } finally {
            isFetchingDbNavBoard = false;
        }
    }

    /**
     * Sucht Haltestellen über die DB Navigator Vendo Location Search API.
     * @returns {Promise<void>}
     */
    async function searchExtendedStations() {
        if (!extendedStationQuery.trim()) return;
        isExtendedSearching = true;
        extendedSearchResults = [];

        try {
            const raw = await DbNavApiService.searchLocation(extendedStationQuery);
            const list = Array.isArray(raw) ? raw : (raw?.locations || []);
            extendedSearchResults = list.map(item => ({
                id: item.id || item.extId || item.evaNr || '',
                name: item.name || '',
                type: item.locationType || item.type || 'Station'
            })).filter(item => item.id && item.name);

            if (extendedSearchResults.length === 0) {
                alert('Keine Haltestellen für diesen Suchbegriff gefunden.');
            }
        } catch (e) {
            console.error('[SettingsLiveData] Fehler bei der erweiterten Stationssuche:', e);
            alert('Fehler bei der Stationssuche über DB Navigator.');
        } finally {
            isExtendedSearching = false;
        }
    }

    /**
     * Wählt eine gefundene Station aus und setzt sie im journeyStore.
     * @param {{ id: string, name: string }} station
     */
    function selectExtendedStation(station) {
        journeyStore.stationContext.stationName = station.name;
        journeyStore.stationContext.stationId = String(station.id);
        extendedSearchResults = [];
        extendedStationQuery = '';
        trainDisplay.updateAll();
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

                    <!-- DB Navigator Wagenreihungs-Abgleich (Hybrid) -->
                    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
                        <label class="field-label">DB Navigator Wagenreihungs-Abgleich (Hybrid):</label>
                        <div class="checkbox-group" style="margin-bottom: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" bind:checked={autoFetchActiveFormations}>
                                <span>Wagenreihung für angezeigten Zug automatisch nachladen</span>
                            </label>
                        </div>
                        <button 
                            type="button" 
                            class="btn-secondary" 
                            style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                            onclick={syncWithDbNav}
                            disabled={isSyncingDbNav}
                        >
                            <ZimIcon name="train_fast" size={14} />
                            <span>{isSyncingDbNav ? 'Gleiche mit DB Navigator ab...' : 'Wagenreihungs-Verfügbarkeit ermitteln ([W])'}</span>
                        </button>
                        {#if dbNavSyncResult}
                            <div class="sync-result-msg" class:is-success={dbNavSyncResult.success} style="margin-top: 8px; font-size: 0.8rem;">
                                {dbNavSyncResult.message}
                            </div>
                        {/if}
                    </div>
                </div>

            {:else if selectedDataSource === 'db_navigator'}
                <!-- DB Navigator / bahn.de spezifische Einstellungen -->
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
                    </div>

                    <div class="checkbox-group" style="margin-top: 6px;">
                        <label class="checkbox-label">
                            <input type="checkbox" bind:checked={dbNavConfig.fetchFormation}>
                            <span>Wagenreihung für angezeigten Zug automatisch abrufen</span>
                        </label>
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 14px;">
                        <button 
                            type="button" 
                            class="btn-primary" 
                            style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                            onclick={() => triggerDbNavBoardFetch(true)}
                            disabled={isFetchingDbNavBoard}
                        >
                            <ZimIcon name="train_fast" size={14} />
                            <span>{isFetchingDbNavBoard ? 'Lade DBNav...' : 'Tafel laden & ersetzen'}</span>
                        </button>
                        <button 
                            type="button" 
                            class="btn-secondary" 
                            style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                            onclick={() => triggerDbNavBoardFetch(false)}
                            disabled={isFetchingDbNavBoard}
                            title="Zu aktuellen Fahrten hinzufügen"
                        >
                            <ZimIcon name="plus" size={14} />
                            <span>Anhängen</span>
                        </button>
                    </div>

                    <!-- Hybrid-Sync Sektion -->
                    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
                        <label class="field-label">Hybrid-Sync für bestehende Fahrten:</label>
                        <button 
                            type="button" 
                            class="btn-secondary" 
                            style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                            onclick={syncWithDbNav}
                            disabled={isSyncingDbNav}
                        >
                            <ZimIcon name="restart" size={14} />
                            <span>{isSyncingDbNav ? 'Gleiche ab...' : 'Bestehende Fahrten mit DB Navigator abgleichen'}</span>
                        </button>
                        {#if dbNavSyncResult}
                            <div class="sync-result-msg" class:is-success={dbNavSyncResult.success} style="margin-top: 8px; font-size: 0.8rem;">
                                {dbNavSyncResult.message}
                            </div>
                        {/if}
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

                        {#if extendedSearchResults.length > 0}
                            <div class="search-results-list">
                                {#each extendedSearchResults as st}
                                    <div class="search-result-item">
                                        <div class="station-meta">
                                            <strong>{st.name}</strong>
                                            <span class="station-id">({st.id})</span>
                                        </div>
                                        <button type="button" class="btn-secondary btn-sm" onclick={() => selectExtendedStation(st)}>
                                            Auswählen
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        {/if}

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

    .sync-result-msg {
        color: #f87171;
        padding: 6px 10px;
        border-radius: 4px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .sync-result-msg.is-success {
        color: #4ade80;
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(74, 222, 128, 0.2);
    }

    .search-results-list {
        margin-top: 8px;
        max-height: 180px;
        overflow-y: auto;
        border: 1px solid var(--border, #334155);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.2);
    }

    .search-result-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .search-result-item:last-child {
        border-bottom: none;
    }

    .station-meta {
        display: flex;
        align-items: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.84rem;
    }

    .station-id {
        font-size: 0.75rem;
        color: var(--text-muted, #94a3b8);
        margin-left: 6px;
    }
</style>
