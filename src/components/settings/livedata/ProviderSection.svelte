<!-- src/components/settings/livedata/ProviderSection.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../../js/core/state/stores.js';
    import { liveDataConfig } from '../../../js/core/state/liveDataConfig.svelte.js';
    import { irisConfig } from '../../../js/core/services/irisPollingService.svelte.js';
    import { toastStore } from '../../../js/core/state/toastStore.svelte.js';
    import { getNonCorsAvailability } from '../../../js/core/services/apiClient.js';
    import { getProviderCapabilities, getProviderLabel } from '../../../js/core/services/liveDataProviderService.js';
    import { JourneyLiveSyncService } from '../../../js/features/journey/services/journeyLiveSyncService.js';
    import ZimIcon from '../../ZimIcon.svelte';
    import ProviderMoTFilter from './ProviderMoTFilter.svelte';
    import ProviderStationSearch from './ProviderStationSearch.svelte';

    /**
     * @typedef {Object} Props
     * @property {string} providerId - Aktiver Provider ('db_navigator' | 'dbweb')
     */
    let { providerId = 'db_navigator' } = $props();

    // Fähigkeiten des aktiven Providers (Vias, Wagenreihungs-Indikator, CubePosition, ...)
    const capabilities = $derived(getProviderCapabilities(providerId) || {});
    const providerLabel = $derived(getProviderLabel(providerId));

    // Plattformabhängige Verfügbarkeit der Nicht-CORS-APIs (DB Navigator / bahn.de)
    const availability = $derived(getNonCorsAvailability());

    // Status für Board Fetch, Hybrid-Sync und Formations-Abruf
    let isFetchingBoard = $state(false);
    let isFetchingFormations = $state(false);
    let fetchResult = $state(null);
    let isSyncingHybrid = $state(false);
    let hybridSyncResult = $state(null);

    /**
     * Lädt die Abfahrts- oder Ankunftstafel des aktiven Providers.
     * @param {boolean} [replace=true] - true ersetzt die bestehenden Fahrten, false hängt an
     * @returns {Promise<void>}
     */
    async function triggerBoardFetch(replace = true) {
        if (!journeyStore.stationContext.stationId) {
            toastStore.warning('Bitte zuerst eine Station auswählen!');
            return;
        }

        const avail = getNonCorsAvailability();
        if (avail.blocked) {
            toastStore.warning(`${providerLabel} ${avail.reason}`);
            return;
        }

        const isArrival = liveDataConfig.board.queryType === 'arrivals';

        isFetchingBoard = true;
        fetchResult = null;

        try {
            const res = await JourneyLiveSyncService.loadStationBoard(providerId, {
                isArrival: isArrival,
                replace: replace,
                lookbehindMinutes: irisConfig.lookbehindMinutes ?? 30,
                chunks: 2
            });

            if (res.success) {
                fetchResult = {
                    success: true,
                    message: `${res.count} Fahrten über ${providerLabel} geladen.`
                };

                // Wagenreihungen für sichtbare Züge nachladen, falls aktiviert
                if (liveDataConfig.board.fetchFormation) {
                    isFetchingFormations = true;
                    try {
                        await JourneyLiveSyncService.autoFetchActiveFormations(2);
                    } finally {
                        isFetchingFormations = false;
                    }
                }
            } else {
                fetchResult = {
                    success: false,
                    message: res.message || `Fehler beim Laden der Daten von ${providerLabel}.`
                };
            }
        } catch (e) {
            console.error(`[ProviderSection] Fehler beim Abrufen der ${providerLabel}-Tafel:`, e);
            fetchResult = {
                success: false,
                message: `Fehler beim Abrufen der Daten von ${providerLabel}.`
            };
        } finally {
            isFetchingBoard = false;
        }
    }

    /**
     * Gleicht bestehende Fahrten (z.B. aus IRIS) mit dem aktiven Provider ab,
     * um die Wagenreihungs-Verfügbarkeit ([W]) freizuschalten, ohne die detaillierten
     * IRIS-Halte zu überschreiben.
     * @returns {Promise<void>}
     */
    async function syncHybrid() {
        const stationId = journeyStore.stationContext.stationId;
        if (!stationId) {
            toastStore.warning('Bitte zuerst eine Station auswählen!');
            return;
        }

        const avail = getNonCorsAvailability();
        if (avail.blocked) {
            hybridSyncResult = {
                success: false,
                message: `${providerLabel} ${avail.reason}`
            };
            return;
        }

        isSyncingHybrid = true;
        hybridSyncResult = null;
        try {
            const res = await JourneyLiveSyncService.enrichJourneys(providerId, {
                stationId: stationId,
                lookbehindMinutes: irisConfig.lookbehindMinutes ?? 30,
                chunks: 2
            });
            hybridSyncResult = {
                success: true,
                message: `${res.matchedCount} von ${res.totalDepartures} ${providerLabel} Fahrten abgeglichen, [W] Verfügbarkeit aktualisiert.`
            };
        } catch (e) {
            console.error(`[ProviderSection] Fehler beim Hybrid-Abgleich mit ${providerLabel}:`, e);
            hybridSyncResult = {
                success: false,
                message: `Fehler beim Abgleich mit ${providerLabel}.`
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
            await JourneyLiveSyncService.autoFetchActiveFormations(2);
        } finally {
            isFetchingFormations = false;
        }
    }
</script>

<div class="form-row column-layout">
    {#if availability.blocked}
        <div class="bridge-warning-box">
            <strong>{availability.needsBridge ? 'Hinweis für Browser / GitHub Pages:' : 'Hinweis für mobile Geräte:'}</strong>
            DB Navigator und bahn.de {availability.reason}
            {#if availability.needsBridge}
                <br>Start unter Windows per Doppelklick auf <code class="bridge-code">scripts/start_bridge.bat</code>, unter macOS/Linux mit <code class="bridge-code">python3 scripts/zimsim_bridge.py</code>. Alternativ die Tauri-Desktop-App verwenden.
            {/if}
        </div>
    {/if}

    <!-- Aktiver Bahnhof -->
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

    <!-- Abfrage-Typ -->
    <div class="field-label" style="margin-top: 10px;">Abfrage-Typ:</div>
    <div class="segment-switch" style="width: 100%;">
        <label>
            <input type="radio" name="board_query_type" value="departures" bind:group={liveDataConfig.board.queryType}>
            <span>Abfahrten</span>
        </label>
        <label>
            <input type="radio" name="board_query_type" value="arrivals" bind:group={liveDataConfig.board.queryType}>
            <span>Ankünfte</span>
        </label>
    </div>

    <!-- Zwischenhalte: nur Quellen mit Via-Unterstützung -->
    {#if capabilities.vias}
        <div class="vias-row">
            <span class="field-label" style="margin: 0;">Zwischenhalte (Vias):</span>
            <span class="vias-badge">{liveDataConfig.board.maxVias} Zwischenhalte (ZIM-Standard)</span>
        </div>
    {:else}
        <div class="vias-row">
            <span class="field-label" style="margin: 0;">Zwischenhalte (Vias):</span>
            <span class="vias-badge vias-badge-muted">Diese Quelle liefert keine Zwischenhalte</span>
        </div>
    {/if}

    <!-- Verkehrsmittel-Filter -->
    <ProviderMoTFilter />

    <!-- Optionen -->
    <div class="checkbox-group" style="margin-top: 12px;">
        <label class="checkbox-label">
            <input type="checkbox" bind:checked={liveDataConfig.board.fetchFormation}>
            <span>Wagenreihungen nach dem Laden automatisch für sichtbare Züge abrufen</span>
        </label>
    </div>

    <!-- Aktions-Buttons für Ersetzen / Anhängen / Wagenreihung -->
    <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button
            type="button"
            class="btn-primary"
            style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={() => triggerBoardFetch(true)}
            disabled={isFetchingBoard || isFetchingFormations}
        >
            <ZimIcon name="api" size={14} />
            <span>{isFetchingBoard ? `Lade ${providerLabel}...` : 'Tafel laden & ersetzen'}</span>
        </button>
        <button
            type="button"
            class="btn-secondary"
            style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={() => triggerBoardFetch(false)}
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

    <!-- Hybrid-Abgleich für bestehende Fahrten (z. B. aus IRIS) -->
    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
        <div class="field-label">Hybrid-Abgleich für bestehende Fahrten (z. B. aus IRIS):</div>
        <p class="hint-text" style="margin: 0 0 10px 0;">
            Gleicht alle aktuell in ZIMSim geladenen Fahrten mit {providerLabel} ab. Behält die detaillierten Halte,
            exakten Zeiten und RIS-Gründe der vorhandenen Quelle bei und ergänzt die Wagenreihung ([W]).
        </p>
        <button
            type="button"
            class="btn-secondary"
            style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={syncHybrid}
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

    <!-- Haltestellensuche über die jeweilige Quelle -->
    <ProviderStationSearch {providerId} />

    <!-- Unterschiede der Quelle transparent machen -->
    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
        <div class="field-label">Eigenschaften von {providerLabel}:</div>
        <ul class="capability-list">
            <li class:cap-yes={capabilities.vias}>Zwischenhalte (Vias) für die Anzeigetafeln</li>
            <li class:cap-yes={capabilities.formationIndicator}>Verlässlicher Wagenreihungs-Indikator [W]</li>
            <li class:cap-yes={capabilities.cubePosition}>Exakte Gleisabschnitts-Würfelposition der Sektoren</li>
            <li class:cap-yes={capabilities.risReasons}>RIS-Gründe (R) und Qualitätsmeldungen (Q)</li>
            <li class:cap-yes={capabilities.extendedStations}>Erweiterte Haltestellensuche (ÖPNV, Bus, Ausland)</li>
        </ul>
        <div class="hint-text">
            Nicht vorhandene Fähigkeiten lassen sich nicht aktivieren - die API liefert die Daten schlicht nicht.
            Beide Quellen lassen sich jedoch parallel nutzen und über den Hybrid-Abgleich miteinander kombinieren.
        </div>
    </div>
</div>
