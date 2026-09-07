<script>
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import { StationService } from '../js/features/station/stationService.js';
    import { IrisApiService } from '../js/core/services/irisApiService.js';
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { fade, slide } from 'svelte/transition';
    import JourneyList from './JourneyList.svelte';
    import StationPicker from './StationPicker.svelte';
    import CollapsibleSection from './CollapsibleSection.svelte';
    import { setSimulatedTime, getSimulatedTime, timeConfig, config } from '../js/core/utils/config.js';
    import { irisPollingService, irisConfig } from '../js/core/services/irisPollingService.svelte.js';
    import { MOT_PRESETS, getSmartHeaderString, MOT_ALL_KEYS } from '../js/features/station/motManager.js';
    import { ansagenStore } from '../js/audio/ansagenStore.svelte.js';
    import { open } from '@tauri-apps/plugin-dialog';
    
    let { modalsComp } = $props();

    // Derived values for the UI
    let entry_station_search = $state('');
    let isPerformanceMode = $state(config.performance_mode);
    let autoUpdateTime = $state(timeConfig.isRunning);
    
    // Time logic
    let customTimeString = $state('');
    
    // Init customTimeString without triggering timezone issues, keeping it simple
    function formatForInput(date) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    }
    
    $effect(() => {
        config.performance_mode = isPerformanceMode;
        localStorage.setItem('zimsim_performance_mode', isPerformanceMode);
    });

    $effect(() => {
        timeConfig.isRunning = autoUpdateTime;
        
        let interval;
        if (autoUpdateTime) {
            // Update the input field every second when auto update is on
            interval = setInterval(() => {
                customTimeString = formatForInput(getSimulatedTime());
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    });
    
    // Fallback: Initial time setup
    $effect(() => {
        if (!customTimeString && !autoUpdateTime) {
            customTimeString = formatForInput(getSimulatedTime());
        }
    });

    function addManualJourney() {
        journeyStore.addJourney();
    }
    
    let isFetchingIris = $state(false);

    async function fetchIrisData() {
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
            console.error(e);
            alert('Fehler beim Abrufen der IRIS-Daten.');
        } finally {
            isFetchingIris = false;
        }
    }
    
    function onLayoutChange(event) {
        const layout = event.target.value;
        trainDisplay.switchLayout(layout);
    }
    
    function onFeatureChange(event) {
        trainDisplay.onFeatureButtonChange(event.target.value);
    }
    
    function selectStation(station) {
        entry_station_search = station.name;
        journeyStore.stationContext.stationName = station.name;
        journeyStore.stationContext.stationId = station.ibnr || station.eva;
    }

    function setCurrentTime() {
        setSimulatedTime(new Date());
        customTimeString = formatForInput(getSimulatedTime());
    }

    function onCustomTimeChange(e) {
        if (e.target.value) {
            setSimulatedTime(new Date(e.target.value));
            customTimeString = e.target.value;
        }
    }

    function setMotPreset(preset) {
        journeyStore.activeMots = [...MOT_PRESETS[preset]];
        trainDisplay.updateAll();
    }

    let motSummary = $derived(getSmartHeaderString(journeyStore.activeMots));
    
    // Dynamically build track list, including both active (manually added) and those in journeys
    let allAvailableTracks = $derived.by(() => {
        const fromJourneys = journeyStore.getAllTracks();
        const all = new Set([...fromJourneys, ...journeyStore.activeTracks]);
        return Array.from(all).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
    });
    
    let trackSummary = $derived(journeyStore.activeTracks.length === 0 ? 'Gleise: Alle' : `Gleise: ${journeyStore.activeTracks.length} ausgewählt`);

    function toggleTrack(track) {
        if (journeyStore.activeTracks.includes(track)) {
            journeyStore.activeTracks = journeyStore.activeTracks.filter(t => t !== track);
        } else {
            journeyStore.activeTracks = [...journeyStore.activeTracks, track];
        }
        trainDisplay.updateAll();
    }

    function invertTracks() {
        const newTracks = [];
        for (const track of allAvailableTracks) {
            if (!journeyStore.activeTracks.includes(track)) {
                newTracks.push(track);
            }
        }
        journeyStore.activeTracks = newTracks;
        trainDisplay.updateAll();
    }

    let manualTrackInput = $state('');
    function addManualTrack() {
        if (manualTrackInput && !journeyStore.activeTracks.includes(manualTrackInput)) {
            journeyStore.activeTracks = [...journeyStore.activeTracks, manualTrackInput];
            trainDisplay.updateAll();
        }
        manualTrackInput = '';
    }

    function exportConfig() {
        const data = journeyStore.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zimsim_export_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    let fileInput;
    function handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                journeyStore.importAll(data);
                trainDisplay.updateAll();
            } catch (err) {
                console.error("Import Fehler:", err);
                alert("Fehler beim Importieren der Datei.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    }

    let audioZipInput;
    async function handleZipLoad() {
        if (ansagenStore.isTauri) {
            try {
                const file = await open({
                    multiple: false,
                    filters: [{ name: 'ZIP', extensions: ['zip'] }]
                });
                if (file) {
                    ansagenStore.setFileRef(file, file.split(/[/\\]/).pop());
                }
            } catch (e) {
                console.error("Failed to open dialog", e);
            }
        } else {
            // Web: try File System Access API
            if (window.showOpenFilePicker) {
                try {
                    const [fileHandle] = await window.showOpenFilePicker({
                        types: [{ description: 'ZIP Files', accept: { 'application/zip': ['.zip'] } }],
                        multiple: false
                    });
                    await ansagenStore.setFileRef(fileHandle, fileHandle.name);
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        console.error("Failed to get file handle", e);
                        // Fallback to classic input
                        audioZipInput.click();
                    }
                }
            } else {
                // Safari/iOS Fallback
                audioZipInput.click();
            }
        }
    }

    function handleWebZipUpload(e) {
        const file = e.target.files[0];
        if (file) {
            ansagenStore.setFileRef(file, file.name);
        }
        e.target.value = ''; // Reset
    }
</script>

<div class="settings-container">
    <div class="dashboard-grid">
        <div class="main-controls">
            {#snippet journeyActions()}
                <button class="btn-secondary btn-sm" onclick={fetchIrisData} disabled={isFetchingIris}>
                    {isFetchingIris ? 'Lädt...' : 'IRIS API Suche'}
                </button>
                <button id="add_journey_btn" class="btn-primary btn-sm" onclick={addManualJourney}>+ Fahrt hinzufügen</button>
            {/snippet}

            <div id="journey_list_frame">
                <CollapsibleSection title="Fahrten" isOpen={true} isFrame={true} headerActions={journeyActions}>
                    <div id="journey_list" class="journey-list">
                        <JourneyList />
                    </div>
                </CollapsibleSection>
            </div>
        </div>

        <div class="side-controls">
            <div class="settings-frame" id="frame_links_oben" style="padding-top: 10px;">
                
                <CollapsibleSection title="Anzeige Wagenreihung" isOpen={true} isFrame={false}>
                    <div class="options-grid">
                        <label class="radio-card"><input type="radio" name="wahl" value="rotierend" onchange={onFeatureChange}> Rotierend</label>
                        <label class="radio-card"><input type="radio" name="wahl" value="wagennummern" checked onchange={onFeatureChange}> Nummern</label>
                        <label class="radio-card"><input type="radio" name="wahl" value="ausstattung" onchange={onFeatureChange}> Ausstattung</label>
                        <label class="radio-card"><input type="radio" name="wahl" value="klasse" onchange={onFeatureChange}> Klasse</label>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Layout" isOpen={true} isFrame={false}>
                    <div class="options-grid">
                        <label class="radio-card"><input type="radio" name="layout_select" value="standard" checked onchange={onLayoutChange}> Standard</label>
                        <label class="radio-card"><input type="radio" name="layout_select" value="voranzeiger" onchange={onLayoutChange}> Voranzeiger</label>
                        <label class="radio-card"><input type="radio" name="layout_select" value="zimvitrine32wagenstand" onchange={onLayoutChange}> Vitrine 32</label>
                    </div>
                    <div class="checkbox-group" style="margin-top: 10px;">
                        <label class="checkbox-label"><input type="checkbox" id="nrw_mode_checkbox" bind:checked={journeyStore.nrwMode} onchange={() => trainDisplay.updateAll()}> Nur Liniennummern (NRW)</label>
                    </div>
                </CollapsibleSection>
                
                <CollapsibleSection title="Bahnhof/Station" isOpen={true} isFrame={false}>
                    <div class="form-row column-layout">
                        <label for="entry_station_search" style="margin-bottom: 5px; display: block;">Station (Suche):</label>
                        <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <StationPicker 
                                    bind:value={entry_station_search} 
                                    placeholder="z.B. Hannover Hbf oder 8000152"
                                    onSelect={selectStation}
                                />
                            </div>
                            <button id="btn_api_station_search" class="btn-secondary" style="padding: 8px 12px; margin: 0;">API Suche</button>
                        </div>

                        <label style="margin-top: 5px;">Datum/Uhrzeit: <input type="datetime-local" step="1" id="custom_time_input" value={customTimeString} onchange={onCustomTimeChange}></label>
                        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px; margin-top: 5px;">
                            <button id="set_current_time_btn" class="btn-secondary btn-sm" style="flex: 1;" onclick={setCurrentTime}>Systemzeit setzen</button>
                        </div>
                        <div class="checkbox-group" style="margin-bottom: 15px;">
                            <label class="checkbox-label"><input type="checkbox" id="auto_update_time_checkbox" bind:checked={autoUpdateTime}> Zeit automatisch simulieren</label>
                        </div>
                        
                        <details class="mot-details" id="mot_details" style="margin-bottom: 10px;">
                            <summary class="mot-summary" id="mot_summary">{motSummary}</summary>
                            <div class="mot-content">
                                <div class="mot-presets">
                                    {#each Object.keys(MOT_PRESETS) as preset}
                                        <button class="btn-secondary btn-sm mot-preset-btn" onclick={() => setMotPreset(preset)}>{preset}</button>
                                    {/each}
                                </div>
                                <div class="checkbox-group mot-checkboxes">
                                    {#each MOT_ALL_KEYS as motKey}
                                        <label class="checkbox-label">
                                            <input type="checkbox" class="mot_dep" value={motKey} bind:group={journeyStore.activeMots} onchange={() => trainDisplay.updateAll()}>
                                            {motKey}
                                        </label>
                                    {/each}
                                </div>
                            </div>
                        </details>

                        <details class="mot-details" id="track_details">
                            <summary class="mot-summary" id="track_summary">{trackSummary}</summary>
                            <div class="mot-content">
                                <div class="mot-presets" style="display: flex; gap: 5px; margin-bottom: 10px;">
                                    <button class="btn-secondary btn-sm" id="btn_invert_tracks" onclick={invertTracks}>Auswahl invertieren</button>
                                    <input type="text" id="manual_track_input" class="short-input" placeholder="Gl." style="width: 50px; margin: 0;" bind:value={manualTrackInput} onkeydown={(e) => { if (e.key === 'Enter') addManualTrack(); }}>
                                    <button class="btn-secondary btn-sm" id="btn_add_manual_track" onclick={addManualTrack}>+</button>
                                </div>
                                <div class="checkbox-group mot-checkboxes" id="track_checkbox_container">
                                    {#each allAvailableTracks as track}
                                        <label class="checkbox-label">
                                            <input type="checkbox" checked={journeyStore.activeTracks.includes(track)} onchange={() => toggleTrack(track)}>
                                            Gleis {track}
                                        </label>
                                    {/each}
                                </div>
                            </div>
                        </details>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Bahnsteig" isOpen={true} isFrame={false}>
                    <div class="form-row column-layout">
                        <label for="global_platform_select" style="margin-bottom: 5px; display: block;">Konfiguration wählen:</label>
                        <select id="global_platform_select" style="width: 100%; padding: 5px; margin-bottom: 10px;" 
                                bind:value={journeyStore.stationContext.activePlatformName} 
                                onchange={() => {
                                    if (journeyStore.stationContext.activePlatformName && journeyStore.platforms[journeyStore.stationContext.activePlatformName]) {
                                        journeyStore.stationContext.platform = journeyStore.platforms[journeyStore.stationContext.activePlatformName];
                                    }
                                    trainDisplay.updateAll();
                                }}>
                            <option value="default">Standard (Generisch)</option>
                            {#each Object.keys(journeyStore.platforms) as pName}
                                <option value={pName}>{pName}</option>
                            {/each}
                        </select>
                        <label>Länge (m): <input type="number" id="platform_length" class="short-input" bind:value={journeyStore.stationContext.platform.length} oninput={() => trainDisplay.updateAll()}></label>
                        <label>Standort (m): <input type="number" id="platform_location" class="short-input" bind:value={journeyStore.stationContext.platform.location} oninput={() => trainDisplay.updateAll()}></label>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="DB IRIS Live-Daten" isOpen={true} isFrame={false}>
                    <div class="form-row column-layout" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                        <label style="display: block; margin-bottom: 5px;">
                            Auto-Update (Polling):
                            <select style="width: 100%; margin-top: 5px; padding: 4px;" bind:value={irisConfig.autoUpdateInterval} onchange={() => irisPollingService.restart()}>
                                <option value={0}>Aus</option>
                                <option value={20}>Alle 20 Sekunden</option>
                                <option value={30}>Alle 30 Sekunden</option>
                                <option value={60}>Alle 60 Sekunden</option>
                            </select>
                        </label>
                        <label style="display: block; margin-bottom: 5px; margin-top: 10px;">
                            Anzeige-Zeitfenster (Zukunft in Std.):
                            <input type="number" class="short-input" min="0" max="10" bind:value={irisConfig.futureWindowHours} onchange={() => irisPollingService.pollRealtime()}>
                        </label>
                        <label class="checkbox-label" style="margin-top: 10px;">
                            <input type="checkbox" bind:checked={irisConfig.autoAnnouncements}>
                            Autom. Ansagen (Verspätungen & Autoplay)
                        </label>
                        <label class="checkbox-label" style="margin-top: 10px;">
                            <input type="checkbox" bind:checked={irisConfig.autoSort} onchange={() => { if(irisConfig.autoSort) journeyStore.sortJourneys(); }}>
                            Züge automatisch nach Echtzeit sortieren
                        </label>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Ansagen" isOpen={true} isFrame={false}>
                    <div class="form-row column-layout" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                        <div style="margin-bottom: 15px;">
                            <label for="ansagen_vias_slider" style="display: block; margin-bottom: 5px;">
                                Anzahl Vias in Ansage: 
                                <strong>{ansagenStore.maxVias === 6 ? 'Alle' : ansagenStore.maxVias}</strong>
                            </label>
                            <input type="range" id="ansagen_vias_slider" min="0" max="6" step="1" style="width: 100%;" 
                                   bind:value={ansagenStore.maxVias} 
                                   onchange={() => {
                                       localStorage.setItem('ansagen_max_vias', ansagenStore.maxVias);
                                       journeyStore.journeys.forEach(j => j.autoGenerateAudioVias(ansagenStore.maxVias, ansagenStore.viaSortMode));
                                       trainDisplay.updateAll();
                                   }}>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <span style="display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.9em;">Via-Halte Auswahl (Ansage):</span>
                            <div class="segment-switch">
                                <label>
                                    <input type="radio" bind:group={ansagenStore.viaSortMode} value={1} onchange={() => {
                                        localStorage.setItem('ansagen_via_sort_mode', 1);
                                        journeyStore.journeys.forEach(j => j.autoGenerateAudioVias(ansagenStore.maxVias, ansagenStore.viaSortMode));
                                        trainDisplay.updateAll();
                                    }}>
                                    <span>Priorisiert</span>
                                </label>
                                <label>
                                    <input type="radio" bind:group={ansagenStore.viaSortMode} value={2} onchange={() => {
                                        localStorage.setItem('ansagen_via_sort_mode', 2);
                                        journeyStore.journeys.forEach(j => j.autoGenerateAudioVias(ansagenStore.maxVias, ansagenStore.viaSortMode));
                                        trainDisplay.updateAll();
                                    }}>
                                    <span>Standard</span>
                                </label>
                            </div>
                        </div>

                        <div class="variant-settings">
                            <span style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 0.9em;">Stationsnamen Varianten:</span>
                            
                            <div class="variant-row">
                                <span class="variant-label">Ziel (Abfahrt)</span>
                                <div class="segment-switch">
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantZiel} value={1} onchange={() => localStorage.setItem('ansagen_variant_ziel', ansagenStore.variantZiel)}>
                                        <span>Kurz</span>
                                    </label>
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantZiel} value={2} onchange={() => localStorage.setItem('ansagen_variant_ziel', ansagenStore.variantZiel)}>
                                        <span>Lang</span>
                                    </label>
                                </div>
                            </div>

                            <div class="variant-row">
                                <span class="variant-label">Herkunft (Ankunft)</span>
                                <div class="segment-switch">
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantHerkunft} value={1} onchange={() => localStorage.setItem('ansagen_variant_herkunft', ansagenStore.variantHerkunft)}>
                                        <span>Kurz</span>
                                    </label>
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantHerkunft} value={2} onchange={() => localStorage.setItem('ansagen_variant_herkunft', ansagenStore.variantHerkunft)}>
                                        <span>Lang</span>
                                    </label>
                                </div>
                            </div>

                            <div class="variant-row">
                                <span class="variant-label">Vias (Zwischenhalte)</span>
                                <div class="segment-switch">
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantVias} value={1} onchange={() => localStorage.setItem('ansagen_variant_vias', ansagenStore.variantVias)}>
                                        <span>Kurz</span>
                                    </label>
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantVias} value={2} onchange={() => localStorage.setItem('ansagen_variant_vias', ansagenStore.variantVias)}>
                                        <span>Lang</span>
                                    </label>
                                </div>
                            </div>

                            <div class="variant-row">
                                <span class="variant-label">Zugteilung</span>
                                <div class="segment-switch">
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantZugteilung} value={1} onchange={() => localStorage.setItem('ansagen_variant_zugteilung', ansagenStore.variantZugteilung)}>
                                        <span>Kurz</span>
                                    </label>
                                    <label>
                                        <input type="radio" bind:group={ansagenStore.variantZugteilung} value={2} onchange={() => localStorage.setItem('ansagen_variant_zugteilung', ansagenStore.variantZugteilung)}>
                                        <span>Lang</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 10px; font-size: 0.9em;">
                            {#if ansagenStore.status === 'loaded'}
                                <span style="color: #4CAF50;">✓ ZIP verknüpft:</span> {ansagenStore.fileName}
                                <div style="margin-top: 5px;">
                                    <button class="btn-secondary btn-sm" onclick={() => ansagenStore.clearFileRef()}>Verknüpfung aufheben</button>
                                </div>
                            {:else}
                                <span style="color: #ff9800;">⚠ Keine ZIP verknüpft</span>
                                <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">
                                    Lade die Audio-Daten (ZIP), um Ansagen abzuspielen.
                                </div>
                            {/if}
                        </div>
                        <button class="btn-primary" onclick={handleZipLoad}>
                            {ansagenStore.status === 'loaded' ? 'ZIP ändern' : 'ZIP laden'}
                        </button>
                        <!-- Fallback hidden file input for Safari/iOS or when File System Access API fails -->
                        <input type="file" bind:this={audioZipInput} style="display: none;" accept=".zip" onchange={handleWebZipUpload}>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Sonstige Einstellungen" isOpen={true} isFrame={false}>
                    <div class="form-row column-layout">
                        <div class="checkbox-group">
                            <label class="checkbox-label"><input type="checkbox" id="performance_mode_checkbox" bind:checked={isPerformanceMode}> Performance-Modus (30 FPS)</label>
                            <label class="checkbox-label"><input type="checkbox" bind:checked={uiState.hideLinkedArrivals}> Durchfahrt-Ankünfte verstecken</label>
                            <label class="checkbox-label"><input type="checkbox" bind:checked={uiState.enableDragAndDrop}> Listen-Sortierung per Drag & Drop (ansonsten nur Pfeile)</label>
                        </div>
                    </div>
                </CollapsibleSection>

                <div class="button-group-vertical" style="margin-top: 15px;">
                    <button id="export_all_btn" class="btn-secondary" onclick={exportConfig}>📤 Exportieren</button>
                    <button id="import_all_btn" class="btn-secondary" onclick={() => fileInput.click()}>📥 Importieren</button>
                    <input type="file" bind:this={fileInput} style="display: none;" accept=".json" onchange={handleFileImport}>
                    <button id="import_db_btn" class="btn-secondary" onclick={() => modalsComp?.openDbImport()}>🚄 DB-Daten importieren</button>
                </div>
                
            </div>
        </div>
    </div>
</div>

<style>
    .variant-settings {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 15px;
        margin-bottom: 15px;
        padding-top: 15px;
        border-top: 1px solid rgba(255,255,255,0.1);
    }
    .variant-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .variant-label {
        font-size: 0.9em;
    }
    .segment-switch {
        display: flex;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .segment-switch label {
        cursor: pointer;
        margin: 0;
    }
    .segment-switch input[type="radio"] {
        display: none;
    }
    .segment-switch span {
        display: block;
        padding: 4px 12px;
        font-size: 0.85em;
        transition: background 0.2s, color 0.2s;
        text-align: center;
        min-width: 50px;
    }
    .segment-switch input[type="radio"]:checked + span {
        background: var(--accent, #e2001a);
        color: white;
        font-weight: bold;
    }
    @media (max-width: 768px) {
        .segment-switch span {
            padding: 10px 12px;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    }
</style>
