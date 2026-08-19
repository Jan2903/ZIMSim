<script>
    import { journeyStore, trainDisplay } from '../js/main.js';
    import { uiState } from '../js/models/uiState.svelte.js';
    import InfoTextEditor from './InfoTextEditor.svelte';
    import StopEditor from './StopEditor.svelte';
    import StationPicker from './StationPicker.svelte';
    import { portalDropdown } from '../js/utils/portal.js';

    let { journey } = $props();
    
    // Autocomplete State
    let linkSearchText = $state('');
    let showLinkDropdown = $state(false);
    let linkWrapperRef = $state();

    // Initialen Text setzen
    $effect(() => {
        if (journey.linkedArrivalJourneyId) {
            const linked = journeyStore.getJourney(journey.linkedArrivalJourneyId);
            if (linked) {
                linkSearchText = `${linked.effectiveDisplayName} (${linked.scheduledTime})`;
            } else {
                linkSearchText = journey.linkedArrivalJourneyId;
            }
        } else {
            linkSearchText = '';
        }
    });

    // Filter-Logik für Autocomplete
    let filteredJourneys = $derived.by(() => {
        const query = linkSearchText.toLowerCase();
        let list = journeyStore.journeys.filter(j => j.id !== journey.id);
        
        // Wenn ein Query existiert und nicht exakt dem ausgewählten Text entspricht
        if (query) {
            const selectedMatch = journey.linkedArrivalJourneyId ? journeyStore.getJourney(journey.linkedArrivalJourneyId) : null;
            const selectedString = selectedMatch ? `${selectedMatch.effectiveDisplayName} (${selectedMatch.scheduledTime})`.toLowerCase() : '';
            
            if (query !== selectedString) {
                list = list.filter(j => 
                    (j.effectiveDisplayName && j.effectiveDisplayName.toLowerCase().includes(query)) ||
                    (j.destination && j.destination.toLowerCase().includes(query)) ||
                    (j.scheduledTime && j.scheduledTime.includes(query))
                );
            }
        }
        return list;
    });

    function setLinkedJourney(targetJourney) {
        if (!targetJourney) {
            journey.linkedArrivalJourneyId = null;
            linkSearchText = '';
        } else {
            journey.linkedArrivalJourneyId = targetJourney.id;
            linkSearchText = `${targetJourney.effectiveDisplayName} (${targetJourney.scheduledTime})`;
        }
        showLinkDropdown = false;
        triggerUpdate();
    }

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
        import('../js/models/stop.svelte.js').then(module => {
            journey.stops.push(new module.Stop({ id: crypto.randomUUID(), name: '' }));
            triggerUpdate();
        });
    }

    function onDestinationSelect(station) {
        journey.destinationLang = station.name;
        journey.destinationKurz = station.nameKurz;
        triggerUpdate();
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
                <label>Ziel (Station): 
                    <div style="display: inline-block; width: 200px;">
                        <StationPicker bind:value={journey.destination} placeholder="Station suchen..." onSelect={onDestinationSelect} />
                    </div>
                </label>
                <label style="margin-left: 15px;">Anzeige (Override): 
                    <input type="text" class="jfield" bind:value={journey.destinationOverride} oninput={triggerUpdate} placeholder={journey.destination || 'Auto'}>
                </label>
            </div>
            <div class="detail-row">
                <label>Abfahrt/Ankunft: <input type="text" class="jfield short-input" bind:value={journey.scheduledTime} oninput={triggerUpdate}></label>
                <label style="margin-left: 15px;">Erwartet: <input type="text" class="jfield short-input" bind:value={journey.expectedTime} oninput={triggerUpdate} placeholder="optional"></label>
                <label style="margin-left: 15px;">Grund: <input type="text" class="jfield" bind:value={journey.delayReason} oninput={triggerUpdate} style="width: 100px;" placeholder="z.B. 10"></label>
            </div>
            <div class="detail-row">
                <label>Gleis: <input type="text" class="jfield short-input" bind:value={journey.platform} oninput={triggerUpdate}></label>
                <label style="margin-left: 15px;">Abschnitte: <input type="text" class="jfield short-input" bind:value={journey.sectors} oninput={triggerUpdate} placeholder="A-C"></label>
                <label style="margin-left: 15px;">Echtzeit-Gleis: <input type="text" class="jfield short-input" bind:value={journey.ezGleis} oninput={triggerUpdate}></label>
            </div>
            <div class="detail-row">
                <label>Verknüpfte Fahrt (Fahrzeugtausch/Wende):
                    <div bind:this={linkWrapperRef} style="position: relative; display: inline-block; width: 300px; margin-left: 10px;">
                        <input type="text" class="jfield" style="width: 100%; margin: 0;"
                               placeholder="Zug suchen (Name, Ziel, Zeit)..."
                               bind:value={linkSearchText}
                               onfocus={() => showLinkDropdown = true}
                               onblur={() => setTimeout(() => showLinkDropdown = false, 200)}>
                               
                        {#if showLinkDropdown}
                            <ul use:portalDropdown={linkWrapperRef} class="autocomplete-list active" style="max-height: 200px; overflow-y: auto; background-color: var(--bg-panel, #2b2b2b); border: 1px solid var(--border-color, #444); list-style: none; padding: 0; margin: 0; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <li class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color, #444);" onclick={() => setLinkedJourney(null)}>-- Keine Verknüpfung --</li>
                                {#each filteredJourneys as a}
                                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <li class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color, #444);" onclick={() => setLinkedJourney(a)}>
                                        {a.effectiveDisplayName} ({a.scheduledTime}) - Gl. {a.ezGleis || a.platform}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </label>
            </div>
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
