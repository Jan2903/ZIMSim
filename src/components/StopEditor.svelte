<script>
    import { trainDisplay } from '../js/core/state/stores.js';
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { moveItemUp, moveItemDown } from '../js/core/utils/arrayUtils.js';
    import { dndzone } from 'svelte-dnd-action';
    import { safeFlip as flip } from '../js/core/utils/animationUtils.js';
    import { Stop } from '../js/features/station/stop.svelte.js';
    import StationPicker from './StationPicker.svelte';

    let { journey = $bindable() } = $props();

    const flipDurationMs = 200;

    function handleDndConsider(e) {
        journey.stops = e.detail.items;
    }

    function handleDndFinalize(e) {
        journey.stops = e.detail.items;
        trainDisplay.updateAll();
    }

    function triggerUpdate() {
        trainDisplay.updateAll();
    }

    function removeStop(stop) {
        journey.stops = journey.stops.filter(s => s !== stop);
        triggerUpdate();
    }
    
    function moveUp(stop) {
        const idx = journey.stops.indexOf(stop);
        if (moveItemUp(journey.stops, idx)) {
            triggerUpdate();
        }
    }

    function moveDown(stop) {
        const idx = journey.stops.indexOf(stop);
        if (moveItemDown(journey.stops, idx)) {
            triggerUpdate();
        }
    }

    function toggleVia(stop) {
        stop.showAsVia = !stop.showAsVia;
        triggerUpdate();
    }

    function toggleAudioVia(stop) {
        stop.audioVia = !stop.audioVia;
        triggerUpdate();
    }

    function onStopStationSelect(stop, station) {
        stop.name = station.name;
        stop.nameKurz = station.nameKurz;
        stop.extId = station.ibnr || station.eva;
        stop.stationCategory = station.kategorie || 7;
        triggerUpdate();
    }
</script>

{#if !journey.stops || journey.stops.length === 0}
    <div class="stops-empty" style="color: #ccc;">Keine Halte vorhanden.</div>
{:else}
    <div class="stops-editor-list" style="border: 1px solid var(--border); border-radius: 5px; background: transparent; padding: 5px;">
        <div use:dndzone={{items: journey.stops, flipDurationMs, type: 'stop', dragDisabled: !uiState.enableDragAndDrop}}
             onconsider={handleDndConsider}
             onfinalize={handleDndFinalize}>
            {#each journey.stops as stop, i (stop.id)}
                <div animate:flip={{duration: flipDurationMs}} class="stop-editor-item" style="display: flex; flex-direction: column; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border); {stop.cancelled ? 'opacity: 0.5; text-decoration: line-through;' : ''} {i === journey._currentStopIndex ? 'border-left: 3px solid #ff6b6b;' : ''}">
                    <div class="stop-editor-row-main" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 24px;">
                            {#if uiState.enableDragAndDrop}
                                <span class="stop-drag-handle" title="Drag & Drop" style="cursor: move; font-size: 14px; margin-bottom: 2px;">⠿</span>
                            {/if}
                            <button class="btn-icon" style="padding: 0; font-size: 0.7em;" onclick={() => moveUp(stop)} title="Hoch">↑</button>
                            <button class="btn-icon" style="padding: 0; font-size: 0.7em;" onclick={() => moveDown(stop)} title="Runter">↓</button>
                        </div>
                        
                        <button class="btn-icon" title={stop.showAsVia ? 'Als Anzeige-Via markiert' : 'Nicht als Anzeige-Via markiert'} onclick={() => toggleVia(stop)}>
                            {stop.showAsVia ? '👁' : '○'}
                        </button>

                        <button class="btn-icon" title={stop.audioVia ? 'Als Audio-Via markiert' : 'Nicht als Audio-Via markiert'} onclick={() => toggleAudioVia(stop)}>
                            {stop.audioVia ? '🔊' : '🔈'}
                        </button>
                        
                        <div style="flex: 2; min-width: 120px; position: relative;">
                            <StationPicker 
                                bind:value={stop.name} 
                                placeholder="Name"
                                cssClass="s-prop short-input" 
                                onSelect={(station) => onStopStationSelect(stop, station)} 
                            />
                        </div>
                        
                        <input type="text" class="s-prop short-input" bind:value={stop.nameKurz} oninput={triggerUpdate} placeholder="Kurz" title="Kurzname (Via)" style="flex: 1; min-width: 80px;">
                        
                        <input type="number" class="s-prop short-input" bind:value={stop.stationCategory} oninput={triggerUpdate} placeholder="Kat" title="Bahnhofskategorie" style="width: 50px;">
                        
                        <select class="s-prop short-input" bind:value={stop.boardingType} onchange={triggerUpdate} title="Ein-/Ausstieg" style="width: 70px;">
                            <option value={null}>—</option>
                            <option value="ein">Nur Ein</option>
                            <option value="aus">Nur Aus</option>
                        </select>
                        
                        <label title="Ausfall" style="display: flex; align-items: center; gap: 4px; cursor: pointer; margin-left: 4px;">
                            <input type="checkbox" class="s-prop" bind:checked={stop.cancelled} onchange={triggerUpdate}> ⛔
                        </label>
                        
                        <button class="btn-icon" title="Halt entfernen" onclick={() => removeStop(stop)}>✕</button>
                    </div>
                </div>
            {/each}
        </div>
    </div>
{/if}
