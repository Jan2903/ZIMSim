<script>
    import { trainDisplay } from '../js/core/state/stores.js';
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { moveItemUp, moveItemDown } from '../js/core/utils/arrayUtils.js';
    import { RisTextService } from '../js/core/services/risTextService.js';
    import { dndzone } from 'svelte-dnd-action';
    import { safeFlip as flip } from '../js/core/utils/animationUtils.js';

    let { journey } = $props();
    
    let qPresets = $state([]);
    let inputText = $state('');
    let showDropdown = $state(false);
    let inputRef = $state();

    // We only load presets on mount or when module evaluates
    $effect(() => {
        qPresets = RisTextService.getPresetsByType('Q');
    });

    const flipDurationMs = 200;

    let filteredPresets = $derived.by(() => {
        const query = inputText.toLowerCase();
        if (!query) return qPresets;
        return qPresets.filter(p => 
            p.text.toLowerCase().includes(query) || 
            (p.code && p.code.toLowerCase().includes(query))
        );
    });

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

    function addText() {
        if (!inputText.trim()) return;
        journey.infoTexts.push({
            id: crypto.randomUUID(),
            text: inputText.trim(),
            visible: true,
            type: 'custom'
        });
        inputText = '';
        showDropdown = false;
        triggerUpdate();
    }

    function selectPreset(presetText) {
        inputText = presetText;
        addText();
    }

    function removeText(info) {
        journey.infoTexts = journey.infoTexts.filter(t => t !== info);
        triggerUpdate();
    }

    function toggleVisible(info) {
        info.visible = !info.visible;
        triggerUpdate();
    }
    
    function moveUp(info) {
        const idx = journey.infoTexts.indexOf(info);
        if (moveItemUp(journey.infoTexts, idx)) {
            triggerUpdate();
        }
    }

    function moveDown(info) {
        const idx = journey.infoTexts.indexOf(info);
        if (moveItemDown(journey.infoTexts, idx)) {
            triggerUpdate();
        }
    }
</script>

<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
    <span style="font-size: 0.9em; color: var(--text-muted);">Lauftext / Info-Bausteine:</span>
</div>

<div class="info-editor-list" style="border: 1px solid var(--border); border-radius: 5px; background: transparent; padding: 5px; margin-bottom: 5px;">
    {#if !journey.infoTexts || journey.infoTexts.length === 0}
        <div class="info-empty" style="color: #ccc; margin-bottom: 5px;">Keine Lauftexte vorhanden.</div>
    {:else}
        <div use:dndzone={{items: journey.infoTexts, flipDurationMs, type: 'infoText', dragDisabled: !uiState.enableDragAndDrop}}
             onconsider={handleDndConsider}
             onfinalize={handleDndFinalize}>
            {#each journey.infoTexts as info (info.id)}
                <div animate:flip={{duration: flipDurationMs}} class="info-editor-row" style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border);">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 24px;">
                        {#if uiState.enableDragAndDrop}
                            <span class="drag-handle" style="cursor: move; font-size: 14px; margin-bottom: 2px;">⠿</span>
                        {/if}
                        <button class="btn-icon" style="padding: 0; font-size: 0.7em;" onclick={() => moveUp(info)} title="Hoch">↑</button>
                        <button class="btn-icon" style="padding: 0; font-size: 0.7em;" onclick={() => moveDown(info)} title="Runter">↓</button>
                    </div>
                    <button class="btn-icon" title={info.visible ? 'Sichtbar im Lauftext' : 'Versteckt'} onclick={() => toggleVisible(info)}>
                        {info.visible ? '👁' : '○'}
                    </button>
                    <input type="text" class="jfield info-text-input" bind:value={info.text} oninput={triggerUpdate} style="flex: 1; margin: 0;" placeholder="Text">
                    <button class="btn-icon" title="Entfernen" onclick={() => removeText(info)}>✕</button>
                </div>
            {/each}
        </div>
    {/if}

    <div style="display: flex; gap: 5px; margin-top: 10px; position: relative;">
        <div style="position: relative; flex: 1; display: flex;">
            <input type="text" class="jfield" style="flex: 1; margin: 0; padding-right: 30px;"
                   placeholder="Suchen oder eigenen Text eingeben."
                   bind:this={inputRef}
                   bind:value={inputText}
                   onfocus={() => showDropdown = true}
                   onblur={() => setTimeout(() => showDropdown = false, 200)}
                   onkeydown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addText(); } }}>
            <button class="btn-icon" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); cursor: pointer; background: none; border: none; font-size: 12px; color: var(--text-muted);" 
                    onmousedown={(e) => { 
                        e.preventDefault(); 
                        if (showDropdown) { showDropdown = false; } 
                        else { showDropdown = true; inputRef?.focus(); }
                    }} tabindex="-1">
                ▼
            </button>
        </div>
        <button class="btn-secondary btn-sm" onclick={addText}>Hinzufügen</button>
        
        {#if showDropdown}
            <ul class="autocomplete-list active" style="position: absolute; top: 100%; left: 0; right: 80px; z-index: 1000; max-height: 200px; overflow-y: auto; background: var(--bg-panel); border: 1px solid var(--border-color); list-style: none; padding: 0; margin: 0; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                {#if filteredPresets.length === 0}
                    <li class="autocomplete-item" style="padding: 8px; color: #888;">Keine Presets gefunden. Drücke Enter für manuellen Text.</li>
                {:else}
                    {#each filteredPresets as p}
                        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                        <li class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color);" onmousedown={(e) => { e.preventDefault(); selectPreset(p.text); }}>
                            <strong style="color: var(--text-primary);">{p.code}</strong>: {p.text}
                        </li>
                    {/each}
                {/if}
            </ul>
        {/if}
    </div>
</div>
