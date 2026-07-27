// js/ui/journeyListView.js
import { uiState } from './uiState.js';
import { journeyStore, trainDisplay } from '../main.js';
import { getMotForCategory } from '../utils/motManager.js';
import { renderInlineFormation, renderInfoTextsEditor, renderDelayReasonOptions, renderStopsEditor } from './editorView.js';

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
        const isExpanded = uiState.expandedJourneyId === journey.id;
        const isCoupled = journey.couplingGroupId !== null;
        const isFirstInCoupling = isCoupled && journey.couplingGroupId !== lastCouplingGroupId;
        const nextJourney = journeyStore.journeys[index + 1];
        const isLastInCoupling = isCoupled && (!nextJourney || nextJourney.couplingGroupId !== journey.couplingGroupId);

        let couplingClass = '';
        if (isCoupled) {
            if (isFirstInCoupling && isLastInCoupling) couplingClass = 'coupling-single';
            else if (isFirstInCoupling) couplingClass = 'coupling-start';
            else if (isLastInCoupling) couplingClass = 'coupling-end';
            else couplingClass = 'coupling-middle';
        }

        const badge = journey.ankunft ? '<span class="badge badge-arrival">ⓐ</span>' : '';
        const cancelledClass = journey.ausfall ? 'journey-cancelled' : '';
        const visibleIcon = journey.visible ? '👁' : '○';
        const delayInfo = journey.expectedTime && journey.expectedTime !== journey.scheduledTime
            ? `<span class="delay-indicator">${journey.expectedTime}</span>` : '';

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

        let linkBadge = '';
        if (journey.linkedArrivalJourneyId) {
            const linkedArr = journeyStore.getJourney(journey.linkedArrivalJourneyId);
            if (linkedArr) {
                linkBadge = `<span class="badge badge-link" data-linked-id="${linkedArr.id}" title="Kommt von Ankunft (anklicken zum Öffnen)" style="cursor: pointer; background: #4dabf7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-right: 8px;">🔗 Kommt aus ${linkedArr.effectiveDisplayName} (${linkedArr.scheduledTime})</span>`;
            }
        } else if (journey.ankunft) {
            const linkedDep = journeyStore.journeys.find(j => j.linkedArrivalJourneyId === journey.id);
            if (linkedDep) {
                linkBadge = `<span class="badge badge-link" data-linked-id="${linkedDep.id}" title="Wird zu Abfahrt (anklicken zum Öffnen)" style="cursor: pointer; background: #4dabf7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-right: 8px;">🔗 Wird zu ${linkedDep.effectiveDisplayName} (${linkedDep.scheduledTime})</span>`;
            }
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
                        ${linkBadge}
                        <button class="btn-icon expand-toggle" data-journey-id="${journey.id}">${isExpanded ? '▾' : '▸'}</button>
                    </div>
                    ${isExpanded ? renderJourneyDetails(journey) : ''}
                </div>
            </div>
        `;

        lastCouplingGroupId = journey.couplingGroupId;
    });

    container.innerHTML = html;

    renderTrackFilter();
}

export function renderTrackFilter() {
    const container = document.getElementById('track_checkbox_container');
    const summary = document.getElementById('track_summary');
    if (!container || !summary) return;

    const storeTracks = journeyStore.getAllTracks();
    const allTracksSet = new Set([...storeTracks, ...uiState.manualTracks]);
    let allTracks = Array.from(allTracksSet).sort((a, b) => {
        if (a === 'Ohne Gleis') return 1;
        if (b === 'Ohne Gleis') return -1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    let html = '';
    allTracks.forEach(track => {
        const isChecked = journeyStore.activeTracks.length === 0 || journeyStore.activeTracks.includes(track);
        html += `<label class="checkbox-label"><input type="checkbox" class="track_dep" value="${track}" ${isChecked ? 'checked' : ''}> ${track}</label>`;
    });

    container.innerHTML = html;

    if (journeyStore.activeTracks.length === 0 || journeyStore.activeTracks.length === allTracks.length) {
        summary.innerText = "Gleise: Alle";
    } else {
        summary.innerText = "Gleise: " + journeyStore.activeTracks.join(', ');
    }

    const checkboxes = container.querySelectorAll('.track_dep');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
            if (selected.length === 0 || selected.length === checkboxes.length) {
                journeyStore.activeTracks = [];
            } else {
                journeyStore.activeTracks = selected;
            }
            renderJourneyList();
            trainDisplay.updateAll();
        });
    });
}

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
                    ${!journey.ankunft ? `
                    <div class="detail-row">
                        <label>Verknüpfte Ankunft (Fahrzeugtausch/Wende): 
                            <select class="jfield" data-field="linkedArrivalJourneyId" style="max-width: 300px;">
                                <option value="">-- Keine Verknüpfung --</option>
                                ${journeyStore.journeys.filter(j => j.ankunft).map(a => 
                                    `<option value="${a.id}" ${journey.linkedArrivalJourneyId === a.id ? 'selected' : ''}>${a.effectiveDisplayName} (${a.scheduledTime}) - Gl. ${a.ezGleis || a.platform}</option>`
                                ).join('')}
                            </select>
                        </label>
                    </div>
                    ` : ''}
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
