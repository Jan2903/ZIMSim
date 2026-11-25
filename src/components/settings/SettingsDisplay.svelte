<!-- src/components/settings/SettingsDisplay.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { uiState } from '../../js/core/state/uiState.svelte.js';
    import { config, setDepartureAlarm } from '../../js/core/utils/config.js';
    import { displayConfigStore } from '../../js/displays/core/displayConfigStore.svelte.js';
    import {
        CHASSIS_GAP_RANGE,
        DISPLAY_PROFILES,
        getChassisOptions,
        getDefaultChassisForDisplay,
        getDisplayOrientation,
        isChassisCompatible
    } from '../../js/displays/core/displayLayoutService.js';
    import { getVariantId, isUhdVariant } from '../../js/displays/core/boardTokenService.js';
    import LineColorEditorModal from '../LineColorEditorModal.svelte';
    import FormationRuleEditorModal from '../FormationRuleEditorModal.svelte';
    import ZimIcon from '../ZimIcon.svelte';
    import { lineColorService, COLOR_SCHEMES } from '../../js/core/services/lineColorService.svelte.js';

    // Modal-Status für Linienfarben & Badges
    let isLineColorModalOpen = $state(false);
    let isFormationRulesModalOpen = $state(false);

    // Abfahrtsalarm (weißer Punkt neben der Abfahrtszeit)
    let isDepartureAlarmEnabled = $state(config.departureAlarmEnabled);
    let alarmLeadMinutes = $state(config.departureAlarmLeadMinutes);
    let alarmBlinkMinutes = $state(config.departureAlarmBlinkMinutes);

    // Darstellungsvariante: Die Auflösungsklasse (Full HD / 4K) ist wählbar,
    // die Ausrichtung folgt dem Display (Quer- bzw. Hochformat).
    const displayOptions = Object.values(DISPLAY_PROFILES);
    const displayOrientation = $derived(getDisplayOrientation(displayConfigStore.displayId));
    // Gehäuse werden nach Ausrichtung gefiltert; `any` (Überkopf, ohne Gehäuse)
    // ist immer dabei.
    const chassisOptions = $derived(getChassisOptions(displayOrientation));
    const fhdVariantId = $derived(getVariantId(displayOrientation, false));
    const uhdVariantId = $derived(getVariantId(displayOrientation, true));
    const selectedVariantId = $derived(getVariantId(displayOrientation, isUhdVariant(displayConfigStore.boardVariant)));

    // Layout-Änderungen wirken über `currentLayout` sofort; Canvas und
    // Skalierungs-Wrapper brauchen danach einen Neuaufbau. Mehrfachaufrufe
    // (z. B. beim Ziehen des Stegdicke-Reglers) werden gebündelt.
    let refreshTimer = null;

    /**
     * Stößt nach einer Hardware-Änderung Neuzeichnung und Resize an.
     * @param {number} [delay=50] - Verzögerung in Millisekunden
     * @returns {void}
     */
    function refreshDisplay(delay = 50) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            trainDisplay.updateAll();
            window.dispatchEvent(new Event('resize'));
        }, delay);
    }

    $effect(() => {
        setDepartureAlarm({
            departureAlarmEnabled: isDepartureAlarmEnabled,
            departureAlarmLeadMinutes: alarmLeadMinutes,
            departureAlarmBlinkMinutes: alarmBlinkMinutes,
        });
    });

    // Die Modale liegen als position: fixed innerhalb dieses Panels und würden in einem
    // ausgeblendeten Tab nicht mehr sichtbar sein. Da die Tab-Panels persistent im DOM
    // bleiben, werden sie beim Verlassen des Tabs daher explizit geschlossen.
    $effect(() => {
        if (uiState.activeTab !== 'display') {
            isLineColorModalOpen = false;
            isFormationRulesModalOpen = false;
        }
    });

    /**
     * Wechselt das Display (Panel-Verbund) unabhängig vom Gehäuse.
     * Das aktuelle Gehäuse bleibt erhalten, wenn es die neue Ausrichtung
     * erlaubt; sonst wird das erste passende Gehäuse gewählt.
     *
     * @param {string} displayId - ID aus DISPLAY_PROFILES
     * @returns {void}
     */
    function handleDisplayChange(displayId) {
        const orientation = getDisplayOrientation(displayId);
        const chassisId = isChassisCompatible(displayConfigStore.chassisId, orientation)
            ? displayConfigStore.chassisId
            : getDefaultChassisForDisplay(displayId);

        if (!displayConfigStore.setDisplayAndChassis(displayId, chassisId)) return;
        refreshDisplay();
    }

    /**
     * Wechselt das Gehäuse (Rahmen) unabhängig vom Display.
     * @param {string} chassisId - ID aus CHASSIS_PROFILES ('none' = ohne Gehäuse)
     * @returns {void}
     */
    function handleChassisChange(chassisId) {
        if (!displayConfigStore.setDisplayAndChassis(displayConfigStore.displayId, chassisId)) return;
        refreshDisplay();
    }

    /**
     * Übernimmt die Stegdicke live aus dem Regler (0–100 px).
     * @param {string|number} value - Reglerwert in logischen Pixeln
     * @returns {void}
     */
    function handleChassisGapInput(value) {
        displayConfigStore.setChassisGap(value);
        refreshDisplay(30);
    }

    /**
     * Wechselt die Darstellungsvariante der Hauptansicht (Full HD / 4K).
     * @param {string} variantId
     * @returns {void}
     */
    function handleVariantChange(variantId) {
        displayConfigStore.setBoardVariant(variantId);
        refreshDisplay();
    }
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Hardware-Monitor & Gehäuse -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="monitors" size={18} />
            <h3>Hardware-Monitor & Gehäuse</h3>
        </div>
        <div class="card-body">
            <div class="form-group">
                <label for="display_profile_select" class="field-label">Display (Panel-Verbund):</label>
                <select 
                    id="display_profile_select"
                    class="form-select full-width-select" 
                    value={displayConfigStore.displayId}
                    onchange={(e) => handleDisplayChange(e.currentTarget.value)}
                    aria-label="Display auswählen"
                >
                    {#each displayOptions as display}
                        <option value={display.id}>{display.name}</option>
                    {/each}
                </select>
            </div>

            <div class="form-group" style="margin-top: 14px;">
                <label for="chassis_profile_select" class="field-label">Gehäuse (Rahmen):</label>
                <select 
                    id="chassis_profile_select"
                    class="form-select full-width-select" 
                    value={displayConfigStore.chassisId}
                    onchange={(e) => handleChassisChange(e.currentTarget.value)}
                    aria-label="Gehäuse auswählen"
                >
                    {#each chassisOptions as chassis}
                        <option value={chassis.id}>{chassis.name}</option>
                    {/each}
                </select>
                <div class="info-note" style="margin-top: 8px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                    Angeboten werden nur Gehäuse, die zur Ausrichtung des Displays passen. „Ohne Gehäuse“ entspricht der früheren Gehäusesimulation „aus“ (Tastenkürzel Strg+B).
                </div>
            </div>

            <div class="form-group" style="margin-top: 14px;">
                <label for="chassis_gap_slider" class="field-label">Stegdicke: {displayConfigStore.chassisGapWidth} px</label>
                <input 
                    type="range" 
                    id="chassis_gap_slider" 
                    class="form-range"
                    min={CHASSIS_GAP_RANGE.min} 
                    max={CHASSIS_GAP_RANGE.max} 
                    step="1"
                    value={displayConfigStore.chassisGapWidth}
                    disabled={displayConfigStore.chassisId === 'none'}
                    oninput={(e) => handleChassisGapInput(e.currentTarget.value)}
                    aria-label="Stegdicke zwischen zwei Panels"
                >
                <div class="info-note" style="margin-top: 4px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                    Der Steg sitzt zwischen zwei Panels; bei einem einzelnen Panel und ohne Gehäuse bleibt der Regler wirkungslos. Beim Wechsel zwischen zwei Gehäusen gilt wieder deren Vorgabe.
                </div>
            </div>

            <div class="form-group" style="margin-top: 14px;">
                <label for="board_variant_select" class="field-label">Darstellungsvariante:</label>
                <select 
                    id="board_variant_select"
                    class="form-select full-width-select" 
                    value={selectedVariantId}
                    onchange={(e) => handleVariantChange(e.currentTarget.value)}
                    aria-label="Darstellungsvariante auswählen"
                >
                    <option value={fhdVariantId}>Full HD (1080p)</option>
                    <option value={uhdVariantId}>4K Ultra HD (2160p)</option>
                </select>
                <div class="info-note" style="margin-top: 8px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                    Die Ausrichtung folgt dem Display (Quer- bzw. Hochformat). 4K ist ein eigenes Design mit mehr Zeilen (z. B. 4 statt 3 Züge im Wagenstand).
                </div>
            </div>

            <div class="info-note" style="margin-top: 12px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                Hinweis: Das Gehäuse simuliert den originalen DB-Rahmen samt Display-Steg. Auf Smartphones wird empfohlen, „Ohne Gehäuse“ zu wählen, um die maximale Bildfläche für die Anzeige zu nutzen.
            </div>
        </div>
    </div>

    <!-- Spalte 2: Display- & Regional-Optionen -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="palette" size={18} />
            <h3>Design & Regional-Modus</h3>
        </div>
        <div class="card-body">
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        id="sbahn_line_only_checkbox" 
                        bind:checked={journeyStore.formatOptions.hideSbahnTrainNumbers} 
                        onchange={() => {
                            journeyStore.saveSettings();
                            trainDisplay.updateAll();
                        }}
                    >
                    <span>S-Bahnen ohne interne Zugnummer (z. B. 'S 7')</span>
                </label>
            </div>

            <div class="checkbox-group" style="margin-top: 8px;">
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        id="nrw_mode_checkbox" 
                        bind:checked={journeyStore.nrwMode} 
                        onchange={() => {
                            journeyStore.saveSettings();
                            trainDisplay.updateAll();
                        }}
                    >
                    <span>Regionalverkehr: nur Linie anzeigen (NRW-Modus, z. B. 'RE 1')</span>
                </label>
            </div>

            <div class="checkbox-group" style="margin-top: 8px;">
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        id="strip_bus_checkbox" 
                        bind:checked={journeyStore.formatOptions.stripBusPrefix} 
                        onchange={() => {
                            journeyStore.saveSettings();
                            trainDisplay.updateAll();
                        }}
                    >
                    <span>Wort 'Bus' vor Liniennummer entfernen (z. B. '100' statt 'Bus 100')</span>
                </label>
            </div>

            <div class="checkbox-group" style="margin-top: 8px;">
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        id="harmonize_spacing_checkbox" 
                        bind:checked={journeyStore.formatOptions.harmonizeSpacing} 
                        onchange={() => {
                            journeyStore.saveSettings();
                            trainDisplay.updateAll();
                        }}
                    >
                    <span>Leerzeichen zwischen Gattung & Nummer (z. B. 'S 7', 'X 10')</span>
                </label>
            </div>

            <div style="margin-top: 16px;">
                <button 
                    type="button" 
                    class="btn-secondary" 
                    onclick={() => isLineColorModalOpen = true}
                    style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;"
                >
                    <ZimIcon name="palette" size={16} />
                    <span>Linienfarben & Badges anpassen</span>
                </button>
                <div class="line-color-scheme-hint">
                    Aktives Farbsystem:
                    <strong>{lineColorService.colorScheme === COLOR_SCHEMES.DB_2026 ? 'DB 2026' : 'Klassisch'}</strong>
                    {#if lineColorService.colorScheme === COLOR_SCHEMES.DB_2026}
                        · Regionalverkehr {lineColorService.regionalAutoColors ? 'mit Linienfarben' : 'einheitlich dunkelgrau'}
                    {/if}
                </div>
                <button 
                    type="button" 
                    class="btn-secondary" 
                    onclick={() => isFormationRulesModalOpen = true}
                    style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 8px;"
                >
                    <ZimIcon name="train" size={16} />
                    <span>Wagenreihungs-Regeln anpassen</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Spalte 3: Abfahrtsalarm -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="bell" size={18} />
            <h3>Abfahrtsalarm</h3>
        </div>
        <div class="card-body">
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        id="departure_alarm_enabled_checkbox" 
                        bind:checked={isDepartureAlarmEnabled} 
                    >
                    <span>Abfahrtsalarm aktivieren (weißer Punkt neben der Abfahrtszeit)</span>
                </label>
            </div>

            <div class="form-group" style="margin-top: 14px;">
                <label class="field-label" for="alarm_lead_minutes">Sichtbar ab (Minuten vor Abfahrt):</label>
                <input 
                    type="number" 
                    id="alarm_lead_minutes" 
                    bind:value={alarmLeadMinutes} 
                    min="0" 
                    max="60" 
                    class="form-input"
                >
            </div>

            <div class="form-group" style="margin-top: 8px;">
                <label class="field-label" for="alarm_blink_minutes">Blinkend ab (Minuten vor Abfahrt):</label>
                <input 
                    type="number" 
                    id="alarm_blink_minutes" 
                    bind:value={alarmBlinkMinutes} 
                    min="0" 
                    max="60" 
                    class="form-input"
                >
            </div>

            <div class="info-note" style="margin-top: 12px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                Der weiße Punkt erscheint ab der eingestellten Lead-Zeit vor der Ist-Abfahrt und beginnt ab der Blink-Zeit zu pulsieren.
            </div>
        </div>
    </div>
</div>

<LineColorEditorModal bind:isOpen={isLineColorModalOpen} />
<FormationRuleEditorModal bind:isOpen={isFormationRulesModalOpen} />

<style>
    .settings-tab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
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

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .field-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
    }

    .full-width-select {
        width: 100%;
        box-sizing: border-box;
    }

    .form-input {
        width: 100%;
        padding: 6px 8px;
        box-sizing: border-box;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        color: var(--text-main, #f8fafc);
        font-size: 0.85rem;
    }

    .form-input:focus {
        outline: none;
        border-color: var(--accent, #e2001a);
    }

    /* Stegdicke-Regler: gleiche Farbwelt wie die Formularfelder */
    .form-range {
        width: 100%;
        box-sizing: border-box;
        accent-color: var(--accent, #e2001a);
    }

    .form-range:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    /* Hinweis auf das aktive Farbsystem unter dem Editor-Button */
    .line-color-scheme-hint {
        margin-top: 6px;
        font-size: 0.76rem;
        color: var(--text-muted, #94a3b8);
        text-align: center;
    }

    .line-color-scheme-hint strong {
        color: var(--text-main, #f8fafc);
        font-weight: 600;
    }

    @media (max-width: 600px) {
        .settings-tab-grid {
            grid-template-columns: 1fr;
            gap: 12px;
        }
        .card-body {
            padding: 14px;
        }
        .card-header {
            padding: 12px 14px;
        }
    }
</style>
