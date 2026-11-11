<!-- src/components/settings/livedata/FormationSection.svelte -->
<script>
    import { journeyStore } from '../../../js/core/state/stores.js';
    import { liveDataConfig } from '../../../js/core/state/liveDataConfig.svelte.js';
    import { irisConfig } from '../../../js/core/services/irisPollingService.svelte.js';
    import { toastStore } from '../../../js/core/state/toastStore.svelte.js';
    import { getNonCorsAvailability } from '../../../js/core/services/apiClient.js';
    import { JourneyLiveSyncService } from '../../../js/features/journey/services/journeyLiveSyncService.js';
    import ZimIcon from '../../ZimIcon.svelte';

    // Status der Wagenreihungs-Anreicherung
    let isSyncing = $state(false);
    let syncResult = $state(null);

    // Anzeigename der aktiven Wagenreihungs-Quelle
    const sourceLabel = $derived(
        liveDataConfig.formationSource === 'dbweb' ? 'bahn.de' : 'DB Navigator'
    );

    /**
     * Gleicht die geladenen Fahrten mit der aktiven Wagenreihungs-Quelle ab.
     * Ermittelt die Verfügbarkeit von Wagenreihungen und lädt bei aktivem
     * Auto-Schalter zusätzlich Formationen für sichtbare Züge nach.
     * @returns {Promise<void>}
     */
    async function syncFormations() {
        if (!journeyStore.stationContext.stationId) {
            toastStore.warning('Bitte zuerst eine Station auswählen!');
            return;
        }

        const avail = getNonCorsAvailability();
        if (avail.blocked) {
            syncResult = {
                success: false,
                message: `${sourceLabel} ${avail.reason}`
            };
            return;
        }

        const providerId = liveDataConfig.formationSource === 'dbweb' ? 'dbweb' : 'db_navigator';

        isSyncing = true;
        syncResult = null;
        try {
            const res = await JourneyLiveSyncService.enrichJourneys(providerId, {
                stationId: journeyStore.stationContext.stationId,
                lookbehindMinutes: irisConfig.lookbehindMinutes ?? 30,
                chunks: 2
            });

            let extraMsg = '';
            if (liveDataConfig.autoFetchFormations) {
                // Ohne verlässlichen Indikator (DBweb) reicht es, wenn noch keine Wagenreihung geladen wurde.
                const fetched = await JourneyLiveSyncService.autoFetchActiveFormations(2, {
                    requireIndicator: providerId !== 'dbweb'
                });
                if (fetched > 0) {
                    extraMsg = ` (${fetched} Wagenreihung(en) für Anzeige geladen)`;
                }
            }

            const suffix = providerId === 'dbweb'
                ? 'Metadaten & Wagenreihungen aktualisiert.'
                : '[W] Verfügbarkeit aktualisiert.';

            syncResult = {
                success: true,
                message: `${res.matchedCount} von ${res.totalDepartures} ${sourceLabel}-Fahrten abgeglichen, ${suffix}${extraMsg}`
            };
        } catch (e) {
            console.error('[FormationSection] Fehler beim Wagenreihungs-Abgleich:', e);
            syncResult = {
                success: false,
                message: `Fehler beim Abgleich mit ${sourceLabel}.`
            };
        } finally {
            isSyncing = false;
        }
    }
</script>

<div class="sub-section" style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <div class="field-label" style="margin-bottom: 0;">Wagenreihungs-Anreicherung:</div>
        <span class="provider-pill">via {sourceLabel}</span>
    </div>
    <p class="sub-desc" style="font-size: 0.76rem; color: var(--text-muted); margin: 0 0 10px 0; line-height: 1.4;">
        DB IRIS liefert reine Fahrplandaten. Wagenreihungen und Formationen werden modular über die gewählte Quelle bezogen.
    </p>

    <label class="field-label" for="formation-source" style="display: block; margin-bottom: 4px;">
        Quelle für Wagenreihungen (IRIS-Fahrten):
    </label>
    <select id="formation-source" class="form-select" bind:value={liveDataConfig.formationSource}>
        <option value="db_navigator">DB Navigator (Wagenreihung-Indikator, exakte Gleisposition)</option>
        <option value="dbweb">bahn.de Web API (Zwischenhalte, RIS-Gründe)</option>
    </select>

    <div class="checkbox-group" style="margin: 10px 0;">
        <label class="checkbox-label">
            <input type="checkbox" bind:checked={liveDataConfig.autoFetchFormations}>
            <span>Wagenreihungen nach dem Laden automatisch für sichtbare Züge abrufen</span>
        </label>
    </div>
    <button
        type="button"
        class="btn-secondary"
        style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
        onclick={syncFormations}
        disabled={isSyncing}
    >
        <ZimIcon name="train_fast" size={14} />
        <span>{isSyncing ? `Gleiche mit ${sourceLabel} ab...` : 'Wagenreihungen ermitteln'}</span>
    </button>
    {#if syncResult}
        <div class="sync-result-msg" class:is-success={syncResult.success} style="margin-top: 8px; font-size: 0.8rem;">
            {syncResult.message}
        </div>
    {/if}
</div>

<style>
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

    .form-select:focus {
        border-color: var(--accent, #3b82f6);
    }
</style>
