<script>
    import { journeyStore, trainDisplay } from '../js/main.js';
    import { StationService } from '../js/utils/stationService.js';
    import JourneyList from './JourneyList.svelte';
    
    let { modalsComp } = $props();

    // Derived values for the UI
    let entry_station_search = $state('');
    let searchResults = $state([]);
    let isPerformanceMode = $state(false);
    let autoUpdateTime = $state(true);
    
    // We bind standard inputs directly
    // Notice how we use bind:value or onchange
    
    function addManualJourney() {
        journeyStore.addJourney();
    }
    
    function onLayoutChange(event) {
        const layout = event.target.value;
        trainDisplay.switchLayout(layout);
    }
    
    function onFeatureChange(event) {
        trainDisplay.onFeatureButtonChange(event.target.value);
    }
    
    // Search station Logic (simplified from events.js)
    let searchTimeout;
    function onStationSearchInput(e) {
        entry_station_search = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (entry_station_search.length >= 3) {
                searchResults = StationService.searchStations(entry_station_search);
            } else {
                searchResults = [];
            }
        }, 300);
    }
    
    function selectStation(station) {
        entry_station_search = station.name;
        journeyStore.stationContext.stationName = station.name;
        journeyStore.stationContext.stationId = station.eva;
        searchResults = [];
    }
</script>

<div class="settings-container">
    <div class="dashboard-grid">
        <div class="main-controls">
            <div class="settings-frame" id="journey_list_frame">
                <div class="journey-list-header">
                    <h3>Fahrten</h3>
                    <div class="journey-list-actions">
                        <button id="add_journey_btn" class="btn-primary btn-sm" onclick={addManualJourney}>+ Fahrt hinzufügen</button>
                    </div>
                </div>
                <div id="journey_list" class="journey-list">
                    <JourneyList />
                </div>
            </div>
        </div>

        <div class="side-controls">
            <div class="settings-frame" id="frame_links_oben">
                <h3>Anzeige Wagenreihung</h3>
                <div class="options-grid">
                    <label class="radio-card"><input type="radio" name="wahl" value="rotierend" onchange={onFeatureChange}> Rotierend</label>
                    <label class="radio-card"><input type="radio" name="wahl" value="wagennummern" checked onchange={onFeatureChange}> Nummern</label>
                    <label class="radio-card"><input type="radio" name="wahl" value="ausstattung" onchange={onFeatureChange}> Ausstattung</label>
                    <label class="radio-card"><input type="radio" name="wahl" value="klasse" onchange={onFeatureChange}> Klasse</label>
                </div>

                <h3 style="margin-top: 25px;">Layout</h3>
                <div class="options-grid">
                    <label class="radio-card"><input type="radio" name="layout_select" value="standard" checked onchange={onLayoutChange}> Standard</label>
                    <label class="radio-card"><input type="radio" name="layout_select" value="voranzeiger" onchange={onLayoutChange}> Voranzeiger</label>
                    <label class="radio-card"><input type="radio" name="layout_select" value="zimvitrine32wagenstand" onchange={onLayoutChange}> Vitrine 32</label>
                </div>
                <div class="checkbox-group" style="margin-top: 10px;">
                    <label class="checkbox-label"><input type="checkbox" id="nrw_mode_checkbox" bind:checked={journeyStore.nrwMode}> Nur Liniennummern (NRW)</label>
                </div>
                
                <h3 style="margin-top: 25px;">Bahnhof/Station</h3>
                <div class="form-row column-layout">
                    <label style="margin-bottom: 5px; display: block;">Station (Suche):</label>
                    <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px;">
                        <div class="autocomplete-wrapper" style="flex: 1; position: relative;">
                            <input type="text" id="entry_station_search" placeholder="z.B. Hannover Hbf oder 8000152" autocomplete="off" style="width: 100%; margin: 0;" oninput={onStationSearchInput} value={entry_station_search}>
                            {#if searchResults.length > 0}
                                <ul id="station_autocomplete_list" class="autocomplete-list">
                                    {#each searchResults as st}
                                        <li onclick={() => selectStation(st)}>{st.name} ({st.eva})</li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                        <button id="btn_api_station_search" class="btn-secondary" style="padding: 8px 12px; margin: 0;">API Suche</button>
                    </div>

                    <label style="margin-top: 5px;">Datum/Uhrzeit: <input type="datetime-local" step="1" id="custom_time_input"></label>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px; margin-top: 5px;">
                        <button id="set_current_time_btn" class="btn-secondary btn-sm" style="flex: 1;">Systemzeit setzen</button>
                    </div>
                    <div class="checkbox-group" style="margin-bottom: 15px;">
                        <label class="checkbox-label"><input type="checkbox" id="auto_update_time_checkbox" bind:checked={autoUpdateTime}> Zeit automatisch simulieren</label>
                    </div>
                    
                    <details class="mot-details" id="mot_details" style="margin-bottom: 10px;">
                        <summary class="mot-summary" id="mot_summary">Verkehrsmittel: Alle Verkehrsmittel</summary>
                        <div class="mot-content">
                            <div class="mot-presets">
                                <button class="btn-secondary btn-sm mot-preset-btn" data-preset="SPV">SPV</button>
                                <button class="btn-secondary btn-sm mot-preset-btn" data-preset="SPFV">FV</button>
                                <button class="btn-secondary btn-sm mot-preset-btn" data-preset="SPNV">NV</button>
                                <button class="btn-secondary btn-sm mot-preset-btn" data-preset="ÖSPV">ÖSPV</button>
                                <button class="btn-secondary btn-sm mot-preset-btn" data-preset="ÖPNV">ÖPNV</button>                                    
                                <button class="btn-secondary btn-sm mot-preset-btn" data-preset="ALL">Alle</button>
                            </div>
                            <div class="checkbox-group mot-checkboxes">
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="ICE" checked> ICE</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="EC_IC" checked> EC/IC</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="IR" checked> IR</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="REGIONAL" checked> Regional</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="SBAHN" checked> S-Bahn</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="BUS" checked> Bus</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="SCHIFF" checked> Schiff</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="UBAHN" checked> U-Bahn</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="TRAM" checked> Straßenbahn</label>
                                <label class="checkbox-label"><input type="checkbox" class="mot_dep" value="ANRUFPFLICHTIG" checked> Anrufpflichtig</label>
                            </div>
                        </div>
                    </details>

                    <details class="mot-details" id="track_details">
                        <summary class="mot-summary" id="track_summary">Gleise: Alle</summary>
                        <div class="mot-content">
                            <div class="mot-presets" style="display: flex; gap: 5px; margin-bottom: 10px;">
                                <button class="btn-secondary btn-sm" id="btn_invert_tracks">Auswahl invertieren</button>
                                <input type="text" id="manual_track_input" class="short-input" placeholder="Gl." style="width: 50px; margin: 0;">
                                <button class="btn-secondary btn-sm" id="btn_add_manual_track">+</button>
                            </div>
                            <div class="checkbox-group mot-checkboxes" id="track_checkbox_container">
                                <!-- Dynamisch generiert -->
                            </div>
                        </div>
                    </details>
                </div>

                <h3 style="margin-top: 25px;">Bahnsteig</h3>
                <div class="form-row column-layout">
                    <label style="margin-bottom: 5px; display: block;">Konfiguration wählen:</label>
                    <select id="global_platform_select" style="width: 100%; padding: 5px; margin-bottom: 10px;">
                        <option value="default">Standard (Generisch)</option>
                    </select>
                    <label>Länge (m): <input type="number" id="platform_length" class="short-input" value="420"></label>
                    <label>Standort (m): <input type="number" id="platform_location" class="short-input" value="150"></label>
                </div>

                <h3 style="margin-top: 25px;">Sonstige Einstellungen</h3>
                <div class="form-row column-layout">
                    <div class="checkbox-group">
                        <label class="checkbox-label"><input type="checkbox" id="performance_mode_checkbox"> Performance-Modus (30 FPS)</label>
                    </div>
                </div>

                <div class="button-group-vertical" style="margin-top: 15px;">
                    <button id="export_all_btn" class="btn-secondary">📤 Exportieren</button>
                    <button id="import_all_btn" class="btn-secondary">📥 Importieren</button>
                    <button id="import_db_btn" class="btn-secondary" onclick={() => modalsComp?.openDbImport()}>🚄 DB-Daten importieren</button>
                </div>
                
            </div>
        </div>
    </div>
</div>
