<!-- src/components/settings/SettingsDisplaySystem.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { uiState } from '../../js/core/state/uiState.svelte.js';
    import { config } from '../../js/core/utils/config.js';
    import LineColorEditorModal from '../LineColorEditorModal.svelte';
    import FormationRuleEditorModal from '../FormationRuleEditorModal.svelte';
    import ZimIcon from '../ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente
     */
    let { modalsComp = null } = $props();

    // Modal-Status für Linienfarben & Badges
    let isLineColorModalOpen = $state(false);
    let isFormationRulesModalOpen = $state(false);

    // Performance-Modus (30 FPS Begrenzung)
    let isPerformanceMode = $state(config.performance_mode);

    $effect(() => {
        config.performance_mode = isPerformanceMode;
        localStorage.setItem('zimsim_performance_mode', isPerformanceMode);
    });

    /**
     * Exportiert das gesamte aktuelle Szenario als JSON-Datei.
     * @returns {void}
     */
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

    /**
     * Importiert ein gespeichertes Szenario aus einer JSON-Datei.
     * @param {Event} e
     * @returns {void}
     */
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
                console.error('[SettingsDisplaySystem] Fehler beim Import:', err);
                alert('Fehler beim Importieren der Datei.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    }
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Display- & Regional-Optionen -->
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
                        id="nrw_mode_checkbox" 
                        bind:checked={journeyStore.nrwMode} 
                        onchange={() => trainDisplay.updateAll()}
                    >
                    <span>Nur Liniennummern anzeigen (NRW-Nahverkehrsmodus)</span>
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

            <div class="info-note" style="margin-top: 14px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
                Hinweis: Die Wahl des DB-Anzeigetyps (z.B. Zuganzeiger, Anschlusstafel) und der Hardware (z.B. 2×32", 3×32") kann direkt über die Steuerungsleiste unter dem Monitor vorgenommen werden.
            </div>
        </div>
    </div>

    <!-- Spalte 2: Performance & Bedienung -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="settings" size={18} />
            <h3>Performance & Bedienung</h3>
        </div>
        <div class="card-body">
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="performance_mode_checkbox" bind:checked={isPerformanceMode}>
                    <span>Performance-Modus (Begrenzung auf 30 FPS für schwächere Hardware)</span>
                </label>
                <label class="checkbox-label" style="margin-top: 8px;">
                    <input type="checkbox" bind:checked={uiState.hideLinkedArrivals}>
                    <span>Durchfahrt-Ankünfte in der Fahrtenliste ausblenden</span>
                </label>
                <label class="checkbox-label" style="margin-top: 8px;">
                    <input type="checkbox" bind:checked={uiState.enableDragAndDrop}>
                    <span>Listen-Sortierung per Drag & Drop aktivieren (alternativ Pfeiltasten)</span>
                </label>
            </div>
        </div>
    </div>

    <!-- Spalte 3: Datensicherung & Szenarien -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="save" size={18} />
            <h3>Szenarien & Datensicherung</h3>
        </div>
        <div class="card-body">
            <div class="button-group-vertical" style="display: flex; flex-direction: column; gap: 8px;">
                <button 
                    type="button"
                    id="export_all_btn" 
                    class="btn-secondary" 
                    onclick={exportConfig} 
                    style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                >
                    <ZimIcon name="export" size={16} />
                    <span>Szenario exportieren (JSON)</span>
                </button>

                <button 
                    type="button"
                    id="import_all_btn" 
                    class="btn-secondary" 
                    onclick={() => fileInput?.click()} 
                    style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                >
                    <ZimIcon name="import" size={16} />
                    <span>Szenario importieren (JSON)</span>
                </button>
                <input type="file" bind:this={fileInput} style="display: none;" accept=".json" onchange={handleFileImport}>

                <button 
                    type="button"
                    id="import_db_btn" 
                    class="btn-secondary" 
                    onclick={() => modalsComp?.openDbImport()} 
                    style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                >
                    <ZimIcon name="train_fast" size={16} />
                    <span>DB-Rohdaten importieren</span>
                </button>
            </div>
        </div>
    </div>
</div>

<LineColorEditorModal bind:isOpen={isLineColorModalOpen} />
<FormationRuleEditorModal bind:isOpen={isFormationRulesModalOpen} />

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
</style>
