// js/ui/editorController.js
import { uiState } from './uiState.js';
import { journeyStore, trainDisplay } from '../main.js';
import { Stop } from '../models/stop.js';
import { FormationGroup } from '../models/formation.js';
import { Coach } from '../models/coach.js';
import { debounce } from '../utils/utils.js';
import { StationService } from '../utils/stationService.js';
import { formatDisplayName } from '../utils/trainNumberFormatter.js';
import { renderJourneyList } from './journeyListView.js';
import { renderFormationGroup, renderCoachRow, showFormationEditor } from './editorView.js';

const debouncedUpdateAll = debounce(() => trainDisplay.updateAll(), 300);

export function saveInfoTextsEditor(journeyId, immediate = true) {
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

export function saveStopsEditor(journeyId, immediate = true) {
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
    if (journey._currentStopIndex >= newStops.length) {
        journey._currentStopIndex = newStops.length - 1;
    }
    
    if (immediate) trainDisplay.updateAll();
    else debouncedUpdateAll();
}

export function saveInlineFormation(journeyId, immediate = true) {
    const journey = journeyStore.getJourney(journeyId);
    if (!journey) return;

    const details = document.querySelector(`.journey-details[data-journey-id="${journeyId}"]`);
    if (!details) return;

    const groupEditors = details.querySelectorAll('.formation-group-editor');
    const newGroups = [];

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
            const wagonIdentificationNumber = row.querySelector('[data-prop="wagonIdentificationNumber"]')?.value || '';
            const open = row.querySelector('[data-prop="open"]')?.checked || false;

            const amenities = [];
            row.querySelectorAll('.amenity-check').forEach(chk => {
                if (chk.checked) amenities.push(chk.dataset.amenity);
            });

            groupData.coaches.push(new Coach({
                type, length, coachClass, wagonIdentificationNumber, open, amenities
            }));
        });

        const hasLoco = groupData.coaches.some(c => c.type === 'locomotive');
        const hasOthers = groupData.coaches.some(c => c.type !== 'locomotive');
        
        if (hasLoco && hasOthers) {
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


export function initEditor() {
    const journeyList = document.getElementById('journey_list');

    // Click Events in Details
    journeyList?.addEventListener('click', (e) => {
        const details = e.target.closest('.journey-details');
        if (!details) return;
        const jId = details.dataset.journeyId;

        // InfoTexts
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

        // Stops
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

        // Formation
        if (e.target.closest('.formation_add_group_btn')) {
            const body = details.querySelector('.inline-formation-editor');
            const gIndex = body.querySelectorAll('.formation-group-editor').length;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderFormationGroup(new FormationGroup(), gIndex, jId);
            body.appendChild(tempDiv.firstElementChild);
            uiState.expandedGroups.add(`${jId}_${gIndex}`);
            saveInlineFormation(jId);
            return;
        }

        if (e.target.closest('.formation_reverse_btn')) {
            saveInlineFormation(jId);
            const journey = journeyStore.getJourney(jId);
            if (journey && journey.formation.groups) {
                journey.formation.groups.reverse();
                journey.formation.groups.forEach(group => {
                    if (group.coaches) {
                        group.coaches.reverse();
                    }
                });
                renderJourneyList();
                trainDisplay.updateAll();
            }
            return;
        }

        if (e.target.closest('.reverse-group-btn')) {
            saveInlineFormation(jId);
            const journey = journeyStore.getJourney(jId);
            const groupEditor = e.target.closest('.formation-group-editor');
            const gIndex = Array.from(groupEditor.parentNode.children).indexOf(groupEditor);
            if (journey && journey.formation.groups[gIndex]) {
                const group = journey.formation.groups[gIndex];
                if (group.coaches) {
                    group.coaches.reverse();
                }
                renderJourneyList();
                trainDisplay.updateAll();
            }
            return;
        }

        if (e.target.closest('.remove-coach-btn')) {
            e.target.closest('.coach-editor-row')?.remove();
            saveInlineFormation(jId);
            return;
        }

        if (e.target.closest('.delete-group-btn')) {
            e.target.closest('.formation-group-editor')?.remove();
            saveInlineFormation(jId);
            return;
        }

        if (e.target.closest('.add-coach-btn')) {
            const btn = e.target.closest('.add-coach-btn');
            const groupEditor = btn.closest('.formation-group-editor');
            const list = groupEditor.querySelector('.coach-editor-list');
            const gIndex = groupEditor.dataset.groupIndex;
            const cIndex = list.querySelectorAll('.coach-editor-row').length;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderCoachRow(new Coach(), cIndex, gIndex);
            list.appendChild(tempDiv.firstElementChild);
            uiState.expandedGroups.add(`${jId}_${gIndex}`);
            saveInlineFormation(jId);
            renderJourneyList();
            return;
        }

        if (e.target.closest('.move-coach-up')) {
            const row = e.target.closest('.coach-editor-row');
            if (row.previousElementSibling) {
                row.parentNode.insertBefore(row, row.previousElementSibling);
                saveInlineFormation(jId);
            }
            return;
        }

        if (e.target.closest('.move-coach-down')) {
            const row = e.target.closest('.coach-editor-row');
            if (row.nextElementSibling) {
                row.parentNode.insertBefore(row.nextElementSibling, row);
                saveInlineFormation(jId);
            }
            return;
        }

        if (e.target.closest('.move-group-up')) {
            const groupEditor = e.target.closest('.formation-group-editor');
            if (groupEditor.previousElementSibling) {
                groupEditor.parentNode.insertBefore(groupEditor, groupEditor.previousElementSibling);
                saveInlineFormation(jId);
            }
            return;
        }

        if (e.target.closest('.move-group-down')) {
            const groupEditor = e.target.closest('.formation-group-editor');
            if (groupEditor.nextElementSibling) {
                groupEditor.parentNode.insertBefore(groupEditor.nextElementSibling, groupEditor);
                saveInlineFormation(jId);
            }
            return;
        }

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

        if (e.target.closest('.formation_import_btn')) {
            uiState.editingFormationJourneyId = jId;
            document.getElementById('formation-file-input')?.click();
            return;
        }
    });

    // Input Events in Details
    journeyList?.addEventListener('input', (e) => {
        const details = e.target.closest('.journey-details');
        if (!details) return;
        const journeyId = details.dataset.journeyId;
        const journey = journeyStore.getJourney(journeyId);
        if (!journey) return;

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
                    if (field === 'name') {
                        journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
                        const overrideInput = details.querySelector('.jfield[data-field="displayNameOverride"]');
                        if (overrideInput) overrideInput.value = journey.displayNameOverride;
                    } else if (field === 'destination') {
                        journey.destinationLang = e.target.value;
                        journey.destinationKurz = e.target.value;
                    }
                }
                debouncedUpdateAll();
            }
        }

        if (e.target.classList.contains('info-text-input')) {
            saveInfoTextsEditor(journeyId, false);
        }

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

        if (e.target.classList.contains('f-prop')) {
            saveInlineFormation(journeyId, false);
        }
    });

    // Change Events in Details
    journeyList?.addEventListener('change', (e) => {
        const details = e.target.closest('.journey-details');
        if (!details) return;
        const journeyId = details.dataset.journeyId;
        const journey = journeyStore.getJourney(journeyId);
        if (!journey) return;

        if (e.target.classList.contains('jcheck')) {
            journey[e.target.dataset.field] = e.target.checked;
            trainDisplay.updateAll();
            renderJourneyList();
        }

        if (e.target.tagName === 'SELECT' && e.target.classList.contains('jfield')) {
            const field = e.target.dataset.field;
            if (field) {
                journey[field] = e.target.value || null;
                trainDisplay.updateAll();
                if (field === 'linkedArrivalJourneyId' || field === 'delayReason') {
                    renderJourneyList();
                }
            }
        }

        if (e.target.classList.contains('f-prop') && e.target.type === 'checkbox') {
            saveInlineFormation(journeyId);
        }

        if (e.target.classList.contains('jradio')) {
            journey[e.target.dataset.field] = parseInt(e.target.value);
            trainDisplay.updateAll();
        }

        if (e.target.classList.contains('f-prop') && e.target.tagName === 'SELECT') {
            saveInlineFormation(journeyId);
        }
    });

    // Formation Import File Input
    document.getElementById('formation-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                const groupsArray = Array.isArray(data) ? data : (data.groups || [data]);
                
                const journey = journeyStore.getJourney(uiState.editingFormationJourneyId);
                if (!journey) return;
                
                journey.formation.groups = groupsArray.map(g => new FormationGroup(g));
                
                showFormationEditor(uiState.editingFormationJourneyId, journeyStore);
                trainDisplay.updateAll();
                renderJourneyList(); // Ensure inline formation is updated
                
            } catch (err) {
                console.error('Formation import error:', err);
                alert('Fehler beim Importieren: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}
