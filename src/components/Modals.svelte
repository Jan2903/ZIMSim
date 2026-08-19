<script>
    import { journeyStore, trainDisplay } from '../js/main.js';

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
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}
.modal-content {
    background: white;
    padding: 20px;
    border-radius: 8px;
    min-width: 500px;
}
.modal-header {
    display: flex;
    justify-content: space-between;
}
.import-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    margin-top: 15px;
}
textarea {
    width: 100%;
    margin-bottom: 15px;
}
</style>
