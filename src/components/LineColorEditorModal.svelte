<script>
    import { lineColorService, DEFAULT_LINE_RULES, COLOR_SCHEMES } from '../js/core/services/lineColorService.svelte.js';
    import {
        DB_2026_OPERATOR_STYLES,
        TRANSPORT_CATEGORY,
        TRANSPORT_CATEGORY_LABELS
    } from '../js/core/constants/trainColorPalette.js';
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import { ScreenSyncService } from '../js/core/services/screenSyncService.js';
    import { toastStore } from '../js/core/state/toastStore.svelte.js';
    import { confirmDialog } from '../js/core/state/confirmStore.svelte.js';
    import ZimIcon from './ZimIcon.svelte';

    import { downloadJsonFile, parseBundle } from '../js/core/utils/bundleUtils.js';
    import { isValidPattern } from '../js/core/utils/patternUtils.js';
    import { contrastRatio, bestTextColor } from '../js/core/utils/colorUtils.js';

    let { isOpen = $bindable(false) } = $props();

    /**
     * Beispielzüge je Betreiber-Schlüssel für die System-Vorschau.
     * Die Namen müssen durch die Klassifikation laufen, damit die Vorschau
     * exakt den späteren Renderpfad zeigt (statt die Palette direkt zu zeichnen).
     * @type {Record<string, string>}
     */
    const OPERATOR_SAMPLES = Object.freeze({
        'db-fernverkehr': 'ICE 543',
        'flixtrain': 'FLX 10',
        'tgv': 'TGV 9583',
        'nightjet': 'NJ 177',
        'oebb': 'RJ 1',
        'westbahn': 'WB 123'
    });

    let selectedRuleId = $state(null);
    let previewTestText = $state('');
    let fileInputRef = $state();
    let pendingImport = $state(null);

    // Initiale Auswahl
    $effect(() => {
        if (isOpen && !selectedRuleId && lineColorService.rules.length > 0) {
            selectedRuleId = lineColorService.rules[0].id;
        }
    });

    let selectedRule = $derived(
        lineColorService.rules.find(r => r.id === selectedRuleId) || null
    );

    $effect(() => {
        if (selectedRule && (!previewTestText || previewTestText === '')) {
            previewTestText = selectedRule.pattern || 'RE 1';
        }
    });

    function syncDisplay() {
        trainDisplay.updateAll();
        ScreenSyncService.broadcastState(journeyStore);
    }

    /**
     * Wechselt das Farbsystem und zeichnet die Anzeigen sofort neu.
     * Die Persistenz übernimmt der Service.
     *
     * @param {'db2026' | 'classic'} scheme - Ziel-Farbsystem
     * @returns {void}
     */
    function selectScheme(scheme) {
        if (lineColorService.colorScheme === scheme) return;
        lineColorService.setColorScheme(scheme);
        syncDisplay();
    }

    /**
     * Schaltet die Traewelling-Linienfarben im Regionalverkehr um.
     *
     * @param {boolean} enabled - true, wenn Linienfarben auch im Regionalverkehr gelten
     * @returns {void}
     */
    function toggleRegionalAutoColors(enabled) {
        lineColorService.setRegionalAutoColors(enabled);
        syncDisplay();
    }

    /**
     * Korrigiert die Schriftfarbe der aktuellen Regel auf schwarz oder weiß,
     * je nachdem, was auf dem Hintergrund besser lesbar ist.
     * Die Hintergrundfarbe selbst bleibt unverändert.
     *
     * @returns {void}
     */
    function applyReadableTextColor() {
        if (!selectedRule) return;
        selectedRule.textColor = bestTextColor(selectedRule.backgroundColor);
        handleFieldChange();
    }

    /**
     * Bewertet ein Kontrastverhältnis für die Anzeige im Editor.
     * Badges gelten als große Schrift (≥ 3:1 nach WCAG AA), normaler Text braucht 4,5:1.
     *
     * @param {number | null} ratio - Kontrastverhältnis oder null bei transparenter/unbekannter Fläche
     * @returns {{ text: string, level: 'ok' | 'large' | 'low' | 'none', title: string }}
     */
    function describeContrast(ratio) {
        if (ratio === null || Number.isNaN(ratio)) {
            return {
                text: '—',
                level: 'none',
                title: 'Kein Kontrast prüfbar (transparente oder unbekannte Fläche)'
            };
        }
        const text = `${ratio.toFixed(2)}:1`;
        if (ratio >= 4.5) {
            return { text, level: 'ok', title: 'Erfüllt WCAG 2.2 AA für normalen Text (4,5:1)' };
        }
        if (ratio >= 3) {
            return { text, level: 'large', title: 'Erfüllt WCAG 2.2 AA nur für große Schrift (3:1)' };
        }
        return { text, level: 'low', title: 'Unter 3:1 — auch für große Schrift zu gering' };
    }

    /**
     * Löst einen Vorschau-Eintrag über den echten Renderpfad auf und bewertet den Kontrast.
     *
     * @param {{ key: string, label: string, kind: string, sample: string, operator?: string }} entry - Roh-Eintrag
     * @returns {object} Eintrag mit Stil, CSS-Style und Kontrastbewertung
     */
    function describePreviewEntry(entry) {
        const style = lineColorService.resolveStyle(entry.sample, { operator: entry.operator });
        const filled = style.shape !== 'outline' && style.backgroundColor && style.backgroundColor !== 'transparent';
        const contrast = filled ? contrastRatio(style.textColor, style.backgroundColor) : null;
        const contrastInfo = describeContrast(contrast);
        return {
            ...entry,
            // Ohne Treffer greift der generische Fallback (z. B. Stadtverkehr ohne Linienfarbe)
            kind: style.hasMatchedRule ? entry.kind : 'Fallback',
            cssStyle: lineColorService.getCssStyle(style, 30),
            contrastText: contrastInfo.text,
            contrastLevel: contrastInfo.level,
            contrastTitle: contrastInfo.title
        };
    }

    /**
     * Baut die System-Vorschau analog zum DB-InfraGO-Schaubild:
     * erst die Betreiberfarben im Fernverkehr, dann die Verkehrsarten.
     *
     * @returns {Array<object>} Aufgelöste Vorschau-Einträge
     */
    function buildSystemPreview() {
        const entries = [];
        for (const [key, style] of Object.entries(DB_2026_OPERATOR_STYLES)) {
            entries.push({
                key,
                label: style.label,
                kind: 'Betreiber',
                sample: OPERATOR_SAMPLES[key] || style.label
            });
        }
        entries.push({
            key: 'regionalverkehr',
            label: TRANSPORT_CATEGORY_LABELS[TRANSPORT_CATEGORY.REGIONALVERKEHR],
            kind: 'Verkehrsart',
            sample: 'RE 1'
        });
        if (lineColorService.regionalAutoColors) {
            entries.push({
                key: 'regionalverkehr-linienfarbe',
                label: `${TRANSPORT_CATEGORY_LABELS[TRANSPORT_CATEGORY.REGIONALVERKEHR]} (Linienfarbe)`,
                kind: 'Opt-in',
                sample: 'RB 98',
                operator: 'ag'
            });
        }
        entries.push({
            key: 'gelegenheitsverkehr',
            label: TRANSPORT_CATEGORY_LABELS[TRANSPORT_CATEGORY.GELEGENHEITSVERKEHR],
            kind: 'Verkehrsart',
            sample: 'DZ 10'
        });
        entries.push({
            key: 'sbahn',
            label: 'S-Bahn (Linienfarbe)',
            kind: 'Linienfarbe',
            sample: 'S 5'
        });
        entries.push({
            key: 'stadtverkehr',
            label: TRANSPORT_CATEGORY_LABELS[TRANSPORT_CATEGORY.STADTVERKEHR],
            kind: 'Linienfarbe',
            sample: 'U 2'
        });
        return entries.map(describePreviewEntry);
    }

    /** Vorschauzeilen des aktiven Farbsystems (reagiert auf colorScheme und regionalAutoColors). */
    let systemPreview = $derived(buildSystemPreview());

    /** Kontrast der aktuell bearbeiteten Regel (Normalmodus). */
    let ruleContrastInfo = $derived(
        selectedRule
            ? describeContrast(contrastRatio(selectedRule.textColor, selectedRule.backgroundColor))
            : null
    );

    function closeModal() {
        isOpen = false;
        syncDisplay();
    }

    function addNewRule() {
        const newRule = lineColorService.addRule({
            name: 'Neue Linie',
            pattern: 'RE',
            matchType: 'startsWith',
            backgroundColor: '#1e3a8a',
            textColor: '#ffffff',
            shape: 'rounded',
            cornerRadius: 6
        });
        selectedRuleId = newRule.id;
        previewTestText = newRule.pattern;
        syncDisplay();
    }

    async function removeRule(id, e) {
        e?.stopPropagation();
        if (await confirmDialog('Möchtest du diese Linien-Regel wirklich löschen?', { danger: true, confirmLabel: 'Löschen' })) {
            lineColorService.deleteRule(id);
            if (selectedRuleId === id) {
                selectedRuleId = lineColorService.rules[0]?.id || null;
            }
            syncDisplay();
        }
    }

    function moveUp(id, e) {
        e?.stopPropagation();
        lineColorService.moveRule(id, 'up');
        syncDisplay();
    }

    function moveDown(id, e) {
        e?.stopPropagation();
        lineColorService.moveRule(id, 'down');
        syncDisplay();
    }

    function handleFieldChange() {
        lineColorService.saveRules();
        syncDisplay();
    }

    /**
     * Prüft beim Verlassen des Pattern-Feldes, ob der reguläre Ausdruck gültig ist.
     * Ein ungültiger Ausdruck würde still auf keinen Text passen.
     */
    function handlePatternBlur() {
        if (selectedRule && selectedRule.matchType === 'regex' && !isValidPattern(selectedRule.pattern, 'regex')) {
            toastStore.warning(`Ungültiger regulärer Ausdruck "${selectedRule.pattern}" - die Regel passt auf keinen Text.`);
        }
    }

    async function resetDefaults() {
        if (await confirmDialog('Möchtest du alle Linien-Regeln auf die DB-Standards (IC-Pille, Flixtrain, S-Bahn) zurücksetzen?', { danger: true, confirmLabel: 'Zurücksetzen' })) {
            lineColorService.resetToDefaults();
            selectedRuleId = lineColorService.rules[0]?.id || null;
            syncDisplay();
        }
    }

    function exportJson() {
        const json = lineColorService.exportRules();
        downloadJsonFile(json, `zimsim_line_colors_${Date.now()}.json`);
    }

    function handleImportFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const raw = event.target.result;
            const parsed = parseBundle(raw, 'zimsim-line-colors');
            if (!parsed.success) {
                toastStore.error(parsed.error || 'Fehler beim Parsen der Datei.');
                return;
            }

            const count = Array.isArray(parsed.payload) ? parsed.payload.length : 0;
            if (count === 0) {
                toastStore.warning('Die ausgewählte Datei enthält keine Linien-Regeln.');
                return;
            }

            if (lineColorService.rules.length > 0) {
                pendingImport = {
                    raw,
                    count,
                    fileName: file.name
                };
            } else {
                executeImport(raw, 'overwrite');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function executeImport(raw, mode) {
        const res = lineColorService.importRules(raw, mode);
        if (res.success) {
            selectedRuleId = lineColorService.rules[0]?.id || null;
            syncDisplay();
            pendingImport = null;
            const actionText = mode === 'merge' ? 'zusammengeführt' : 'ersetzt';
            toastStore.success(`${res.count} Linien-Regeln erfolgreich ${actionText}.`);
        } else {
            toastStore.error(res.error || 'Fehler beim Importieren der Datei.');
        }
    }
</script>

{#if isOpen}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }} role="presentation">
    <div class="modal-content modal-extra-wide" role="dialog" aria-modal="true" tabindex="-1">
        <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 10px;">
                <ZimIcon name="palette" size={22} />
                <h3>Linienfarben & Badges konfigurieren</h3>
            </div>
            <button class="modal-close" onclick={closeModal} title="Schließen">
                <ZimIcon name="close" size={18} />
            </button>
        </div>

        <div class="modal-body">
            <!-- Farbsystem-Umschalter (DB-InfraGO-Konzept ab 26.11.2026 vs. klassisch) -->
            <div class="scheme-banner">
                <div class="scheme-info">
                    <div class="scheme-title">
                        <ZimIcon name="palette" size={16} />
                        <span>Farbsystem</span>
                        <span class="badge-status badge-success">
                            {lineColorService.colorScheme === COLOR_SCHEMES.DB_2026 ? 'DB 2026' : 'Klassisch'}
                        </span>
                    </div>
                    <div class="scheme-desc">
                        {#if lineColorService.colorScheme === COLOR_SCHEMES.DB_2026}
                            Farbe kennzeichnet den Betreiber (Fernverkehr) oder die Verkehrsart (Regional- und
                            Gelegenheitsverkehr); S-Bahnen behalten ihre Linienfarbe. Eigene Regeln behalten Vorrang,
                            die DB-Standardregeln gelten nur im klassischen System.
                        {:else}
                            Bisheriges Verhalten: Linienfarben und feste Regeln (u. a. weiße IC-Pille) ohne
                            Betreiber- und Verkehrsart-Systematik.
                        {/if}
                    </div>
                </div>
                <div class="scheme-switch" role="radiogroup" aria-label="Farbsystem">
                    <button
                        type="button"
                        class="scheme-option"
                        class:active={lineColorService.colorScheme === COLOR_SCHEMES.DB_2026}
                        role="radio"
                        aria-checked={lineColorService.colorScheme === COLOR_SCHEMES.DB_2026}
                        onclick={() => selectScheme(COLOR_SCHEMES.DB_2026)}
                    >
                        DB 2026
                    </button>
                    <button
                        type="button"
                        class="scheme-option"
                        class:active={lineColorService.colorScheme === COLOR_SCHEMES.CLASSIC}
                        role="radio"
                        aria-checked={lineColorService.colorScheme === COLOR_SCHEMES.CLASSIC}
                        onclick={() => selectScheme(COLOR_SCHEMES.CLASSIC)}
                    >
                        Klassisch
                    </button>
                </div>
            </div>

            <!-- Opt-in: Linienfarben im Regionalverkehr (nur im DB-2026-System) -->
            {#if lineColorService.colorScheme === COLOR_SCHEMES.DB_2026}
                <div class="scheme-option-row">
                    <div class="scheme-option-info">
                        <div class="scheme-option-title">Linienfarben auch im Regionalverkehr</div>
                        <div class="scheme-option-desc">
                            Standardmäßig ist der Regionalverkehr einheitlich dunkelgrau. Mit dieser Option gelten
                            die Traewelling-Linienfarben wie bisher.
                        </div>
                    </div>
                    <label class="switch-toggle" title="Linienfarben im Regionalverkehr ein-/ausschalten">
                        <input
                            type="checkbox"
                            checked={lineColorService.regionalAutoColors}
                            onchange={(e) => toggleRegionalAutoColors(e.target.checked)}
                        />
                        <span class="slider round"></span>
                    </label>
                </div>
            {/if}

            <!-- System-Vorschau analog DB-InfraGO-Schaubild -->
            <div class="system-preview-card">
                <div class="system-preview-header">
                    <span class="sub-heading">System-Vorschau</span>
                    <span class="system-preview-hint">Kontrast nach WCAG 2.2</span>
                </div>
                {#if lineColorService.colorScheme === COLOR_SCHEMES.DB_2026}
                    <div class="system-preview-grid">
                        {#each systemPreview as entry (entry.key)}
                            <div class="system-preview-item">
                                <div class="system-preview-badge" style={entry.cssStyle}>{entry.sample}</div>
                                <div class="system-preview-meta">
                                    <span class="system-preview-label" title={entry.label}>{entry.label}</span>
                                    <span class="system-preview-kind">{entry.kind}</span>
                                </div>
                                <span class="contrast-chip contrast-{entry.contrastLevel}" title={entry.contrastTitle}>
                                    {entry.contrastText}
                                </span>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="empty-hint">
                        Die System-Vorschau zeigt das DB-2026-Konzept und ist im klassischen System ausgeblendet.
                    </div>
                {/if}
            </div>

            <!-- Auto-Colors Status & Toggle Banner -->
            <div class="auto-colors-banner">
                <div class="auto-colors-info">
                    <div class="auto-colors-title">
                        <ZimIcon name="palette" size={16} />
                        <span>Automatische Linienfarben (Traewelling Sync)</span>
                        {#if lineColorService.isAutoColorsLoaded}
                            <span class="badge-status badge-success">Aktiv ({lineColorService._autoData?.totalRowsProcessed || 7429} Linien)</span>
                        {:else}
                            <span class="badge-status badge-pending">Wird geladen...</span>
                        {/if}
                    </div>
                    <div class="auto-colors-desc">
                        Erkennt offizielle Farben für S-Bahnen (Hannover, München, Berlin, Hamburg, Rhein-Main etc.) und Privatbahnen automatisch. Manuelle Regeln unten überschreiben diese Automatik.
                    </div>
                </div>
                <label class="switch-toggle" title="Automatische Linienfarben ein-/ausschalten">
                    <input 
                        type="checkbox" 
                        checked={lineColorService.autoColorsEnabled} 
                        onchange={(e) => { lineColorService.setAutoColorsEnabled(e.target.checked); syncDisplay(); }} 
                    />
                    <span class="slider round"></span>
                </label>
            </div>

            <div class="rules-grid">
                <!-- LINKE SPALTE: Regelliste -->
                <div class="rules-list-column">
                    <div class="column-header">
                        <span class="sub-heading">Prioritätsliste (First-Match)</span>
                        <button class="btn-sm btn-primary" onclick={addNewRule}>
                            <ZimIcon name="plus" size={14} /> Neue Regel
                        </button>
                    </div>

                    <div class="rules-scroll-area">
                        {#if lineColorService.rules.length === 0}
                            <div class="empty-hint">Keine Regeln vorhanden.</div>
                        {:else}
                            {#each lineColorService.rules as rule, idx (rule.id)}
                                <div 
                                    class="rule-item" 
                                    class:active={rule.id === selectedRuleId}
                                    onclick={() => selectedRuleId = rule.id}
                                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedRuleId = rule.id; } }}
                                    role="button"
                                    tabindex="0"
                                >
                                    <div class="rule-order-buttons">
                                        <button 
                                            class="btn-icon-tiny" 
                                            title="Priorität erhöhen" 
                                            disabled={idx === 0}
                                            onclick={(e) => moveUp(rule.id, e)}
                                        >
                                            <ZimIcon name="arrow_up" size={12} />
                                        </button>
                                        <button 
                                            class="btn-icon-tiny" 
                                            title="Priorität verringern" 
                                            disabled={idx === lineColorService.rules.length - 1}
                                            onclick={(e) => moveDown(rule.id, e)}
                                        >
                                            <ZimIcon name="arrow_down" size={12} />
                                        </button>
                                    </div>

                                    <div class="rule-chip-preview" style={lineColorService.getCssStyle({ ...rule, hasMatchedRule: true }, 26)}>
                                        {rule.pattern}
                                    </div>

                                    <div class="rule-info">
                                        <div class="rule-name">{rule.name}</div>
                                        <div class="rule-meta">{rule.matchType}: <code>{rule.pattern}</code></div>
                                    </div>

                                    <button 
                                        class="btn-icon-tiny btn-delete" 
                                        title="Regel löschen" 
                                        onclick={(e) => removeRule(rule.id, e)}
                                    >
                                        <ZimIcon name="trash" size={13} />
                                    </button>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>

                <!-- RECHTE SPALTE: Editor & Vorschau -->
                <div class="rule-editor-column">
                    {#if selectedRule}
                        <div class="column-header">
                            <span class="sub-heading">Regel bearbeiten: {selectedRule.name}</span>
                        </div>

                        <!-- LIVE VORSCHAU -->
                        <div class="live-preview-box">
                            <div class="preview-title">Echtzeit-Vorschau</div>
                            <div class="preview-canvases">
                                <!-- Auf DB-Blau (Normal) -->
                                <div class="preview-screen dark-screen">
                                    <div class="screen-label">Normal (DB-Blau)</div>
                                    <div class="sample-badge" style={lineColorService.getCssStyle({ ...selectedRule, hasMatchedRule: true }, 38)}>
                                        {previewTestText || selectedRule.pattern}
                                    </div>
                                </div>

                                <!-- Auf Weiß (Ausfall / Invers) -->
                                <div class="preview-screen light-screen">
                                    <div class="screen-label">Ausfall / Invers</div>
                                    <div class="sample-badge" style={lineColorService.getCssStyle(lineColorService.resolveStyle(previewTestText || selectedRule.pattern, { isAusfall: true, defaultBgColor: '#e2e8f0', defaultTextColor: '#000080' }), 38)}>
                                        {previewTestText || selectedRule.pattern}
                                    </div>
                                </div>
                            </div>

                            <div class="preview-test-input">
                                <label for="preview_test_text">Vorschau-Text anpassen:</label>
                                <input id="preview_test_text" type="text" bind:value={previewTestText} placeholder="z.B. ICE 543 oder FLX 10">
                            </div>
                        </div>

                        <!-- EINSTELLUNGSFORMULAR -->
                        <div class="editor-form">
                            <div class="form-row-2">
                                <label>
                                    <span>Bezeichnung:</span>
                                    <input type="text" bind:value={selectedRule.name} oninput={handleFieldChange}>
                                </label>
                                <label>
                                    <span>Muster / Pattern:</span>
                                    <input type="text" bind:value={selectedRule.pattern} oninput={handleFieldChange} onblur={handlePatternBlur}>
                                </label>
                            </div>

                            <div class="form-row-2">
                                <label>
                                    <span>Abgleich-Methode:</span>
                                    <select bind:value={selectedRule.matchType} onchange={handleFieldChange}>
                                        <option value="startsWith">Beginnt mit (z.B. "RE ", "S ")</option>
                                        <option value="contains">Enthält (z.B. "FLX", "IC")</option>
                                        <option value="exact">Exakter Name (z.B. "RE 1")</option>
                                        <option value="regex">Regulärer Ausdruck (Regex)</option>
                                    </select>
                                </label>

                                <label>
                                    <span>Form (Shape):</span>
                                    <select bind:value={selectedRule.shape} onchange={handleFieldChange}>
                                        <option value="pill">Pille (Voll gerundet / IC-Standard)</option>
                                        <option value="rounded">Abgerundet (Leichte Eckenrundung)</option>
                                        <option value="rectangle">Eckig (Scharfe Kanten)</option>
                                        <option value="outline">Nur Rahmen (Transparenter Body)</option>
                                    </select>
                                </label>
                            </div>

                            <!-- FARBEN NORMALMODUS -->
                            <div class="colors-section">
                                <div class="section-title-row">
                                    <span class="section-title">Farben (Normalmodus):</span>
                                    {#if ruleContrastInfo}
                                        <span class="contrast-chip contrast-{ruleContrastInfo.level}" title={ruleContrastInfo.title}>
                                            Kontrast {ruleContrastInfo.text}
                                        </span>
                                    {/if}
                                    {#if ruleContrastInfo && (ruleContrastInfo.level === 'low' || ruleContrastInfo.level === 'large')}
                                        <button
                                            type="button"
                                            class="contrast-fix-btn"
                                            title="Setzt die Schriftfarbe auf schwarz oder weiß – die Marken-/Hintergrundfarbe bleibt unverändert"
                                            onclick={applyReadableTextColor}
                                        >
                                            Schrift korrigieren
                                        </button>
                                    {/if}
                                </div>
                                <div class="color-pickers-row">
                                    <div class="color-item">
                                        <label for="bg_color_picker">Hintergrund</label>
                                        <div class="color-input-wrap">
                                            <input id="bg_color_picker" type="color" value={lineColorService.toHexColor(selectedRule.backgroundColor, '#1e3a8a')} oninput={(e) => { selectedRule.backgroundColor = e.target.value; handleFieldChange(); }}>
                                            <input type="text" class="hex-input" bind:value={selectedRule.backgroundColor} oninput={handleFieldChange}>
                                        </div>
                                    </div>

                                    <div class="color-item">
                                        <label for="text_color_picker">Schrift</label>
                                        <div class="color-input-wrap">
                                            <input id="text_color_picker" type="color" value={lineColorService.toHexColor(selectedRule.textColor, '#ffffff')} oninput={(e) => { selectedRule.textColor = e.target.value; handleFieldChange(); }}>
                                            <input type="text" class="hex-input" bind:value={selectedRule.textColor} oninput={handleFieldChange}>
                                        </div>
                                    </div>

                                    <div class="color-item">
                                        <label for="border_color_picker">Rahmen (Optional)</label>
                                        <div class="color-input-wrap">
                                            <input id="border_color_picker" type="color" value={lineColorService.toHexColor(selectedRule.borderColor, '#ffffff')} oninput={(e) => { selectedRule.borderColor = e.target.value; handleFieldChange(); }}>
                                            <input type="text" class="hex-input" bind:value={selectedRule.borderColor} placeholder="transparent" oninput={handleFieldChange}>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- INVERTIERUNGS-OVERRIDE -->
                            <div class="invert-section">
                                <label class="checkbox-label" style="font-weight: 600;">
                                    <input type="checkbox" bind:checked={selectedRule.hasInvertOverride} onchange={handleFieldChange}>
                                    Abweichendes Styling bei Invertierung / Ausfall (z.B. wie IC-Outline)
                                </label>

                                {#if selectedRule.hasInvertOverride}
                                    <div class="color-pickers-row" style="margin-top: 10px;">
                                        <div class="color-item">
                                            <label for="inv_bg_picker">Invert. Hintergrund</label>
                                            <div class="color-input-wrap">
                                                <input id="inv_bg_picker" type="color" value={lineColorService.toHexColor(selectedRule.invertedBgColor, '#000080')} oninput={(e) => { selectedRule.invertedBgColor = e.target.value; handleFieldChange(); }}>
                                                <input type="text" class="hex-input" bind:value={selectedRule.invertedBgColor} placeholder="z.B. #000080" oninput={handleFieldChange}>
                                            </div>
                                        </div>

                                        <div class="color-item">
                                            <label for="inv_text_picker">Invert. Schrift</label>
                                            <div class="color-input-wrap">
                                                <input id="inv_text_picker" type="color" value={lineColorService.toHexColor(selectedRule.invertedTextColor, '#000080')} oninput={(e) => { selectedRule.invertedTextColor = e.target.value; handleFieldChange(); }}>
                                                <input type="text" class="hex-input" bind:value={selectedRule.invertedTextColor} placeholder="z.B. #000080" oninput={handleFieldChange}>
                                            </div>
                                        </div>

                                        <div class="color-item">
                                            <label for="inv_shape_select">Invert. Form</label>
                                            <select id="inv_shape_select" bind:value={selectedRule.invertedShape} onchange={handleFieldChange} style="padding: 4px; height: 32px;">
                                                <option value="outline">Nur Rahmen (Outline)</option>
                                                <option value="pill">Pille</option>
                                                <option value="rounded">Abgerundet</option>
                                                <option value="rectangle">Eckig</option>
                                            </select>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <div class="empty-selection">
                            Wähle eine Regel links aus oder erstelle eine neue.
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        {#if pendingImport}
        <div class="import-confirm-banner">
            <div class="import-confirm-content">
                <div class="import-confirm-title">
                    <ZimIcon name="import" size={16} />
                    <span>Regeln importieren: <strong>{pendingImport.fileName}</strong> ({pendingImport.count} Regeln)</span>
                </div>
                <p class="import-confirm-desc">
                    Möchtest du die neuen Regeln zu deinen bisherigen Regeln hinzufügen oder alle bestehenden Regeln ersetzen?
                </p>
                <div class="import-confirm-actions">
                    <button type="button" class="btn-primary btn-sm" onclick={() => executeImport(pendingImport.raw, 'merge')}>
                        Zusammenführen (Merge)
                    </button>
                    <button type="button" class="btn-danger btn-sm" onclick={() => executeImport(pendingImport.raw, 'overwrite')}>
                        Alles ersetzen (Overwrite)
                    </button>
                    <button type="button" class="btn-secondary btn-sm" onclick={() => { pendingImport = null; }}>
                        Abbrechen
                    </button>
                </div>
            </div>
        </div>
        {/if}

        <div class="modal-footer">
            <div style="display: flex; gap: 8px;">
                <button class="btn-secondary btn-sm" onclick={exportJson} title="Als JSON sichern">
                    <ZimIcon name="export" size={14} /> Exportieren
                </button>
                <button class="btn-secondary btn-sm" onclick={() => fileInputRef.click()} title="JSON-Datei laden">
                    <ZimIcon name="import" size={14} /> Importieren
                </button>
                <input type="file" accept=".json" bind:this={fileInputRef} onchange={handleImportFile} style="display: none;">
                <button class="btn-secondary btn-sm" onclick={resetDefaults} title="Auf Standard-Presets zurücksetzen">
                    DB-Standards
                </button>
            </div>
            <button class="btn-primary" onclick={closeModal}>Fertig</button>
        </div>
    </div>
</div>
{/if}

<style>
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    padding: 20px;
    box-sizing: border-box;
}
.modal-content {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 90vh;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
}
.modal-extra-wide {
    max-width: 980px;
}
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
}
.modal-header h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
}
.modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
}
.modal-close:hover {
    color: var(--text-main);
    background: rgba(255, 255, 255, 0.08);
}
.modal-body {
    padding: 18px;
    overflow-y: auto;
    flex: 1;
}
.modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.15);
}

/* 2-Spalten Layout */
.rules-grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
    min-height: 480px;
}
@media (max-width: 768px) {
    .rules-grid {
        grid-template-columns: 1fr;
    }
}
.column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.sub-heading {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
}
.rules-scroll-area {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 430px;
    overflow-y: auto;
    padding-right: 4px;
}
.rule-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}
.rule-item:hover {
    background: rgba(255, 255, 255, 0.05);
}
.rule-item.active {
    background: rgba(30, 58, 138, 0.35);
    border-color: #3b82f6;
}
.rule-order-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.btn-icon-tiny {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    display: flex;
    align-items: center;
}
.btn-icon-tiny:hover:not(:disabled) {
    color: var(--text-main);
    background: rgba(255, 255, 255, 0.1);
}
.btn-icon-tiny:disabled {
    opacity: 0.25;
    cursor: not-allowed;
}
.btn-delete:hover {
    color: #ef4444 !important;
}
.rule-chip-preview {
    font-size: 0.8rem;
    font-weight: 700;
    padding: 2px 8px;
    min-width: 44px;
    text-align: center;
    flex-shrink: 0;
}
.rule-info {
    flex: 1;
    overflow: hidden;
}
.rule-name {
    font-size: 0.88rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.rule-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
}
.rule-meta code {
    background: rgba(0, 0, 0, 0.25);
    padding: 1px 4px;
    border-radius: 3px;
}

/* Editor Spalte */
.rule-editor-column {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.live-preview-box {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
}
.preview-title {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
}
.preview-canvases {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 10px;
}
.preview-screen {
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80px;
    position: relative;
}
.dark-screen {
    background: #101c48;
}
.light-screen {
    background: #ffffff;
}
.screen-label {
    position: absolute;
    top: 6px;
    left: 8px;
    font-size: 0.68rem;
    font-weight: 600;
    opacity: 0.6;
}
.dark-screen .screen-label { color: #ffffff; }
.light-screen .screen-label { color: #0f172a; }

.sample-badge {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'Open Sans Condensed', sans-serif;
    padding: 4px 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.5px;
}
.preview-test-input {
    display: flex;
    align-items: center;
    gap: 8px;
}
.preview-test-input label {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: nowrap;
}
.preview-test-input input {
    flex: 1;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--text-main);
    font-size: 0.85rem;
}

/* Formular */
.editor-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
    color: var(--text-muted);
}
input[type="text"], select {
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 10px;
    color: var(--text-main);
    font-size: 0.88rem;
}
.colors-section, .invert-section {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
}
.section-title {
    font-size: 0.8rem;
    font-weight: 700;
    display: block;
    margin-bottom: 8px;
    color: var(--text-main);
}
.color-pickers-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
}
.color-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.color-item label {
    font-size: 0.75rem;
}
.color-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
}
input[type="color"] {
    -webkit-appearance: none;
    appearance: none;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    cursor: pointer;
    background: none;
    padding: 0;
}
input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
input[type="color"]::-webkit-color-swatch { border: 1px solid var(--border); border-radius: 6px; }
.hex-input {
    width: 80px;
    font-family: monospace;
    font-size: 0.8rem !important;
    padding: 5px 6px !important;
}
.empty-selection, .empty-hint {
    padding: 30px;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
}

/* Auto-Colors Status & Toggle Banner */
.auto-colors-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: rgba(30, 58, 138, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
}
.auto-colors-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.auto-colors-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--text-main);
}
.auto-colors-desc {
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.35;
}
.badge-status {
    font-size: 0.7rem;
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.badge-success {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
}
.badge-pending {
    background: rgba(234, 179, 8, 0.2);
    color: #facc15;
    border: 1px solid rgba(234, 179, 8, 0.4);
}

/* Farbsystem-Umschalter (DB 2026 / Klassisch) */
.scheme-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
}
.scheme-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 240px;
    min-width: 0;
}
.scheme-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--text-main);
}
.scheme-desc {
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.35;
}
.scheme-switch {
    display: inline-flex;
    gap: 3px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border);
    border-radius: 8px;
    flex-shrink: 0;
}
.scheme-option {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}
.scheme-option:hover {
    color: var(--text-main);
}
.scheme-option.active {
    background: #2563eb;
    color: #ffffff;
}

/* Regionalverkehr-Opt-in */
.scheme-option-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 12px;
}
.scheme-option-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1 1 240px;
    min-width: 0;
}
.scheme-option-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-main);
}
.scheme-option-desc {
    font-size: 0.76rem;
    color: var(--text-muted);
    line-height: 1.35;
}

/* System-Vorschau */
.system-preview-card {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 16px;
}
.system-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}
.system-preview-hint {
    font-size: 0.72rem;
    color: var(--text-muted);
}
.system-preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
}
.system-preview-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 8px;
}
.system-preview-badge {
    font-family: 'Open Sans Condensed', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 62px;
    flex-shrink: 0;
}
.system-preview-meta {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}
.system-preview-label {
    font-size: 0.74rem;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.system-preview-kind {
    font-size: 0.66rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

/* Kontrast-Chips (WCAG 2.2) */
.section-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
}
.section-title-row .section-title {
    margin-bottom: 0;
}
.contrast-fix-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border);
    color: var(--text-main);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    cursor: pointer;
}
.contrast-fix-btn:hover {
    background: rgba(255, 255, 255, 0.12);
}
.contrast-chip {
    font-size: 0.66rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 8px;
    border: 1px solid transparent;
    white-space: nowrap;
    flex-shrink: 0;
}
.contrast-ok {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border-color: rgba(34, 197, 94, 0.4);
}
.contrast-large {
    background: rgba(234, 179, 8, 0.2);
    color: #facc15;
    border-color: rgba(234, 179, 8, 0.4);
}
.contrast-low {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.4);
}
.contrast-none {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
    border-color: rgba(148, 163, 184, 0.3);
}

/* Toggle Switch */
.switch-toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
}
.switch-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}
.slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #334155;
    transition: 0.2s;
    border-radius: 24px;
}
.slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
}
input:checked + .slider {
    background-color: #2563eb;
}
input:checked + .slider:before {
    transform: translateX(20px);
}

/* Import Confirmation Banner */
.import-confirm-banner {
    background: var(--bg-panel, #1e293b);
    border-top: 1px solid var(--primary, #3b82f6);
    border-bottom: 1px solid var(--border, #334155);
    padding: 12px 20px;
    box-sizing: border-box;
    animation: fadeIn 0.2s ease;
}
.import-confirm-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--text-primary, #f8fafc);
    margin-bottom: 4px;
    font-size: 0.95rem;
}
.import-confirm-desc {
    margin: 0 0 10px 0;
    font-size: 0.85rem;
    color: var(--text-muted, #94a3b8);
}
.import-confirm-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
