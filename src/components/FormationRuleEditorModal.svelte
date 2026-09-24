<!-- src/components/FormationRuleEditorModal.svelte -->
<script>
    import { formationRuleService } from '../js/features/formation/formationRuleService.svelte.js';
    import { FormationPresetService } from '../js/features/formation/formationPresetService.js';
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import ZimIcon from './ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {boolean} isOpen
     */
    let {
        isOpen = $bindable(false)
    } = $props();

    const presets = FormationPresetService.getPresets();
    let selectedRuleId = $state(null);

    // Live-Test-Felder
    let testTrainName = $state('RE 1');
    let testTime = $state('14:30');

    // Initiale Auswahl der ersten Regel beim Öffnen
    $effect(() => {
        if (isOpen && !selectedRuleId && formationRuleService.rules.length > 0) {
            selectedRuleId = formationRuleService.rules[0].id;
        }
    });

    let selectedRule = $derived(
        formationRuleService.rules.find(r => r.id === selectedRuleId) || null
    );

    // Auswertung des Live-Tests
    let testResult = $derived.by(() => {
        if (!testTrainName.trim()) return null;

        const dummyJourney = {
            name: testTrainName.trim(),
            effectiveDisplayName: testTrainName.trim(),
            scheduledTime: testTime,
            expectedTime: testTime,
            produktGattung: testTrainName.trim().split(/\s+/)[0] || '',
            destination: ''
        };

        const matched = formationRuleService.findMatchingRule(dummyJourney);
        if (!matched) return null;

        const matchedPreset = FormationPresetService.getPresetById(matched.presetId);
        return {
            rule: matched,
            preset: matchedPreset
        };
    });

    function closeModal() {
        isOpen = false;
    }

    function createNewRule() {
        const newR = formationRuleService.addRule({
            name: 'Neue Wagenreihungs-Regel',
            presetId: presets[0]?.id || 'ice4_12',
            linePattern: 'RE',
            matchType: 'startsWith',
            traction: 1
        });
        selectedRuleId = newR.id;
    }

    function deleteCurrentRule(id) {
        if (confirm('Möchtest du diese Regel wirklich löschen?')) {
            formationRuleService.deleteRule(id);
            selectedRuleId = formationRuleService.rules[0]?.id || null;
        }
    }

    function moveRule(id, dir) {
        formationRuleService.moveRule(id, dir);
    }

    function handleFieldChange() {
        formationRuleService.saveRules();
    }

    function applyToAllJourneys() {
        const count = formationRuleService.applyRulesToAllJourneys(journeyStore, true);
        trainDisplay.updateAll();
        alert(`Die Regeln wurden erfolgreich auf ${count} Fahrt(en) angewendet.`);
    }

    function resetToDefaults() {
        if (confirm('Möchtest du alle Regeln auf die Standardeinstellungen zurücksetzen? Eigene Regeln gehen verloren.')) {
            formationRuleService.resetToDefaults();
            selectedRuleId = formationRuleService.rules[0]?.id || null;
        }
    }

    function exportRules() {
        const json = formationRuleService.exportRules();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zimsim_formation_rules_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleImport(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const success = formationRuleService.importRules(event.target.result);
            if (success) {
                selectedRuleId = formationRuleService.rules[0]?.id || null;
                alert('Regeln wurden erfolgreich importiert!');
            } else {
                alert('Fehler beim Importieren der Datei. Ungültiges Format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }
</script>

{#if isOpen}
<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }} role="presentation">
    <div class="modal-content modal-extra-wide">
        <!-- Header -->
        <div class="modal-header">
            <div class="header-title-wrap">
                <ZimIcon name="train" size={20} color="var(--accent, #e2001a)" />
                <h3>Regeln für automatische Wagenreihung</h3>
            </div>
            <button class="modal-close" onclick={closeModal} title="Schließen">
                <ZimIcon name="close" size={18} />
            </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
            <!-- Globale Steuerungsleiste -->
            <div class="top-controls-bar">
                <label class="auto-assign-toggle">
                    <input 
                        type="checkbox" 
                        checked={formationRuleService.autoAssign} 
                        onchange={(e) => formationRuleService.setAutoAssign(e.target.checked)} 
                    />
                    <span><strong>Automatische Zuweisung aktiv</strong> (bei IRIS-Live-Import & neuen Fahrten)</span>
                </label>

                <div class="top-buttons">
                    <button type="button" class="btn-secondary btn-sm" onclick={applyToAllJourneys} title="Wendet alle zutreffenden Regeln auf bestehende Fahrten an">
                        <ZimIcon name="restart" size={14} />
                        <span>Auf alle Fahrten anwenden</span>
                    </button>
                    <button type="button" class="btn-primary btn-sm" onclick={createNewRule}>
                        <ZimIcon name="plus" size={14} />
                        <span>Neue Regel</span>
                    </button>
                </div>
            </div>

            <!-- Haupt-Layout: 2 Spalten -->
            <div class="rules-main-grid">
                <!-- Spalte 1: Regelliste (Priorität von oben nach unten) -->
                <div class="rules-sidebar">
                    <div class="sidebar-header">
                        <span>Priorität (Erster Treffer gewinnt)</span>
                        <span class="rules-count">{formationRuleService.rules.length}</span>
                    </div>

                    <div class="rules-list">
                        {#if formationRuleService.rules.length === 0}
                            <div class="empty-list-notice">Keine Regeln vorhanden.</div>
                        {/if}

                        {#each formationRuleService.rules as rule, idx (rule.id)}
                            {@const isSelected = rule.id === selectedRuleId}
                            {@const preset = presets.find(p => p.id === rule.presetId)}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <div 
                                class="rule-item {isSelected ? 'selected' : ''} {!rule.enabled ? 'disabled' : ''}" 
                                onclick={() => selectedRuleId = rule.id}
                                role="button"
                                tabindex="0"
                            >
                                <div class="rule-item-left">
                                    <input 
                                        type="checkbox" 
                                        bind:checked={rule.enabled} 
                                        onchange={handleFieldChange} 
                                        onclick={(e) => e.stopPropagation()} 
                                        title="Regel aktivieren / deaktivieren"
                                    />
                                    <div class="rule-info">
                                        <div class="rule-name">{rule.name}</div>
                                        <div class="rule-badges">
                                            <span class="mini-badge pattern">{rule.linePattern}</span>
                                            {#if preset}
                                                <span class="mini-badge preset">{preset.name}</span>
                                            {/if}
                                            {#if rule.traction > 1}
                                                <span class="mini-badge traction">{rule.traction}x Traktion</span>
                                            {/if}
                                            {#if rule.cadenceEnabled}
                                                <span class="mini-badge cadence">Takt {rule.cadenceInterval}h</span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                <div class="rule-item-actions">
                                    <button 
                                        type="button" 
                                        class="btn-icon-tiny" 
                                        disabled={idx === 0} 
                                        onclick={(e) => { e.stopPropagation(); moveRule(rule.id, 'up'); }}
                                        title="Priorität erhöhen"
                                    >
                                        <ZimIcon name="arrow_up" size={13} />
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn-icon-tiny" 
                                        disabled={idx === formationRuleService.rules.length - 1} 
                                        onclick={(e) => { e.stopPropagation(); moveRule(rule.id, 'down'); }}
                                        title="Priorität verringern"
                                    >
                                        <ZimIcon name="arrow_down" size={13} />
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn-icon-tiny delete-btn" 
                                        onclick={(e) => { e.stopPropagation(); deleteCurrentRule(rule.id); }}
                                        title="Regel löschen"
                                    >
                                        <ZimIcon name="trash" size={13} />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Spalte 2: Detail-Editor & Live-Tester -->
                {#if selectedRule}
                    <div class="rule-editor-pane">
                        <div class="editor-header">
                            <h4>Regel konfigurieren: {selectedRule.name}</h4>
                        </div>

                        <div class="editor-sections">
                            <!-- Sektion 1: Grunddaten & Preset -->
                            <div class="config-card">
                                <div class="card-title">1. Grunddaten & Zugkomposition</div>
                                <div class="form-row">
                                    <div class="form-group flex-2">
                                        <label for="rule_name_input">Bezeichnung der Regel:</label>
                                        <input 
                                            id="rule_name_input"
                                            type="text" 
                                            class="form-control" 
                                            bind:value={selectedRule.name} 
                                            oninput={handleFieldChange} 
                                        />
                                    </div>
                                    <div class="form-group flex-2">
                                        <label for="rule_preset_select">Zuzuweisendes Preset:</label>
                                        <select 
                                            id="rule_preset_select"
                                            class="form-control" 
                                            bind:value={selectedRule.presetId} 
                                            onchange={handleFieldChange}
                                        >
                                            {#each presets as p}
                                                <option value={p.id}>{p.name} ({p.coaches.length} Wagen)</option>
                                            {/each}
                                        </select>
                                    </div>
                                </div>

                                <div class="form-row" style="margin-top: 10px;">
                                    <div class="form-group">
                                        <label for="rule_traction_select">Traktion:</label>
                                        <select 
                                            id="rule_traction_select"
                                            class="form-control" 
                                            bind:value={selectedRule.traction} 
                                            onchange={handleFieldChange}
                                        >
                                            <option value={1}>1x Einzeltraktion</option>
                                            <option value={2}>2x Doppeltraktion</option>
                                            <option value={3}>3x Dreifachtraktion</option>
                                        </select>
                                    </div>
                                    <div class="form-group checkbox-align">
                                        <label class="checkbox-label">
                                            <input type="checkbox" bind:checked={selectedRule.reverse} onchange={handleFieldChange} />
                                            <span>Ausrichtung umkehren (gespiegelt)</span>
                                        </label>
                                    </div>
                                    <div class="form-group checkbox-align">
                                        <label class="checkbox-label">
                                            <input type="checkbox" bind:checked={selectedRule.offsetWagons} onchange={handleFieldChange} />
                                            <span>Wagennummern-Versatz bei Mehrfachtraktion</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Sektion 2: Kriterien Zug & Linie -->
                            <div class="config-card">
                                <div class="card-title">2. Kriterien: Zug, Linie & Gattung</div>
                                <div class="form-row">
                                    <div class="form-group flex-2">
                                        <label for="rule_pattern_input">Suchmuster für Linie / Zugname:</label>
                                        <input 
                                            id="rule_pattern_input"
                                            type="text" 
                                            class="form-control" 
                                            bind:value={selectedRule.linePattern} 
                                            oninput={handleFieldChange} 
                                            placeholder="z.B. ^RE\s*1$ oder ICE 5" 
                                        />
                                    </div>
                                    <div class="form-group flex-1">
                                        <label for="rule_matchtype_select">Abgleichsart:</label>
                                        <select 
                                            id="rule_matchtype_select"
                                            class="form-control" 
                                            bind:value={selectedRule.matchType} 
                                            onchange={handleFieldChange}
                                        >
                                            <option value="startsWith">Beginnt mit</option>
                                            <option value="contains">Enthält</option>
                                            <option value="exact">Exakt</option>
                                            <option value="regex">Regulärer Ausdruck (Regex)</option>
                                        </select>
                                    </div>
                                    <div class="form-group flex-1">
                                        <label for="rule_cat_input">Gattung (optional):</label>
                                        <input 
                                            id="rule_cat_input"
                                            type="text" 
                                            class="form-control" 
                                            bind:value={selectedRule.category} 
                                            oninput={handleFieldChange} 
                                            placeholder="z.B. ICE, RE, S" 
                                        />
                                    </div>
                                </div>

                                <div class="form-row" style="margin-top: 10px;">
                                    <div class="form-group flex-1">
                                        <label for="rule_num_min">Zugnummer von (opt.):</label>
                                        <input 
                                            id="rule_num_min"
                                            type="number" 
                                            class="form-control" 
                                            bind:value={selectedRule.trainNumberMin} 
                                            oninput={handleFieldChange} 
                                            placeholder="z.B. 500" 
                                        />
                                    </div>
                                    <div class="form-group flex-1">
                                        <label for="rule_num_max">Zugnummer bis (opt.):</label>
                                        <input 
                                            id="rule_num_max"
                                            type="number" 
                                            class="form-control" 
                                            bind:value={selectedRule.trainNumberMax} 
                                            oninput={handleFieldChange} 
                                            placeholder="z.B. 599" 
                                        />
                                    </div>
                                    <div class="form-group flex-2">
                                        <label for="rule_dest_input">Zielbahnhof enthält (optional):</label>
                                        <input 
                                            id="rule_dest_input"
                                            type="text" 
                                            class="form-control" 
                                            bind:value={selectedRule.destinationPattern} 
                                            oninput={handleFieldChange} 
                                            placeholder="z.B. Köln Hbf" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Sektion 3: Takt- & Zeitfenster -->
                            <div class="config-card">
                                <div class="card-title">3. Kriterien: Takt, Uhrzeit & Wochentag</div>
                                
                                <div class="toggle-subcard">
                                    <label class="checkbox-label subcard-header">
                                        <input type="checkbox" bind:checked={selectedRule.cadenceEnabled} onchange={handleFieldChange} />
                                        <span><strong>Takt-Intervall filtern</strong> (z.B. zweistündlicher Wechsel von Fahrzeugtypen)</span>
                                    </label>
                                    {#if selectedRule.cadenceEnabled}
                                        <div class="form-row subcard-body">
                                            <div class="form-group flex-1">
                                                <label for="cadence_interval_input">Takt-Intervall (Stunden):</label>
                                                <input 
                                                    id="cadence_interval_input"
                                                    type="number" 
                                                    min="1" 
                                                    max="24" 
                                                    class="form-control" 
                                                    bind:value={selectedRule.cadenceInterval} 
                                                    oninput={handleFieldChange} 
                                                />
                                            </div>
                                            <div class="form-group flex-1">
                                                <label for="cadence_offset_select">Stunden-Muster:</label>
                                                <select 
                                                    id="cadence_offset_select"
                                                    class="form-control" 
                                                    bind:value={selectedRule.cadenceOffset} 
                                                    onchange={handleFieldChange}
                                                >
                                                    <option value={0}>Gerade Stunden (z.B. 10:xx, 12:xx, 14:xx)</option>
                                                    <option value={1}>Ungerade Stunden (z.B. 09:xx, 11:xx, 13:xx)</option>
                                                </select>
                                            </div>
                                        </div>
                                    {/if}
                                </div>

                                <div class="toggle-subcard" style="margin-top: 10px;">
                                    <label class="checkbox-label subcard-header">
                                        <input type="checkbox" bind:checked={selectedRule.timeRangeEnabled} onchange={handleFieldChange} />
                                        <span><strong>Zeitfenster filtern</strong> (z.B. HVZ-Verstärker oder Nachtzüge)</span>
                                    </label>
                                    {#if selectedRule.timeRangeEnabled}
                                        <div class="form-row subcard-body">
                                            <div class="form-group flex-1">
                                                <label for="time_from_input">Von (HH:MM):</label>
                                                <input 
                                                    id="time_from_input"
                                                    type="time" 
                                                    class="form-control" 
                                                    bind:value={selectedRule.timeRangeFrom} 
                                                    oninput={handleFieldChange} 
                                                />
                                            </div>
                                            <div class="form-group flex-1">
                                                <label for="time_to_input">Bis (HH:MM):</label>
                                                <input 
                                                    id="time_to_input"
                                                    type="time" 
                                                    class="form-control" 
                                                    bind:value={selectedRule.timeRangeTo} 
                                                    oninput={handleFieldChange} 
                                                />
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            <!-- Sektion 4: Live-Tester -->
                            <div class="config-card test-card">
                                <div class="card-title">Live-Tester für Regeln</div>
                                <div class="test-inputs-row">
                                    <div class="form-group flex-2">
                                        <label for="test_train_input">Zugname / Linie zum Testen:</label>
                                        <input 
                                            id="test_train_input"
                                            type="text" 
                                            class="form-control" 
                                            bind:value={testTrainName} 
                                            placeholder="z.B. RE 1 oder ICE 543" 
                                        />
                                    </div>
                                    <div class="form-group flex-1">
                                        <label for="test_time_input">Uhrzeit:</label>
                                        <input 
                                            id="test_time_input"
                                            type="time" 
                                            class="form-control" 
                                            bind:value={testTime} 
                                        />
                                    </div>
                                </div>

                                <div class="test-feedback {testResult ? 'match' : 'no-match'}">
                                    {#if testResult}
                                        <div class="match-badge">
                                            <ZimIcon name="check" size={16} />
                                            <span><strong>Match!</strong> Greift durch Regel: <em>„{testResult.rule.name}“</em></span>
                                        </div>
                                        <div class="match-details">
                                            Zuweisung: <strong>{testResult.preset?.name}</strong> &bull; {testResult.rule.traction}x Traktion ({testResult.preset?.coaches.length * testResult.rule.traction} Wagen)
                                        </div>
                                    {:else}
                                        <div class="no-match-badge">
                                            <span>Keine Regel greift für diesen Testfall (Standard-Wagenreihung bliebe unverändert).</span>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
            <div class="footer-left">
                <button type="button" class="btn-secondary btn-sm" onclick={resetToDefaults}>Standard zurücksetzen</button>
                <button type="button" class="btn-secondary btn-sm" onclick={exportRules}>Regeln exportieren</button>
                <label class="btn-secondary btn-sm file-import-label">
                    <span>Regeln importieren</span>
                    <input type="file" accept=".json" onchange={handleImport} style="display: none;" />
                </label>
            </div>
            <button type="button" class="btn-primary" onclick={closeModal}>Fertig</button>
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
    padding: 16px;
    box-sizing: border-box;
}

.modal-content {
    background: var(--bg-card, #202020);
    border: 1px solid var(--border, #444);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 92vh;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
}

.modal-extra-wide {
    max-width: 1080px;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border, #444);
    background: rgba(0, 0, 0, 0.2);
}

.header-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

.header-title-wrap h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-main, #fff);
}

.modal-close {
    background: none;
    border: none;
    color: var(--text-muted, #aaa);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
}
.modal-close:hover {
    color: var(--text-main, #fff);
    background: rgba(255, 255, 255, 0.08);
}

.modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

/* Top Controls */
.top-controls-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 8px;
    padding: 10px 14px;
    flex-wrap: wrap;
    gap: 10px;
}

.auto-assign-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    color: var(--text-main, #eee);
    cursor: pointer;
}

.top-buttons {
    display: flex;
    gap: 8px;
}

/* 2-Column Rules Grid */
.rules-main-grid {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 16px;
    min-height: 480px;
}

/* Sidebar List */
.rules-sidebar {
    background: var(--bg-input, #181818);
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #888);
    border-bottom: 1px solid var(--border, #333);
}

.rules-count {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 0.75rem;
}

.rules-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.empty-list-notice {
    padding: 20px;
    text-align: center;
    color: var(--text-muted, #777);
    font-size: 0.85rem;
}

.rule-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border, #333);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.rule-item:hover {
    border-color: var(--text-muted, #777);
    background: rgba(255, 255, 255, 0.05);
}

.rule-item.selected {
    border-color: var(--accent, #e2001a);
    background: rgba(226, 0, 26, 0.08);
}

.rule-item.disabled {
    opacity: 0.5;
}

.rule-item-left {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex: 1;
    overflow: hidden;
}

.rule-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
}

.rule-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-main, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.rule-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.mini-badge {
    font-size: 0.68rem;
    padding: 1px 5px;
    border-radius: 3px;
    background: #334155;
    color: #e2e8f0;
}
.mini-badge.pattern { background: #1e3a8a; }
.mini-badge.preset { background: #0f766e; }
.mini-badge.traction { background: #047857; }
.mini-badge.cadence { background: #b45309; }

.rule-item-actions {
    display: flex;
    align-items: center;
    gap: 2px;
}

.btn-icon-tiny {
    background: none;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    padding: 3px;
    border-radius: 3px;
    display: flex;
    align-items: center;
}
.btn-icon-tiny:hover:not(:disabled) {
    color: var(--text-main, #fff);
    background: rgba(255, 255, 255, 0.1);
}
.btn-icon-tiny:disabled {
    opacity: 0.3;
    cursor: default;
}
.btn-icon-tiny.delete-btn:hover {
    color: #ef4444;
}

/* Editor Pane */
.rule-editor-pane {
    background: var(--bg-input, #181818);
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.editor-header h4 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-main, #fff);
    border-bottom: 1px solid var(--border, #333);
    padding-bottom: 8px;
}

.editor-sections {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.config-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border, #333);
    border-radius: 6px;
    padding: 12px;
}

.card-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted, #aaa);
    margin-bottom: 10px;
}

.form-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.form-group.flex-1 { flex: 1; min-width: 120px; }
.form-group.flex-2 { flex: 2; min-width: 200px; }

.form-group label {
    font-size: 0.78rem;
    color: var(--text-muted, #aaa);
}

.form-control {
    background: var(--bg-card, #2b2b2b);
    border: 1px solid var(--border, #444);
    border-radius: 4px;
    color: var(--text-main, #fff);
    padding: 6px 8px;
    font-size: 0.85rem;
    outline: none;
}
.form-control:focus {
    border-color: var(--accent, #e2001a);
}

.checkbox-align {
    justify-content: flex-end;
    padding-bottom: 4px;
}

.checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    color: var(--text-main, #ddd);
    cursor: pointer;
}

.toggle-subcard {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.15);
}

.subcard-header {
    font-size: 0.84rem;
}

.subcard-body {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Test Card */
.test-card {
    background: #0f172a;
    border-color: #1e293b;
}

.test-inputs-row {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
}

.test-feedback {
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
}

.test-feedback.match {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid #22c55e;
    color: #86efac;
}

.test-feedback.no-match {
    background: rgba(148, 163, 184, 0.08);
    border: 1px solid #475569;
    color: #94a3b8;
}

.match-badge {
    display: flex;
    align-items: center;
    gap: 6px;
}

.match-details {
    color: #f8fafc;
    font-size: 0.8rem;
}

/* Footer */
.modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    border-top: 1px solid var(--border, #444);
    background: rgba(0, 0, 0, 0.2);
    flex-wrap: wrap;
    gap: 10px;
}

.footer-left {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.file-import-label {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
}

@media (max-width: 820px) {
    .rules-main-grid {
        grid-template-columns: 1fr;
    }
}
</style>
