<script>
    import { journeyStore, trainDisplay } from '../js/core/state/stores.js';
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import InfoTextEditor from './InfoTextEditor.svelte';
    import StopEditor from './StopEditor.svelte';
    import StationPicker from './StationPicker.svelte';
    import { portalDropdown } from '../js/core/utils/portal.js';
    import { RisTextService } from '../js/core/services/risTextService.js';
    import { ansagenGenerator } from '../js/audio/ansagenGenerator.js';
    import { ansagenPlayer } from '../js/audio/ansagenPlayer.svelte.js';

    let { journey = $bindable() } = $props();
    
    // Autocomplete State für Verknüpfung
    let linkSearchText = $state('');
    let showLinkDropdown = $state(false);
    let linkWrapperRef = $state();

    // Autocomplete State für Verspätungsgrund
    let showReasonDropdown = $state(false);
    let reasonWrapperRef = $state();
    
    // Initialen Text synchronisieren via Store-Methode
    $effect(() => {
        const linked = journeyStore.getLinkedJourney(journey.id);
        if (linked) {
            linkSearchText = `${linked.effectiveDisplayName} (${linked.scheduledTime})`;
        } else {
            linkSearchText = '';
        }
    });

    // Filter-Logik für Autocomplete Verknüpfung:
    // Nur komplementäre Typen! (Abfahrt sucht Ankünfte, Ankunft sucht Abfahrten)
    let filteredJourneys = $derived.by(() => {
        const query = linkSearchText.toLowerCase().trim();
        const targetIsArrival = !journey.ankunft;
        let list = journeyStore.journeys.filter(j => j.id !== journey.id && j.ankunft === targetIsArrival);
        
        const linkedPartner = journeyStore.getLinkedJourney(journey.id);
        const selectedString = linkedPartner ? `${linkedPartner.effectiveDisplayName} (${linkedPartner.scheduledTime})`.toLowerCase() : '';

        if (query && query !== selectedString) {
            list = list.filter(j => 
                (j.effectiveDisplayName && j.effectiveDisplayName.toLowerCase().includes(query)) ||
                (j.destination && j.destination.toLowerCase().includes(query)) ||
                (j.scheduledTime && j.scheduledTime.includes(query)) ||
                (j.platform && j.platform.toString().includes(query)) ||
                (j.ezGleis && j.ezGleis.toString().includes(query))
            );
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
            journeyStore.unlinkJourney(journey.id);
            linkSearchText = '';
        } else {
            journeyStore.linkJourneys(journey.id, targetJourney.id);
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
        if (!journey.ankunft) {
            journey.autoGenerateVias(4);
            journey.autoGenerateAudioVias(ansagenStore.maxVias, ansagenStore.viaSortMode);
        }
        triggerUpdate();
    }

    function addStop() {
        import('../js/features/station/stop.svelte.js').then(module => {
            journey.stops.push(new module.Stop({ id: crypto.randomUUID(), name: '' }));
            triggerUpdate();
        });
    }

    function onDestinationSelect(station) {
        journey.destinationLang = station.name;
        journey.destinationKurz = station.nameKurz;
        triggerUpdate();
    }

    function playAnsage(mode) {
        let playlist = [];
        if (mode === 'Einfahrt') playlist = ansagenGenerator.generateEinfahrt(journey);
        else if (mode === 'Steht') playlist = ansagenGenerator.generateSteht(journey);
        else if (mode === 'Information') playlist = ansagenGenerator.generateInformation(journey);
        else if (mode === 'Anschluesse') playlist = ansagenGenerator.generateAnschluesse(journey);
        
        ansagenPlayer.play(playlist);
    }
</script>

<div class="journey-details">
    <div class="details-grid">
        <!-- LINKE SPALTE: STAMMDATEN -->
        <div class="detail-section">
            <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--border-color, #444); padding-bottom: 5px; margin-bottom: 15px;">
                <h4 style="margin: 0;">Stammdaten</h4>
            </div>
            
            <!-- Name -->
            <div class="form-row-responsive align-top">
                <div class="form-group fixed-width">
                    <span class="form-group-label">Name</span>
                    <input type="text" class="jfield" bind:value={journey.name} oninput={triggerUpdate} style="width: 100%;" placeholder="z.B. RE 70 / 95835">
                </div>
                <div class="form-group">
                    <span class="form-group-label">Zusatz / Überschreiben</span>
                    <input type="text" class="jfield" bind:value={journey.displayNameOverride} oninput={triggerUpdate} placeholder={journey.name || 'auto'} style="width: 100%;">
                </div>
            </div>
            
            <!-- Ziel / Herkunft -->
            <div class="form-row-responsive align-top">
                <div class="form-group fixed-width">
                    <span class="form-group-label">Ziel / Herkunft</span>
                    <StationPicker bind:value={journey.destination} placeholder="Station suchen" onSelect={onDestinationSelect} />
                </div>
                <div class="form-group">
                    <span class="form-group-label">Zusatz / Überschreiben</span>
                    <input type="text" class="jfield" bind:value={journey.destinationOverride} oninput={triggerUpdate} placeholder={journey.destination || 'Auto'} style="width: 100%;">
                </div>
            </div>
            
            <!-- Zeit & Gleis in einer Box zusammengefasst -->
            <div class="settings-box form-row-responsive align-stretch" style="margin-bottom: 20px;">
                <!-- Zeit Block -->
                <div class="form-group" style="flex-direction: row; gap: 10px; flex-wrap: wrap;">
                    <div class="form-group">
                        <span class="form-group-label center">Zeit (Plan)</span>
                        <input type="text" class="jfield" bind:value={journey.scheduledTime} oninput={triggerUpdate} placeholder="z.B. 14:30" style="width: 100%; text-align: center;">
                    </div>
                    <div class="form-group">
                        <span class="form-group-label center">Echtzeit</span>
                        <input type="text" class="jfield" bind:value={journey.expectedTime} oninput={triggerUpdate} placeholder="optional" style="width: 100%; text-align: center; color: var(--error-color, #ff6b6b); font-weight: bold;">
                    </div>
                </div>
                
                <div class="settings-divider"></div>
                
                <!-- Gleis Block -->
                <div class="form-group" style="flex-direction: row; gap: 10px; flex-wrap: wrap;">
                    <div class="form-group">
                        <span class="form-group-label center">Gleis/Plattf.</span>
                        <input type="text" class="jfield" bind:value={journey.platform} oninput={triggerUpdate} placeholder="z.B. 4" style="width: 100%; text-align: center;">
                    </div>
                    <div class="form-group">
                        <span class="form-group-label center">Echtzeit</span>
                        <input type="text" class="jfield" bind:value={journey.ezGleis} oninput={triggerUpdate} placeholder="optional" style="width: 100%; text-align: center; color: var(--error-color, #ff6b6b); font-weight: bold;">
                    </div>
                </div>
            </div>
            
            <!-- Verknüpfte Fahrt -->
            <div class="form-group" style="margin-bottom: 15px;">
                <span class="form-group-label">
                    {journey.ankunft ? 'Wird zu Abfahrt (Wende / Fahrzeugtausch)' : 'Kommt aus Ankunft (Wende / Fahrzeugtausch)'}
                </span>
                <div bind:this={linkWrapperRef} style="position: relative; width: 100%;">
                    <input type="text" class="jfield" style="width: 100%; margin: 0;"
                           placeholder={journey.ankunft ? 'Abfahrt suchen (Name, Ziel, Zeit)...' : 'Ankunft suchen (Name, Herkunft, Zeit)...'}
                           bind:value={linkSearchText}
                           onfocus={() => showLinkDropdown = true}
                           onblur={() => setTimeout(() => showLinkDropdown = false, 200)}>
                           
                    {#if showLinkDropdown}
                        <ul use:portalDropdown={linkWrapperRef} class="autocomplete-list active" style="max-height: 200px; overflow-y: auto; background-color: var(--bg-panel, #2b2b2b); border: 1px solid var(--border-color, #444); list-style: none; padding: 0; margin: 0; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <li class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color, #444);" onclick={() => setLinkedJourney(null)}>-- Keine Verknüpfung --</li>
                            {#each filteredJourneys as a}
                                {@const existingPartner = journeyStore.getLinkedJourney(a.id)}
                                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <li class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color, #444); display: flex; justify-content: space-between; align-items: center;" onclick={() => setLinkedJourney(a)}>
                                    <span>
                                        <strong>{a.effectiveDisplayName}</strong> ({a.scheduledTime})
                                        {#if a.destination} - {a.destination}{/if}
                                        {#if a.ezGleis || a.platform} - Gl. {a.ezGleis || a.platform}{/if}
                                    </span>
                                    {#if existingPartner && existingPartner.id !== journey.id}
                                        <span style="font-size: 0.75em; opacity: 0.7; color: #ff9800; margin-left: 8px;">
                                            (bereits mit {existingPartner.effectiveDisplayName} verknüpft)
                                        </span>
                                    {/if}
                                </li>
                            {/each}
                            {#if filteredJourneys.length === 0}
                                <li style="padding: 8px; color: #888; font-style: italic;">
                                    {journey.ankunft ? 'Keine passenden Abfahrten vorhanden' : 'Keine passenden Ankünfte vorhanden'}
                                </li>
                            {/if}
                        </ul>
                    {/if}
                </div>
            </div>
            
            <!-- Verspätungsgrund -->
            <div class="form-group" style="margin-bottom: 15px;">
                <span class="form-group-label">Verspätungsgrund</span>
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
            
            <div class="audio-action-bar">
                <button class="btn-secondary btn-sm" onclick={() => playAnsage('Einfahrt')} title="Ansage Einfahrt generieren">🔊 Einfahrt</button>
                <button class="btn-secondary btn-sm" onclick={() => playAnsage('Steht')} title="Ansage Steht generieren">🔊 Steht</button>
                <button class="btn-secondary btn-sm" onclick={() => playAnsage('Information')} title="Ansage Information generieren">🔊 Info</button>
                <button class="btn-secondary btn-sm" onclick={() => playAnsage('Anschluesse')} title="Ansage Anschlüsse generieren">🔊 Anschlüsse</button>
            </div>
        </div>
        
        <!-- RECHTE SPALTE: ANZEIGE -->
        <div class="detail-section">
            <h4 style="margin-bottom: 15px; border-bottom: 1px solid var(--border-color, #444); padding-bottom: 5px;">Anzeige</h4>
            
            <!-- Row 1: Status & Modus (Ankunft/Abfahrt, Ausfall, Infoscreen) -->
            <div class="settings-box form-row-responsive align-stretch" style="margin-bottom: 20px;">
                <!-- Ankunft/Abfahrt Toggle -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="form-group" style="align-items: center; justify-content: center; cursor: pointer; flex: 0 0 80px;" onclick={() => { journeyStore.toggleJourneyMode(journey.id); triggerUpdate(); }}>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-bottom: 8px;">Modus</div>
                    <div style="width: 44px; height: 22px; background: var(--bg-panel, #1a1a1a); border-radius: 11px; position: relative; border: 2px solid var(--border-color, #555); box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
                        <div style="width: 16px; height: 16px; background: {journey.ankunft ? '#ff6b6b' : '#4dabf7'}; border-radius: 50%; position: absolute; top: 1px; transition: 0.2s; {journey.ankunft ? 'right: 1px;' : 'left: 1px;'} box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>
                    </div>
                    <div style="font-size: 0.85em; margin-top: 8px; font-weight: bold; color: {journey.ankunft ? '#ff6b6b' : '#4dabf7'};">{journey.ankunft ? 'Ankunft' : 'Abfahrt'}</div>
                </div>
                
                <div class="settings-divider"></div>
                
                <!-- Ausfall & Infoscreen -->
                <div class="form-group" style="justify-content: center; gap: 12px;">
                    <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                        <input type="checkbox" bind:checked={journey.ausfall} onchange={triggerUpdate} style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1.05em; {journey.ausfall ? 'color: #ff6b6b; font-weight: bold;' : ''}">Ausfall</span>
                    </label>
                    
                    <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                        <input type="checkbox" bind:checked={journey.infoscreen} onchange={triggerUpdate} style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1.05em;">Infoscreen (Lauftext/ Sonderanzeige)</span>
                    </label>
                </div>
            </div>
            
            <!-- Row 2: InfoTexte -->
            <div style="margin-bottom: 20px;">
                <InfoTextEditor {journey} />
            </div>
            
            <!-- Row 3: Verkehrt heute ab -->
            <div class="form-group" style="margin-bottom: 20px;">
                <span class="form-group-label">Verkehrt heute ab (Station)</span>
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
            <div class="settings-box form-row-responsive align-stretch" style="margin-bottom: 20px;">
                <!-- Richtung Toggle -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="form-group" style="align-items: center; justify-content: center; cursor: pointer; flex: 0 0 80px;" onclick={() => { journey.direction = journey.direction === 1 ? 0 : 1; triggerUpdate(); }}>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-bottom: 8px;">Fahrtrichtung</div>
                    <div style="width: 44px; height: 22px; background: var(--bg-panel, #1a1a1a); border-radius: 11px; position: relative; border: 2px solid var(--border-color, #555); box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
                        <div style="width: 16px; height: 16px; background: #4dabf7; border-radius: 50%; position: absolute; top: 1px; transition: 0.2s; {journey.direction === 1 ? 'right: 1px;' : 'left: 1px;'} box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>
                    </div>
                    <div style="font-size: 0.85em; margin-top: 8px; font-weight: bold;">{journey.direction === 1 ? 'Rechts' : 'Links'}</div>
                </div>

                <div class="settings-divider"></div>

                <!-- Startmeter -->
                <div class="form-group" style="justify-content: center; flex: 0 0 80px;">
                    <span class="form-group-label center">Startmeter</span>
                    <input type="number" class="jfield" bind:value={journey.startMeter} oninput={triggerUpdate} style="width: 100%; text-align: center;" placeholder="z.B. 50">
                </div>

                <div class="settings-divider"></div>

                <!-- Skalierung -->
                <div class="form-group" style="justify-content: center;">
                    <span class="form-group-label">Skalierung (Zoom)</span>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <label class="checkbox-label" style="margin: 0; min-height: 24px;">
                            <input type="checkbox" bind:checked={journey.skalieren} onchange={triggerUpdate}>
                            Aktiv
                        </label>
                        {#if journey.skalieren}
                            <input type="number" step="0.01" class="jfield" bind:value={journey.scaleFactor} oninput={triggerUpdate} style="width: 70px; text-align: center;" placeholder="1.0">
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="detail-section" style="margin-top: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
            <h4>Wagenreihung</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-secondary">📥 Import</button>
                <button class="btn-secondary">📤 Export</button>
                <button class="btn-secondary" title="Dreht die Reihenfolge aller Gruppen und Wagen um">🔁 Komplett drehen</button>
                <button class="btn-secondary">+ Neue Gruppe</button>
            </div>
        </div>
        <!-- FormationEditor placeholder -->
        <div style="color: #888; font-style: italic; padding: 10px; border: 1px dashed #555;">Wagenreihungs-Editor (coming soon)</div>
    </div>

    <div class="details-actions" style="margin-top: 20px; flex-wrap: wrap;">
        <button class="btn-secondary" onclick={toggleCoupling}>{journey.couplingGroupId ? '🔗 Entkoppeln' : '🔗 Koppeln'}</button>
        <button class="btn-danger" onclick={deleteJourney}>🗑️ Löschen</button>
    </div>
    
    <div class="detail-section" style="margin-top: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
            <h4>Zuglauf (Halte)</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-secondary" onclick={toggleAllStops}>👁️ Alle umschalten</button>
                <button class="btn-secondary" onclick={autoGenVias}>⚡ Auto-Vias</button>
                <button class="btn-secondary" onclick={addStop}>+ Halt hinzufügen</button>
            </div>
        </div>
        <StopEditor bind:journey />
    </div>
</div>

<style>
.journey-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .details-grid { grid-template-columns: 1fr; } }
.detail-section h4 { margin: 0 0 8px 0; color: var(--text-muted); font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em; }
.detail-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; align-items: center; }
.detail-row label { display: flex; align-items: center; gap: 4px; font-size: 0.9em; color: var(--text-muted); }
.detail-row input[type="text"], .detail-row input[type="number"] { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-main); padding: 4px 8px; border-radius: 4px; font-family: inherit; font-size: 0.9em; }
.detail-row .short-input { width: 70px; }
.details-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
</style>
