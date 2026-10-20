<!-- src/components/settings/livedata/IrisSection.svelte -->
<script>
    import { journeyStore } from '../../../js/core/state/stores.js';
    import { irisPollingService, irisConfig } from '../../../js/core/services/irisPollingService.svelte.js';
    import { liveDataConfig } from '../../../js/core/state/liveDataConfig.svelte.js';
    import { toastStore } from '../../../js/core/state/toastStore.svelte.js';
    import { getNonCorsAvailability } from '../../../js/core/services/apiClient.js';
    import { JourneyDbNavSyncService } from '../../../js/features/journey/services/journeyDbNavSyncService.js';
    import { JourneyDbWebSyncService } from '../../../js/features/journey/services/journeyDbWebSyncService.js';
    import ZimIcon from '../../ZimIcon.svelte';

    // Lade-Status für manuelle IRIS-Abfrage
    let isFetchingIris = $state(false);

    // Status für die Wagenreihungs-Anreicherung ([W])
    let isSyncingFormations = $state(false);
    let formationSyncResult = $state(null);

    // Anzeigename der aktiven Wagenreihungs-Quelle
    const formationSourceLabel = $derived(
        liveDataConfig.formationSource === 'dbweb' ? 'bahn.de' : 'DB Navigator'
    );

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

    /**
     * Gleicht die aktuellen Fahrten mit der aktiven Wagenreihungs-Quelle ab.
     * Ermittelt die Verfügbarkeit von Wagenreihungen ([W]) und lädt optional die Formation für aktive Züge.
     * @returns {Promise<void>}
     */
    async function syncFormations() {
        if (!journeyStore.stationContext.stationId) {
            toastStore.warning('Bitte zuerst eine Station auswählen!');
            return;
        }

        const avail = getNonCorsAvailability();
        if (avail.blocked) {
            formationSyncResult = {
                success: false,
                message: `DB Navigator ${avail.reason}`
            };
            return;
        }

        const useDbWeb = liveDataConfig.formationSource === 'dbweb';

        isSyncingFormations = true;
        formationSyncResult = null;
        try {
            const res = useDbWeb
                ? await JourneyDbWebSyncService.enrichJourneysWithDbWeb(null, journeyStore.stationContext.stationId)
                : await JourneyDbNavSyncService.enrichJourneysWithDbNav(null, null, {
                    lookbehindMinutes: irisConfig.lookbehindMinutes ?? 30,
                    maxChunks: 2
                });

            let extraMsg = '';
            if (liveDataConfig.autoFetchActiveFormations && res.matchedCount > 0) {
                const fetched = useDbWeb
                    ? await JourneyDbWebSyncService.autoFetchActiveFormations()
                    : await JourneyDbNavSyncService.autoFetchActiveFormations(2);
                if (fetched > 0) {
                    extraMsg = ` (${fetched} Wagenreihung(en) für Anzeige geladen)`;
                }
            }

            const suffix = useDbWeb
                ? '[W] Verfügbarkeit & Wagenreihungen aktualisiert.'
                : '[W] Verfügbarkeit aktualisiert.';

            formationSyncResult = {
                success: true,
                message: `${res.matchedCount} von ${res.totalDepartures} ${formationSourceLabel} Fahrten abgeglichen, ${suffix}${extraMsg}`
            };
        } catch (e) {
            console.error('[IrisSection] Fehler beim Wagenreihungs-Abgleich:', e);
            formationSyncResult = {
                success: false,
                message: `Fehler beim Abgleich mit ${formationSourceLabel}.`
            };
        } finally {
            isSyncingFormations = false;
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
            onchange={() => irisPollingService.restart()}
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

    <!-- Wagenreihungs-Anreicherung (Formationen) -->
    <div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div class="field-label" style="margin-bottom: 0;">Wagenreihungs-Anreicherung:</div>
            <span class="provider-pill">via {formationSourceLabel}</span>
        </div>
        <p class="sub-desc" style="font-size: 0.76rem; color: var(--text-muted); margin: 0 0 10px 0; line-height: 1.4;">
            DB IRIS liefert reine Fahrplandaten. Wagenreihungen ([W]) und Formationen werden modular über die gewählte Quelle bezogen.
        </p>

        <label class="field-label" style="display: block; margin-bottom: 4px;">
            Quelle für Wagenreihungen (IRIS-Fahrten):
        </label>
        <select class="form-select" bind:value={liveDataConfig.formationSource}>
            <option value="db_navigator">DB Navigator (Wagenreihung-Indikator, exakte Gleisposition)</option>
            <option value="dbweb">bahn.de Web API (Zwischenhalte, RIS-Gründe)</option>
        </select>

        <div class="checkbox-group" style="margin: 10px 0;">
            <label class="checkbox-label">
                <input type="checkbox" bind:checked={liveDataConfig.autoFetchActiveFormations}>
                <span>Wagenreihung für angezeigten Zug automatisch nachladen</span>
            </label>
        </div>
        <button
            type="button"
            class="btn-secondary"
            style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
            onclick={syncFormations}
            disabled={isSyncingFormations}
        >
            <ZimIcon name="train_fast" size={14} />
            <span>{isSyncingFormations ? `Gleiche mit ${formationSourceLabel} ab...` : 'Wagenreihungen ermitteln ([W])'}</span>
        </button>
        {#if formationSyncResult}
            <div class="sync-result-msg" class:is-success={formationSyncResult.success} style="margin-top: 8px; font-size: 0.8rem;">
                {formationSyncResult.message}
            </div>
        {/if}
    </div>
</div>

<style>
    .field-label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
        margin-bottom: 6px;
    }

    .provider-pill {
        font-size: 0.7rem;
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        border: 1px solid rgba(96, 165, 250, 0.25);
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 500;
    }

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

    .sync-result-msg {
        color: #f87171;
        padding: 6px 10px;
        border-radius: 4px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .sync-result-msg.is-success {
        color: #4ade80;
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(74, 222, 128, 0.2);
    }
</style>
