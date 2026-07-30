// js/ui/editorView.js
import { uiState } from './uiState.js';
import { RisTextService } from '../utils/risTextService.js';
import { FormationGroup } from '../models/formation.js';
import { Coach } from '../models/coach.js';

export function renderInlineFormation(journey) {
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

export function renderFormationGroup(group, gIndex, journeyId) {
    let coachesHtml = '';
    group.coaches.forEach((coach, i) => {
        coachesHtml += renderCoachRow(coach, i, gIndex);
    });

    const groupId = `${journeyId}_${gIndex}`;
    const isExpanded = uiState.expandedGroups.has(groupId);
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

export function renderCoachRow(coach, index, gIndex = 0) {
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
            <input type="text" class="f-prop" data-prop="wagonIdentificationNumber" value="${coach.wagonIdentificationNumber || ''}" style="width:50px" placeholder="Nr" title="Wagennummer">
            <div class="amenity-checks">${amenityChecks}</div>
            <label title="Offen"><input type="checkbox" class="f-prop" data-prop="open" ${coach.open ? 'checked' : ''}> ✓</label>
            <button class="btn-icon remove-coach-btn" title="Wagen entfernen">✕</button>
        </div>
    `;
}

export function renderInfoTextsEditor(journey) {
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

export function renderInfoTextRow(info, index, journeyId) {
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

export function renderDelayReasonOptions(selectedReason) {
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

export function renderStopsEditor(journey) {
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

export function renderStopRow(stop, index, journeyId, isCurrent) {
    const arr = stop.arrivalTime || '';
    const dep = stop.departureTime || '';
    const cancelledStyle = stop.cancelled ? 'opacity: 0.5; text-decoration: line-through;' : '';
    const currentStyle = isCurrent ? 'border-left: 3px solid #ff6b6b;' : '';
    const viaIcon = stop.showAsVia ? '👁️' : '○';
    const viaTitle = stop.showAsVia ? 'Als Via markiert' : 'Nicht als Via markiert';

    return `
        <div class="stop-editor-row" data-index="${index}" draggable="true" style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px; padding: 5px; background: var(--bg-input); border-radius: 5px; border: 1px solid var(--border); ${cancelledStyle} ${currentStyle}">
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

export function showFormationEditor(journeyId, journeyStore) {
    const journey = journeyStore.getJourney(journeyId);
    if (!journey) return;

    uiState.editingFormationJourneyId = journeyId;

    if (journey.formation.groups.length === 0) {
        journey.formation.groups.push(new FormationGroup({
            transport: { category: '', destination: { name: journey.destination }, number: journey.name }
        }));
    }

    const modal = document.getElementById('formation_modal');
    const title = document.getElementById('formation_modal_title');
    const body = document.getElementById('formation_editor_body');

    if(title) title.textContent = `Wagenreihung: ${journey.effectiveDisplayName}`;

    let html = '';
    journey.formation.groups.forEach((group, gIndex) => {
        html += renderFormationGroup(group, gIndex, journeyId);
    });

    if(body) body.innerHTML = html;
    if(modal) modal.classList.remove('hidden');
}
