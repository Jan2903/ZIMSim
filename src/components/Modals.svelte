<script>
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';

    let isDbModalOpen = $state(false);
    let importType = $state('departure_list');
    let dbImportText = $state('');
    let selectedJourneyIdForFormation = $state('');

    export function openDbImport() {
        isDbModalOpen = true;
    }

    function closeDbImport() {
        isDbModalOpen = false;
        dbImportText = '';
    }

    function executeDbImport() {
        if (!dbImportText) return;

        try {
            const data = JSON.parse(dbImportText);

            if (importType === 'departure_list') {
                journeyStore.importFromDepartureList(data);
            } else if (importType === 'arrival_list') {
                journeyStore.importFromArrivalList(data);
            } else if (importType === 'journey') {
                journeyStore.importFromJourney(data);
            } else if (importType === 'formation') {
                if (!selectedJourneyIdForFormation) {
                    alert('Erstelle zuerst eine Fahrt, der die Formation zugewiesen werden soll.');
                    return;
                }
                journeyStore.importFormation(selectedJourneyIdForFormation, data);
            }

            trainDisplay.updateAll();
            closeDbImport();
        } catch (err) {
            console.error('DB Import error:', err);
            alert('Fehler beim Importieren: ' + err.message);
        }
    }
</script>

{#if isDbModalOpen}
<div class="modal-overlay">
    <div class="modal-content modal-wide">
        <div class="modal-header">
            <h3>DB-Daten importieren</h3>
            <button class="modal-close" onclick={closeDbImport}>✕</button>
        </div>
        <div class="modal-body">
            <div class="import-tabs">
                <label class="radio-card"><input type="radio" bind:group={importType} value="departure_list"> Abfahrtstafel</label>
                <label class="radio-card"><input type="radio" bind:group={importType} value="arrival_list"> Ankunftstafel</label>
                <label class="radio-card"><input type="radio" bind:group={importType} value="journey"> Zuglauf</label>
                <label class="radio-card"><input type="radio" bind:group={importType} value="formation"> Formation</label>
            </div>
            
            {#if importType === 'formation'}
            <div style="margin-bottom: 10px;">
                <label>Ziel-Fahrt auswählen: 
                    <select bind:value={selectedJourneyIdForFormation} style="width: 100%; padding: 5px;">
                        {#each journeyStore.journeys as j}
                            <option value={j.id}>{j.effectiveDisplayName || j.name || 'Unbenannte Fahrt'}</option>
                        {/each}
                    </select>
                </label>
            </div>
            {/if}
            
            <textarea rows="12" placeholder="JSON hier einfügen..." bind:value={dbImportText}></textarea>
        </div>
        <div class="modal-footer">
            <button class="btn-primary" onclick={executeDbImport}>Importieren</button>
            <button class="btn-secondary" onclick={closeDbImport}>Abbrechen</button>
        </div>
    </div>
</div>
{/if}

<style>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-overlay.hidden { display: none; }
.modal-content { background: var(--bg-card); border-radius: 12px; padding: 0; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column; min-width: 400px; }
.modal-wide { width: 90%; max-width: 900px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.modal-header h3 { margin: 0; }
.modal-close { background: none; border: none; color: var(--text-muted); font-size: 1.2em; cursor: pointer; padding: 4px; }
.modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
.import-tabs { display: flex; gap: 8px; margin-bottom: 12px; margin-top: 15px; }
textarea { width: 100%; background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 0.85em; resize: vertical; box-sizing: border-box; margin-bottom: 15px; }
.import-info { margin-top: 8px; color: var(--text-muted); font-size: 0.85em; }
</style>
