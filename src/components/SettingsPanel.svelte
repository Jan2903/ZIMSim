<script>
    import { journeyStore, trainDisplay } from '../js/stores.js';
    import { StationService } from '../js/utils/stationService.js';
    import JourneyList from './JourneyList.svelte';
    import StationPicker from './StationPicker.svelte';
    import { setSimulatedTime, getSimulatedTime, timeConfig, config } from '../js/utils/config.js';
    import { MOT_PRESETS, getSmartHeaderString, MOT_ALL_KEYS } from '../js/utils/motManager.js';
    import { ansagenStore } from '../js/utils/ansagenStore.svelte.js';
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
        // In the CSV, it's ibnr, but getStationByIdOrName returned something.
        // Wait, the API/old code used `station.eva`. `StationService.searchStations` returns `{ibnr, ...}`.
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
                    <label for="entry_station_search" style="margin-bottom: 5px; display: block;">Station (Suche):</label>
                    <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <StationPicker 
                                bind:value={entry_station_search} 
                                placeholder="z.B. Hannover Hbf oder 8000152"
                                onSelect={selectStation}
                            />
                        </div>
                        <button id="btn_api_station_search" class="btn-secondary" style="padding: 8px 12px; margin: 0;" onclick={() => modalsComp?.openDbImport()} title="DB Import Dialog öffnen">API Suche</button>
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

                <h3 style="margin-top: 25px;">Bahnsteig</h3>
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

                <h3 style="margin-top: 25px;">Ansagen</h3>
                <div class="form-row column-layout" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
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

                <h3 style="margin-top: 25px;">Sonstige Einstellungen</h3>
                <div class="form-row column-layout">
                    <div class="checkbox-group">
                        <label class="checkbox-label"><input type="checkbox" id="performance_mode_checkbox" bind:checked={isPerformanceMode}> Performance-Modus (30 FPS)</label>
                    </div>
                </div>

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
