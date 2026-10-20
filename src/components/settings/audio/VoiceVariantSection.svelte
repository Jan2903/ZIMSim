<!-- src/components/settings/audio/VoiceVariantSection.svelte -->
<script>
    /**
     * @typedef {Object} VoiceVariantRow
     * @property {string} label - Beschriftung der Zeile
     * @property {number} value - Aktuell gewählte Variante (1 = kurz, 2 = lang)
     * @property {(value: number) => void} onChange - Callback bei Änderung der Variante
     */

    /**
     * @typedef {Object} VoiceVariantSectionProps
     * @property {VoiceVariantRow[]} rows - Die anzuzeigenden Varianten-Zeilen
     */

    /** @type {VoiceVariantSectionProps} */
    let { rows } = $props();
</script>

{#snippet variantRow(row)}
    <div class="variant-row">
        <span class="variant-label">{row.label}</span>
        <div class="segment-switch-sm">
            <label>
                <input type="radio" name={row.label} checked={row.value === 1} onchange={() => row.onChange(1)}>
                <span>Kurz</span>
            </label>
            <label>
                <input type="radio" name={row.label} checked={row.value === 2} onchange={() => row.onChange(2)}>
                <span>Lang</span>
            </label>
        </div>
    </div>
{/snippet}

<div class="variant-grid">
    {#each rows as row (row.label)}
        {@render variantRow(row)}
    {/each}
</div>

<style>
    .variant-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .variant-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
    }

    .variant-label {
        min-width: 0;
        font-size: 0.82rem;
        color: var(--text-muted, #94a3b8);
    }

    .segment-switch-sm {
        display: inline-flex;
        flex-shrink: 0;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 4px;
        padding: 2px;
    }

    .segment-switch-sm label {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        cursor: pointer;
        padding: 3px 10px;
        font-size: 0.75rem;
        border-radius: 3px;
        color: var(--text-muted, #94a3b8);
        transition: all 0.15s ease;
    }

    .segment-switch-sm input {
        display: none;
    }

    .segment-switch-sm label:has(input:checked) {
        background: var(--accent, #3b82f6);
        color: #fff;
        font-weight: 600;
    }

    /* Tablet: Varianten-Zeilen sauber umbrechen */
    @media (max-width: 900px) {
        .variant-row {
            flex-wrap: wrap;
        }
    }

    @media (max-width: 768px) {
        .variant-row {
            gap: 8px;
        }

        .variant-label {
            flex: 1 1 100%;
        }

        .segment-switch-sm {
            width: 100%;
        }

        .segment-switch-sm label {
            flex: 1;
            min-height: 36px;
        }
    }
</style>
