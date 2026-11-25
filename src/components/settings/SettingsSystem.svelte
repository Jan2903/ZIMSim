<!-- src/components/settings/SettingsSystem.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { uiState } from '../../js/core/state/uiState.svelte.js';
    import { toastStore } from '../../js/core/state/toastStore.svelte.js';
    import { config, setPerformanceMode, setVoranzeigerAutoPage } from '../../js/core/utils/config.js';
    import ZimIcon from '../ZimIcon.svelte';
    import { createBundle, parseBundle, downloadJsonFile } from '../../js/core/utils/bundleUtils.js';

    /**
     * @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente
     */
    let { modalsComp = null } = $props();

    // Performance-Modus (30 FPS Begrenzung)
    let isPerformanceMode = $state(config.performance_mode);

    // Automatischer Seitenwechsel für Anschlusstafeln (10s Zyklus)
    let isVoranzeigerAutoPage = $state(config.voranzeigerAutoPage);

    $effect(() => {
        setPerformanceMode(isPerformanceMode);
    });

    $effect(() => {
        setVoranzeigerAutoPage(isVoranzeigerAutoPage);
        trainDisplay.updateAll();
    });

    /**
     * Exportiert das gesamte aktuelle Szenario im standardisierten ZIMSim-Container als JSON-Datei.
     * @returns {void}
     */
    function exportConfig() {
        const data = journeyStore.exportAll();
        const bundle = createBundle('zimsim-full-backup', data, {
            stationName: journeyStore.stationContext.stationName,
            journeyCount: journeyStore.journeys.length,
            colorScheme: data.colorScheme,
            regionalAutoColors: data.regionalAutoColors
        });
        downloadJsonFile(bundle, `zimsim_backup_${Date.now()}.json`);
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
            const parsed = parseBundle(event.target.result, 'zimsim-full-backup');
            if (!parsed.success) {
                toastStore.error(parsed.error || 'Fehler beim Importieren der Datei.');
                return;
            }

            try {
                journeyStore.importAll(parsed.payload);
                trainDisplay.updateAll();
                toastStore.success('Szenario-Backup erfolgreich geladen!');
            } catch (err) {
                console.error('[SettingsSystem] Fehler beim Import:', err);
                toastStore.error('Fehler beim Importieren der Datei: ' + (err?.message || err));
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    }
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Performance & Bedienung -->
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
                    <input type="checkbox" id="voranzeiger_auto_page_checkbox" bind:checked={isVoranzeigerAutoPage}>
                    <span>Automatischer Seitenwechsel für Anschlusstafeln (alle 10s bei mehr Abfahrten als Zeilen)</span>
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

    <!-- Spalte 2: Datensicherung & Szenarien -->
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
