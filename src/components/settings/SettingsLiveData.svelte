<!-- src/components/settings/SettingsLiveData.svelte -->
<script>
    import { liveDataConfig } from '../../js/core/state/liveDataConfig.svelte.js';
    import ZimIcon from '../ZimIcon.svelte';
    import DataSourceSelector from './livedata/DataSourceSelector.svelte';
    import IrisSection from './livedata/IrisSection.svelte';
    import DbNavSection from './livedata/DbNavSection.svelte';
    import DbWebSection from './livedata/DbWebSection.svelte';

    /**
     * @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente für den DB-Import
     */
    let { modalsComp = null } = $props();

    // Aktive Datenquelle: 'iris' | 'db_navigator' | 'dbweb'
    let selectedDataSource = $state(liveDataConfig.timetableSource || 'iris');

    $effect(() => {
        liveDataConfig.timetableSource = selectedDataSource;
    });
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Datenquellen-Auswahl, Plattform-Status & Python-Bridge -->
    <DataSourceSelector bind:selectedDataSource />

    <!-- Spalte 2: Konfiguration der gewählten Datenquelle -->
    <div class="settings-card">
        <div class="card-header">
            <ZimIcon name="settings" size={18} />
            <h3>
                {#if selectedDataSource === 'iris'}
                    DB IRIS Einstellungen (Fahrplan & Echtzeit)
                {:else if selectedDataSource === 'db_navigator'}
                    DB Navigator Optionen (Fahrplan & Wagenreihung)
                {:else if selectedDataSource === 'dbweb'}
                    DBweb Optionen (In Vorbereitung)
                {:else}
                    Live-Daten Konfiguration
                {/if}
            </h3>
        </div>
        <div class="card-body">
            {#if selectedDataSource === 'iris'}
                <IrisSection />
            {:else if selectedDataSource === 'db_navigator'}
                <DbNavSection />
            {:else if selectedDataSource === 'dbweb'}
                <DbWebSection />
            {/if}
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

    @media (max-width: 600px) {
        .settings-tab-grid {
            grid-template-columns: 1fr;
            gap: 12px;
        }
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
