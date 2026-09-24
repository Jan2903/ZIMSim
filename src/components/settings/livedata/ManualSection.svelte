<!-- src/components/settings/livedata/ManualSection.svelte -->
<script>
    import ZimIcon from '../../ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {object} [modalsComp] - Referenz auf die Modals-Komponente für den DB-Import
     */
    let { modalsComp = null } = $props();
</script>

<div class="form-row column-layout">
    <p class="manual-hint-text">
        Im manuellen Modus werden keine Netzwerkanfragen gesendet. Sie können JSON-Rohdaten importieren oder Fahrten im Reiter „Fahrten“ bearbeiten.
    </p>
    <button 
        type="button" 
        class="btn-secondary import-btn"
        onclick={() => modalsComp?.openDbImport()}
    >
        <ZimIcon name="train_fast" size={16} />
        <span>DB-Rohdaten importieren (JSON)</span>
    </button>
</div>

<style>
    .manual-hint-text {
        font-size: 0.85rem;
        color: var(--text-muted, #94a3b8);
        margin-top: 0;
        line-height: 1.45;
    }

    .import-btn {
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 8px;
    }
</style>
