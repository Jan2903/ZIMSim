<!-- src/components/settings/SettingsStationTime.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { setSimulatedTime, getSimulatedTime, timeConfig } from '../../js/core/utils/config.js';
    import { MOT_PRESETS, getSmartHeaderString, MOT_ALL_KEYS } from '../../js/features/station/motManager.js';
    import StationPicker from '../StationPicker.svelte';
    import PlatformEditor from './PlatformEditor.svelte';
    import ZimIcon from '../ZimIcon.svelte';

    // Suchtext für die Bahnhofssuche
    let entry_station_search = $state(journeyStore.stationContext.stationName || '');

    // Zeit-Logik & Simulation
    let autoUpdateTime = $state(timeConfig.isRunning);
    let customTimeString = $state('');

    /**
     * Formatiert ein Datum für das HTML datetime-local Input-Feld.
     * @param {Date} date
     * @returns {string}
     */
    function formatForInput(date) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    }

    $effect(() => {
        timeConfig.isRunning = autoUpdateTime;
        
        let interval;
        if (autoUpdateTime) {
            // Aktualisiere das Eingabefeld jede Sekunde bei automatischer Zeitfortschreibung
            interval = setInterval(() => {
                customTimeString = formatForInput(getSimulatedTime());
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    });

    // Initialer Zeit-Setup Fallback
    $effect(() => {
        if (!customTimeString && !autoUpdateTime) {
            customTimeString = formatForInput(getSimulatedTime());
        }
    });

    /**
     * Setzt die simulierte Zeit auf die aktuelle reale Systemzeit.
     * @returns {void}
     */
    function setCurrentTime() {
        setSimulatedTime(new Date());
        customTimeString = formatForInput(getSimulatedTime());
    }

    /**
     * Aktualisiert die simulierte Zeit manuell bei Eingabeänderung.
     * @param {Event} e
     * @returns {void}
     */
    function onCustomTimeChange(e) {
        if (e.target.value) {
            setSimulatedTime(new Date(e.target.value));
            customTimeString = e.target.value;
        }
    }

    /**
     * Wählt einen Bahnhof aus und aktualisiert den StationContext.
     * @param {object} station
     * @returns {void}
     */
    function selectStation(station) {
        entry_station_search = station.name;
        journeyStore.stationContext.stationName = station.name;
        journeyStore.stationContext.stationId = station.ibnr || station.eva;
    }

    /**
     * Wählt ein Verkehrsmittel-Preset (MoT) aus.
     * @param {string} preset
     * @returns {void}
     */
    function setMotPreset(preset) {
        journeyStore.activeMots = [...MOT_PRESETS[preset]];
        trainDisplay.updateAll();
    }

    let motSummary = $derived(getSmartHeaderString(journeyStore.activeMots));

    // Dynamische Gleisliste aus Zügen und manuell hinzugefügten Gleisen
    let allAvailableTracks = $derived.by(() => {
        const fromJourneys = journeyStore.getAllTracks();
        const all = new Set([...fromJourneys, ...journeyStore.activeTracks]);
        return Array.from(all).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
    });

    let trackSummary = $derived(journeyStore.activeTracks.length === 0 ? 'Alle Gleise aktiv' : `${journeyStore.activeTracks.length} Gleise gefiltert`);

    /**
     * Schaltet ein Gleis im Filter an oder aus.
     * @param {string} track
     * @returns {void}
     */
    function toggleTrack(track) {
        if (journeyStore.activeTracks.includes(track)) {
            journeyStore.activeTracks = journeyStore.activeTracks.filter(t => t !== track);
        } else {
            journeyStore.activeTracks = [...journeyStore.activeTracks, track];
        }
        trainDisplay.updateAll();
    }

    /**
     * Invertiert die aktuelle Gleisauswahl.
     * @returns {void}
     */
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

    /**
     * Fügt ein manuelles Gleis zum Filter hinzu.
     * @returns {void}
     */
    function addManualTrack() {
        if (manualTrackInput && !journeyStore.activeTracks.includes(manualTrackInput)) {
            journeyStore.activeTracks = [...journeyStore.activeTracks, manualTrackInput];
            trainDisplay.updateAll();
        }
        manualTrackInput = '';
    }
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Bahnhof / Station & Kontext -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="station" size={18} />
            <h3>Bahnhof & Betriebsstelle</h3>
        </div>
        <div class="card-body">
            <div class="form-row column-layout">
                <label for="station_search_input" class="field-label">Station suchen:</label>
                <StationPicker 
                    bind:value={entry_station_search} 
                    placeholder="z.B. Hannover Hbf oder 8000152"
                    onSelect={selectStation}
                />
            </div>

            <div class="station-meta-box">
                <div class="meta-row">
                    <span class="meta-label">Aktive Station:</span>
                    <span class="meta-value">{journeyStore.stationContext.stationName || 'Nicht gewählt'}</span>
                </div>
                {#if journeyStore.stationContext.stationId}
                    <div class="meta-row">
                        <span class="meta-label">IBNR / EVA:</span>
                        <span class="meta-value font-mono">{journeyStore.stationContext.stationId}</span>
                    </div>
                {/if}
            </div>

            <!-- Bahnsteig & Position (Konfiguration, Abschnitte & Sektoren) -->
            <div class="sub-section" style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
                <h4 class="sub-title" style="margin-bottom: 12px;">Bahnsteig & Position</h4>
                <PlatformEditor />
            </div>
        </div>
    </div>

    <!-- Spalte 2: Simulations-Uhrzeit -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="clock" size={18} />
            <h3>Simulations-Zeit</h3>
        </div>
        <div class="card-body">
            <div class="form-row column-layout">
                <label for="custom_time_input" class="field-label">Simulations-Datum & Uhrzeit:</label>
                <input 
                    type="datetime-local" 
                    step="1" 
                    id="custom_time_input" 
                    class="form-input" 
                    value={customTimeString} 
                    onchange={onCustomTimeChange}
                >

                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button type="button" class="btn-secondary btn-sm" style="flex: 1;" onclick={setCurrentTime}>
                        <ZimIcon name="restart" size={14} />
                        <span>Systemzeit setzen</span>
                    </button>
                </div>

                <div class="checkbox-group" style="margin-top: 16px;">
                    <label class="checkbox-label">
                        <input type="checkbox" id="auto_update_time_checkbox" bind:checked={autoUpdateTime}>
                        <span>Zeit automatisch simulieren (Sekundentakt)</span>
                    </label>
                </div>
            </div>
        </div>
    </div>

    <!-- Spalte 3: Gleise & Verkehrsmittel (MoT) -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="train" size={18} />
            <h3>Gleise & Verkehrsmittel</h3>
        </div>
        <div class="card-body">
            <!-- Gleis-Filter -->
            <div class="sub-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 class="sub-title" style="margin: 0;">Gleis-Filter</h4>
                    <span class="badge-subtle">{trackSummary}</span>
                </div>

                <div class="track-actions" style="display: flex; gap: 6px; margin-bottom: 10px;">
                    <button type="button" class="btn-secondary btn-sm" onclick={invertTracks} title="Auswahl umkehren">
                        Invertieren
                    </button>
                    <input 
                        type="text" 
                        class="form-input short-input" 
                        placeholder="Gl." 
                        style="width: 50px; margin: 0; padding: 4px;" 
                        bind:value={manualTrackInput} 
                        onkeydown={(e) => { if (e.key === 'Enter') addManualTrack(); }}
                    >
                    <button type="button" class="btn-secondary btn-sm" onclick={addManualTrack} title="Gleis hinzufügen">
                        <ZimIcon name="plus" size={14} />
                    </button>
                </div>

                <div class="track-pills-container">
                    {#each allAvailableTracks as track}
                        <label class="track-pill" class:selected={journeyStore.activeTracks.includes(track)}>
                            <input 
                                type="checkbox" 
                                checked={journeyStore.activeTracks.includes(track)} 
                                onchange={() => toggleTrack(track)}
                            >
                            <span>Gleis {track}</span>
                        </label>
                    {/each}
                </div>
            </div>

            <!-- Verkehrsmittel (MoT) -->
            <div class="sub-section" style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 class="sub-title" style="margin: 0;">Verkehrsmittel (MoT)</h4>
                </div>
                <div class="mot-summary-text" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                    {motSummary}
                </div>

                <div class="mot-presets" style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;">
                    {#each Object.keys(MOT_PRESETS) as preset}
                        <button type="button" class="btn-secondary btn-sm mot-preset-btn" onclick={() => setMotPreset(preset)}>
                            {preset}
                        </button>
                    {/each}
                </div>

                <div class="checkbox-grid">
                    {#each MOT_ALL_KEYS as motKey}
                        <label class="checkbox-label">
                            <input 
                                type="checkbox" 
                                value={motKey} 
                                bind:group={journeyStore.activeMots} 
                                onchange={() => trainDisplay.updateAll()}
                            >
                            <span>{motKey}</span>
                        </label>
                    {/each}
                </div>
            </div>
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

    .station-meta-box {
        margin-top: 12px;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 0.82rem;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .meta-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .meta-label {
        color: var(--text-muted, #94a3b8);
    }

    .meta-value {
        font-weight: 600;
        color: var(--text-main, #f8fafc);
    }

    .font-mono {
        font-family: monospace;
    }

    .sub-section {
        margin-top: 14px;
    }

    .sub-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-main, #f8fafc);
        margin-bottom: 8px;
    }

    .badge-subtle {
        font-size: 0.72rem;
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-muted, #94a3b8);
        padding: 2px 6px;
        border-radius: 4px;
    }

    .track-pills-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 160px;
        overflow-y: auto;
        padding: 4px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 6px;
    }

    .track-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 4px;
        font-size: 0.78rem;
        cursor: pointer;
        user-select: none;
        transition: all 0.15s ease;
    }

    .track-pill.selected {
        background: rgba(59, 130, 246, 0.15);
        border-color: var(--accent, #3b82f6);
        color: var(--accent, #3b82f6);
        font-weight: 600;
    }

    .track-pill input {
        display: none;
    }

    .checkbox-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 8px;
    }
</style>
