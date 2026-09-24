<script>
    import { lineColorService, DEFAULT_LINE_RULES } from '../js/features/journey/services/lineColorService.svelte.js';
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import { ScreenSyncService } from '../js/core/services/screenSyncService.js';
    import ZimIcon from './ZimIcon.svelte';

    let { isOpen = $bindable(false) } = $props();

    let selectedRuleId = $state(null);
    let previewTestText = $state('');
    let fileInputRef = $state();

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

    function removeRule(id, e) {
        e?.stopPropagation();
        if (confirm('Möchtest du diese Linien-Regel wirklich löschen?')) {
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

    function resetDefaults() {
        if (confirm('Möchtest du alle Linien-Regeln auf die DB-Standards (IC-Pille, Flixtrain, S-Bahn) zurücksetzen?')) {
            lineColorService.resetToDefaults();
            selectedRuleId = lineColorService.rules[0]?.id || null;
            syncDisplay();
        }
    }

    function exportJson() {
        const json = lineColorService.exportRules();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zimsim_line_colors_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleImportFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const success = lineColorService.importRules(event.target.result);
            if (success) {
                selectedRuleId = lineColorService.rules[0]?.id || null;
                syncDisplay();
                alert('Linienfarben erfolgreich importiert.');
            } else {
                alert('Fehler beim Importieren der JSON-Datei.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
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
                                    <input type="text" bind:value={selectedRule.pattern} oninput={handleFieldChange}>
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
                                <span class="section-title">Farben (Normalmodus):</span>
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
</style>
