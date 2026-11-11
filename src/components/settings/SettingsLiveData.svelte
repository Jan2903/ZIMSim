<!-- src/components/settings/SettingsLiveData.svelte -->
<script>
    import { liveDataConfig } from '../../js/core/state/liveDataConfig.svelte.js';
    import ZimIcon from '../ZimIcon.svelte';
    import DataSourceSelector from './livedata/DataSourceSelector.svelte';
    import IrisSection from './livedata/IrisSection.svelte';
    import FormationSection from './livedata/FormationSection.svelte';
    import ProviderSection from './livedata/ProviderSection.svelte';

    // Aktive Detailansicht: 'iris' | 'db_navigator' | 'dbweb' (Migrationsfallback auf 'iris')
    let selectedDataSource = $state(
        ['iris', 'db_navigator', 'dbweb'].includes(liveDataConfig.profile) ? liveDataConfig.profile : 'iris'
    );
</script>

<div class="settings-tab-grid">
    <!-- Spalte 1: Datenquellen-Auswahl, Plattform-Status & Python-Bridge -->
    <DataSourceSelector bind:selectedDataSource />

    <!-- Spalte 2: IRIS-Basis (immer), Formationsblock (immer) und Provider-Details -->
    <div class="settings-stack">
        <div class="settings-card">
            <div class="card-header">
                <ZimIcon name="settings" size={18} />
                <h3>Live-Daten Basis (DB IRIS)</h3>
            </div>
            <div class="card-body">
                <IrisSection />
                <FormationSection />
            </div>
        </div>

        {#if selectedDataSource === 'db_navigator' || selectedDataSource === 'dbweb'}
            <div class="settings-card">
                <div class="card-header">
                    <ZimIcon name="settings" size={18} />
                    <h3>
                        {#if selectedDataSource === 'db_navigator'}
                            DB Navigator Optionen (Fahrplan & Wagenreihung)
                        {:else}
                            DBweb Optionen (bahn.de Web API)
                        {/if}
                    </h3>
                </div>
                <div class="card-body">
                    <ProviderSection providerId={selectedDataSource} />
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .settings-tab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        align-items: start;
    }

    .settings-stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
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
