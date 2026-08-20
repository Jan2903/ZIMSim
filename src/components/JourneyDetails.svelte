<script>
    import { journeyStore, trainDisplay } from '../js/main.js';
    import { uiState } from '../js/models/uiState.svelte.js';
    import InfoTextEditor from './InfoTextEditor.svelte';
    import StopEditor from './StopEditor.svelte';
    import StationPicker from './StationPicker.svelte';
    import { portalDropdown } from '../js/utils/portal.js';
    import { RisTextService } from '../js/utils/risTextService.js';

    let { journey = $bindable() } = $props();
    
    // Autocomplete State für Verknüpfung
    let linkSearchText = $state('');
    let showLinkDropdown = $state(false);
    let linkWrapperRef = $state();

    // Autocomplete State für Verspätungsgrund
    let showReasonDropdown = $state(false);
    let reasonWrapperRef = $state();

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

    // Filter-Logik für Autocomplete Verknüpfung
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

    // Filter-Logik für Autocomplete Verspätungsgrund
    let delayReasonPresets = $derived.by(() => {
        const all = RisTextService.getPresetsByType('R');
        const query = (journey.delayReason || '').toLowerCase();
        if (!query) return all;
        return all.filter(p => 
            p.text.toLowerCase().includes(query) || 
            p.code.toLowerCase().includes(query)
        );
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

    function setDelayReason(text) {
        journey.delayReason = text;
        showReasonDropdown = false;
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
        <!-- LINKE SPALTE: STAMMDATEN -->
        <div class="detail-section">
            <h4 style="margin-bottom: 15px; border-bottom: 1px solid var(--border-color, #444); padding-bottom: 5px;">Stammdaten</h4>
            
            <!-- Name -->
            <div class="detail-row" style="display: flex; gap: 15px; align-items: flex-start; margin-bottom: 15px;">
                <div style="display: flex; flex-direction: column; width: 200px;">
                    <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Name</label>
                    <input type="text" class="jfield" bind:value={journey.name} oninput={triggerUpdate} style="width: 100%;" placeholder="z.B. RE 70 / 95835">
                </div>
                <div style="display: flex; flex-direction: column; flex-grow: 1;">
                    <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Zusatz / Überschreiben</label>
                    <input type="text" class="jfield" bind:value={journey.displayNameOverride} oninput={triggerUpdate} placeholder={journey.name || 'auto'} style="width: 100%;">
                </div>
            </div>
            
            <!-- Ziel / Herkunft -->
            <div class="detail-row" style="display: flex; gap: 15px; align-items: flex-start; margin-bottom: 15px;">
                <div style="display: flex; flex-direction: column; width: 200px;">
                    <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Ziel / Herkunft</label>
                    <StationPicker bind:value={journey.destination} placeholder="Station suchen" onSelect={onDestinationSelect} />
                </div>
                <div style="display: flex; flex-direction: column; flex-grow: 1;">
                    <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Zusatz / Überschreiben</label>
                    <input type="text" class="jfield" bind:value={journey.destinationOverride} oninput={triggerUpdate} placeholder={journey.destination || 'Auto'} style="width: 100%;">
                </div>
            </div>
            
            <!-- Zeit & Gleis in einer Box zusammengefasst -->
            <div class="detail-row" style="display: flex; gap: 20px; align-items: stretch; margin-bottom: 20px; background: rgba(0,0,0,0.1); padding: 12px 15px; border-radius: 6px;">
                <!-- Zeit Block -->
                <div style="display: flex; gap: 10px; flex-grow: 1;">
                    <div style="display: flex; flex-direction: column; flex: 1;">
                        <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Zeit (Plan)</label>
                        <input type="text" class="jfield" bind:value={journey.scheduledTime} oninput={triggerUpdate} placeholder="z.B. 14:30" style="width: 100%; text-align: center;">
                    </div>
                    <div style="display: flex; flex-direction: column; flex: 1;">
                        <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Echtzeit</label>
                        <input type="text" class="jfield" bind:value={journey.expectedTime} oninput={triggerUpdate} placeholder="optional" style="width: 100%; text-align: center; color: var(--error-color, #ff6b6b); font-weight: bold;">
                    </div>
                </div>
                
                <div style="width: 1px; background: var(--border-color, #444); margin: 5px 0;"></div>
                
                <!-- Gleis Block -->
                <div style="display: flex; gap: 10px; flex-grow: 1;">
                    <div style="display: flex; flex-direction: column; flex: 1;">
                        <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Gleis/Plattform</label>
                        <input type="text" class="jfield" bind:value={journey.platform} oninput={triggerUpdate} placeholder="z.B. 4" style="width: 100%; text-align: center;">
                    </div>
                    <div style="display: flex; flex-direction: column; flex: 1;">
                        <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Echtzeit</label>
                        <input type="text" class="jfield" bind:value={journey.ezGleis} oninput={triggerUpdate} placeholder="optional" style="width: 100%; text-align: center; color: var(--error-color, #ff6b6b); font-weight: bold;">
                    </div>
                </div>
            </div>
            
            <!-- Verknüpfte Fahrt -->
            <div class="detail-row" style="display: flex; flex-direction: column; margin-bottom: 15px;">
                <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block; text-align: left;">Verknüpfte Fahrt (Fahrzeugtausch/Wende)</label>
                <div bind:this={linkWrapperRef} style="position: relative; width: 100%;">
                    <input type="text" class="jfield" style="width: 100%; margin: 0;"
                           placeholder="Fahrt suchen (Name, Ziel, Zeit)..."
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
            </div>
            
            <!-- Verspätungsgrund -->
            <div class="detail-row" style="display: flex; flex-direction: column; margin-bottom: 15px;">
                <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block; text-align: left;">Verspätungsgrund</label>
                <div bind:this={reasonWrapperRef} style="position: relative; width: 100%;">
                    <input type="text" class="jfield" style="width: 100%; margin: 0;"
                           placeholder="Suchen oder eigenen Text eingeben"
                           bind:value={journey.delayReason}
                           oninput={triggerUpdate}
                           onfocus={() => showReasonDropdown = true}
                           onblur={() => setTimeout(() => showReasonDropdown = false, 200)}>
                           
                    {#if showReasonDropdown && delayReasonPresets.length > 0}
                        <ul use:portalDropdown={reasonWrapperRef} class="autocomplete-list active" style="max-height: 200px; overflow-y: auto; background-color: var(--bg-panel, #2b2b2b); border: 1px solid var(--border-color, #444); list-style: none; padding: 0; margin: 0; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <li class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color, #444);" onclick={() => setDelayReason('')}>-- Kein Grund --</li>
                            {#each delayReasonPresets as preset}
                                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <li class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color, #444);" onclick={() => setDelayReason(preset.text)}>
                                    {preset.code} - {preset.text}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            </div>
        </div>
        
        <!-- RECHTE SPALTE: ANZEIGE -->
        <div class="detail-section">
            <h4 style="margin-bottom: 15px; border-bottom: 1px solid var(--border-color, #444); padding-bottom: 5px;">Anzeige</h4>
            
            <!-- Row 1: Status & Modus (Ankunft/Abfahrt, Ausfall, Infoscreen) -->
            <div class="detail-row" style="display: flex; gap: 20px; align-items: stretch; margin-bottom: 20px; background: rgba(0,0,0,0.1); padding: 12px 15px; border-radius: 6px;">
                <!-- Ankunft/Abfahrt Toggle -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; width: 80px;" onclick={() => { journey.ankunft = !journey.ankunft; triggerUpdate(); }}>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-bottom: 8px;">Modus</div>
                    <div style="width: 44px; height: 22px; background: var(--bg-panel, #1a1a1a); border-radius: 11px; position: relative; border: 2px solid var(--border-color, #555); box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
                        <div style="width: 16px; height: 16px; background: {journey.ankunft ? '#ff6b6b' : '#4dabf7'}; border-radius: 50%; position: absolute; top: 1px; transition: 0.2s; {journey.ankunft ? 'right: 1px;' : 'left: 1px;'} box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>
                    </div>
                    <div style="font-size: 0.85em; margin-top: 8px; font-weight: bold; color: {journey.ankunft ? '#ff6b6b' : '#4dabf7'};">{journey.ankunft ? 'Ankunft' : 'Abfahrt'}</div>
                </div>
                
                <div style="width: 1px; background: var(--border-color, #444); margin: 5px 0;"></div>
                
                <!-- Ausfall & Infoscreen -->
                <div style="display: flex; flex-direction: column; justify-content: center; gap: 12px; flex-grow: 1;">
                    <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                        <input type="checkbox" bind:checked={journey.ausfall} onchange={triggerUpdate} style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1.05em; {journey.ausfall ? 'color: #ff6b6b; font-weight: bold;' : ''}">Zugausfall</span>
                    </label>
                    
                    <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                        <input type="checkbox" bind:checked={journey.infoscreen} onchange={triggerUpdate} style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1.05em;">Infoscreen (Lauftext/ Sonderanzeige)</span>
                    </label>
                </div>
            </div>
            
            <!-- Row 2: InfoTexte -->
            <div class="detail-row" style="margin-bottom: 20px;">
                <div style="width: 100%;">
                    <InfoTextEditor {journey} />
                </div>
            </div>
            
            <!-- Row 3: Verkehrt heute ab -->
            <div class="detail-row" style="display: flex; flex-direction: column; margin-bottom: 20px;">
                <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block; text-align: left;">Verkehrt heute ab (Station)</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="flex-grow: 1;">
                        <StationPicker 
                            value={journey.verkehrtAb === '0' ? '' : journey.verkehrtAb} 
                            onInput={(val) => { journey.verkehrtAb = val === '' ? '0' : val; triggerUpdate(); }}
                            onSelect={(st) => { journey.verkehrtAb = st.name; triggerUpdate(); }}
                            placeholder="Station suchen" 
                        />
                    </div>
                    {#if journey.verkehrtAb && journey.verkehrtAb !== '0'}
                        <button class="btn-icon" onclick={() => { journey.verkehrtAb = '0'; triggerUpdate(); }} title="Zurücksetzen (Deaktivieren)" style="width: 32px; height: 32px; border-radius: 4px; background: rgba(255, 107, 107, 0.1); color: #ff6b6b; border: 1px solid rgba(255, 107, 107, 0.3);">✕</button>
                    {/if}
                </div>
            </div>

            <!-- Row 4: Wagenreihung Display Settings -->
            <div class="detail-row" style="display: flex; gap: 20px; align-items: stretch; background: rgba(0,0,0,0.1); padding: 12px 15px; border-radius: 6px;">
                <!-- Richtung Toggle -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; width: 80px;" onclick={() => { journey.direction = journey.direction === 1 ? 0 : 1; triggerUpdate(); }}>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-bottom: 8px;">Fahrtrichtung</div>
                    <div style="width: 44px; height: 22px; background: var(--bg-panel, #1a1a1a); border-radius: 11px; position: relative; border: 2px solid var(--border-color, #555); box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
                        <div style="width: 16px; height: 16px; background: #4dabf7; border-radius: 50%; position: absolute; top: 1px; transition: 0.2s; {journey.direction === 1 ? 'right: 1px;' : 'left: 1px;'} box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>
                    </div>
                    <div style="font-size: 0.85em; margin-top: 8px; font-weight: bold;">{journey.direction === 1 ? 'Rechts' : 'Links'}</div>
                </div>

                <div style="width: 1px; background: var(--border-color, #444); margin: 5px 0;"></div>

                <!-- Startmeter -->
                <div style="display: flex; flex-direction: column; justify-content: center; width: 80px;">
                    <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block; text-align: center;">Startmeter</label>
                    <input type="number" class="jfield" bind:value={journey.startMeter} oninput={triggerUpdate} style="width: 100%; min-width: 0; text-align: center;" placeholder="z.B. 50">
                </div>

                <div style="width: 1px; background: var(--border-color, #444); margin: 5px 0;"></div>

                <!-- Skalierung -->
                <div style="display: flex; flex-direction: column; justify-content: center; flex-grow: 1;">
                    <label style="font-size: 0.85em; opacity: 0.8; margin-bottom: 6px; display: block;">Skalierung (Zoom)</label>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0;">
                            <input type="checkbox" bind:checked={journey.skalieren} onchange={triggerUpdate} style="width: 16px; height: 16px;">
                            <span>Aktiv</span>
                        </label>
                        {#if journey.skalieren}
                            <input type="number" step="0.01" class="jfield" bind:value={journey.scaleFactor} oninput={triggerUpdate} style="width: 70px; min-width: 0; text-align: center;" placeholder="Faktor (1.0)">
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="detail-section" style="margin-top: 25px;">
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
        <StopEditor bind:journey />
    </div>
</div>
