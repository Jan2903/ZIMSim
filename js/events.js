// js/events.js
// Komplett neue UI-Logik für die dynamische Journey-Liste
import { journeyStore, trainDisplay } from './main.js';
import { Journey } from './models/journey.js';
import { formatDisplayName } from './utils/trainNumberFormatter.js';
import { Stop } from './models/stop.js';
import { Formation, FormationGroup } from './models/formation.js';
import { Coach } from './models/coach.js';
import { config, timeConfig, setSimulatedTime, getSimulatedTime } from './utils/config.js';
import { toggleDebugMeters } from './displays/formationRenderer.js';
import { debounce } from './utils/utils.js';
import { StationService } from './utils/stationService.js';
import { RisTextService } from './utils/risTextService.js';
import { MOT_PRESETS, MOT_ALL_KEYS, getSmartHeaderString, getMotForCategory } from './utils/motManager.js';

const debouncedUpdateAll = debounce(() => trainDisplay.updateAll(), 300);

// Aktuell aufgeklappte Journey-ID (oder null)
let expandedJourneyId = null;
// IDs der aktuell aufgeklappten FormationGroups (Format: "journeyId_groupIndex")
const expandedGroups = new Set();
// Manuell hinzugefügte Gleise (werden nicht durch Store-Änderungen gelöscht)
const manualTracks = new Set();

// ==========================================
// Journey-Liste rendern
// ==========================================

/**
 * Rendert die gesamte Journey-Liste neu.
 */
export function renderJourneyList() {
    const container = document.getElementById('journey_list');
    if (!container) return;

    if (journeyStore.journeys.length === 0) {
        container.innerHTML = '<div class="journey-empty">Keine Fahrten vorhanden. Klicke "+ Fahrt hinzufügen" oder importiere DB-Daten.</div>';
        return;
    }

    let html = '';
    let lastCouplingGroupId = null;

    journeyStore.journeys.forEach((journey, index) => {
        const isExpanded = expandedJourneyId === journey.id;
        const isCoupled = journey.couplingGroupId !== null;
        const isFirstInCoupling = isCoupled && journey.couplingGroupId !== lastCouplingGroupId;
        const nextJourney = journeyStore.journeys[index + 1];
        const isLastInCoupling = isCoupled && (!nextJourney || nextJourney.couplingGroupId !== journey.couplingGroupId);

        // Coupling-Linie
        let couplingClass = '';
        if (isCoupled) {
            if (isFirstInCoupling && isLastInCoupling) couplingClass = 'coupling-single';
            else if (isFirstInCoupling) couplingClass = 'coupling-start';
            else if (isLastInCoupling) couplingClass = 'coupling-end';
            else couplingClass = 'coupling-middle';
        }

        // Arrival/Departure Badge
        const badge = journey.ankunft ? '<span class="badge badge-arrival">ⓐ</span>' : '';
        const cancelledClass = journey.ausfall ? 'journey-cancelled' : '';
        const visibleIcon = journey.visible ? '👁' : '○';
        const delayInfo = journey.expectedTime && journey.expectedTime !== journey.scheduledTime
            ? `<span class="delay-indicator">${journey.expectedTime}</span>` : '';

        // Check if journey is filtered out by MOT or Track
        let isHidden = false;
        const mot = getMotForCategory(journey.produktGattung || journey.name);
        if (mot && !journeyStore.activeMots.includes(mot)) {
            isHidden = true;
        }
        
        if (journeyStore.activeTracks.length > 0) {
            const hasPlatform = journey.platform && journeyStore.activeTracks.includes(journey.platform.toString());
            const hasEzGleis = journey.ezGleis && journeyStore.activeTracks.includes(journey.ezGleis.toString());
            const hasNoTrackCondition = (!journey.platform && !journey.ezGleis && journeyStore.activeTracks.includes('Ohne Gleis'));
            
            if (!hasPlatform && !hasEzGleis && !hasNoTrackCondition) {
                isHidden = true;
            }
        }
        
        const hiddenClass = isHidden ? 'mot-hidden' : '';

        let platformText = journey.platform ? 'Gl. ' + journey.platform : '';
        if (journey.ezGleis && journey.ezGleis !== journey.platform) {
            platformText += ` <span style="color: #ff6b6b; font-weight: bold;">(${journey.ezGleis})</span>`;
        }

        html += `
            <div class="journey-row ${cancelledClass} ${hiddenClass}" data-journey-id="${journey.id}" draggable="true">
                <div class="journey-col-reorder">
                    <span class="journey-drag-handle" title="Drag & Drop">⠿</span>
                    <div class="reorder-buttons">
                        <button class="btn-icon btn-reorder-up" data-journey-id="${journey.id}" title="Nach oben">▲</button>
                        <button class="btn-icon btn-reorder-down" data-journey-id="${journey.id}" title="Nach unten">▼</button>
                    </div>
                </div>
                <div class="journey-col-visibility">
                    <button class="btn-icon visibility-toggle" data-journey-id="${journey.id}" title="Sichtbarkeit umschalten">${visibleIcon}</button>
                </div>
                <div class="journey-col-coupling ${couplingClass}">
                    <div class="coupling-line"></div>
                </div>
                <div class="journey-col-main">
                    <div class="journey-summary" data-journey-id="${journey.id}">
                        <span class="journey-name">${journey.effectiveDisplayName || '(kein Name)'}</span>
                        ${badge}
                        <span class="journey-destination">${journey.destination || '—'}</span>
                        <span class="journey-time">${journey.scheduledTime || '—'}</span>
                        ${delayInfo}
                        <span class="journey-platform">${platformText}</span>
                        <button class="btn-icon expand-toggle" data-journey-id="${journey.id}">${isExpanded ? '▾' : '▸'}</button>
                    </div>
                    ${isExpanded ? renderJourneyDetails(journey) : ''}
                </div>
            </div>
        `;

        lastCouplingGroupId = journey.couplingGroupId;
    });

    container.innerHTML = html;

    // Track Filter nach Rendern der Journeys aktualisieren
    renderTrackFilter();
}

/**
 * Generiert und rendert die dynamische Gleis-Auswahl im "Bahnhof"-Tab.
 */
export function renderTrackFilter() {
    const container = document.getElementById('track_checkbox_container');
    const summary = document.getElementById('track_summary');
    if (!container || !summary) return;

    // Alle Gleise aus Store holen
    const storeTracks = journeyStore.getAllTracks();
    
    // Mit manuellen Gleisen mergen und sortieren
    const allTracksSet = new Set([...storeTracks, ...manualTracks]);
    let allTracks = Array.from(allTracksSet).sort((a, b) => {
        if (a === 'Ohne Gleis') return 1;
        if (b === 'Ohne Gleis') return -1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Checkboxen generieren
    let html = '';
    allTracks.forEach(track => {
        // Default-mäßig alle angehakt, außer wir haben schon manuell deselektiert
        // journeyStore.activeTracks speichert die AKTIVEN. 
        // Wenn activeTracks leer ist UND initial geladen wird, sollten wir es evtl. füllen?
        // Bei MOT ist initial alles gecheckt (im HTML), dann wird activeMots befüllt.
        // Bei Tracks: Wenn activeTracks leer ist, nehmen wir an alle sind aktiv,
        // oder wir füllen es einmalig. Besser: Im HTML ist nichts, wir initialisieren hier.
        const isChecked = journeyStore.activeTracks.length === 0 || journeyStore.activeTracks.includes(track);
        html += `<label class="checkbox-label"><input type="checkbox" class="track_dep" value="${track}" ${isChecked ? 'checked' : ''}> ${track}</label>`;
    });

    container.innerHTML = html;

    // Summary updaten
    if (journeyStore.activeTracks.length === 0 || journeyStore.activeTracks.length === allTracks.length) {
        summary.innerText = "Gleise: Alle";
    } else {
        summary.innerText = "Gleise: " + journeyStore.activeTracks.join(', ');
    }

    // Events binden für neu generierte Checkboxen
    const checkboxes = container.querySelectorAll('.track_dep');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const selected = Array.from(checkboxes)
                .filter(c => c.checked)
                .map(c => c.value);
            
            // Wenn alle oder keines gewählt, dann Liste leeren -> Alle sichtbar
            if (selected.length === 0 || selected.length === checkboxes.length) {
                journeyStore.activeTracks = [];
            } else {
                journeyStore.activeTracks = selected;
            }
            
            // UI Updaten (rekursiv wird renderTrackFilter in renderJourneyList aufgerufen, 
            // das ist okay, solange renderTrackFilter nicht den Fokus verliert,
            // aber Checkbox-Click verliert keinen Text-Fokus)
            renderJourneyList();
            trainDisplay.updateAll();
        });
    });
}

/**
 * Rendert das aufgeklappte Detail-Panel einer Journey.
 */
function renderJourneyDetails(journey) {
    const groups = journey.formation.groups;
    const groupOptions = groups.length > 0
        ? groups.map((g, i) => `<option value="${i}">${g.trainNumber || g.name || 'Gruppe ' + (i+1)}</option>`).join('')
        : '<option value="0">Standard</option>';

    return `
        <div class="journey-details" data-journey-id="${journey.id}">
            <div class="details-grid">
                <div class="detail-section">
                    <h4>Stammdaten</h4>
                    <div class="detail-row">
                        <label>Name: <input type="text" class="jfield" data-field="name" value="${journey.name || ''}" style="width: 150px;" placeholder="z.B. RE 70 / 95835"></label>
                        <label style="margin-left: 15px;">Anzeigename (Override): <input type="text" class="jfield" data-field="displayNameOverride" value="${journey.displayNameOverride}" placeholder="${journey.name || 'auto'}"></label>
                    </div>
                    <div class="detail-row">
                        <label>Ziel: <input type="text" class="jfield" data-field="destination" value="${journey.destination}"></label>
                    </div>
                    <div class="detail-row">
                        <label>Abfahrt/Ankunft: <input type="text" class="jfield short-input" data-field="scheduledTime" value="${journey.scheduledTime}"></label>
                        <label>Echtzeit: <input type="text" class="jfield short-input" data-field="expectedTime" value="${journey.expectedTime}"></label>
                        <label>Gleis (Plan): <input type="text" class="jfield short-input" data-field="platform" value="${journey.platform}"></label>
                        <label>Echtzeit-Gleis: <input type="text" class="jfield short-input" data-field="ezGleis" value="${journey.ezGleis}"></label>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Anzeige</h4>
                    <div class="detail-row">
                        <div style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 0.9em; color: var(--text-muted);">Lauftext / Info-Bausteine:</span>
                                <button class="btn-secondary btn-sm info_add_custom_btn" data-journey-id="${journey.id}">+ Manuell</button>
                            </div>
                            <div class="inline-infotext-editor" data-journey-id="${journey.id}">
                                ${renderInfoTextsEditor(journey)}
                            </div>
                        </div>
                    </div>
                    <div class="detail-row">
                        <label class="radio-group">Richtung:
                            <span><input type="radio" class="jradio" name="dir_${journey.id}" data-field="direction" value="0" ${journey.direction === 0 ? 'checked' : ''}> Links</span>
                            <span><input type="radio" class="jradio" name="dir_${journey.id}" data-field="direction" value="1" ${journey.direction === 1 ? 'checked' : ''}> Rechts</span>
                        </label>
                        <label>Startmeter: <input type="number" class="jfield short-input" data-field="startMeter" value="${journey.startMeter}"></label>
                    </div>
                    <div class="detail-row">
                        <label class="checkbox-label"><input type="checkbox" class="jcheck" data-field="ankunft" ${journey.ankunft ? 'checked' : ''}> Ankunft</label>
                        <label class="checkbox-label"><input type="checkbox" class="jcheck" data-field="skalieren" ${journey.skalieren ? 'checked' : ''}> Skalieren</label>
                        <label>Faktor: <input type="number" step="0.01" class="jfield short-input" data-field="scaleFactor" value="${journey.scaleFactor}"></label>
                        <label class="checkbox-label"><input type="checkbox" class="jcheck" data-field="ausfall" ${journey.ausfall ? 'checked' : ''}> Ausfall</label>
                        <label class="checkbox-label"><input type="checkbox" class="jcheck" data-field="infoscreen" ${journey.infoscreen ? 'checked' : ''}> Infoscreen</label>
                    </div>
                    <div class="detail-row">
                        <label>Verkehrt ab: <input type="text" class="jfield short-input" data-field="verkehrtAb" value="${journey.verkehrtAb}"></label>
                        <label style="margin-left: 10px;">Verspätungsgrund: 
                            <select class="jfield" data-field="delayReason" style="max-width: 250px;">
                                ${renderDelayReasonOptions(journey.delayReason)}
                            </select>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="detail-section" style="margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4>Wagenreihung</h4>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-secondary formation_import_btn" data-journey-id="${journey.id}">📥 Import</button>
                        <button class="btn-secondary formation_export_btn" data-journey-id="${journey.id}">📤 Export</button>
                        <button class="btn-secondary formation_reverse_btn" data-journey-id="${journey.id}" title="Dreht die Reihenfolge aller Gruppen und Wagen um">🔁 Komplett drehen</button>
                        <button class="btn-secondary formation_add_group_btn" data-journey-id="${journey.id}">+ Neue Gruppe</button>
                    </div>
                </div>
                <div class="inline-formation-editor" data-journey-id="${journey.id}">
                    ${renderInlineFormation(journey)}
                </div>
            </div>

            <div class="details-actions" style="margin-top: 20px;">
                <button class="btn-secondary couple-btn" data-journey-id="${journey.id}">${journey.couplingGroupId ? '🔗 Entkoppeln' : '🔗 Koppeln'}</button>
                <button class="btn-danger delete-journey-btn" data-journey-id="${journey.id}">🗑️ Löschen</button>
            </div>
            
            <div class="detail-section" style="margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4>Zuglauf (Halte)</h4>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-secondary stops_toggle_all_btn" data-journey-id="${journey.id}" title="Alle (außer Ausfall/Nur Einstieg) als Via an/abwählen">👁️ Alle umschalten</button>
                        <button class="btn-secondary stops_auto_gen_btn" data-journey-id="${journey.id}">⚡ Auto-Vias</button>
                        <button class="btn-secondary stops_add_btn" data-journey-id="${journey.id}">+ Halt hinzufügen</button>
                    </div>
                </div>
                <div class="inline-stops-editor" data-journey-id="${journey.id}">
                    ${renderStopsEditor(journey)}
                </div>
            </div>
        </div>
    `;
}

function renderInlineFormation(journey) {
    if (journey.formation.groups.length === 0) {
        journey.formation.groups.push(new FormationGroup({
            transport: { category: '', destination: { name: journey.destination }, number: journey.name }
        }));
    }
    
    let html = '';
    journey.formation.groups.forEach((group, gIndex) => {
        html += renderFormationGroup(group, gIndex, journey.id);
    });
    return html;
}

// ==========================================
// Info-Texte und Verspätungsgrund Editoren
// ==========================================

function renderInfoTextsEditor(journey) {
    let html = '<div class="info-editor-list" style="border: 1px solid var(--border); border-radius: 5px; background: transparent; padding: 5px; margin-bottom: 5px;">';
    
    if (!journey.infoTexts || journey.infoTexts.length === 0) {
        html += '<div class="info-empty" style="color: #ccc; margin-bottom: 5px;">Keine Lauftexte vorhanden.</div>';
    } else {
        journey.infoTexts.forEach((info, i) => {
            html += renderInfoTextRow(info, i, journey.id);
        });
    }
    
    // Preset-Auswahl (Type Q) hinzufügen
    const qPresets = RisTextService.getPresetsByType('Q');
    let presetOptions = '<option value="">-- Preset wählen --</option>';
    qPresets.forEach(p => {
        presetOptions += `<option value="${p.text}">${p.code}: ${p.text}</option>`;
    });

    html += `
        <div style="display: flex; gap: 5px; margin-top: 10px;">
            <select class="jfield info-preset-select" style="flex: 1;">
                ${presetOptions}
            </select>
            <button class="btn-secondary btn-sm info_add_preset_btn" data-journey-id="${journey.id}">Hinzufügen</button>
        </div>
    </div>`;
    
    return html;
}

function renderInfoTextRow(info, index, journeyId) {
    const visibleIcon = info.visible ? '👁️' : '○';
    const visibleTitle = info.visible ? 'Sichtbar im Lauftext' : 'Versteckt';
    
    return `
        <div class="info-editor-row" data-index="${index}" style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border);">
            <button class="btn-icon move-info-up" title="Nach oben">⬆️</button>
            <button class="btn-icon move-info-down" title="Nach unten">⬇️</button>
            <button class="btn-icon toggle-info-visible" title="${visibleTitle}">${visibleIcon}</button>
            <input type="text" class="jfield info-text-input" value="${info.text}" style="flex: 1; margin: 0;" placeholder="Text">
            <button class="btn-icon remove-info-btn" title="Entfernen">✕</button>
        </div>
    `;
}

function renderDelayReasonOptions(selectedReason) {
    const rPresets = RisTextService.getPresetsByType('R');
    let html = '<option value="">-- Kein Verspätungsgrund --</option>';
    rPresets.forEach(p => {
        const selected = (p.text === selectedReason) ? 'selected' : '';
        html += `<option value="${p.text}" ${selected}>${p.code}: ${p.text}</option>`;
    });
    // Falls manueller Grund drinsteht, der nicht in den Presets ist
    if (selectedReason && !rPresets.some(p => p.text === selectedReason)) {
        html += `<option value="${selectedReason}" selected>${selectedReason}</option>`;
    }
    return html;
}

function saveInfoTextsEditor(journeyId, immediate = true) {
    const journey = journeyStore.getJourney(journeyId);
    if (!journey) return;

    const details = document.querySelector(`.journey-details[data-journey-id="${journeyId}"]`);
    if (!details) return;

    const infoRows = details.querySelectorAll('.info-editor-row');
    const newInfos = [];

    infoRows.forEach((row) => {
        const dataIndex = row.dataset.index;
        const oldInfo = journey.infoTexts[dataIndex] || {};
        const text = row.querySelector('.info-text-input')?.value || '';
        
        newInfos.push({
            id: oldInfo.id || crypto.randomUUID(),
            text: text,
            visible: oldInfo.visible !== undefined ? oldInfo.visible : true,
            type: oldInfo.type || 'custom'
        });
    });

    journey.infoTexts = newInfos;
    
    if (immediate) trainDisplay.updateAll();
    else debouncedUpdateAll();
}

/**
 * Rendert den editierbaren Stop-Editor (Zuglauf).
 */
function renderStopsEditor(journey) {
    if (journey.stops.length === 0) return '<div class="stops-empty" style="color: #ccc;">Keine Halte vorhanden.</div>';

    let html = '';
    journey.stops.forEach((stop, i) => {
        html += renderStopRow(stop, i, journey.id, i === journey._currentStopIndex);
    });

    return `
        <div class="stops-editor-list" style="border: 1px solid var(--border); border-radius: 5px; background: transparent; padding: 5px;">
            ${html}
        </div>
    `;
}

function renderStopRow(stop, index, journeyId, isCurrent) {
    const arr = stop.arrivalTime || '';
    const dep = stop.departureTime || '';
    const cancelledStyle = stop.cancelled ? 'opacity: 0.5; text-decoration: line-through;' : '';
    const currentStyle = isCurrent ? 'border-left: 3px solid #ff6b6b;' : '';
    const viaIcon = stop.showAsVia ? '👁️' : '○';
    const viaTitle = stop.showAsVia ? 'Als Via markiert' : 'Nicht als Via markiert';

    return `
        <div class="stop-editor-row" data-index="${index}" style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border); ${cancelledStyle} ${currentStyle}">
            <span class="stop-drag-handle" title="Drag & Drop" style="cursor: move;">⠿</span>
            <button class="btn-icon move-stop-up" title="Nach oben">⬆️</button>
            <button class="btn-icon move-stop-down" title="Nach unten">⬇️</button>
            <button class="btn-icon toggle-stop-via" title="${viaTitle}">${viaIcon}</button>
            
            <div class="autocomplete-wrapper" style="flex: 2; position: relative; display: flex; flex-direction: column;">
                <input type="text" class="s-prop short-input station-name-input" data-prop="name" value="${stop.name}" placeholder="Name" title="Bahnhofsname" autocomplete="off" style="width: 100%;">
                <ul class="stop-autocomplete-list autocomplete-list"></ul>
            </div>
            
            <input type="text" class="s-prop short-input" data-prop="nameKurz" value="${stop.nameKurz}" placeholder="Kurz" title="Kurzname (Via)" style="flex: 1;">
            <input type="text" class="s-prop short-input" data-prop="arrival" value="${arr}" placeholder="An" title="Ankunft" style="width: 50px;">
            <input type="text" class="s-prop short-input" data-prop="departure" value="${dep}" placeholder="Ab" title="Abfahrt" style="width: 50px;">
            <input type="text" class="s-prop short-input" data-prop="platform" value="${stop.platform}" placeholder="Gl." title="Gleis" style="width: 40px;">
            <input type="number" class="s-prop short-input" data-prop="stationCategory" value="${stop.stationCategory !== 99 ? stop.stationCategory : ''}" placeholder="Kat" title="Bahnhofskategorie (Priorität)" style="width: 40px;">
            
            <select class="s-prop short-input" data-prop="boardingType" title="Ein-/Ausstieg">
                <option value="null" ${stop.boardingType === null ? 'selected' : ''}>—</option>
                <option value="ein" ${stop.boardingType === 'ein' ? 'selected' : ''}>Nur Ein</option>
                <option value="aus" ${stop.boardingType === 'aus' ? 'selected' : ''}>Nur Aus</option>
            </select>
            
            <label title="Ausfall"><input type="checkbox" class="s-prop" data-prop="cancelled" ${stop.cancelled ? 'checked' : ''}> ⛔</label>
            <button class="btn-icon remove-stop-btn" title="Halt entfernen">✕</button>
        </div>
    `;
}

function saveStopsEditor(journeyId, immediate = true) {
    const journey = journeyStore.getJourney(journeyId);
    if (!journey) return;

    const details = document.querySelector(`.journey-details[data-journey-id="${journeyId}"]`);
    if (!details) return;

    const stopRows = details.querySelectorAll('.stop-editor-row');
    const newStops = [];

    stopRows.forEach((row, idx) => {
        const dataIndex = row.dataset.index;
        const oldStop = journey.stops[dataIndex];
        const name = row.querySelector('[data-prop="name"]')?.value || '';
        const nameKurz = row.querySelector('[data-prop="nameKurz"]')?.value || '';
        const arrival = row.querySelector('[data-prop="arrival"]')?.value || '';
        const departure = row.querySelector('[data-prop="departure"]')?.value || '';
        const platform = row.querySelector('[data-prop="platform"]')?.value || '';
        let boardingType = row.querySelector('[data-prop="boardingType"]')?.value;
        boardingType = boardingType === 'null' ? null : boardingType;
        const cancelled = row.querySelector('[data-prop="cancelled"]')?.checked || false;
        
        let stationCategory = parseInt(row.querySelector('[data-prop="stationCategory"]')?.value);
        if (isNaN(stationCategory)) stationCategory = 99;

        const stopData = {
            name, nameKurz, platform, cancelled, boardingType,
            arrival: arrival ? { scheduled: arrival } : null,
            departure: departure ? { scheduled: departure } : null,
            extId: oldStop ? oldStop.extId : '',
            showAsVia: oldStop ? oldStop.showAsVia : false,
            stationCategory: stationCategory
        };
        newStops.push(new Stop(stopData));
    });

    journey.stops = newStops;
    // Current Index beibehalten oder resetten
    if (journey._currentStopIndex >= newStops.length) {
        journey._currentStopIndex = newStops.length - 1;
    }
    
    if (immediate) trainDisplay.updateAll();
    else debouncedUpdateAll();
}

// ==========================================
// Formation-Editor
// ==========================================

function showFormationEditor(journeyId) {
    const journey = journeyStore.getJourney(journeyId);
    if (!journey) return;

    editingFormationJourneyId = journeyId;

    if (journey.formation.groups.length === 0) {
        journey.formation.groups.push(new FormationGroup({
            transport: { category: '', destination: { name: journey.destination }, number: journey.name }
        }));
    }

    const modal = document.getElementById('formation_modal');
    const title = document.getElementById('formation_modal_title');
    const body = document.getElementById('formation_editor_body');

    title.textContent = `Wagenreihung: ${journey.effectiveDisplayName}`;

    let html = '';
    journey.formation.groups.forEach((group, gIndex) => {
        html += renderFormationGroup(group, gIndex);
    });

    body.innerHTML = html;
    modal.classList.remove('hidden');
}

function renderFormationGroup(group, gIndex, journeyId) {
    let coachesHtml = '';
    group.coaches.forEach((coach, i) => {
        coachesHtml += renderCoachRow(coach, i, gIndex);
    });

    const groupId = `${journeyId}_${gIndex}`;
    const isExpanded = expandedGroups.has(groupId);
    const displayStyle = isExpanded ? 'block' : 'none';
    const chevron = isExpanded ? '▼' : '▶';

    return `
        <div class="formation-group-editor" data-group-index="${gIndex}" style="border: 1px solid #444; margin-bottom: 10px; border-radius: 5px; background: rgba(0,0,0,0.2);" draggable="true">
            <div class="group-editor-header formation-accordion-toggle" data-group-id="${groupId}" style="display: flex; gap: 10px; align-items: center; padding: 10px; cursor: pointer; border-bottom: ${isExpanded ? '1px solid #444' : 'none'};">
                <span class="group-drag-handle" title="Gruppe verschieben" style="font-size: 20px; cursor: move;">⠿</span>
                <span style="width: 20px; text-align: center; font-weight: bold;">${chevron}</span>
                <strong>Zugteil</strong>
                <input type="text" class="f-prop group-prop" data-prop="category" placeholder="ICE" value="${group.transport.category || ''}" title="Kategorie (z.B. ICE)" style="width:50px">
                <input type="text" class="f-prop group-prop" data-prop="number" placeholder="2310" value="${group.transport.number || ''}" title="Zugnummer" style="width:70px">
                <input type="text" class="f-prop group-prop" data-prop="destination" placeholder="Ziel" value="${group.transport.destination?.name || ''}" title="Ziel" style="flex-grow:1">
                <input type="text" class="f-prop group-prop" data-prop="name" placeholder="Name/Triebzug" value="${group.name || ''}" title="Name/Triebzug" style="width:120px">
                
                <button class="btn-icon move-group-up" title="Nach oben">⬆️</button>
                <button class="btn-icon move-group-down" title="Nach unten">⬇️</button>
                <button class="btn-icon reverse-group-btn" title="Reihenfolge der Wagen in dieser Gruppe umkehren">🔁</button>
                <button class="btn-icon export-group-btn" title="Gruppe exportieren">📤</button>
                <button class="btn-secondary add-coach-btn" data-group-index="${gIndex}">+ Wagen</button>
                <button class="btn-danger delete-group-btn" title="Gruppe löschen">🗑️</button>
            </div>
            <div class="coach-editor-list" data-group-index="${gIndex}" style="min-height: 20px; padding: 10px; display: ${displayStyle};">
                ${coachesHtml}
            </div>
        </div>
    `;
}

function renderCoachRow(coach, index, gIndex = 0) {
    const amenityTypes = ['f', 'r', 'g', 'm'];
    const amenityLabels = { f: '🚲', r: '♿', g: '🍽️', m: '📦' };
    const amenityChecks = amenityTypes.map(a =>
        `<label title="${a}"><input type="checkbox" class="f-prop amenity-check" data-amenity="${a}" ${coach.hasAmenity(a) ? 'checked' : ''}> ${amenityLabels[a]}</label>`
    ).join('');

    return `
        <div class="coach-editor-row" data-index="${index}" data-group-index="${gIndex}" draggable="true">
            <span class="drag-handle" title="Drag & Drop" style="cursor: move;">⠿</span>
            <button class="btn-icon move-coach-up" title="Nach oben">⬆️</button>
            <button class="btn-icon move-coach-down" title="Nach unten">⬇️</button>
            <select class="f-prop" data-prop="type">
                <option value="locomotive" ${coach.type === 'locomotive' ? 'selected' : ''}>Lok</option>
                <option value="control_car" ${coach.type === 'control_car' ? 'selected' : ''}>Steuerwagen</option>
                <option value="middle_car" ${coach.type === 'middle_car' ? 'selected' : ''}>Mittelwagen</option>
            </select>
            <input type="number" class="f-prop" data-prop="length" value="${coach.length}" style="width:60px" title="Länge">
            <select class="f-prop" data-prop="coachClass" style="width:55px">
                <option value="1" ${coach.coachClass === 1 ? 'selected' : ''}>1.</option>
                <option value="2" ${coach.coachClass === 2 ? 'selected' : ''}>2.</option>
                <option value="null" ${coach.coachClass === null ? 'selected' : ''}>—</option>
            </select>
            <input type="text" class="f-prop" data-prop="coachNumber" value="${coach.coachNumber}" style="width:50px" placeholder="Nr" title="Wagennummer">
            <div class="amenity-checks">${amenityChecks}</div>
            <label title="Offen"><input type="checkbox" class="f-prop" data-prop="open" ${coach.open ? 'checked' : ''}> ✓</label>
            <button class="btn-icon remove-coach-btn" title="Wagen entfernen">✕</button>
        </div>
    `;
}

function saveInlineFormation(journeyId, immediate = true) {
    const journey = journeyStore.getJourney(journeyId);
    if (!journey) return;

    const details = document.querySelector(`.journey-details[data-journey-id="${journeyId}"]`);
    if (!details) return;

    const groupEditors = details.querySelectorAll('.formation-group-editor');
    const newGroups = [];
    let hasSplitAny = false;

    groupEditors.forEach((groupEl) => {
        const groupData = {
            transport: {
                category: groupEl.querySelector('.group-prop[data-prop="category"]')?.value || '',
                number: parseInt(groupEl.querySelector('.group-prop[data-prop="number"]')?.value) || 0,
                destination: { name: groupEl.querySelector('.group-prop[data-prop="destination"]')?.value || '' }
            },
            name: groupEl.querySelector('.group-prop[data-prop="name"]')?.value || '',
            coaches: []
        };

        const coachRows = groupEl.querySelectorAll('.coach-editor-row');
        coachRows.forEach(row => {
            const type = row.querySelector('[data-prop="type"]')?.value || 'middle_car';
            const length = parseFloat(row.querySelector('[data-prop="length"]')?.value) || 25;
            let coachClass = row.querySelector('[data-prop="coachClass"]')?.value;
            coachClass = coachClass === 'null' ? null : parseInt(coachClass);
            const coachNumber = row.querySelector('[data-prop="coachNumber"]')?.value || '';
            const open = row.querySelector('[data-prop="open"]')?.checked || false;

            const amenities = [];
            row.querySelectorAll('.amenity-check').forEach(chk => {
                if (chk.checked) amenities.push(chk.dataset.amenity);
            });

            groupData.coaches.push(new Coach({
                type, length, coachClass, coachNumber, open, amenities
            }));
        });

        // Automatische Auslagerung von Loks, wenn gemischt
        const hasLoco = groupData.coaches.some(c => c.type === 'locomotive');
        const hasOthers = groupData.coaches.some(c => c.type !== 'locomotive');
        
        if (hasLoco && hasOthers) {
            hasSplitAny = true;
            let currentSplitGroup = { ...groupData, coaches: [] };

            groupData.coaches.forEach(c => {
                if (c.type === 'locomotive') {
                    if (currentSplitGroup.coaches.length > 0) {
                        newGroups.push(new FormationGroup(currentSplitGroup));
                        currentSplitGroup = { ...groupData, coaches: [] };
                    }
                    newGroups.push(new FormationGroup({ ...groupData, coaches: [c] }));
                } else {
                    currentSplitGroup.coaches.push(c);
                }
            });
            if (currentSplitGroup.coaches.length > 0) {
                newGroups.push(new FormationGroup(currentSplitGroup));
            }
        } else {
            newGroups.push(new FormationGroup(groupData));
        }
    });

    journey.formation.groups = newGroups;
    if (immediate) {
        trainDisplay.updateAll();
    } else {
        debouncedUpdateAll();
    }
}

function toggleOrientation(orientation) {
    if (orientation === 'FORWARDS') return 'BACKWARDS';
    if (orientation === 'BACKWARDS') return 'FORWARDS';
    return orientation;
}

// ==========================================
// Event-Handler
// ==========================================

export function initEvents() {
    const journeyList = document.getElementById('journey_list');

    // --- Tastenkombination (Alt + M) für Debug-Meter ---
    document.addEventListener('keydown', (e) => {
        // Alt + M
        if (e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            toggleDebugMeters();
            trainDisplay.updateAll();
        }
    });

    // --- Journey-Liste rendern ---
    renderJourneyList();

    // --- Journey hinzufügen ---
    document.getElementById('add_journey_btn')?.addEventListener('click', () => {
        journeyStore.addJourney();
        renderJourneyList();
        trainDisplay.updateAll();
    });

    // --- Event Delegation auf Journey-Liste ---
    journeyList?.addEventListener('click', (e) => {
        const target = e.target.closest('[data-journey-id]');
        if (!target) return;
        const journeyId = target.dataset.journeyId;

        // Sichtbarkeit togglen
        if (target.classList.contains('visibility-toggle')) {
            const journey = journeyStore.getJourney(journeyId);
            if (journey) {
                journey.visible = !journey.visible;
                renderJourneyList();
                trainDisplay.updateAll();
            }
            return;
        }

        // Reorder (Hoch/Runter)
        if (target.classList.contains('btn-reorder-up')) {
            journeyStore.moveJourneyGroupUp(journeyId);
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }
        if (target.classList.contains('btn-reorder-down')) {
            journeyStore.moveJourneyGroupDown(journeyId);
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }

        // Details auf-/zuklappen
        if (target.classList.contains('expand-toggle') || target.classList.contains('journey-summary')) {
            expandedJourneyId = expandedJourneyId === journeyId ? null : journeyId;
            renderJourneyList();
            return;
        }

        // Löschen
        if (target.classList.contains('delete-journey-btn')) {
            journeyStore.removeJourney(journeyId);
            if (expandedJourneyId === journeyId) expandedJourneyId = null;
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }

        // Accordion Toggle für Wagenreihung
        const header = e.target.closest('.formation-accordion-toggle');
        if (header) {
            const isInputOrButton = e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.closest('.btn-icon');
            if (!isInputOrButton) {
                const groupId = header.dataset.groupId;
                if (expandedGroups.has(groupId)) {
                    expandedGroups.delete(groupId);
                } else {
                    expandedGroups.add(groupId);
                }
                renderJourneyList();
                return;
            }
        }

        // --- Inline Editors (Formation & Stops) Actions ---
        const details = e.target.closest('.journey-details');
        if (details) {
            const jId = details.dataset.journeyId;

            // --- InfoTexts Editor ---
            if (e.target.closest('.info_add_custom_btn')) {
                const journey = journeyStore.getJourney(jId);
                if (journey) {
                    journey.infoTexts.push({ id: crypto.randomUUID(), text: '', visible: true, type: 'custom' });
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            if (e.target.closest('.info_add_preset_btn')) {
                const journey = journeyStore.getJourney(jId);
                const selectEl = details.querySelector('.info-preset-select');
                if (journey && selectEl && selectEl.value) {
                    journey.infoTexts.push({ id: crypto.randomUUID(), text: selectEl.value, visible: true, type: 'Q' });
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            if (e.target.closest('.toggle-info-visible')) {
                const row = e.target.closest('.info-editor-row');
                const journey = journeyStore.getJourney(jId);
                if (row && journey) {
                    const idx = row.dataset.index;
                    journey.infoTexts[idx].visible = !journey.infoTexts[idx].visible;
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            if (e.target.closest('.remove-info-btn')) {
                e.target.closest('.info-editor-row')?.remove();
                saveInfoTextsEditor(jId);
                renderJourneyList();
                return;
            }

            if (e.target.closest('.move-info-up')) {
                const row = e.target.closest('.info-editor-row');
                if (row.previousElementSibling && row.previousElementSibling.classList.contains('info-editor-row')) {
                    row.parentNode.insertBefore(row, row.previousElementSibling);
                    saveInfoTextsEditor(jId);
                    renderJourneyList();
                }
                return;
            }

            if (e.target.closest('.move-info-down')) {
                const row = e.target.closest('.info-editor-row');
                if (row.nextElementSibling && row.nextElementSibling.classList.contains('info-editor-row')) {
                    row.parentNode.insertBefore(row.nextElementSibling, row);
                    saveInfoTextsEditor(jId);
                    renderJourneyList();
                }
                return;
            }

            // --- Stops Editor ---
            if (e.target.closest('.stops_add_btn')) {
                const journey = journeyStore.getJourney(jId);
                if (journey) {
                    journey.stops.push(new Stop({ name: "Neuer Halt" }));
                    renderJourneyList();
                }
                return;
            }

            if (e.target.closest('.stops_auto_gen_btn')) {
                const journey = journeyStore.getJourney(jId);
                if (journey) {
                    journey.autoGenerateVias(4);
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            if (e.target.closest('.stops_toggle_all_btn')) {
                const journey = journeyStore.getJourney(jId);
                if (journey) {
                    const anyVia = journey.stops.some(s => s.showAsVia);
                    journey.stops.forEach(s => {
                        if (!s.cancelled && s.boardingType !== 'ein') {
                            s.showAsVia = !anyVia;
                        } else {
                            s.showAsVia = false;
                        }
                    });
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            if (e.target.closest('.toggle-stop-via')) {
                const row = e.target.closest('.stop-editor-row');
                const journey = journeyStore.getJourney(jId);
                if (row && journey) {
                    const idx = row.dataset.index;
                    journey.stops[idx].showAsVia = !journey.stops[idx].showAsVia;
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            if (e.target.closest('.remove-stop-btn')) {
                e.target.closest('.stop-editor-row')?.remove();
                saveStopsEditor(jId);
                renderJourneyList();
                return;
            }

            if (e.target.closest('.move-stop-up')) {
                const row = e.target.closest('.stop-editor-row');
                if (row.previousElementSibling) {
                    row.parentNode.insertBefore(row, row.previousElementSibling);
                    saveStopsEditor(jId);
                    renderJourneyList();
                }
                return;
            }

            if (e.target.closest('.move-stop-down')) {
                const row = e.target.closest('.stop-editor-row');
                if (row.nextElementSibling) {
                    row.parentNode.insertBefore(row.nextElementSibling, row);
                    saveStopsEditor(jId);
                    renderJourneyList();
                }
                return;
            }

            // --- Formation Editor ---
            
            // Neue Gruppe hinzufügen
            if (e.target.closest('.formation_add_group_btn')) {
                const body = details.querySelector('.inline-formation-editor');
                const gIndex = body.querySelectorAll('.formation-group-editor').length;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = renderFormationGroup(new FormationGroup(), gIndex, jId);
                body.appendChild(tempDiv.firstElementChild);
                expandedGroups.add(`${jId}_${gIndex}`);
                saveInlineFormation(jId);
                return;
            }

            // Ganzen Zug drehen
            if (e.target.closest('.formation_reverse_btn')) {
                saveInlineFormation(jId); // Vorher speichern
                const journey = journeyStore.getJourney(jId);
                if (journey && journey.formation.groups) {
                    journey.formation.groups.reverse();
                    journey.formation.groups.forEach(group => {
                        if (group.coaches) {
                            group.coaches.reverse();
                            group.coaches.forEach(c => {
                                c.orientation = toggleOrientation(c.orientation);
                            });
                        }
                    });
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            // Einzelne Gruppe drehen
            if (e.target.closest('.reverse-group-btn')) {
                saveInlineFormation(jId); // Vorher speichern
                const journey = journeyStore.getJourney(jId);
                const groupEditor = e.target.closest('.formation-group-editor');
                const gIndex = Array.from(groupEditor.parentNode.children).indexOf(groupEditor);
                if (journey && journey.formation.groups[gIndex]) {
                    const group = journey.formation.groups[gIndex];
                    if (group.coaches) {
                        group.coaches.reverse();
                        group.coaches.forEach(c => {
                            c.orientation = toggleOrientation(c.orientation);
                        });
                    }
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
                return;
            }

            // Wagen löschen
            if (e.target.closest('.remove-coach-btn')) {
                e.target.closest('.coach-editor-row')?.remove();
                saveInlineFormation(jId);
                return;
            }

            // Gruppe löschen
            if (e.target.closest('.delete-group-btn')) {
                e.target.closest('.formation-group-editor')?.remove();
                saveInlineFormation(jId);
                return;
            }

            // Wagen hinzufügen
            if (e.target.closest('.add-coach-btn')) {
                const btn = e.target.closest('.add-coach-btn');
                const groupEditor = btn.closest('.formation-group-editor');
                const list = groupEditor.querySelector('.coach-editor-list');
                const gIndex = groupEditor.dataset.groupIndex;
                const cIndex = list.querySelectorAll('.coach-editor-row').length;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = renderCoachRow(new Coach(), cIndex, gIndex);
                list.appendChild(tempDiv.firstElementChild);
                expandedGroups.add(`${jId}_${gIndex}`); // Sicherstellen, dass aufgeklappt ist
                saveInlineFormation(jId);
                renderJourneyList(); // Render, damit es aufklappt
                return;
            }

            // Coach verschieben (Up)
            if (e.target.closest('.move-coach-up')) {
                const row = e.target.closest('.coach-editor-row');
                if (row.previousElementSibling) {
                    row.parentNode.insertBefore(row, row.previousElementSibling);
                    saveInlineFormation(jId);
                }
                return;
            }

            // Coach verschieben (Down)
            if (e.target.closest('.move-coach-down')) {
                const row = e.target.closest('.coach-editor-row');
                if (row.nextElementSibling) {
                    row.parentNode.insertBefore(row.nextElementSibling, row);
                    saveInlineFormation(jId);
                }
                return;
            }

            // Gruppe verschieben (Up)
            if (e.target.closest('.move-group-up')) {
                const groupEditor = e.target.closest('.formation-group-editor');
                if (groupEditor.previousElementSibling) {
                    groupEditor.parentNode.insertBefore(groupEditor, groupEditor.previousElementSibling);
                    saveInlineFormation(jId);
                }
                return;
            }

            // Gruppe verschieben (Down)
            if (e.target.closest('.move-group-down')) {
                const groupEditor = e.target.closest('.formation-group-editor');
                if (groupEditor.nextElementSibling) {
                    groupEditor.parentNode.insertBefore(groupEditor.nextElementSibling, groupEditor);
                    saveInlineFormation(jId);
                }
                return;
            }

            // Export Gruppe
            if (e.target.closest('.export-group-btn')) {
                const groupEditor = e.target.closest('.formation-group-editor');
                saveInlineFormation(jId);
                const journey = journeyStore.getJourney(jId);
                const gIndex = Array.from(groupEditor.parentNode.children).indexOf(groupEditor);
                const group = journey.formation.groups[gIndex];
                if (group) {
                    const blob = new Blob([JSON.stringify(group, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `group_${group.trainNumber || 'export'}.json`;
                    a.click();
                }
                return;
            }

            // Export Ganze Formation
            if (e.target.closest('.formation_export_btn')) {
                saveInlineFormation(jId);
                const journey = journeyStore.getJourney(jId);
                const blob = new Blob([JSON.stringify(journey.formation.groups, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `formation_${journey.effectiveDisplayName.replace(/\s/g, '_')}.json`;
                a.click();
                return;
            }

            // Import Ganze Formation
            if (e.target.closest('.formation_import_btn')) {
                editingFormationJourneyId = jId; // Zustand für FileReader
                document.getElementById('formation-file-input')?.click();
                return;
            }
        }

        // Autocomplete Auswahl für Stops
        if (e.target.tagName === 'LI' && e.target.closest('.stop-autocomplete-list')) {
            const li = e.target;
            const row = li.closest('.stop-editor-row');
            if (row && target) {
                const nameInput = row.querySelector('[data-prop="name"]');
                const kurzInput = row.querySelector('[data-prop="nameKurz"]');
                
                nameInput.value = li.dataset.name;
                kurzInput.value = li.dataset.kurz;
                
                const catInput = row.querySelector('[data-prop="stationCategory"]');
                if (catInput) catInput.value = li.dataset.kategorie !== '99' ? li.dataset.kategorie : '';
                
                // Schließen und speichern
                li.closest('.stop-autocomplete-list').style.display = 'none';
                saveStopsEditor(target.dataset.journeyId, true);
            }
            return;
        }

        // Koppeln/Entkoppeln
        if (target.classList.contains('couple-btn')) {
            const journey = journeyStore.getJourney(journeyId);
            if (!journey) return;
            if (journey.couplingGroupId) {
                journeyStore.uncoupleJourney(journeyId);
            } else {
                // Finde die nächste Journey und koppele damit
                const idx = journeyStore.journeys.findIndex(j => j.id === journeyId);
                const next = journeyStore.journeys[idx + 1];
                if (next) {
                    journeyStore.coupleJourneys(journeyId, next.id);
                }
            }
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }
    });

    // --- Feld-Änderungen in Details ---
    journeyList?.addEventListener('input', (e) => {
        const details = e.target.closest('.journey-details');
        if (!details) return;
        const journeyId = details.dataset.journeyId;
        const journey = journeyStore.getJourney(journeyId);
        if (!journey) return;

        // Text/Number-Felder in Journey-Details
        if (e.target.classList.contains('jfield') && !e.target.classList.contains('info-text-input')) {
            const field = e.target.dataset.field;
            if (field) {
                if (field === 'startMeter') {
                    journey[field] = parseFloat(e.target.value) || 0;
                } else if (field === 'scaleFactor') {
                    journey[field] = parseFloat(e.target.value) || 1.0;
                    journey.skalieren = false;
                    const skCheckbox = details.querySelector('.jcheck[data-field="skalieren"]');
                    if (skCheckbox) skCheckbox.checked = false;
                } else {
                    journey[field] = e.target.value;
                    // Wenn der Name bearbeitet wird, auch den Override aktualisieren
                    if (field === 'name') {
                        journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
                        // Optional: Das UI-Feld für displayNameOverride direkt mit aktualisieren, 
                        // falls es offen ist
                        const overrideInput = details.querySelector('.jfield[data-field="displayNameOverride"]');
                        if (overrideInput) overrideInput.value = journey.displayNameOverride;
                    }
                }
                debouncedUpdateAll();
            }
        }

        // Auto-Save für Info-Texte
        if (e.target.classList.contains('info-text-input')) {
            saveInfoTextsEditor(journeyId, false);
        }

        // Auto-Save für Stops-Eingaben
        if (e.target.classList.contains('s-prop')) {
            saveStopsEditor(journeyId, false);

            if (e.target.classList.contains('station-name-input')) {
                const query = e.target.value;
                const ul = e.target.nextElementSibling;
                if (query.length >= 2) {
                    const results = StationService.searchStations(query, 10);
                    ul.innerHTML = results.map(r => `<li data-name="${r.name}" data-kurz="${r.nameKurz}" data-ibnr="${r.ibnr}" data-kategorie="${r.kategorie}">${r.name} (${r.kategorie})</li>`).join('');
                    ul.style.display = results.length > 0 ? 'block' : 'none';
                } else {
                    ul.style.display = 'none';
                }
            }
        }

        // Auto-Save für Formation-Eingaben
        if (e.target.classList.contains('f-prop')) {
            saveInlineFormation(journeyId, false);
        }
    });

    journeyList?.addEventListener('change', (e) => {
        const details = e.target.closest('.journey-details');
        if (!details) return;
        const journeyId = details.dataset.journeyId;
        const journey = journeyStore.getJourney(journeyId);
        if (!journey) return;

        // Checkboxen
        if (e.target.classList.contains('jcheck')) {
            journey[e.target.dataset.field] = e.target.checked;
            trainDisplay.updateAll();
            renderJourneyList(); // Badges aktualisieren
        }

        // Selects mit .jfield (z.B. delayReason)
        if (e.target.tagName === 'SELECT' && e.target.classList.contains('jfield')) {
            const field = e.target.dataset.field;
            if (field) {
                journey[field] = e.target.value;
                trainDisplay.updateAll();
            }
        }

        // Auto-Save für Checkboxen der Formation (z.B. Offen, Amenities)
        if (e.target.classList.contains('f-prop') && e.target.type === 'checkbox') {
            saveInlineFormation(journeyId);
        }

        // Radio-Buttons (Richtung)
        if (e.target.classList.contains('jradio')) {
            journey[e.target.dataset.field] = parseInt(e.target.value);
            trainDisplay.updateAll();
        }

        // Auto-Save für Selects (Dropdowns) der Formation (Lok/Mittelwagen, Klasse)
        if (e.target.classList.contains('f-prop') && e.target.tagName === 'SELECT') {
            saveInlineFormation(journeyId);
        }
    });

    // Die alten Modal-Event-Listener für Wagenreihung wurden entfernt, 
    // da alles per Delegation in der Journey-Liste abgehandelt wird.

    document.getElementById('formation-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                // "data" is expected to be an array of exported groups
                const groupsArray = Array.isArray(data) ? data : (data.groups || [data]);
                
                const journey = journeyStore.getJourney(editingFormationJourneyId);
                if (!journey) return;
                
                journey.formation.groups = groupsArray.map(g => new FormationGroup(g));
                
                // Modal neu aufbauen mit den neuen Gruppen
                showFormationEditor(editingFormationJourneyId);
                trainDisplay.updateAll();
                
            } catch (err) {
                console.error('Formation import error:', err);
                alert('Fehler beim Importieren: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // --- Modal schließen ---
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.closeModal;
            document.getElementById(modalId)?.classList.add('hidden');
        });
    });

    // --- Wagenreihungs-Feature-Auswahl ---
    document.querySelectorAll('input[name="wahl"]').forEach(radio => {
        radio.addEventListener('change', () => {
            trainDisplay.onFeatureButtonChange(radio.value);
        });
    });

    // --- Layout-Auswahl ---
    document.querySelectorAll('input[name="layout_select"]').forEach(radio => {
        radio.addEventListener('change', () => {
            trainDisplay.switchLayout(radio.value);
        });
    });

    // --- Performance Modus ---
    const perfCheckbox = document.getElementById('performance_mode_checkbox');
    if (perfCheckbox) {
        perfCheckbox.checked = config.performance_mode;
        perfCheckbox.addEventListener('change', (e) => {
            config.performance_mode = e.target.checked;
            localStorage.setItem('zimsim_performance_mode', e.target.checked);
        });
    }

    // --- Bahnhof/Station ---
    const searchInput = document.getElementById('entry_station_search');
    const autocompleteList = document.getElementById('station_autocomplete_list');
    let selectedIndex = -1;

    if (searchInput && autocompleteList) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            const results = StationService.searchStations(query, 50);
            
            autocompleteList.innerHTML = '';
            selectedIndex = -1;

            if (results.length === 0 || query.length < 2) {
                autocompleteList.classList.remove('active');
                return;
            }

            results.forEach((station, index) => {
                const li = document.createElement('li');
                li.className = 'autocomplete-item';
                
                const ds100Str = station.ds100 ? `[${station.ds100}]` : '';
                
                li.innerHTML = `
                    <div class="autocomplete-item-title">${station.name} ${ds100Str}</div>
                    <div class="autocomplete-item-details">${station.nameKurz} ${station.ibnr} Kat.: ${station.kategorie}</div>
                `;
                
                li.addEventListener('click', () => {
                    selectStation(station);
                });
                
                autocompleteList.appendChild(li);
            });
            
            autocompleteList.classList.add('active');
        });

        searchInput.addEventListener('keydown', (e) => {
            const items = autocompleteList.querySelectorAll('.autocomplete-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                updateSelection(items);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            } else if (e.key === 'Escape') {
                autocompleteList.classList.remove('active');
            }
        });

        function updateSelection(items) {
            items.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.classList.add('selected');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        function selectStation(station) {
            const ds100Str = station.ds100 ? `[${station.ds100}] ` : '';
            searchInput.value = `${station.name} ${ds100Str}${station.ibnr}`;
            autocompleteList.classList.remove('active');

            journeyStore.stationContext.stationName = station.name;
            journeyStore.stationContext.stationId = station.ibnr;
            
            journeyStore.journeys.forEach(j => {
                if (j.stops.length > 0) {
                    j.syncFromCurrentStop(station.ibnr);
                }
            });
            renderJourneyList();
            trainDisplay.updateAll();
        }

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !autocompleteList.contains(e.target)) {
                autocompleteList.classList.remove('active');
            }
        });
    }

    document.getElementById('btn_api_station_search')?.addEventListener('click', () => {
        alert("API-Suche wird in einem späteren Schritt implementiert.");
    });

    // --- Gleis (Track) Filter Events ---
    document.getElementById('btn_invert_tracks')?.addEventListener('click', (e) => {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.track_dep');
        if (checkboxes.length === 0) return;
        
        let allUnchecked = true;
        checkboxes.forEach(cb => {
            cb.checked = !cb.checked;
            if (cb.checked) allUnchecked = false;
        });
        
        const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
        if (allUnchecked || selected.length === checkboxes.length) {
            journeyStore.activeTracks = [];
        } else {
            journeyStore.activeTracks = selected;
        }
        
        // UI aktualisieren (Summary und Listen)
        const summary = document.getElementById('track_summary');
        if (summary) {
            if (journeyStore.activeTracks.length === 0 || journeyStore.activeTracks.length === checkboxes.length) {
                summary.innerText = "Gleise: Alle";
            } else {
                summary.innerText = "Gleise: " + journeyStore.activeTracks.join(', ');
            }
        }
        
        renderJourneyList();
        trainDisplay.updateAll();
    });

    document.getElementById('btn_add_manual_track')?.addEventListener('click', (e) => {
        e.preventDefault();
        const input = document.getElementById('manual_track_input');
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            manualTracks.add(val);
            input.value = '';
            renderTrackFilter();
        }
    });

    document.getElementById('manual_track_input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btn_add_manual_track')?.click();
        }
    });

    // --- Verkehrsmittel (MOT) Filter ---
    const motCheckboxes = document.querySelectorAll('.mot_dep');
    const motSummary = document.getElementById('mot_summary');
    const motPresetBtns = document.querySelectorAll('.mot-preset-btn');

    function updateMotSummary() {
        if (!motSummary || motCheckboxes.length === 0) return;
        const selected = Array.from(motCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        motSummary.innerText = getSmartHeaderString(selected);
        
        // Live Filter Trigger
        journeyStore.activeMots = selected;
        renderJourneyList();
        trainDisplay.updateAll();
    }

    motCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateMotSummary);
    });

    motPresetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const preset = btn.dataset.preset;
            const valuesToSelect = MOT_PRESETS[preset] || [];
            
            motCheckboxes.forEach(cb => {
                cb.checked = valuesToSelect.includes(cb.value);
            });
            
            updateMotSummary();
        });
    });

    // Initiale Zuweisung, ohne UpdateAll (passiert ohnehin in main.js)
    if (motCheckboxes.length > 0) {
        journeyStore.activeMots = Array.from(motCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        if (motSummary) motSummary.innerText = getSmartHeaderString(journeyStore.activeMots);
    }

    // --- Bahnsteig Längen ---
    document.getElementById('platform_length')?.addEventListener('input', (e) => {
        journeyStore.stationContext.platform.length = parseInt(e.target.value) || 420;
        trainDisplay.updateAll();
    });

    document.getElementById('platform_location')?.addEventListener('input', (e) => {
        journeyStore.stationContext.platform.currentLocation = parseInt(e.target.value) || 0;
        trainDisplay.updateAll();
    });

    // --- NRW-Modus ---
    document.getElementById('nrw_mode_checkbox')?.addEventListener('change', (e) => {
        journeyStore.nrwMode = e.target.checked;
        // Alle Overrides neu berechnen
        journeyStore.journeys.forEach(journey => {
            journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
        });
        renderJourneyList();
        trainDisplay.updateAll();
    });

    // --- Zeit-Einstellungen ---
    const customTimeInput = document.getElementById('custom_time_input');
    const autoUpdateTimeCheckbox = document.getElementById('auto_update_time_checkbox');
    const setCurrentTimeBtn = document.getElementById('set_current_time_btn');

    function updateTimeInputFromState() {
        if (!customTimeInput || document.activeElement === customTimeInput) return;
        const simTime = getSimulatedTime();
        // Format to YYYY-MM-DDTHH:mm:ss for datetime-local
        const offset = simTime.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(simTime - offset)).toISOString().slice(0, 19);
        customTimeInput.value = localISOTime;
    }

    if (customTimeInput) {
        customTimeInput.addEventListener('change', (e) => {
            const date = new Date(e.target.value);
            if (!isNaN(date.getTime())) {
                setSimulatedTime(date);
            }
        });
    }

    if (autoUpdateTimeCheckbox) {
        autoUpdateTimeCheckbox.addEventListener('change', (e) => {
            // By setting the time to the *current simulated time*, we effectively
            // freeze it at this exact moment if pausing, or resume it from this moment if unpausing.
            setSimulatedTime(getSimulatedTime(), e.target.checked);
        });
    }

    if (setCurrentTimeBtn) {
        setCurrentTimeBtn.addEventListener('click', () => {
            setSimulatedTime(new Date());
            updateTimeInputFromState();
        });
    }
    
    // Timer to update the input field visually if time is running
    setInterval(() => {
        if (timeConfig.isRunning) {
            updateTimeInputFromState();
        }
    }, 1000);
    // Initial update
    updateTimeInputFromState();

    // --- Screenshot ---
    document.getElementById('download-btn')?.addEventListener('click', () => {
        const container = document.getElementById('display-container');
        if (!container) return;
        html2canvas(container, { useCORS: true, scale: 1, backgroundColor: null }).then(canvas => {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'ZIMSim_screenshot.png';
            a.click();
        });
    });

    // --- Export ---
    document.getElementById('export_all_btn')?.addEventListener('click', () => {
        const data = journeyStore.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'zimsim_export.json';
        a.click();
    });

    // --- Import (eigenes Format) ---
    document.getElementById('import_all_btn')?.addEventListener('click', () => {
        document.getElementById('file-input')?.click();
    });

    document.getElementById('file-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                journeyStore.importAll(data);
                renderJourneyList();
                trainDisplay.updateAll();
            } catch (err) {
                console.error('Import error:', err);
                alert('Fehler beim Importieren: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // --- DB-Import Modal ---
    document.getElementById('import_db_btn')?.addEventListener('click', () => {
        document.getElementById('db_import_modal')?.classList.remove('hidden');
    });

    document.querySelectorAll('input[name="import_type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const hint = document.getElementById('import_type_hint');
            if (!hint) return;
            const hints = {
                'departure_list': 'Füge das JSON einer DB-Abfahrtstafel ein (entries[]-Array).',
                'journey': 'Füge das JSON eines DB-Zuglaufs ein (halte[]-Array).',
                'formation': 'Füge das JSON einer DB-Wagenreihung ein (groups[]-Array). Wähle anschließend die Fahrt, der sie zugewiesen werden soll.'
            };
            hint.textContent = hints[radio.value] || '';
        });
    });

    document.getElementById('db_import_execute')?.addEventListener('click', () => {
        const type = document.querySelector('input[name="import_type"]:checked')?.value;
        const text = document.getElementById('db_import_textarea')?.value;
        if (!text) return;

        try {
            const data = JSON.parse(text);

            if (type === 'departure_list') {
                journeyStore.importFromDepartureList(data);
                journeyStore.journeys.forEach(journey => {
                    journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
                });
            } else if (type === 'journey') {
                journeyStore.importFromJourney(data);
                journeyStore.journeys.forEach(journey => {
                    journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
                });
            } else if (type === 'formation') {
                // Formation einer bestehenden Journey zuweisen
                const visible = journeyStore.getVisibleJourneys();
                if (visible.length > 0) {
                    const groupsArray = Array.isArray(data) ? data : (data.groups || []);
                    visible[0].formation.groups = groupsArray.map(g => new FormationGroup(g));
                } else {
                    alert('Erstelle zuerst eine Fahrt, der die Formation zugewiesen werden soll.');
                    return;
                }
            }

            renderJourneyList();
            trainDisplay.updateAll();
            document.getElementById('db_import_modal')?.classList.add('hidden');
            document.getElementById('db_import_textarea').value = '';
        } catch (err) {
            console.error('DB Import error:', err);
            alert('Fehler beim Importieren: ' + err.message);
        }
    });

    // --- Drag & Drop im Formation-Editor ---
    let dragSrcElement = null;
    let dragType = null; // 'coach' or 'group'
    let dragJourneyId = null;

    journeyList?.addEventListener('dragstart', (e) => {
        const coachRow = e.target.closest('.coach-editor-row');
        const groupEditor = e.target.closest('.formation-group-editor');

        if (coachRow && (e.target === coachRow || coachRow.contains(e.target))) {
            const groupHeader = e.target.closest('.group-editor-header');
            if (!groupHeader) {
                dragSrcElement = coachRow;
                dragType = 'coach';
                dragJourneyId = coachRow.closest('.journey-details')?.dataset.journeyId;
                coachRow.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
                return;
            }
        }
        if (groupEditor) {
            dragSrcElement = groupEditor;
            dragType = 'group';
            dragJourneyId = groupEditor.closest('.journey-details')?.dataset.journeyId;
            groupEditor.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            return;
        }

        const journeyRow = e.target.closest('.journey-row');
        if (journeyRow && !coachRow && !groupEditor) {
            dragSrcElement = journeyRow;
            dragType = 'journey';
            dragJourneyId = journeyRow.dataset.journeyId;
            journeyRow.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragJourneyId);
        }
    });

    journeyList?.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragSrcElement || !dragJourneyId) return;

        const details = e.target.closest('.journey-details');
        if (!details || details.dataset.journeyId !== dragJourneyId) {
            // Drop nur innerhalb der gleichen Journey erlauben
            return;
        }

        if (dragType === 'coach') {
            const row = e.target.closest('.coach-editor-row');
            const groupList = e.target.closest('.coach-editor-list');

            if (row && row !== dragSrcElement) {
                const rect = row.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                if (after) {
                    row.parentNode.insertBefore(dragSrcElement, row.nextSibling);
                } else {
                    row.parentNode.insertBefore(dragSrcElement, row);
                }
            } else if (groupList && groupList !== dragSrcElement.parentNode && groupList.children.length === 0) {
                groupList.appendChild(dragSrcElement);
            }
        } else if (dragType === 'group') {
            const row = e.target.closest('.formation-group-editor');
            if (row && row !== dragSrcElement) {
                const rect = row.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                if (after) {
                    row.parentNode.insertBefore(dragSrcElement, row.nextSibling);
                } else {
                    row.parentNode.insertBefore(dragSrcElement, row);
                }
            }
        } else if (dragType === 'journey') {
            e.preventDefault(); // allow drop
            const row = e.target.closest('.journey-row');
            if (row && row !== dragSrcElement) {
                const rect = row.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                
                document.querySelectorAll('.journey-row').forEach(r => {
                    r.classList.remove('drag-over-top', 'drag-over-bottom');
                });
                
                const targetJourneyId = row.dataset.journeyId;
                const bounds = journeyStore.getJourneyBlockBounds(targetJourneyId);
                if (bounds) {
                    if (after) {
                        const endRow = journeyList.children[bounds.endIndex];
                        if (endRow) endRow.classList.add('drag-over-bottom');
                    } else {
                        const startRow = journeyList.children[bounds.startIndex];
                        if (startRow) startRow.classList.add('drag-over-top');
                    }
                }
            }
        }
    });

    journeyList?.addEventListener('drop', (e) => {
        if (dragType === 'journey') {
            e.preventDefault();
            const row = e.target.closest('.journey-row');
            if (row && dragJourneyId) {
                const targetJourneyId = row.dataset.journeyId;
                const bounds = journeyStore.getJourneyBlockBounds(targetJourneyId);
                if (bounds) {
                    const rect = row.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    let targetIndex = after ? bounds.endIndex + 1 : bounds.startIndex;
                    journeyStore.moveJourneyGroupToIndex(dragJourneyId, targetIndex);
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
            }
            dragSrcElement = null;
            dragType = null;
            dragJourneyId = null;
            document.querySelectorAll('.journey-row').forEach(r => {
                r.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        }
    });

    journeyList?.addEventListener('dragend', () => {
        if (dragType === 'journey') {
            if (dragSrcElement) dragSrcElement.classList.remove('dragging');
            document.querySelectorAll('.journey-row').forEach(r => {
                r.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        } else if (dragSrcElement) {
            dragSrcElement.classList.remove('dragging');
            if (dragJourneyId) {
                saveInlineFormation(dragJourneyId);
            }
        }
        dragSrcElement = null;
        dragType = null;
        dragJourneyId = null;
    });

    // --- Window Resize (Skalierung) ---
    window.addEventListener('resize', () => {
        const canvas = document.getElementById('zimCanvas');
        const container = document.getElementById('display-container');
        if (!canvas || !container) return;

        const layoutWidth = trainDisplay.currentLayout.width;
        const layoutHeight = trainDisplay.currentLayout.height;
        const containerWidth = container.clientWidth;
        if (containerWidth === 0) return; // Container noch nicht gerendert

        const scale = containerWidth / layoutWidth;
        const scaledHeight = layoutHeight * scale;

        canvas.style.transform = `scale(${scale})`;
        canvas.style.transformOrigin = 'top left';
        container.style.height = `${scaledHeight}px`;

        // Bezel wird nicht mehr mit Bild bestückt — das Hintergrundbild
        // wird ausschließlich via drawFullBackground() auf dem Canvas gezeichnet.
        // Die Bezel-Div bleibt transparent (nur für zukünftige Overlays nutzbar).
    });

    // Initiale Skalierung
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
}