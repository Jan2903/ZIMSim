<!-- src/components/settings/livedata/IrisSection.svelte -->
<script>
    import { journeyStore } from '../../../js/core/state/stores.js';
    import { irisPollingService, irisConfig } from '../../../js/core/services/irisPollingService.svelte.js';
    import { toastStore } from '../../../js/core/state/toastStore.svelte.js';
    import ZimIcon from '../../ZimIcon.svelte';

    // Lade-Status für manuelle IRIS-Abfrage
    let isFetchingIris = $state(false);

    /**
     * Führt eine sofortige Aktualisierung der IRIS-Daten aus.
     * @returns {Promise<void>}
     */
    async function triggerIrisFetch() {
        if (!journeyStore.stationContext.stationId) {
            toastStore.warning('Bitte zuerst eine Station auswählen!');
            return;
        }
        isFetchingIris = true;
        try {
            if (irisConfig.autoUpdateInterval > 0) {
                irisPollingService.start();
            } else {
                await irisPollingService.pollRealtime(true);
            }
        } catch (e) {
            console.error('[IrisSection] Fehler beim Abrufen der IRIS-Daten:', e);
            toastStore.error('Fehler beim Abrufen der IRIS-Daten.');
        } finally {
            isFetchingIris = false;
        }
    }
</script>

<div class="form-row column-layout">
    <label class="field-label">
        Automatisches Polling (Intervall):
        <select 
            class="form-select" 
            style="margin-top: 4px;"
            bind:value={irisConfig.autoUpdateInterval} 
            onchange={() => { if (irisConfig.autoUpdateInterval > 0) irisPollingService.restart(); else irisPollingService.stop(); }}
        >
            <option value={0}>Aus (Nur manueller Abruf)</option>
            <option value={20}>Alle 20 Sekunden</option>
            <option value={30}>Alle 30 Sekunden</option>
            <option value={60}>Alle 60 Sekunden</option>
        </select>
    </label>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
        <label class="field-label">
            Zukunft (Std.):
            <input 
                type="number" 
                class="form-input" 
                min="0" 
                max="10" 
                bind:value={irisConfig.futureWindowHours} 
                onchange={() => irisPollingService.pollRealtime()}
            >
        </label>
        <label class="field-label">
            Vergangenheit (Min.):
            <input 
                type="number" 
                class="form-input" 
                min="0" 
                max="180" 
                bind:value={irisConfig.lookbehindMinutes} 
                onchange={() => irisPollingService.pollRealtime()}
            >
        </label>
    </div>

    <div class="checkbox-group" style="margin-top: 16px;">
        <label class="checkbox-label">
            <input type="checkbox" bind:checked={irisConfig.autoAnnouncements}>
            <span>Automatische Ansagen bei Verspätungen & Gleiswechseln</span>
        </label>
        <label class="checkbox-label">
            <input 
                type="checkbox" 
                bind:checked={irisConfig.autoSort} 
                onchange={() => { if (irisConfig.autoSort) journeyStore.sortJourneys(); }}
            >
            <span>Züge automatisch nach Echtzeit sortieren</span>
        </label>
    </div>

    <div style="margin-top: 18px;">
        <button 
            type="button" 
            class="btn-primary" 
            style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={triggerIrisFetch} 
            disabled={isFetchingIris || irisPollingService.isFetching}
        >
            <ZimIcon name="restart" size={14} />
            <span>{isFetchingIris || irisPollingService.isFetching ? 'Lade IRIS-Daten...' : 'Jetzt IRIS-Daten abrufen'}</span>
        </button>
    </div>
</div>

<style>
    .form-input,
    .form-select {
        width: 100%;
        background: var(--bg-input, #0f172a);
        color: var(--text-main, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 8px 12px;
        font-size: 0.85rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s ease;
    }

    .form-input:focus,
    .form-select:focus {
        border-color: var(--accent, #3b82f6);
    }
</style>
