// js/events.js
// Komplett neue UI-Logik für die dynamische Journey-Liste
import { journeyStore, trainDisplay } from './main.js';
import { Journey } from './models/journey.js';
import { Formation, FormationGroup } from './models/formation.js';
import { Coach } from './models/coach.js';
import { config } from './utils/config.js';
import { toggleDebugMeters } from './displays/formationRenderer.js';

// Aktuell aufgeklappte Journey-ID (oder null)
let expandedJourneyId = null;
// Aktuell im Formation-Editor bearbeitete Journey-ID + Group-Index
let editingFormationJourneyId = null;
let editingFormationGroupIndex = 0;

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

        html += `
            <div class="journey-row ${cancelledClass}" data-journey-id="${journey.id}">
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
                        <span class="journey-platform">${journey.platform ? 'Gl. ' + journey.platform : ''}</span>
                        <button class="btn-icon expand-toggle" data-journey-id="${journey.id}">${isExpanded ? '▾' : '▸'}</button>
                    </div>
                    ${isExpanded ? renderJourneyDetails(journey) : ''}
                </div>
            </div>
        `;

        lastCouplingGroupId = journey.couplingGroupId;
    });

    container.innerHTML = html;
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
                        <label>Kategorie: <input type="text" class="jfield short-input" data-field="category" value="${journey.category}"></label>
                        <label>Linie: <input type="text" class="jfield short-input" data-field="line" value="${journey.line}"></label>
                        <label>Nummer: <input type="text" class="jfield short-input" data-field="number" value="${journey.number}"></label>
                    </div>
                    <div class="detail-row">
                        <label>Anzeigename (Override): <input type="text" class="jfield" data-field="displayNameOverride" value="${journey.displayNameOverride}" placeholder="${journey.displayName || 'auto'}"></label>
                    </div>
                    <div class="detail-row">
                        <label>Ziel: <input type="text" class="jfield" data-field="destination" value="${journey.destination}"></label>
                    </div>
                    <div class="detail-row">
                        <label>Abfahrt/Ankunft: <input type="text" class="jfield short-input" data-field="scheduledTime" value="${journey.scheduledTime}"></label>
                        <label>Echtzeit: <input type="text" class="jfield short-input" data-field="expectedTime" value="${journey.expectedTime}"></label>
                        <label>Gleis: <input type="text" class="jfield short-input" data-field="platform" value="${journey.platform}"></label>
                    </div>
                    <div class="detail-row">
                        <label>Via 1: <input type="text" class="jfield via-field" data-field="via0" value="${journey.vias[0] || ''}"></label>
                        <label>Via 2: <input type="text" class="jfield via-field" data-field="via1" value="${journey.vias[1] || ''}"></label>
                        <label>Via 3: <input type="text" class="jfield via-field" data-field="via2" value="${journey.vias[2] || ''}"></label>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Anzeige</h4>
                    <div class="detail-row">
                        <label>Lauftext: <input type="text" class="jfield" data-field="scrollText" value="${journey.scrollText}"></label>
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
                        <label>Gleiswechsel: <input type="text" class="jfield short-input" data-field="gleiswechsel" value="${journey.gleiswechsel}"></label>
                        <label>Verkehrt ab: <input type="text" class="jfield short-input" data-field="verkehrtAb" value="${journey.verkehrtAb}"></label>
                    </div>
                </div>
            </div>
            <div class="details-actions">
                <button class="btn-secondary edit-formation-btn" data-journey-id="${journey.id}">✏️ Wagenreihung</button>
                <button class="btn-secondary couple-btn" data-journey-id="${journey.id}">${journey.couplingGroupId ? '🔗 Entkoppeln' : '🔗 Koppeln'}</button>
                <button class="btn-danger delete-journey-btn" data-journey-id="${journey.id}">🗑️ Löschen</button>
            </div>
            ${journey.stops.length > 0 ? renderStopsList(journey) : ''}
        </div>
    `;
}

/**
 * Rendert die Halteliste einer Journey (wenn Stops vorhanden).
 */
function renderStopsList(journey) {
    let rows = journey.stops.map((stop, i) => {
        const isCurrent = i === journey._currentStopIndex;
        const cancelledClass = stop.cancelled ? 'stop-cancelled' : '';
        const currentClass = isCurrent ? 'stop-current' : '';
        const dep = stop.departureTime || '';
        const arr = stop.arrivalTime || '';
        return `<tr class="${cancelledClass} ${currentClass}">
            <td>${stop.name}</td><td>${arr}</td><td>${dep}</td><td>${stop.platform}</td>
            ${stop.cancelled ? '<td>⛔</td>' : '<td></td>'}
        </tr>`;
    }).join('');

    return `
        <div class="stops-section">
            <h4>Halte (${journey.stops.length})</h4>
            <table class="stops-table"><thead><tr><th>Halt</th><th>An</th><th>Ab</th><th>Gl</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table>
        </div>
    `;
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
            transport: { category: journey.category, destination: { name: journey.destination }, number: journey.number }
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

function renderFormationGroup(group, gIndex) {
    let coachesHtml = '';
    group.coaches.forEach((coach, i) => {
        coachesHtml += renderCoachRow(coach, i, gIndex);
    });

    return `
        <div class="formation-group-editor" data-group-index="${gIndex}" style="border: 1px solid #444; margin-bottom: 15px; padding: 10px; border-radius: 5px; background: rgba(0,0,0,0.2);" draggable="true">
            <div class="group-editor-header" style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px; cursor: move;">
                <span class="group-drag-handle" title="Gruppe verschieben" style="font-size: 20px;">⠿</span>
                <strong>Zugteil</strong>
                <input type="text" class="group-prop" data-prop="category" placeholder="ICE" value="${group.transport.category || ''}" title="Kategorie (z.B. ICE)" style="width:50px">
                <input type="text" class="group-prop" data-prop="number" placeholder="2310" value="${group.transport.number || ''}" title="Zugnummer" style="width:70px">
                <input type="text" class="group-prop" data-prop="destination" placeholder="Ziel" value="${group.transport.destination?.name || ''}" title="Ziel" style="flex-grow:1">
                <input type="text" class="group-prop" data-prop="name" placeholder="Name/Triebzug" value="${group.name || ''}" title="Name/Triebzug" style="width:120px">
                
                <button class="btn-icon move-group-up" title="Nach oben">⬆️</button>
                <button class="btn-icon move-group-down" title="Nach unten">⬇️</button>
                <button class="btn-icon export-group-btn" title="Gruppe exportieren">📤</button>
                <button class="btn-secondary add-coach-btn" data-group-index="${gIndex}">+ Wagen</button>
                <button class="btn-danger delete-group-btn" title="Gruppe löschen">🗑️</button>
            </div>
            <div class="coach-editor-list" data-group-index="${gIndex}" style="min-height: 50px;">
                ${coachesHtml}
            </div>
        </div>
    `;
}

function renderCoachRow(coach, index, gIndex = 0) {
    const amenityTypes = ['f', 'r', 'g', 'm'];
    const amenityLabels = { f: '🚲', r: '♿', g: '🍽️', m: '📦' };
    const amenityChecks = amenityTypes.map(a =>
        `<label title="${a}"><input type="checkbox" class="amenity-check" data-amenity="${a}" ${coach.hasAmenity(a) ? 'checked' : ''}> ${amenityLabels[a]}</label>`
    ).join('');

    return `
        <div class="coach-editor-row" data-index="${index}" data-group-index="${gIndex}" draggable="true">
            <span class="drag-handle" title="Drag & Drop" style="cursor: move;">⠿</span>
            <button class="btn-icon move-coach-up" title="Nach oben">⬆️</button>
            <button class="btn-icon move-coach-down" title="Nach unten">⬇️</button>
            <select data-prop="type">
                <option value="locomotive" ${coach.type === 'locomotive' ? 'selected' : ''}>Lok</option>
                <option value="control_car" ${coach.type === 'control_car' ? 'selected' : ''}>Steuerwagen</option>
                <option value="middle_car" ${coach.type === 'middle_car' ? 'selected' : ''}>Mittelwagen</option>
            </select>
            <input type="number" data-prop="length" value="${coach.length}" style="width:60px" title="Länge">
            <select data-prop="coachClass" style="width:55px">
                <option value="1" ${coach.coachClass === 1 ? 'selected' : ''}>1.</option>
                <option value="2" ${coach.coachClass === 2 ? 'selected' : ''}>2.</option>
                <option value="null" ${coach.coachClass === null ? 'selected' : ''}>—</option>
            </select>
            <input type="text" data-prop="coachNumber" value="${coach.coachNumber}" style="width:50px" placeholder="Nr" title="Wagennummer">
            <div class="amenity-checks">${amenityChecks}</div>
            <label title="Offen"><input type="checkbox" data-prop="open" ${coach.open ? 'checked' : ''}> ✓</label>
            <button class="btn-icon remove-coach-btn" title="Wagen entfernen">✕</button>
        </div>
    `;
}

function saveFormation() {
    const journey = journeyStore.getJourney(editingFormationJourneyId);
    if (!journey) return;

    const groupEditors = document.querySelectorAll('#formation_editor_body .formation-group-editor');
    const newGroups = [];
    let hasSplitAny = false;

    groupEditors.forEach(groupEditor => {
        const category = groupEditor.querySelector('[data-prop="category"]').value;
        const numberStr = groupEditor.querySelector('[data-prop="number"]').value;
        const number = numberStr ? parseInt(numberStr) : 0;
        const destination = groupEditor.querySelector('[data-prop="destination"]').value;
        const name = groupEditor.querySelector('[data-prop="name"]').value;

        const groupData = {
            name: name,
            transport: {
                category: category,
                number: number,
                destination: { name: destination }
            },
            coaches: []
        };

        const rows = groupEditor.querySelectorAll('.coach-editor-row');
        let currentSubGroupCoaches = [];
        let currentSubGroupIsLoco = null;
        let wasSplit = false;

        rows.forEach(row => {
            const type = row.querySelector('[data-prop="type"]').value;
            const length = parseFloat(row.querySelector('[data-prop="length"]').value) || 25;
            let coachClass = row.querySelector('[data-prop="coachClass"]').value;
            coachClass = coachClass === 'null' ? null : parseInt(coachClass);
            const coachNumber = row.querySelector('[data-prop="coachNumber"]').value;
            const open = row.querySelector('[data-prop="open"]').checked;

            const amenities = [];
            row.querySelectorAll('.amenity-check:checked').forEach(cb => {
                amenities.push(cb.dataset.amenity);
            });

            const coachData = new Coach({ type, length, coachClass, coachNumber, amenities, open });
            const isLoco = (type === 'locomotive');

            if (currentSubGroupIsLoco === null) {
                currentSubGroupIsLoco = isLoco;
            }

            if (isLoco !== currentSubGroupIsLoco) {
                // Typ hat gewechselt -> abspalten in neue Gruppe
                const newGroupData = JSON.parse(JSON.stringify(groupData)); // Deep Clone Transport-Daten
                newGroupData.coaches = currentSubGroupCoaches;
                newGroups.push(new FormationGroup(newGroupData));
                
                currentSubGroupCoaches = [];
                currentSubGroupIsLoco = isLoco;
                wasSplit = true;
            }

            currentSubGroupCoaches.push(coachData);
        });

        if (currentSubGroupCoaches.length > 0) {
            const newGroupData = JSON.parse(JSON.stringify(groupData));
            newGroupData.coaches = currentSubGroupCoaches;
            newGroups.push(new FormationGroup(newGroupData));
        }

        if (wasSplit) {
            hasSplitAny = true;
        }
    });

    if (hasSplitAny) {
        alert("Hinweis: Eine oder mehrere Loks wurden automatisch in eigene Zugteile separiert.");
    }

    journey.formation.groups = newGroups;
    trainDisplay.updateAll();
    document.getElementById('formation_modal').classList.add('hidden');
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

        // Formation bearbeiten
        if (target.classList.contains('edit-formation-btn')) {
            showFormationEditor(journeyId);
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

        // Text/Number-Felder
        if (e.target.classList.contains('jfield')) {
            const field = e.target.dataset.field;
            if (field.startsWith('via')) {
                const idx = parseInt(field.replace('via', ''));
                while (journey.vias.length <= idx) journey.vias.push('');
                journey.vias[idx] = e.target.value;
            } else if (field === 'startMeter') {
                journey[field] = parseFloat(e.target.value) || 0;
            } else if (field === 'scaleFactor') {
                journey[field] = parseFloat(e.target.value) || 1.0;
                journey.skalieren = false;
                const skCheckbox = details.querySelector('.jcheck[data-field="skalieren"]');
                if (skCheckbox) skCheckbox.checked = false;
            } else {
                journey[field] = e.target.value;
            }
            trainDisplay.updateAll();
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

        // Radio-Buttons (Richtung)
        if (e.target.classList.contains('jradio')) {
            journey[e.target.dataset.field] = parseInt(e.target.value);
            trainDisplay.updateAll();
        }
    });

    // --- Formation Editor Events ---
    document.getElementById('formation_save_btn')?.addEventListener('click', saveFormation);

    document.getElementById('formation_add_group_btn')?.addEventListener('click', () => {
        const body = document.getElementById('formation_editor_body');
        const gIndex = body.children.length;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderFormationGroup(new FormationGroup(), gIndex);
        body.appendChild(tempDiv.firstElementChild);
    });

    document.getElementById('formation_editor_body')?.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.closest('.remove-coach-btn')) {
            target.closest('.coach-editor-row')?.remove();
            return;
        }

        if (target.closest('.delete-group-btn')) {
            target.closest('.formation-group-editor')?.remove();
            return;
        }

        if (target.closest('.add-coach-btn')) {
            const btn = target.closest('.add-coach-btn');
            const groupEditor = btn.closest('.formation-group-editor');
            const list = groupEditor.querySelector('.coach-editor-list');
            const gIndex = groupEditor.dataset.groupIndex;
            const cIndex = list.children.length;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderCoachRow(new Coach(), cIndex, gIndex);
            list.appendChild(tempDiv.firstElementChild);
            return;
        }

        if (target.closest('.move-coach-up')) {
            const row = target.closest('.coach-editor-row');
            if (row.previousElementSibling) {
                row.parentNode.insertBefore(row, row.previousElementSibling);
            }
            return;
        }

        if (target.closest('.move-coach-down')) {
            const row = target.closest('.coach-editor-row');
            if (row.nextElementSibling) {
                row.parentNode.insertBefore(row.nextElementSibling, row);
            }
            return;
        }

        if (target.closest('.move-group-up')) {
            const groupEditor = target.closest('.formation-group-editor');
            if (groupEditor.previousElementSibling) {
                groupEditor.parentNode.insertBefore(groupEditor, groupEditor.previousElementSibling);
            }
            return;
        }

        if (target.closest('.move-group-down')) {
            const groupEditor = target.closest('.formation-group-editor');
            if (groupEditor.nextElementSibling) {
                groupEditor.parentNode.insertBefore(groupEditor.nextElementSibling, groupEditor);
            }
            return;
        }

        if (target.closest('.export-group-btn')) {
            const groupEditor = target.closest('.formation-group-editor');
            // Save temporarily to get the latest DOM state
            saveFormation(); 
            const journey = journeyStore.getJourney(editingFormationJourneyId);
            const gIndex = Array.from(groupEditor.parentNode.children).indexOf(groupEditor);
            const group = journey.formation.groups[gIndex];
            if (!group) return;
            const blob = new Blob([JSON.stringify(group.coaches, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `formation_group_${group.trainNumber || gIndex}.json`;
            a.click();
            // Modal wieder öffnen, da saveFormation es schließt
            showFormationEditor(editingFormationJourneyId);
            return;
        }
    });

    document.getElementById('formation_export_btn')?.addEventListener('click', () => {
        saveFormation();
        const journey = journeyStore.getJourney(editingFormationJourneyId);
        if (!journey) return;
        const blob = new Blob([JSON.stringify(journey.formation.groups, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `formation_${journey.effectiveDisplayName.replace(/\s/g, '_')}.json`;
        a.click();
        showFormationEditor(editingFormationJourneyId);
    });

    document.getElementById('formation_import_btn')?.addEventListener('click', () => {
        document.getElementById('formation-file-input')?.click();
    });

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

    // --- Bahnhof/Station ---
    document.getElementById('entry_stop_name')?.addEventListener('input', (e) => {
        journeyStore.stationContext.stationName = e.target.value;
    });

    document.getElementById('entry_stop_id')?.addEventListener('input', (e) => {
        journeyStore.stationContext.stationId = e.target.value;
        // Alle Journeys mit Stops synchronisieren
        journeyStore.journeys.forEach(j => {
            if (j.stops.length > 0) {
                j.syncFromCurrentStop(e.target.value);
            }
        });
        renderJourneyList();
        trainDisplay.updateAll();
    });

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
        renderJourneyList();
        trainDisplay.updateAll();
    });

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
            } else if (type === 'journey') {
                journeyStore.importFromJourney(data);
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
    const formationBody = document.getElementById('formation_editor_body');

    formationBody?.addEventListener('dragstart', (e) => {
        const coachRow = e.target.closest('.coach-editor-row');
        const groupEditor = e.target.closest('.formation-group-editor');

        // Check which one is being dragged. We need to prevent the group from being dragged
        // if the user is dragging a coach inside it.
        if (coachRow && (e.target === coachRow || coachRow.contains(e.target))) {
            // Is it dragging by the handle or just generally dragging the coach?
            // HTML5 drag doesn't easily let us filter by handle after dragstart, 
            // but we can assume if the user clicked the coach row, it's a coach drag.
            // Wait, actually `e.target` is the element that triggered dragstart.
            // We'll see if it's the group header or the coach row.
            const groupHeader = e.target.closest('.group-editor-header');
            if (!groupHeader) {
                dragSrcElement = coachRow;
                dragType = 'coach';
                coachRow.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
                return;
            }
        }
        
        if (groupEditor) {
            dragSrcElement = groupEditor;
            dragType = 'group';
            groupEditor.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    formationBody?.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragSrcElement) return;

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
                // Drop into an empty group
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
        }
    });

    formationBody?.addEventListener('dragend', () => {
        dragSrcElement?.classList.remove('dragging');
        dragSrcElement = null;
        dragType = null;
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