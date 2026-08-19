<script>
    import { trainDisplay } from '../js/main.js';
    import { RisTextService } from '../js/utils/risTextService.js';
    import { dndzone } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';

    let { journey } = $props();
    
    let selectedPreset = $state('');
    let qPresets = $state([]);

    // We only load presets on mount or when module evaluates
    $effect(() => {
        qPresets = RisTextService.getPresetsByType('Q');
    });

    const flipDurationMs = 200;

    function handleDndConsider(e) {
        journey.infoTexts = e.detail.items;
    }

    function handleDndFinalize(e) {
        journey.infoTexts = e.detail.items;
        trainDisplay.updateAll();
    }

    function triggerUpdate() {
        trainDisplay.updateAll();
    }

    function addManual() {
        journey.infoTexts.push({
            id: crypto.randomUUID(),
            text: '',
            visible: true,
            type: 'custom'
        });
        triggerUpdate();
    }

    function addPreset() {
        if (!selectedPreset) return;
        journey.infoTexts.push({
            id: crypto.randomUUID(),
            text: selectedPreset,
            visible: true,
            type: 'Q'
        });
        selectedPreset = '';
        triggerUpdate();
    }

    function removeText(info) {
        journey.infoTexts = journey.infoTexts.filter(t => t !== info);
        triggerUpdate();
    }

    function toggleVisible(info) {
        info.visible = !info.visible;
        triggerUpdate();
    }
</script>

<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
    <span style="font-size: 0.9em; color: var(--text-muted);">Lauftext / Info-Bausteine:</span>
    <button class="btn-secondary btn-sm" onclick={addManual}>+ Manuell</button>
</div>

<div class="info-editor-list" style="border: 1px solid var(--border); border-radius: 5px; background: transparent; padding: 5px; margin-bottom: 5px;">
    {#if !journey.infoTexts || journey.infoTexts.length === 0}
        <div class="info-empty" style="color: #ccc; margin-bottom: 5px;">Keine Lauftexte vorhanden.</div>
    {:else}
        <div use:dndzone={{items: journey.infoTexts, flipDurationMs}}
             onconsider={handleDndConsider}
             onfinalize={handleDndFinalize}>
            {#each journey.infoTexts as info (info.id)}
                <div animate:flip={{duration: flipDurationMs}} class="info-editor-row" style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border);">
                    <span class="drag-handle" style="cursor: move;">⠿</span>
                    <button class="btn-icon" title={info.visible ? 'Sichtbar im Lauftext' : 'Versteckt'} onclick={() => toggleVisible(info)}>
                        {info.visible ? '👁️' : '○'}
                    </button>
                    <input type="text" class="jfield info-text-input" bind:value={info.text} oninput={triggerUpdate} style="flex: 1; margin: 0;" placeholder="Text">
                    <button class="btn-icon" title="Entfernen" onclick={() => removeText(info)}>✕</button>
                </div>
            {/each}
        </div>
    {/if}

    <div style="display: flex; gap: 5px; margin-top: 10px;">
        <select class="jfield" style="flex: 1;" bind:value={selectedPreset}>
            <option value="">-- Preset wählen --</option>
            {#each qPresets as p}
                <option value={p.text}>{p.code}: {p.text}</option>
            {/each}
        </select>
        <button class="btn-secondary btn-sm" onclick={addPreset}>Hinzufügen</button>
    </div>
</div>
