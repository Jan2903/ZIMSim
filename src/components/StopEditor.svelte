<script>
    import { trainDisplay } from '../js/stores.js';
    import { dndzone } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { Stop } from '../js/models/stop.svelte.js';
    import StationPicker from './StationPicker.svelte';

    let { journey = $bindable(), showStopDetails = false } = $props();

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
        <div use:dndzone={{items: journey.stops, flipDurationMs, type: 'stop'}}
             onconsider={handleDndConsider}
             onfinalize={handleDndFinalize}>
            {#each journey.stops as stop, i (stop.id)}
                <div animate:flip={{duration: flipDurationMs}} class="stop-editor-item" style="display: flex; flex-direction: column; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border); {stop.cancelled ? 'opacity: 0.5; text-decoration: line-through;' : ''} {i === journey._currentStopIndex ? 'border-left: 3px solid #ff6b6b;' : ''}">
                    <div class="stop-editor-row-main" style="display: flex; gap: 8px; align-items: center;">
                        <span class="stop-drag-handle" title="Drag & Drop" style="cursor: move;">⠿</span>
                        
                        <button class="btn-icon" title={stop.showAsVia ? 'Als Via markiert' : 'Nicht als Via markiert'} onclick={() => toggleVia(stop)}>
                            {stop.showAsVia ? '👁' : '○'}
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
                    
                    {#if showStopDetails}
                        <div class="stop-editor-row-details" style="display: flex; gap: 15px; align-items: center; padding-left: 54px; margin-top: 6px;">
                            <label style="display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 0.85em;">An: <input type="text" class="s-prop short-input" bind:value={stop.arrivalTime} oninput={triggerUpdate} placeholder="HH:MM" title="Ankunft" style="width: 60px;"></label>
                            <label style="display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 0.85em;">Ab: <input type="text" class="s-prop short-input" bind:value={stop.departureTime} oninput={triggerUpdate} placeholder="HH:MM" title="Abfahrt" style="width: 60px;"></label>
                            <label style="display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 0.85em;">Gl: <input type="text" class="s-prop short-input" bind:value={stop.platform} oninput={triggerUpdate} placeholder="z.B. 1" title="Gleis" style="width: 60px;"></label>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}
