<!-- src/components/settings/SettingsAudio.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { ansagenStore } from '../../js/audio/ansagenStore.svelte.js';
    import { toastStore } from '../../js/core/state/toastStore.svelte.js';
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
                toastStore.error('Audio-Paket konnte nicht geöffnet werden.');
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
                        toastStore.error('Audio-Paket konnte nicht geladen werden.');
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

    // --- Hold-to-Repeat Logik (Vias & Anschluss-Parameter) ---
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
     * Begrenzt einen numerischen Wert auf den erlaubten Bereich.
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    function clampValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function setAnschluesseMaxCount(value) {
        ansagenStore.setAnschluesseMaxCount(value);
    }

    function setAnschluesseTimeWindow(value) {
        ansagenStore.setAnschluesseTimeWindow(value);
    }

    function setAnschluesseMinTransfer(value) {
        ansagenStore.setAnschluesseMinTransfer(value);
    }

    function setAnschluesseMinTransferOpposite(value) {
        ansagenStore.setAnschluesseMinTransferOpposite(value);
    }

    function stepAnschluesseMaxCount(delta) {
        setAnschluesseMaxCount(clampValue(ansagenStore.anschluesseMaxCount + delta, 1, 10));
    }

    function stepAnschluesseTimeWindow(delta) {
        setAnschluesseTimeWindow(clampValue(ansagenStore.anschluesseTimeWindow + delta, 5, 180));
    }

    function stepAnschluesseMinTransfer(delta) {
        setAnschluesseMinTransfer(clampValue(ansagenStore.anschluesseMinTransfer + delta, 1, 30));
    }

    function stepAnschluesseMinTransferOpposite(delta) {
        setAnschluesseMinTransferOpposite(clampValue(ansagenStore.anschluesseMinTransferOpposite + delta, 0, 20));
    }

    /**
     * Verarbeitet manuelle Eingaben in numerischen Einstellungsfeldern.
     * @param {Event} e
     * @param {number} min
     * @param {number} max
     * @param {(value: number) => void} setFn
     * @returns {void}
     */
    function handleNumericInput(e, min, max, setFn) {
        const value = parseInt(e.target.value, 10);
        if (Number.isNaN(value) || value < min || value > max) return;
        setFn(value);
    }

    /**
     * Stellt beim Verlassen eines numerischen Feldes einen gültigen Wert sicher.
     * @param {Event} e
     * @param {number} min
     * @param {number} max
     * @param {number} current
     * @param {(value: number) => void} setFn
     * @returns {void}
     */
    function handleNumericBlur(e, min, max, current, setFn) {
        let value = parseInt(e.target.value, 10);
        value = Number.isNaN(value) ? current : clampValue(value, min, max);
        e.target.value = value;
        setFn(value);
    }

    /**
     * Startet den Hold-to-Repeat-Modus bei PointerDown (unterstützt Maus & Mobile-Touch).
     * @param {number} delta - Schrittweite pro Wiederholung
     * @param {(delta: number) => void} stepFn - Funktion, die den neuen Wert anwendet
     * @param {PointerEvent} e
     * @returns {void}
     */
    function startHoldRepeat(delta, stepFn, e) {
        if (e && e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch (err) {
                console.warn('[SettingsAudio] Pointer-Capture konnte nicht gesetzt werden:', err);
            }
        }
        stopHold();
        stepFn(delta);
        holdStartTime = Date.now();

        // Globale Freigabe-Listener: beenden das Wiederholen auch, wenn der Button
        // während des Haltens deaktiviert wird oder der Zeiger das Element verlässt.
        window.addEventListener('pointerup', stopHold);
        window.addEventListener('pointercancel', stopHold);
        window.addEventListener('blur', stopHold);

        holdTimer = setTimeout(() => {
            holdInterval = setInterval(() => {
                const elapsed = Date.now() - holdStartTime;
                // Nach 1,5s kontinuierlichem Halten Sprünge in 5er-Schritten (Beschleunigung)
                const stepDelta = elapsed > 1500 ? delta * 5 : delta;
                stepFn(stepDelta);
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
        window.removeEventListener('pointerup', stopHold);
        window.removeEventListener('pointercancel', stopHold);
        window.removeEventListener('blur', stopHold);
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

    /**
     * Stellt sicher, dass das Feld beim Verlassen einen gültigen Wert hat.
     * @param {Event} e
     * @returns {void}
     */
    function handleViaBlur(e) {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) {
            val = ansagenStore.maxVias;
        } else {
            val = Math.max(0, Math.min(128, val));
        }
        e.target.value = val;
        ansagenStore.setMaxVias(val);
        applyViaChanges();
    }

    $effect(() => {
        return () => {
            stopHold();
        };
    });
</script>

{#snippet numericStepper(id, label, value, min, max, stepFn, setFn)}
    <div class="setting-param-row">
        <label class="setting-param-label" for={id}>{label}</label>
        <div class="param-stepper">
            <button 
                type="button" 
                class="stepper-action-btn" 
                disabled={value <= min}
                onpointerdown={(e) => startHoldRepeat(-1, stepFn, e)}
                onpointerup={stopHold}
                onpointerleave={stopHold}
                onpointercancel={stopHold}
                aria-label="{label} verringern"
                title="Verringern (gedrückt halten für schnellen Durchlauf)"
            >
                <ZimIcon name="minus" size={14} />
            </button>
            <input 
                id={id}
                type="number" 
                class="param-stepper-input" 
                min={min} 
                max={max} 
                value={value}
                oninput={(e) => handleNumericInput(e, min, max, setFn)}
                onblur={(e) => handleNumericBlur(e, min, max, value, setFn)}
            />
            <button 
                type="button" 
                class="stepper-action-btn" 
                disabled={value >= max}
                onpointerdown={(e) => startHoldRepeat(1, stepFn, e)}
                onpointerup={stopHold}
                onpointerleave={stopHold}
                onpointercancel={stopHold}
                aria-label="{label} erhöhen"
                title="Erhöhen (gedrückt halten für schnellen Durchlauf)"
            >
                <ZimIcon name="plus" size={14} />
            </button>
        </div>
    </div>
{/snippet}

<div class="settings-tab-grid">
    <!-- Spalte 1: Vias, Sprachvarianten & optionale Audio-Quelle -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="volume_high" size={18} />
            <h3>Ansagen & Akustik</h3>
        </div>
        <div class="card-body">
            <!-- Via-Halte in Ansagen -->
            <div class="sub-section">
                <div class="via-header">
                    <label for="ansagen_vias_input" class="field-label" style="margin: 0;">Anzahl Vias in Ansage:</label>
                    <button 
                        type="button" 
                        class="via-all-btn {ansagenStore.allVias ? 'active' : ''}"
                        onclick={toggleAllVias}
                        title={ansagenStore.allVias ? 'Klicken für feste Anzahl' : 'Klicken für alle Halte'}
                    >
                        {#if ansagenStore.allVias}
                            <ZimIcon name="check" size={13} />
                        {/if}
                        <span>Alle Halte</span>
                    </button>
                </div>

                <div class="via-stepper-box">
                    <button 
                        type="button" 
                        class="stepper-action-btn" 
                        disabled={ansagenStore.allVias || ansagenStore.maxVias <= 0}
                        onpointerdown={(e) => startHoldRepeat(-1, stepVia, e)}
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
                                onblur={handleViaBlur}
                            />
                            <span class="stepper-unit-label">{ansagenStore.maxVias === 1 ? 'Halt' : 'Halte'}</span>
                        {/if}
                    </div>

                    <button 
                        type="button" 
                        class="stepper-action-btn" 
                        disabled={ansagenStore.allVias || ansagenStore.maxVias >= 128}
                        onpointerdown={(e) => startHoldRepeat(1, stepVia, e)}
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
                                ansagenStore.setViaSortMode(1);
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
                                ansagenStore.setViaSortMode(2);
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
                                <input type="radio" bind:group={ansagenStore.variantZiel} value={1} onchange={() => ansagenStore.setVariantZiel(1)}>
                                <span>Kurz</span>
                            </label>
                            <label>
                                <input type="radio" bind:group={ansagenStore.variantZiel} value={2} onchange={() => ansagenStore.setVariantZiel(2)}>
                                <span>Lang</span>
                            </label>
                        </div>
                    </div>

                    <div class="variant-row">
                        <span class="variant-label">Herkunft (Ankunft):</span>
                        <div class="segment-switch-sm">
                            <label>
                                <input type="radio" bind:group={ansagenStore.variantHerkunft} value={1} onchange={() => ansagenStore.setVariantHerkunft(1)}>
                                <span>Kurz</span>
                            </label>
                            <label>
                                <input type="radio" bind:group={ansagenStore.variantHerkunft} value={2} onchange={() => ansagenStore.setVariantHerkunft(2)}>
                                <span>Lang</span>
                            </label>
                        </div>
                    </div>

                    <div class="variant-row">
                        <span class="variant-label">Vias (Zwischenhalte):</span>
                        <div class="segment-switch-sm">
                            <label>
                                <input type="radio" bind:group={ansagenStore.variantVias} value={1} onchange={() => ansagenStore.setVariantVias(1)}>
                                <span>Kurz</span>
                            </label>
                            <label>
                                <input type="radio" bind:group={ansagenStore.variantVias} value={2} onchange={() => ansagenStore.setVariantVias(2)}>
                                <span>Lang</span>
                            </label>
                        </div>
                    </div>

                    <div class="variant-row">
                        <span class="variant-label">Zugteilung:</span>
                        <div class="segment-switch-sm">
                            <label>
                                <input type="radio" bind:group={ansagenStore.variantZugteilung} value={1} onchange={() => ansagenStore.setVariantZugteilung(1)}>
                                <span>Kurz</span>
                            </label>
                            <label>
                                <input type="radio" bind:group={ansagenStore.variantZugteilung} value={2} onchange={() => ansagenStore.setVariantZugteilung(2)}>
                                <span>Lang</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Zusätzliche Ansagenelemente -->
            <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
                <span class="field-label" style="margin-bottom: 8px;">Zusätzliche Ansagenelemente:</span>
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        checked={ansagenStore.ansageAbschnitte} 
                        onchange={(e) => ansagenStore.setAnsageAbschnitte(e.currentTarget.checked)}
                    >
                    <span>Bahnsteigabschnitte („in den Abschnitten...“)</span>
                </label>
                <div class="field-hint with-indent">
                    Sagt bei Einfahrt und Steht-Ansagen die Abschnitte an (z. B. „in den Abschnitten C bis E“), sofern Wagenreihung oder Abschnitte vorhanden sind.
                </div>

                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        checked={ansagenStore.ansageErsteKlasse} 
                        onchange={(e) => ansagenStore.setAnsageErsteKlasse(e.currentTarget.checked)}
                    >
                    <span>1. Klasse Abschnitte („Heute 1. Klasse in Abschnitt...“)</span>
                </label>
                <div class="field-hint with-indent">
                    Sagt bei Einfahrt und Steht-Ansagen die Abschnitte der 1. Klasse an (z. B. „Heute 1. Klasse in Abschnitt A und B“).
                </div>

                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        checked={ansagenStore.einfahrtBitteNichtEinsteigen} 
                        onchange={(e) => ansagenStore.setEinfahrtBitteNichtEinsteigen(e.currentTarget.checked)}
                    >
                    <span>„Bitte nicht einsteigen“ bei reinen Ankünften</span>
                </label>
                <div class="field-hint with-indent">
                    Hängt den Hinweis ans Ende der Einfahrtsansage von Zügen an, die am Bahnhof enden.
                </div>
            </div>

            <!-- Optionale Audio-Quelle (dezent, eingeklappt) -->
            <details class="audio-package-details">
                <summary class="audio-package-summary">
                    <span class="audio-package-title">
                        <ZimIcon name={ansagenStore.status === 'loaded' ? 'check' : 'volume_low'} size={14} />
                        <span>Audio-Paket {ansagenStore.status === 'loaded' ? 'verknüpft' : '(optional)'}</span>
                    </span>
                    {#if ansagenStore.status === 'loaded'}
                        <span class="audio-package-file" title={ansagenStore.fileName}>{ansagenStore.fileName}</span>
                    {/if}
                </summary>
                <div class="audio-package-content">
                    <button type="button" class="btn-secondary btn-sm audio-package-btn" onclick={handleZipLoad}>
                        <ZimIcon name="volume_low" size={14} />
                        <span>{ansagenStore.status === 'loaded' ? 'Anderes ZIP-Paket laden' : 'Audio-ZIP laden'}</span>
                    </button>
                    {#if ansagenStore.status === 'loaded'}
                        <button type="button" class="btn-secondary btn-sm audio-package-btn" onclick={() => ansagenStore.clearFileRef()}>
                            <ZimIcon name="close" size={14} />
                            <span>Verknüpfung aufheben</span>
                        </button>
                    {/if}
                    <!-- Fallback hidden file input -->
                    <input type="file" bind:this={audioZipInput} style="display: none;" accept=".zip" onchange={handleWebZipUpload}>
                </div>
            </details>
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
                {@render numericStepper('anschluesse_max_count', 'Max. Anzahl Anschlüsse', ansagenStore.anschluesseMaxCount, 1, 10, stepAnschluesseMaxCount, setAnschluesseMaxCount)}

                {@render numericStepper('anschluesse_time_window', 'Suchzeitfenster (Min.)', ansagenStore.anschluesseTimeWindow, 5, 180, stepAnschluesseTimeWindow, setAnschluesseTimeWindow)}

                {@render numericStepper('anschluesse_min_transfer', 'Min. Umsteigezeit normal (Min.)', ansagenStore.anschluesseMinTransfer, 1, 30, stepAnschluesseMinTransfer, setAnschluesseMinTransfer)}

                {@render numericStepper('anschluesse_min_transfer_opposite', 'Min. Umsteigezeit gegenüber (Min.)', ansagenStore.anschluesseMinTransferOpposite, 0, 20, stepAnschluesseMinTransferOpposite, setAnschluesseMinTransferOpposite)}

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

                    <div class="track-pair-add">
                        <input 
                            type="text" 
                            list="opposite-tracks-datalist" 
                            placeholder="Gleis A" 
                            bind:value={newTrackA} 
                            class="form-input track-pair-input" 
                        >
                        <span class="track-pair-arrow" aria-hidden="true">↔</span>
                        <input 
                            type="text" 
                            list="opposite-tracks-datalist" 
                            placeholder="Gleis B" 
                            bind:value={newTrackB} 
                            class="form-input track-pair-input" 
                        >
                        <button 
                            type="button" 
                            class="btn-secondary btn-sm track-pair-add-btn" 
                            onclick={handleAddTrackPair} 
                            title="Gleispaar hinzufügen"
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
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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
        min-width: 0;
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

    .field-hint {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        margin-top: 4px;
        line-height: 1.4;
    }

    .field-hint.with-indent {
        margin-left: 24px;
        margin-bottom: 12px;
    }

    .via-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 8px;
    }

    /* Dezente, eingeklappte Audio-Paket-Verwaltung */
    .audio-package-details {
        margin-top: 18px;
        padding-top: 10px;
        border-top: 1px solid var(--border, #334155);
    }

    .audio-package-summary {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 4px 2px;
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        cursor: pointer;
        user-select: none;
        list-style: none;
    }

    .audio-package-summary::-webkit-details-marker {
        display: none;
    }

    .audio-package-summary::before {
        content: "";
        flex-shrink: 0;
        width: 6px;
        height: 6px;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: rotate(-45deg);
        transition: transform 0.2s ease;
    }

    .audio-package-details[open] > .audio-package-summary::before {
        transform: rotate(45deg);
    }

    .audio-package-summary:hover {
        color: var(--text-main, #f8fafc);
    }

    .audio-package-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .audio-package-file {
        min-width: 0;
        margin-left: auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.75;
    }

    .audio-package-content {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 4px 0 2px 14px;
    }

    .audio-package-btn {
        background: transparent;
        border-color: transparent;
        color: var(--text-muted, #94a3b8);
        font-size: 0.76rem;
        padding: 4px 8px;
    }

    .audio-package-btn:hover {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-main, #f8fafc);
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
        gap: 12px;
    }

    .variant-label {
        min-width: 0;
        font-size: 0.82rem;
        color: var(--text-muted, #94a3b8);
    }

    .segment-switch-sm {
        display: inline-flex;
        flex-shrink: 0;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 4px;
        padding: 2px;
    }

    .segment-switch-sm label {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        cursor: pointer;
        padding: 3px 10px;
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
        gap: 12px;
        margin-bottom: 8px;
        font-size: 0.85rem;
        color: var(--text-main, #f8fafc);
    }

    .setting-param-label {
        display: block;
        flex: 1;
        min-width: 0;
        margin: 0;
        font-size: 0.82rem;
        font-weight: 500;
        line-height: 1.3;
        color: var(--text-muted, #94a3b8);
    }

    .param-stepper {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        height: 34px;
        overflow: hidden;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .param-stepper .stepper-action-btn {
        width: 34px;
    }

    .param-stepper-input {
        width: 46px;
        height: 100%;
        padding: 0;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-main, #f8fafc);
        font-size: 0.88rem;
        font-weight: 600;
        text-align: center;
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .param-stepper-input:focus {
        background: rgba(255, 255, 255, 0.04);
    }

    .param-stepper-input::-webkit-outer-spin-button,
    .param-stepper-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
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
        gap: 10px;
        background: rgba(255, 255, 255, 0.05);
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 0.82rem;
    }

    .track-pair-item > span {
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .track-pair-item .btn-icon {
        flex-shrink: 0;
    }

    .empty-hint {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        margin-bottom: 10px;
        line-height: 1.4;
        font-style: italic;
    }

    .track-pair-add {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        margin-top: 8px;
    }

    .track-pair-input {
        width: 100%;
        min-width: 0;
        text-align: center;
    }

    .track-pair-arrow {
        font-size: 0.9rem;
        opacity: 0.5;
    }

    .track-pair-add-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
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

    /* Via Stepper */
    .via-all-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-height: 30px;
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
        appearance: textfield;
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

    /* Tablet: Parameter und Gleispaar-Eingabe sauber umbrechen */
    @media (max-width: 900px) {
        .variant-row {
            flex-wrap: wrap;
        }

        .track-pair-add {
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        }

        .track-pair-add-btn {
            grid-column: 1 / -1;
            justify-content: center;
        }
    }

    @media (max-width: 768px) {
        .card-header {
            padding: 12px 14px;
        }

        .card-body {
            padding: 14px;
        }

        .variant-row {
            gap: 8px;
        }

        .variant-label {
            flex: 1 1 100%;
        }

        .segment-switch-sm {
            width: 100%;
        }

        .segment-switch-sm label {
            flex: 1;
            min-height: 36px;
        }

        .setting-param-row {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
        }

        .param-stepper {
            width: 100%;
            height: 40px;
        }

        .param-stepper .stepper-action-btn {
            width: 44px;
        }

        .param-stepper-input {
            flex: 1;
            width: auto;
            font-size: 16px;
        }

        .track-pair-input,
        .form-input {
            font-size: 16px;
        }

        .stepper-num-input {
            font-size: 16px;
        }

        .audio-package-summary {
            min-height: 40px;
        }

        .audio-package-content {
            flex-direction: column;
            align-items: stretch;
            margin-left: 0;
        }

        .audio-package-btn {
            justify-content: flex-start;
            width: 100%;
        }
    }

    @media (max-width: 480px) {
        .via-header {
            flex-direction: column;
            align-items: stretch;
        }

        .via-all-btn {
            min-height: 38px;
        }

        .field-hint.with-indent {
            margin-left: 0;
        }
    }

    /* Touch-Geräte: größere Halteflächen für Stepper */
    @media (hover: none) and (pointer: coarse) {
        .stepper-action-btn {
            min-width: 46px;
        }

        .param-stepper .stepper-action-btn {
            width: 44px;
        }

        .via-stepper-box {
            height: 46px;
        }

        .via-all-btn {
            min-height: 38px;
            padding: 6px 12px;
        }
    }
</style>
