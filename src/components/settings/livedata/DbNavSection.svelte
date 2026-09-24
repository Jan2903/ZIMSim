<!-- src/components/settings/livedata/DbNavSection.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../../js/core/state/stores.js';
    import { irisConfig } from '../../../js/core/services/irisPollingService.svelte.js';
    import { isTauri, proxyConfig } from '../../../js/core/services/apiClient.js';
    import { DbNavApiService } from '../../../js/core/services/dbNavApiService.js';
    import { JourneyDbNavSyncService } from '../../../js/features/journey/services/journeyDbNavSyncService.js';
    import ZimIcon from '../../ZimIcon.svelte';

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

    // Status für Board Fetch und Sync
    let isFetchingDbNavBoard = $state(false);
    let isSyncingDbNav = $state(false);
    let dbNavSyncResult = $state(null);

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

        if (!isTauri && !proxyConfig.enabled) {
            alert('Für DB Navigator im Browser bitte zuerst die lokale Python-Bridge (start_bridge.bat) starten.');
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
            console.error('[DbNavSection] Fehler beim Abrufen der DBNav-Tafel:', e);
            alert('Fehler beim Abrufen der DB Navigator Daten.');
        } finally {
            isFetchingDbNavBoard = false;
        }
    }

    /**
     * Gleicht die bestehenden Fahrten mit DB Navigator ab.
     * @returns {Promise<void>}
     */
    async function syncWithDbNav() {
        if (!journeyStore.stationContext.stationId) {
            alert('Bitte zuerst eine Station auswählen!');
            return;
        }

        if (!isTauri && !proxyConfig.enabled) {
            dbNavSyncResult = {
                success: false,
                message: 'DB Navigator erfordert im Browser die lokale Python-Bridge (start_bridge.bat) oder Tauri.'
            };
            return;
        }

        isSyncingDbNav = true;
        dbNavSyncResult = null;
        try {
            const res = await JourneyDbNavSyncService.enrichJourneysWithDbNav(null, null, {
                lookbehindMinutes: irisConfig.lookbehindMinutes ?? 30,
                maxChunks: 2
            });
            dbNavSyncResult = {
                success: true,
                message: `${res.matchedCount} von ${res.totalDepartures} DB Navigator Fahrten abgeglichen, [W] Verfügbarkeit aktualisiert.`
            };
        } catch (e) {
            console.error('[DbNavSection] Fehler beim DBNav-Abgleich:', e);
            dbNavSyncResult = {
                success: false,
                message: 'Fehler beim DB Navigator Abgleich.'
            };
        } finally {
            isSyncingDbNav = false;
        }
    }

    /**
     * Sucht Haltestellen über die DB Navigator Vendo Location Search API.
     * @returns {Promise<void>}
     */
    async function searchExtendedStations() {
        if (!extendedStationQuery.trim()) return;

        if (!isTauri && !proxyConfig.enabled) {
            alert('Für die Stationssuche im Browser bitte zuerst die lokale Python-Bridge (start_bridge.bat) starten.');
            return;
        }

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
            console.error('[DbNavSection] Fehler bei der erweiterten Stationssuche:', e);
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

<div class="form-row column-layout">
    {#if !isTauri && !proxyConfig.enabled}
        <div class="bridge-warning-box">
            <strong>Hinweis für Browser / GitHub Pages:</strong> DB Navigator Anfragen benötigen im Web-Modus die lokale Python-Bridge. Bitte starten Sie <code class="bridge-code">scripts/start_bridge.bat</code> auf Windows.
        </div>
    {/if}

    <div class="field-label">Abfrage-Modus für Bahnhofstafel:</div>
    <div class="segment-switch">
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
        <div class="field-label">Hybrid-Sync für bestehende Fahrten:</div>
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

<style>
    .field-label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
        margin-bottom: 6px;
    }

    .form-input {
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

    .form-input:focus {
        border-color: var(--accent, #3b82f6);
    }

    .bridge-warning-box {
        padding: 10px 12px;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 6px;
        margin-bottom: 14px;
        font-size: 0.82rem;
        color: #fde68a;
        line-height: 1.45;
    }

    .bridge-code {
        color: white;
        background: rgba(0, 0, 0, 0.3);
        padding: 1px 4px;
        border-radius: 3px;
    }

    .segment-switch {
        width: 100%;
        margin-bottom: 14px;
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
