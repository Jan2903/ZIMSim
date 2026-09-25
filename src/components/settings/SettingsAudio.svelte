<!-- src/components/settings/SettingsAudio.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { ansagenStore } from '../../js/audio/ansagenStore.svelte.js';
    import { open } from '@tauri-apps/plugin-dialog';
    import ZimIcon from '../ZimIcon.svelte';

    let audioZipInput;

    /**
     * Lädt die Audio-ZIP-Datei entweder über Tauri-Dialog oder Browser File System Access API.
     * @returns {Promise<void>}
     */
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
                console.error('[SettingsAudio] Fehler beim Öffnen des Tauri-Dateidialogs:', e);
            }
        } else {
            // Web: Versuche moderne File System Access API
            if (window.showOpenFilePicker) {
                try {
                    const [fileHandle] = await window.showOpenFilePicker({
                        types: [{ description: 'ZIP Files', accept: { 'application/zip': ['.zip'] } }],
                        multiple: false
                    });
                    await ansagenStore.setFileRef(fileHandle, fileHandle.name);
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        console.error('[SettingsAudio] Fehler bei File System Access API:', e);
                        // Fallback zum klassischen Input
                        audioZipInput?.click();
                    }
                }
            } else {
                // Safari / iOS Fallback
                audioZipInput?.click();
            }
        }
    }

    /**
     * Fallback-Upload für Web-Browser ohne File System Access API.
     * @param {Event} e
     * @returns {void}
     */
    function handleWebZipUpload(e) {
        const file = e.target.files[0];
        if (file) {
            ansagenStore.setFileRef(file, file.name);
        }
        e.target.value = ''; // Reset
    }

    // Anschluss-Gleispaare State & Logik
    let newTrackA = $state('');
    let newTrackB = $state('');

    let currentStationId = $derived(journeyStore.stationContext.stationId || 'default');
    let currentStationTrackPairs = $derived(ansagenStore.getOppositeTrackPairs(currentStationId));
    let stationTracks = $derived(journeyStore.getAllTracks());

    /**
     * Fügt ein neues Gleispaar für gegenüberliegende Gleise hinzu.
     * @returns {void}
     */
    function handleAddTrackPair() {
        if (!newTrackA || !newTrackB) return;
        ansagenStore.addOppositeTrackPair(currentStationId, newTrackA, newTrackB);
        newTrackA = '';
        newTrackB = '';
    }

    /**
     * Entfernt ein Gleispaar aus der Konfiguration.
     * @param {number} index
     * @returns {void}
     */
    function handleRemoveTrackPair(index) {
        ansagenStore.removeOppositeTrackPair(currentStationId, index);
    }

    // --- Via-Steuerung & Hold-to-Repeat Logik ---
    let holdTimer = null;
    let holdInterval = null;
    let holdStartTime = 0;

    /**
     * Wendet Änderungen der Via-Einstellungen sofort auf alle Fahrten im Store an.
     * @returns {void}
     */
    function applyViaChanges() {
        journeyStore.journeys.forEach(j => {
            j.autoGenerateAudioVias(ansagenStore.effectiveMaxVias, ansagenStore.viaSortMode, ansagenStore.allVias);
        });
        trainDisplay.updateAll();
    }

    /**
     * Ändert die Anzahl der Vias schrittweise.
     * @param {number} delta - Schrittweite
     * @returns {void}
     */
    function stepVia(delta) {
        if (ansagenStore.allVias) {
            ansagenStore.setAllVias(false);
        }
        const current = ansagenStore.maxVias;
        const next = Math.max(0, Math.min(128, current + delta));
        if (next !== current || ansagenStore.allVias) {
            ansagenStore.setMaxVias(next);
            applyViaChanges();
        }
    }

    /**
     * Startet den Hold-to-Repeat-Modus bei PointerDown (unterstützt Maus & Mobile-Touch).
     * @param {number} delta - Schrittweite
     * @param {PointerEvent} e
     * @returns {void}
     */
    function startHold(delta, e) {
        if (e && e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch (_) {}
        }
        stopHold();
        stepVia(delta);
        holdStartTime = Date.now();

        holdTimer = setTimeout(() => {
            holdInterval = setInterval(() => {
                const elapsed = Date.now() - holdStartTime;
                // Nach 1,5s kontinuierlichem Halten Sprünge in 5er-Schritten (Beschleunigung)
                const stepDelta = elapsed > 1500 ? delta * 5 : delta;
                stepVia(stepDelta);
            }, 60);
        }, 350);
    }

    /**
     * Beendet den Hold-to-Repeat-Timer sicher.
     * @returns {void}
     */
    function stopHold() {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
        if (holdInterval) {
            clearInterval(holdInterval);
            holdInterval = null;
        }
    }

    /**
     * Schaltet zwischen "Alle Halte" und der eingestellten festen Zahl um.
     * @returns {void}
     */
    function toggleAllVias() {
        ansagenStore.setAllVias(!ansagenStore.allVias);
        applyViaChanges();
    }

    /**
     * Verarbeitet manuelle Tastatur-Eingaben im Zahlenfeld.
     * @param {Event} e
     * @returns {void}
     */
    function handleViaInput(e) {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) return;
        val = Math.max(0, Math.min(128, val));
        ansagenStore.setMaxVias(val);
        applyViaChanges();
    }

    $effect(() => {
        return () => {
            stopHold();
        };
    });
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Audio-Paket, Vias & Sprachvarianten -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="volume_high" size={18} />
            <h3>Ansagen & Akustik</h3>
        </div>
        <div class="card-body">
            <!-- Audio-ZIP Status & Upload -->
            <div class="audio-zip-status-box">
                {#if ansagenStore.status === 'loaded'}
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #10b981; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.88rem;">
                            <ZimIcon name="check" size={16} />
                            <span>Audio-Paket geladen</span>
                        </span>
                        <button type="button" class="btn-secondary btn-sm" onclick={() => ansagenStore.clearFileRef()}>
                            Verknüpfung aufheben
                        </button>
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">
                        Datei: <strong>{ansagenStore.fileName}</strong>
                    </div>
                {:else}
                    <div style="display: flex; align-items: center; gap: 8px; color: #f59e0b; font-weight: 600; font-size: 0.88rem;">
                        <ZimIcon name="warning" size={16} />
                        <span>Kein Audio-Paket (ZIP) verknüpft</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">
                        Lade die offizielle DB-Ansagen-ZIP, um automatische und manuelle Bahnhofsansagen wiederzugeben.
                    </div>
                {/if}

                <div style="margin-top: 12px;">
                    <button type="button" class="btn-primary" style="width: 100%;" onclick={handleZipLoad}>
                        <ZimIcon name="volume_high" size={14} />
                        <span>{ansagenStore.status === 'loaded' ? 'Anderes ZIP-Paket laden' : 'Audio-ZIP laden'}</span>
                    </button>
                    <!-- Fallback hidden file input -->
                    <input type="file" bind:this={audioZipInput} style="display: none;" accept=".zip" onchange={handleWebZipUpload}>
                </div>
            </div>

            <!-- Via-Halte in Ansagen -->
            <div class="sub-section" style="margin-top: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label for="ansagen_vias_input" class="field-label" style="margin: 0;">Anzahl Vias in Ansage:</label>
                    <button 
                        type="button" 
                        class="via-all-btn {ansagenStore.allVias ? 'active' : ''}"
                        onclick={toggleAllVias}
                        title={ansagenStore.allVias ? 'Klicken für feste Anzahl' : 'Klicken für alle Halte'}
                    >
                        {ansagenStore.allVias ? '✓ Alle Halte' : 'Alle Halte'}
                    </button>
                </div>

                <div class="via-stepper-box">
                    <button 
                        type="button" 
                        class="stepper-action-btn" 
                        disabled={ansagenStore.allVias || ansagenStore.maxVias <= 0}
                        onpointerdown={(e) => startHold(-1, e)}
                        onpointerup={stopHold}
                        onpointerleave={stopHold}
                        onpointercancel={stopHold}
                        aria-label="Anzahl verringern"
                        title="Verringern (gedrückt halten für schnellen Durchlauf)"
                    >
                        <ZimIcon name="arrow_down" size={15} />
                    </button>

                    <div class="stepper-center">
                        {#if ansagenStore.allVias}
                            <div class="stepper-all-badge">Alle Halte</div>
                        {:else}
                            <input 
                                type="number" 
                                id="ansagen_vias_input" 
                                class="stepper-num-input" 
                                min="0" 
                                max="128" 
                                value={ansagenStore.maxVias} 
                                oninput={handleViaInput}
                            />
                            <span class="stepper-unit-label">{ansagenStore.maxVias === 1 ? 'Halt' : 'Halte'}</span>
                        {/if}
                    </div>

                    <button 
                        type="button" 
                        class="stepper-action-btn" 
                        disabled={ansagenStore.allVias || ansagenStore.maxVias >= 128}
                        onpointerdown={(e) => startHold(1, e)}
                        onpointerup={stopHold}
                        onpointerleave={stopHold}
                        onpointercancel={stopHold}
                        aria-label="Anzahl erhöhen"
                        title="Erhöhen (gedrückt halten für schnellen Durchlauf)"
                    >
                        <ZimIcon name="arrow_up" size={15} />
                    </button>
                </div>

                <div class="via-hint-text">
                    {#if ansagenStore.allVias}
                        Alle Zwischenhalte mit aktivem Audio-Symbol werden abgespielt.
                    {:else if ansagenStore.maxVias === 0}
                        Keine Zwischenhalte in der Ansage (nur Start & Ziel).
                    {:else}
                        Bis zu {ansagenStore.maxVias} Zwischenhalt{ansagenStore.maxVias === 1 ? '' : 'e'} (0–128) werden automatisch markiert.
                    {/if}
                </div>
            </div>

            <div class="sub-section" style="margin-top: 14px;">
                <span class="field-label">Via-Halte Auswahl (Priorisierung):</span>
                <div class="segment-switch" style="width: 100%;">
                    <label>
                        <input 
                            type="radio" 
                            bind:group={ansagenStore.viaSortMode} 
                            value={1} 
                            onchange={() => {
                                localStorage.setItem('ansagen_via_sort_mode', 1);
                                applyViaChanges();
                            }}
                        >
                        <span>Priorisiert (Kategorie)</span>
                    </label>
                    <label>
                        <input 
                            type="radio" 
                            bind:group={ansagenStore.viaSortMode} 
                            value={2} 
                            onchange={() => {
                                localStorage.setItem('ansagen_via_sort_mode', 2);
                                applyViaChanges();
                            }}
                        >
                        <span>Standard (Chronologisch)</span>
                    </label>
                </div>
            </div>

            <!-- Stationsnamen-Varianten -->
            <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
                <span class="field-label" style="margin-bottom: 8px;">Stationsnamen-Aussprache (Varianten):</span>
                
                <div class="variant-grid">
                    <div class="variant-row">
                        <span class="variant-label">Ziel (Abfahrt):</span>
                        <div class="segment-switch-sm">
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
                        <span class="variant-label">Herkunft (Ankunft):</span>
                        <div class="segment-switch-sm">
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
                        <span class="variant-label">Vias (Zwischenhalte):</span>
                        <div class="segment-switch-sm">
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
                        <span class="variant-label">Zugteilung:</span>
                        <div class="segment-switch-sm">
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
            </div>
        </div>
    </div>

    <!-- Spalte 2: Anschluss-Ansagen & Bahnsteig-Beziehungen -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="link" size={18} />
            <h3>Anschluss-Ansagen & Gleisbeziehungen</h3>
        </div>
        <div class="card-body">
            <div class="form-row column-layout">
                <div class="setting-param-row">
                    <span>Max. Anzahl Anschlüsse:</span>
                    <input 
                        type="number" 
                        class="form-input short-input" 
                        min="1" 
                        max="10" 
                        value={ansagenStore.anschluesseMaxCount} 
                        oninput={(e) => ansagenStore.setAnschluesseMaxCount(e.currentTarget.value)}
                    >
                </div>

                <div class="setting-param-row">
                    <span>Suchzeitfenster (Min.):</span>
                    <input 
                        type="number" 
                        class="form-input short-input" 
                        min="5" 
                        max="180" 
                        value={ansagenStore.anschluesseTimeWindow} 
                        oninput={(e) => ansagenStore.setAnschluesseTimeWindow(e.currentTarget.value)}
                    >
                </div>

                <div class="setting-param-row">
                    <span>Min. Umsteigezeit normal (Min.):</span>
                    <input 
                        type="number" 
                        class="form-input short-input" 
                        min="1" 
                        max="30" 
                        value={ansagenStore.anschluesseMinTransfer} 
                        oninput={(e) => ansagenStore.setAnschluesseMinTransfer(e.currentTarget.value)}
                    >
                </div>

                <div class="setting-param-row">
                    <span>Min. Umsteigezeit gegenüber (Min.):</span>
                    <input 
                        type="number" 
                        class="form-input short-input" 
                        min="0" 
                        max="20" 
                        value={ansagenStore.anschluesseMinTransferOpposite} 
                        oninput={(e) => ansagenStore.setAnschluesseMinTransferOpposite(e.currentTarget.value)}
                    >
                </div>

                <div class="checkbox-group" style="margin-top: 14px; margin-bottom: 14px;">
                    <label class="checkbox-label">
                        <input 
                            type="checkbox" 
                            checked={ansagenStore.anschluesseIncludeDelays} 
                            onchange={(e) => ansagenStore.setAnschluesseIncludeDelays(e.currentTarget.checked)}
                        >
                        <span>Verspätungen ansagen (ab 5 Min.)</span>
                    </label>
                    <label class="checkbox-label" style="margin-top: 6px;">
                        <input 
                            type="checkbox" 
                            checked={ansagenStore.anschluesseIncludeDeviations} 
                            onchange={(e) => ansagenStore.setAnschluesseIncludeDeviations(e.currentTarget.checked)}
                        >
                        <span>Haltabweichungen ansagen</span>
                    </label>
                </div>

                <!-- Gegenüberliegende Gleise (selber Bahnsteig) -->
                <div class="sub-section" style="border-top: 1px solid var(--border); padding-top: 14px;">
                    <span class="field-label">Gleise direkt gegenüber (selber Bahnsteig):</span>
                    <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 10px;">
                        Station: <strong>{journeyStore.stationContext.stationName || 'Aktueller Bahnhof'}</strong>
                        {#if currentStationId !== 'default'} ({currentStationId}){/if}
                    </div>

                    {#if currentStationTrackPairs.length > 0}
                        <div class="track-pairs-list">
                            {#each currentStationTrackPairs as [tA, tB], idx}
                                <div class="track-pair-item">
                                    <span>Gleis <strong>{tA}</strong> ↔ Gleis <strong>{tB}</strong></span>
                                    <button 
                                        type="button" 
                                        class="btn-icon" 
                                        onclick={() => handleRemoveTrackPair(idx)} 
                                        title="Gleispaar entfernen"
                                    >
                                        <ZimIcon name="close" size={12} />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="empty-hint">
                            Keine benutzerdefinierten Paare. DB-Standard für Mittelbahnsteige aktiv (2 ↔ 3, 4 ↔ 5 etc.).
                        </div>
                    {/if}

                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 8px;">
                        <input 
                            type="text" 
                            list="opposite-tracks-datalist" 
                            placeholder="Gleis A" 
                            bind:value={newTrackA} 
                            class="form-input short-input" 
                            style="flex: 1;"
                        >
                        <span style="opacity: 0.5;">↔</span>
                        <input 
                            type="text" 
                            list="opposite-tracks-datalist" 
                            placeholder="Gleis B" 
                            bind:value={newTrackB} 
                            class="form-input short-input" 
                            style="flex: 1;"
                        >
                        <button 
                            type="button" 
                            class="btn-secondary btn-sm" 
                            onclick={handleAddTrackPair} 
                            title="Gleispaar hinzufügen"
                            style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;"
                        >
                            <ZimIcon name="plus" size={14} />
                            <span>Paar</span>
                        </button>
                    </div>
                    <datalist id="opposite-tracks-datalist">
                        {#each stationTracks as tr}
                            <option value={tr}>{tr}</option>
                        {/each}
                    </datalist>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .settings-tab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        align-items: start;
    }

    @media (max-width: 600px) {
        .settings-tab-grid {
            grid-template-columns: 1fr;
            gap: 12px;
        }
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

    .audio-zip-status-box {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 14px;
    }

    .variant-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .variant-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .variant-label {
        font-size: 0.82rem;
        color: var(--text-muted, #94a3b8);
    }

    .segment-switch-sm {
        display: inline-flex;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 4px;
        padding: 2px;
    }

    .segment-switch-sm label {
        cursor: pointer;
        padding: 2px 8px;
        font-size: 0.75rem;
        border-radius: 3px;
        color: var(--text-muted, #94a3b8);
        transition: all 0.15s ease;
    }

    .segment-switch-sm input {
        display: none;
    }

    .segment-switch-sm label:has(input:checked) {
        background: var(--accent, #3b82f6);
        color: #fff;
        font-weight: 600;
    }

    .setting-param-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 0.85rem;
        color: var(--text-main, #f8fafc);
    }

    .track-pairs-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 10px;
    }

    .track-pair-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.05);
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 0.82rem;
    }

    .empty-hint {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        margin-bottom: 10px;
        font-style: italic;
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

    .short-input {
        width: 60px;
        text-align: center;
    }

    /* Via Stepper */
    .via-all-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--border, #334155);
        color: var(--text-muted, #94a3b8);
        border-radius: 4px;
        padding: 3px 10px;
        font-size: 0.78rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
    }

    .via-all-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        color: var(--text-main, #f8fafc);
    }

    .via-all-btn.active {
        background: var(--accent, #3b82f6);
        border-color: var(--accent, #3b82f6);
        color: #ffffff;
        font-weight: 600;
    }

    .via-stepper-box {
        display: flex;
        align-items: center;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        overflow: hidden;
        height: 42px;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .stepper-action-btn {
        width: 48px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.04);
        border: none;
        color: var(--text-main, #f8fafc);
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        touch-action: none; /* Verhindert Gesten/Scrollen auf Mobile beim Gedrückthalten */
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none; /* Verhindert iOS-Kontextmenü */
    }

    .stepper-action-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.12);
        color: var(--accent, #3b82f6);
    }

    .stepper-action-btn:active:not(:disabled) {
        background: var(--accent, #3b82f6);
        color: #ffffff;
    }

    .stepper-action-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .stepper-center {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 100%;
        border-left: 1px solid rgba(255, 255, 255, 0.06);
        border-right: 1px solid rgba(255, 255, 255, 0.06);
    }

    .stepper-all-badge {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--accent, #3b82f6);
        letter-spacing: 0.02em;
    }

    .stepper-num-input {
        width: 52px;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-main, #f8fafc);
        font-size: 0.95rem;
        font-weight: 600;
        text-align: right;
        -moz-appearance: textfield;
    }

    .stepper-num-input::-webkit-outer-spin-button,
    .stepper-num-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .stepper-unit-label {
        font-size: 0.82rem;
        color: var(--text-muted, #94a3b8);
        user-select: none;
    }

    .via-hint-text {
        font-size: 0.76rem;
        color: var(--text-muted, #94a3b8);
        margin-top: 6px;
        line-height: 1.35;
    }
</style>
