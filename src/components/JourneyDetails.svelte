<script>
    import { journeyStore, trainDisplay } from '../js/main.js';
    import { uiState } from '../js/models/uiState.svelte.js';
    import InfoTextEditor from './InfoTextEditor.svelte';
    import StopEditor from './StopEditor.svelte';

    let { journey } = $props();

    function triggerUpdate() {
        trainDisplay.updateAll();
    }

    function toggleCoupling() {
        if (journey.couplingGroupId) {
            journeyStore.uncoupleJourney(journey.id);
        } else {
            console.log("Koppeln clicked for", journey.id);
        }
        triggerUpdate();
    }
    
    function deleteJourney() {
        journeyStore.removeJourney(journey.id);
        trainDisplay.updateAll();
    }

    function toggleAllStops() {
        if (!journey.stops) return;
        const anyOn = journey.stops.some(s => s.showAsVia && !s.cancelled && s.boardingType !== 'ein');
        journey.stops.forEach(s => {
            if (!s.cancelled && s.boardingType !== 'ein') {
                s.showAsVia = !anyOn;
            }
        });
        triggerUpdate();
    }

    function autoGenVias() {
        journey.autoGenerateVias();
        triggerUpdate();
    }

    function addStop() {
        import('../js/models/stop.js').then(module => {
            journey.stops.push(new module.Stop({ id: crypto.randomUUID(), name: '' }));
            triggerUpdate();
        });
    }
</script>

<div class="journey-details">
    <div class="details-grid">
        <div class="detail-section">
            <h4>Stammdaten</h4>
            <div class="detail-row">
                <label>Name: <input type="text" class="jfield" bind:value={journey.name} oninput={triggerUpdate} style="width: 150px;" placeholder="z.B. RE 70 / 95835"></label>
                <label style="margin-left: 15px;">Anzeigename (Override): <input type="text" class="jfield" bind:value={journey.displayNameOverride} oninput={triggerUpdate} placeholder={journey.name || 'auto'}></label>
            </div>
            <div class="detail-row">
                <label>Ziel: <input type="text" class="jfield" bind:value={journey.destination} oninput={triggerUpdate}></label>
            </div>
            <div class="detail-row">
                <label>Abfahrt/Ankunft: <input type="text" class="jfield short-input" bind:value={journey.scheduledTime} oninput={triggerUpdate}></label>
                <label>Echtzeit: <input type="text" class="jfield short-input" bind:value={journey.expectedTime} oninput={triggerUpdate}></label>
                <label>Gleis (Plan): <input type="text" class="jfield short-input" bind:value={journey.platform} oninput={triggerUpdate}></label>
                <label>Echtzeit-Gleis: <input type="text" class="jfield short-input" bind:value={journey.ezGleis} oninput={triggerUpdate}></label>
            </div>
            {#if !journey.ankunft}
            <div class="detail-row">
                <label>Verknüpfte Ankunft (Fahrzeugtausch/Wende): 
                    <select class="jfield" bind:value={journey.linkedArrivalJourneyId} onchange={triggerUpdate} style="max-width: 300px;">
                        <option value={null}>-- Keine Verknüpfung --</option>
                        {#each journeyStore.journeys.filter(j => j.ankunft) as a}
                            <option value={a.id}>{a.effectiveDisplayName} ({a.scheduledTime}) - Gl. {a.ezGleis || a.platform}</option>
                        {/each}
                    </select>
                </label>
            </div>
            {/if}
        </div>
        
        <div class="detail-section">
            <h4>Anzeige</h4>
            <div class="detail-row">
                <div style="width: 100%;">
                    <InfoTextEditor {journey} />
                </div>
            </div>
            <div class="detail-row">
                <label class="radio-group">Richtung:
                    <span><input type="radio" bind:group={journey.direction} value={0} onchange={triggerUpdate}> Links</span>
                    <span><input type="radio" bind:group={journey.direction} value={1} onchange={triggerUpdate}> Rechts</span>
                </label>
                <label>Startmeter: <input type="number" class="jfield short-input" bind:value={journey.startMeter} oninput={triggerUpdate}></label>
            </div>
            <div class="detail-row">
                <label class="checkbox-label"><input type="checkbox" bind:checked={journey.ankunft} onchange={triggerUpdate}> Ankunft</label>
                <label class="checkbox-label"><input type="checkbox" bind:checked={journey.skalieren} onchange={triggerUpdate}> Skalieren</label>
                <label>Faktor: <input type="number" step="0.01" class="jfield short-input" bind:value={journey.scaleFactor} oninput={triggerUpdate}></label>
                <label class="checkbox-label"><input type="checkbox" bind:checked={journey.ausfall} onchange={triggerUpdate}> Ausfall</label>
                <label class="checkbox-label"><input type="checkbox" bind:checked={journey.infoscreen} onchange={triggerUpdate}> Infoscreen</label>
            </div>
            <div class="detail-row">
                <label>Verkehrt ab: <input type="text" class="jfield short-input" bind:value={journey.verkehrtAb} oninput={triggerUpdate}></label>
                <label style="margin-left: 10px;">Verspätungsgrund: 
                    <input type="text" class="jfield" bind:value={journey.delayReason} oninput={triggerUpdate}>
                </label>
            </div>
        </div>
    </div>
    
    <div class="detail-section" style="margin-top: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4>Wagenreihung</h4>
            <div style="display: flex; gap: 10px;">
                <button class="btn-secondary">📥 Import</button>
                <button class="btn-secondary">📤 Export</button>
                <button class="btn-secondary" title="Dreht die Reihenfolge aller Gruppen und Wagen um">🔁 Komplett drehen</button>
                <button class="btn-secondary">+ Neue Gruppe</button>
            </div>
        </div>
        <!-- FormationEditor placeholder -->
        <div style="color: #888; font-style: italic; padding: 10px; border: 1px dashed #555;">Wagenreihungs-Editor (coming soon)</div>
    </div>

    <div class="details-actions" style="margin-top: 20px;">
        <button class="btn-secondary" onclick={toggleCoupling}>{journey.couplingGroupId ? '🔗 Entkoppeln' : '🔗 Koppeln'}</button>
        <button class="btn-danger" onclick={deleteJourney}>🗑️ Löschen</button>
    </div>
    
    <div class="detail-section" style="margin-top: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4>Zuglauf (Halte)</h4>
            <div style="display: flex; gap: 10px;">
                <button class="btn-secondary" onclick={toggleAllStops}>👁️ Alle umschalten</button>
                <button class="btn-secondary" onclick={autoGenVias}>⚡ Auto-Vias</button>
                <button class="btn-secondary" onclick={addStop}>+ Halt hinzufügen</button>
            </div>
        </div>
        <StopEditor {journey} />
    </div>
</div>
