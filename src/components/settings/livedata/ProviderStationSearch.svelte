<!-- src/components/settings/livedata/ProviderStationSearch.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../../js/core/state/stores.js';
    import { toastStore } from '../../../js/core/state/toastStore.svelte.js';
    import { getNonCorsAvailability } from '../../../js/core/services/apiClient.js';
    import { getProviderLabel } from '../../../js/core/services/liveDataProviderService.js';
    import { JourneyLiveSyncService } from '../../../js/features/journey/services/journeyLiveSyncService.js';

    /**
     * @typedef {Object} Props
     * @property {string} providerId - Aktiver Provider ('db_navigator' | 'dbweb')
     */
    let { providerId = 'db_navigator' } = $props();

    const providerLabel = $derived(getProviderLabel(providerId));

    // Manuelle / erweiterte Stationssuche (für ÖPNV, Bus, Tram, Ausland)
    let stationQuery = $state('');
    let isSearching = $state(false);
    let searchResults = $state([]);

    /**
     * Sucht Haltestellen über die Haltestellensuche des aktiven Providers.
     * @returns {Promise<void>}
     */
    async function searchStations() {
        if (!stationQuery.trim()) return;

        const avail = getNonCorsAvailability();
        if (avail.blocked) {
            toastStore.warning(`${providerLabel} ${avail.reason}`);
            return;
        }

        isSearching = true;
        searchResults = [];

        try {
            const provider = JourneyLiveSyncService.getProvider(providerId);
            if (!provider) {
                toastStore.error(`Unbekannte Datenquelle: ${providerId}`);
                return;
            }

            searchResults = await provider.searchStations(stationQuery);

            if (searchResults.length === 0) {
                toastStore.info('Keine Haltestellen für diesen Suchbegriff gefunden.');
            }
        } catch (e) {
            console.error(`[ProviderStationSearch] Fehler bei der Stationssuche über ${providerLabel}:`, e);
            toastStore.error(`Fehler bei der Stationssuche über ${providerLabel}.`);
        } finally {
            isSearching = false;
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

<div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
    <label class="field-label" for="provider_station_search">
        Haltestellensuche über {providerLabel} (inkl. Ausland & Nahverkehr):
    </label>
    <div style="display: flex; gap: 6px; margin-top: 4px;">
        <input
            type="text"
            id="provider_station_search"
            class="form-input"
            placeholder="z.B. Berlin Alexanderplatz (U), Herford oder Wien Hbf"
            bind:value={stationQuery}
            onkeydown={(e) => { if (e.key === 'Enter') searchStations(); }}
        >
        <button
            type="button"
            class="btn-secondary"
            onclick={searchStations}
            disabled={isSearching || !stationQuery.trim()}
            style="white-space: nowrap;"
        >
            {isSearching ? 'Sucht...' : 'Suchen'}
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

    <div class="hint-text">
        Ermöglicht das Auffinden von Haltestellen, die nicht in der lokalen DB-Bahnhofsliste enthalten sind.
    </div>
</div>

<style>
    .form-input {
        flex: 1;
        width: 100%;
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
</style>
