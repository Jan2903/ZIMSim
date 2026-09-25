<!-- src/components/settings/livedata/DbWebSection.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../../js/core/state/stores.js';
    import { liveDataConfig } from '../../../js/core/state/liveDataConfig.svelte.js';
    import { isTauri, proxyConfig } from '../../../js/core/services/apiClient.js';
    import { DbWebApiService } from '../../../js/core/services/dbWebApiService.js';
    import { JourneyDbWebSyncService } from '../../../js/features/journey/services/journeyDbWebSyncService.js';
    import ZimIcon from '../../ZimIcon.svelte';

    // Status für Board Fetch, Hybrid-Sync und Formations-Abruf
    let isFetchingBoard = $state(false);
    let isFetchingFormations = $state(false);
    let fetchResult = $state(null);
    let isSyncingHybrid = $state(false);
    let hybridSyncResult = $state(null);

    // Erweiterte Stationssuche über bahn.de
    let stationQuery = $state('');
    let isSearchingStation = $state(false);
    let searchResults = $state([]);

    // Immer 8 Zwischenhalte als fester ZIM-Standard
    liveDataConfig.dbWeb.maxVias = 8;

    // Verfügbare Verkehrsmittel
    const ALL_MOTS = [
        { id: 'ICE', label: 'ICE' },
        { id: 'EC_IC', label: 'EC / IC' },
        { id: 'IR', label: 'InterRegio' },
        { id: 'REGIONAL', label: 'Regional (RE/RB)' },
        { id: 'SBAHN', label: 'S-Bahn' },
        { id: 'BUS', label: 'Bus' },
        { id: 'SCHIFF', label: 'Schiff' },
        { id: 'UBAHN', label: 'U-Bahn' },
        { id: 'TRAM', label: 'Straßenbahn' },
        { id: 'ANRUFPFLICHTIG', label: 'Anrufpflichtig' }
    ];

    /**
     * Schaltet alle Verkehrsmittel an oder aus.
     * @param {string[]} list
     */
    function setMots(list) {
        liveDataConfig.dbWeb.verkehrsmittel = [...list];
    }

    /**
     * Schaltet ein einzelnes Verkehrsmittel um.
     * @param {string} motId
     */
    function toggleMot(motId) {
        const cur = liveDataConfig.dbWeb.verkehrsmittel || [];
        if (cur.includes(motId)) {
            liveDataConfig.dbWeb.verkehrsmittel = cur.filter(m => m !== motId);
        } else {
            liveDataConfig.dbWeb.verkehrsmittel = [...cur, motId];
        }
    }

    /**
     * Lädt die Abfahrts- oder Ankunftstafel von bahn.de.
     * @param {boolean} [replace=true]
     * @returns {Promise<void>}
     */
    async function triggerDbWebBoardFetch(replace = true) {
        const stationId = journeyStore.stationContext.stationId;
        if (!stationId) {
            alert('Bitte zuerst eine Station auswählen!');
            return;
        }

        if (!isTauri && !proxyConfig.enabled) {
            alert('Für bahn.de Anfragen im Web-Browser bitte zuerst die lokale Python-Bridge (start_bridge.bat) starten.');
            return;
        }

        isFetchingBoard = true;
        fetchResult = null;

        try {
            const isDeparture = liveDataConfig.dbWeb.queryType !== 'arrivals';
            const res = await JourneyDbWebSyncService.syncStationBoard(stationId, isDeparture, {
                maxVias: 8,
                mots: liveDataConfig.dbWeb.verkehrsmittel,
                clearBefore: replace
            });

            if (res.success) {
                fetchResult = {
                    success: true,
                    message: `${res.count} Fahrten über bahn.de geladen.`
                };

                // Wagenreihungen für sichtbare Züge nachladen, falls aktiviert
                if (liveDataConfig.dbWeb.fetchFormation) {
                    isFetchingFormations = true;
                    try {
                        await JourneyDbWebSyncService.autoFetchActiveFormations();
                    } finally {
                        isFetchingFormations = false;
                    }
                }
            } else {
                fetchResult = {
                    success: false,
                    message: res.message || 'Fehler beim Laden der bahn.de Daten.'
                };
            }
        } catch (e) {
            console.error('[DbWebSection] Fehler beim Abrufen der bahn.de Tafel:', e);
            fetchResult = {
                success: false,
                message: 'Fehler beim Abrufen der bahn.de Daten.'
            };
        } finally {
            isFetchingBoard = false;
        }
    }

    /**
     * Hybrid-Sync: Gleicht bestehende Fahrten (z.B. aus IRIS) mit bahn.de ab,
     * um Wagenreihungen ([W]) freizuschalten, ohne detaillierte IRIS-Halte zu überschreiben.
     * @returns {Promise<void>}
     */
    async function syncWithDbWeb() {
        const stationId = journeyStore.stationContext.stationId;
        if (!stationId) {
            alert('Bitte zuerst eine Station auswählen!');
            return;
        }

        if (!isTauri && !proxyConfig.enabled) {
            hybridSyncResult = {
                success: false,
                message: 'bahn.de erfordert im Browser die lokale Python-Bridge (start_bridge.bat) oder Tauri.'
            };
            return;
        }

        isSyncingHybrid = true;
        hybridSyncResult = null;
        try {
            const res = await JourneyDbWebSyncService.enrichJourneysWithDbWeb(null, stationId);
            hybridSyncResult = {
                success: true,
                message: `${res.matchedCount} von ${res.totalDepartures} bahn.de Fahrten abgeglichen, [W] Verfügbarkeit & Wagenreihungen aktualisiert.`
            };
        } catch (e) {
            console.error('[DbWebSection] Fehler beim bahn.de Hybrid-Abgleich:', e);
            hybridSyncResult = {
                success: false,
                message: 'Fehler beim Abgleich mit bahn.de.'
            };
        } finally {
            isSyncingHybrid = false;
        }
    }

    /**
     * Lädt manuell Wagenreihungen für sichtbare Züge nach.
     * @returns {Promise<void>}
     */
    async function fetchVisibleFormations() {
        isFetchingFormations = true;
        try {
            await JourneyDbWebSyncService.autoFetchActiveFormations();
        } finally {
            isFetchingFormations = false;
        }
    }

    /**
     * Sucht Haltestellen über die bahn.de Web API.
     * @returns {Promise<void>}
     */
    async function searchStation() {
        if (!stationQuery.trim()) return;

        if (!isTauri && !proxyConfig.enabled) {
            alert('Für die Stationssuche im Web-Browser bitte die lokale Python-Bridge (start_bridge.bat) starten.');
            return;
        }

        isSearchingStation = true;
        searchResults = [];

        try {
            const list = await DbWebApiService.searchLocation(stationQuery, 10);
            searchResults = (list || []).map(item => ({
                id: item.extId || item.id || '',
                name: item.name || '',
                type: item.type || 'ST'
            })).filter(item => item.id && item.name);

            if (searchResults.length === 0) {
                alert('Keine Haltestellen auf bahn.de gefunden.');
            }
        } catch (e) {
            console.error('[DbWebSection] Fehler bei der Stationssuche:', e);
            alert('Fehler bei der Stationssuche über bahn.de.');
        } finally {
            isSearchingStation = false;
        }
    }

    /**
     * Wählt eine gefundene Station aus und setzt sie im journeyStore.
     * @param {{ id: string, name: string }} station
     */
    function selectStation(station) {
        journeyStore.stationContext.stationName = station.name;
        journeyStore.stationContext.stationId = String(station.id);
        searchResults = [];
        stationQuery = '';
        trainDisplay.updateAll();
    }
</script>

<div class="form-row column-layout">
    {#if !isTauri && !proxyConfig.enabled}
        <div class="bridge-warning-box">
            <strong>Hinweis für Browser / GitHub Pages:</strong> bahn.de Web API Anfragen benötigen im Browser die lokale Python-Bridge. Starte einfach <code class="bridge-code">scripts/start_bridge.bat</code> auf Windows.
        </div>
    {/if}

    <!-- Aktueller Bahnhof -->
    <div class="station-badge-card">
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
                <span class="field-label" style="margin: 0;">Aktiver Bahnhof:</span>
                <strong style="font-size: 1.05rem; color: var(--text-main);">
                    {journeyStore.stationContext.stationName || 'Kein Bahnhof gewählt'}
                </strong>
            </div>
            {#if journeyStore.stationContext.stationId}
                <span class="station-id-pill">EVA: {journeyStore.stationContext.stationId}</span>
            {/if}
        </div>
    </div>

    <!-- Modus-Umschalter -->
    <div class="field-label" style="margin-top: 10px;">Abfrage-Typ:</div>
    <div class="segment-switch">
        <label>
            <input type="radio" name="dbweb_query_type" value="departures" bind:group={liveDataConfig.dbWeb.queryType}>
            <span>Abfahrten</span>
        </label>
        <label>
            <input type="radio" name="dbweb_query_type" value="arrivals" bind:group={liveDataConfig.dbWeb.queryType}>
            <span>Ankünfte</span>
        </label>
    </div>

    <!-- Zwischenhalte (fest auf 8 Vias) -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 6px 10px; background: rgba(0, 0, 0, 0.2); border-radius: 4px; border: 1px solid var(--border);">
        <span class="field-label" style="margin: 0;">Zwischenhalte (Vias):</span>
        <span class="vias-badge">8 Zwischenhalte (ZIM-Standard)</span>
    </div>

    <!-- Verkehrsmittel-Filter -->
    <div class="sub-section" style="margin-top: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="field-label" style="margin: 0;">Verkehrsmittel:</span>
            <div style="display: flex; gap: 6px;">
                <button 
                    type="button" 
                    class="btn-xs" 
                    onclick={() => setMots(ALL_MOTS.map(m => m.id))}
                >
                    Alle
                </button>
                <button 
                    type="button" 
                    class="btn-xs" 
                    onclick={() => setMots(['ICE', 'EC_IC', 'IR', 'REGIONAL', 'SBAHN'])}
                >
                    Nur Bahn
                </button>
                <button 
                    type="button" 
                    class="btn-xs" 
                    onclick={() => setMots(['ICE', 'EC_IC'])}
                >
                    Fernverkehr
                </button>
            </div>
        </div>

        <div class="mots-grid">
            {#each ALL_MOTS as mot}
                <label class="mot-item" class:selected={liveDataConfig.dbWeb.verkehrsmittel?.includes(mot.id)}>
                    <input 
                        type="checkbox" 
                        checked={liveDataConfig.dbWeb.verkehrsmittel?.includes(mot.id)}
                        onchange={() => toggleMot(mot.id)}
                    >
                    <span>{mot.label}</span>
                </label>
            {/each}
        </div>
    </div>

    <!-- Optionen -->
    <div class="checkbox-group" style="margin-top: 12px;">
        <label class="checkbox-label">
            <input type="checkbox" bind:checked={liveDataConfig.dbWeb.fetchFormation}>
            <span>Wagenreihungen nach dem Laden automatisch für sichtbare Züge abrufen</span>
        </label>
    </div>

    <!-- Aktions-Buttons für Ersetzen / Anhängen -->
    <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button 
            type="button" 
            class="btn-primary" 
            style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={() => triggerDbWebBoardFetch(true)}
            disabled={isFetchingBoard || isFetchingFormations}
        >
            <ZimIcon name="api" size={14} />
            <span>{isFetchingBoard ? 'Lade bahn.de...' : 'Tafel laden & ersetzen'}</span>
        </button>
        <button 
            type="button" 
            class="btn-secondary" 
            style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={() => triggerDbWebBoardFetch(false)}
            disabled={isFetchingBoard || isFetchingFormations}
            title="Zu aktuellen Fahrten hinzufügen"
        >
            <ZimIcon name="plus" size={14} />
            <span>Anhängen</span>
        </button>
        <button 
            type="button" 
            class="btn-secondary" 
            style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;"
            onclick={fetchVisibleFormations}
            disabled={isFetchingFormations || isFetchingBoard}
            title="Wagenreihungen für sichtbare Züge aktualisieren"
        >
            <ZimIcon name="train_fast" size={14} />
            <span>{isFetchingFormations ? 'Lädt...' : '[W]'}</span>
        </button>
    </div>

    {#if fetchResult}
        <div class="sync-result-msg" class:is-success={fetchResult.success} style="margin-top: 10px; font-size: 0.82rem;">
            {fetchResult.message}
        </div>
    {/if}

    <!-- Hybrid-Abgleich für bestehende Fahrten (IRIS) -->
    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
        <div class="field-label">Hybrid-Abgleich für bestehende Fahrten (z. B. aus IRIS):</div>
        <p style="font-size: 0.76rem; color: var(--text-muted); margin: 0 0 10px 0; line-height: 1.4;">
            Gleicht alle aktuell in ZIMSim geladenen Fahrten mit bahn.de ab. Behält alle detaillierten Halte, exakten Zeiten und RIS-Gründe aus IRIS bei und ergänzt die originale bahn.de Wagenreihung ([W]).
        </p>
        <button 
            type="button" 
            class="btn-secondary" 
            style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={syncWithDbWeb}
            disabled={isSyncingHybrid}
        >
            <ZimIcon name="restart" size={14} />
            <span>{isSyncingHybrid ? 'Gleiche ab...' : 'Formations-Verfügbarkeit abgleichen ([W])'}</span>
        </button>
        {#if hybridSyncResult}
            <div class="sync-result-msg" class:is-success={hybridSyncResult.success} style="margin-top: 8px; font-size: 0.8rem;">
                {hybridSyncResult.message}
            </div>
        {/if}
    </div>

    <!-- Haltestellensuche über bahn.de -->
    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
        <label class="field-label" for="dbweb_station_search">
            Direkte Stationssuche über bahn.de (inkl. Ausland & Nahverkehr):
        </label>
        <div style="display: flex; gap: 6px; margin-top: 4px;">
            <input 
                type="text" 
                id="dbweb_station_search"
                class="form-input" 
                placeholder="z.B. Berlin Hbf oder Herford oder Wien Hbf" 
                bind:value={stationQuery}
                onkeydown={(e) => { if (e.key === 'Enter') searchStation(); }}
            >
            <button 
                type="button" 
                class="btn-secondary" 
                onclick={searchStation}
                disabled={isSearchingStation || !stationQuery.trim()}
                style="white-space: nowrap;"
            >
                {isSearchingStation ? 'Sucht...' : 'Suchen'}
            </button>
        </div>

        {#if searchResults.length > 0}
            <div class="search-results-list">
                {#each searchResults as st}
                    <div class="search-result-item">
                        <div class="station-meta">
                            <strong>{st.name}</strong>
                            <span class="station-id">({st.id})</span>
                        </div>
                        <button type="button" class="btn-secondary btn-sm" onclick={() => selectStation(st)}>
                            Übernehmen
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
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
        background: var(--bg-input, #0f172a);
        color: var(--text-main, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 6px 10px;
        font-size: 0.85rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s ease;
    }

    .form-input:focus {
        border-color: var(--accent, #3b82f6);
    }

    .station-badge-card {
        padding: 10px 14px;
        background: rgba(59, 130, 246, 0.08);
        border: 1px solid rgba(59, 130, 246, 0.25);
        border-radius: 6px;
        margin-bottom: 6px;
    }

    .station-id-pill {
        font-size: 0.72rem;
        padding: 2px 8px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid var(--border, #334155);
        border-radius: 10px;
        color: var(--text-muted, #94a3b8);
        font-family: monospace;
    }

    .vias-badge {
        font-size: 0.75rem;
        color: #c084fc;
        background: rgba(168, 85, 247, 0.15);
        border: 1px solid rgba(192, 132, 252, 0.3);
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
    }

    .bridge-warning-box {
        padding: 10px 12px;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 6px;
        margin-bottom: 12px;
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
        margin-bottom: 10px;
    }

    .btn-xs {
        background: var(--bg-input, #0f172a);
        color: var(--text-main, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: 3px;
        padding: 2px 8px;
        font-size: 0.72rem;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .btn-xs:hover {
        border-color: var(--accent, #3b82f6);
        background: rgba(59, 130, 246, 0.1);
    }

    .mots-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 6px;
        margin-top: 4px;
    }

    .mot-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 4px;
        font-size: 0.76rem;
        color: var(--text-muted, #94a3b8);
        cursor: pointer;
        user-select: none;
        transition: all 0.15s ease;
    }

    .mot-item:hover {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .mot-item.selected {
        border-color: rgba(168, 85, 247, 0.5);
        background: rgba(168, 85, 247, 0.1);
        color: var(--text-main, #f8fafc);
    }

    .mot-item input {
        accent-color: #a855f7;
    }

    .sync-result-msg {
        color: #f87171;
        padding: 8px 12px;
        border-radius: 4px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        line-height: 1.4;
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
