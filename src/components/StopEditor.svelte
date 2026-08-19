<script>
    import { trainDisplay } from '../js/main.js';
    import { dndzone } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { Stop } from '../js/models/stop.svelte.js';
    import StationPicker from './StationPicker.svelte';

    let { journey } = $props();

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

    function toggleVia(stop) {
        stop.showAsVia = !stop.showAsVia;
        triggerUpdate();
    }

    function onStopStationSelect(stop, station) {
        stop.name = station.name;
        stop.nameKurz = station.nameKurz;
        stop.extId = station.ibnr || station.eva;
        stop.stationCategory = station.kategorie || 99;
        triggerUpdate();
    }
</script>

{#if !journey.stops || journey.stops.length === 0}
    <div class="stops-empty" style="color: #ccc;">Keine Halte vorhanden.</div>
{:else}
    <div class="stops-editor-list" style="border: 1px solid var(--border); border-radius: 5px; background: transparent; padding: 5px;">
        <div use:dndzone={{items: journey.stops, flipDurationMs}}
             onconsider={handleDndConsider}
             onfinalize={handleDndFinalize}>
            {#each journey.stops as stop, i (stop.id)}
                <div animate:flip={{duration: flipDurationMs}} class="stop-editor-row" style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border); {stop.cancelled ? 'opacity: 0.5; text-decoration: line-through;' : ''} {i === journey._currentStopIndex ? 'border-left: 3px solid #ff6b6b;' : ''}">
                    <span class="stop-drag-handle" title="Drag & Drop" style="cursor: move;">⠿</span>
                    
                    <button class="btn-icon" title={stop.showAsVia ? 'Als Via markiert' : 'Nicht als Via markiert'} onclick={() => toggleVia(stop)}>
                        {stop.showAsVia ? '👁️' : '○'}
                    </button>
                    
                    <div style="flex: 2; min-width: 150px; position: relative;">
                        <StationPicker 
                            bind:value={stop.name} 
                            placeholder="Name"
                            cssClass="s-prop short-input" 
                            onSelect={(station) => onStopStationSelect(stop, station)} 
                        />
                    </div>
                    
                    <input type="text" class="s-prop short-input" bind:value={stop.nameKurz} oninput={triggerUpdate} placeholder="Kurz" title="Kurzname (Via)" style="flex: 1;">
                    <input type="text" class="s-prop short-input" bind:value={stop.arrivalTime} oninput={triggerUpdate} placeholder="An" title="Ankunft" style="width: 50px;">
                    <input type="text" class="s-prop short-input" bind:value={stop.departureTime} oninput={triggerUpdate} placeholder="Ab" title="Abfahrt" style="width: 50px;">
                    <input type="text" class="s-prop short-input" bind:value={stop.platform} oninput={triggerUpdate} placeholder="Gl." title="Gleis" style="width: 40px;">
                    <input type="number" class="s-prop short-input" bind:value={stop.stationCategory} oninput={triggerUpdate} placeholder="Kat" title="Bahnhofskategorie" style="width: 40px;">
                    
                    <select class="s-prop short-input" bind:value={stop.boardingType} onchange={triggerUpdate} title="Ein-/Ausstieg">
                        <option value={null}>—</option>
                        <option value="ein">Nur Ein</option>
                        <option value="aus">Nur Aus</option>
                    </select>
                    
                    <label title="Ausfall">
                        <input type="checkbox" class="s-prop" bind:checked={stop.cancelled} onchange={triggerUpdate}> ⛔
                    </label>
                    
                    <button class="btn-icon" title="Halt entfernen" onclick={() => removeStop(stop)}>✕</button>
                </div>
            {/each}
        </div>
    </div>
{/if}
