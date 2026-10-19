<script>
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import { toastStore } from '../js/core/state/toastStore.svelte.js';
    import Modal from './Modal.svelte';

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
                    toastStore.warning('Erstelle zuerst eine Fahrt, der die Formation zugewiesen werden soll.');
                    return;
                }
                journeyStore.importFormation(selectedJourneyIdForFormation, data);
            }

            trainDisplay.updateAll();
            closeDbImport();
        } catch (err) {
            console.error('DB Import error:', err);
            toastStore.error('Fehler beim Importieren: ' + err.message);
        }
    }
</script>

<Modal
    bind:isOpen={isDbModalOpen}
    title="DB-Daten importieren"
    size="lg"
    onClose={() => { dbImportText = ''; }}
>
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

    {#snippet footer()}
        <button class="btn-primary" onclick={executeDbImport}>Importieren</button>
        <button class="btn-secondary" onclick={closeDbImport}>Abbrechen</button>
    {/snippet}
</Modal>

<style>
    .import-tabs { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .import-tabs .radio-card { flex: 1; min-width: 130px; }
    textarea { width: 100%; background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 0.85em; resize: vertical; box-sizing: border-box; }
</style>
