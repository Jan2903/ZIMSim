// js/events.js
import { Coach } from './models/coach.js';
import { Departure } from './models/departure.js';
import { Platform } from './models/platform.js';
import { TrainGroup } from './models/trainGroup.js';
import { trainData, trainDisplay } from './main.js';
import { config } from './utils/config.js';
import { startRotation } from './utils/utils.js';

/**
 * Stellt sicher, dass ein Departure-Objekt und dessen erste TrainGroup für einen gegebenen Index existieren.
 * @param {number} departureIndex - Der 0-basierte Index in trainData.departures.
 * @returns {{departure: Departure, group: TrainGroup}}
 */
function getDepartureAndGroup(departureIndex) {
    while (trainData.departures.length <= departureIndex) {
        trainData.departures.push(new Departure());
    }
    const departure = trainData.departures[departureIndex];
    if (!departure.groups || departure.groups.length === 0) {
        departure.groups.push(new TrainGroup());
    }
    return { departure, group: departure.groups[0] };
}

/**
 * Stellt sicher, dass ein Departure- und ein TrainGroup-Objekt für die gegebenen Indizes existieren.
 * @param {number} departureIndex - Der 0-basierte Index in trainData.departures.
 * @param {number} groupIndex - Der 0-basierte Index in departure.groups.
 * @returns {{departure: Departure, group: TrainGroup}}
 */
function getDepartureAndGroupByIndex(departureIndex, groupIndex) {
    // Stellt sicher, dass das Departure-Objekt existiert
    while (trainData.departures.length <= departureIndex) {
        trainData.departures.push(new Departure());
    }
    const departure = trainData.departures[departureIndex];
    // Stellt sicher, dass das TrainGroup-Objekt existiert
    while (departure.groups.length <= groupIndex) {
        departure.groups.push(new TrainGroup());
    }
    return { departure, group: departure.groups[groupIndex] };
}

/**
 * Generiert das HTML für die Eingabefelder eines einzelnen Zugteils (TrainGroup).
 * @param {number} departureIndex - Der 0-basierte Index der Abfahrt.
 * @param {number} groupIndex - Der 0-basierte Index des Zugteils.
 * @returns {string} - Der HTML-String für den Zugteil-Editor.
 */
function generateGroupSettingsHTML(departureIndex, groupIndex) {
    const zugId = departureIndex + 1;
    return `
        <div class="train-group-frame" data-group-index="${groupIndex}">
            <h4>Zugteil ${groupIndex + 1}</h4>
            <div class="form-row">
                <label>Linie/Nummer: <input type="text" class="zug_entry" data-zug="${zugId}" data-group-index="${groupIndex}" data-field="Zugnummer"></label>
                <label>Ziel: <input type="text" class="zug_entry" data-zug="${zugId}" data-group-index="${groupIndex}" data-field="Ziel"></label>
                <label>Zeit: <input type="text" class="zug_entry short-input" data-zug="${zugId}" data-group-index="${groupIndex}" data-field="Abfahrt"></label>
                <label>Abw.: <input type="text" class="zug_entry short-input" data-zug="${zugId}" data-group-index="${groupIndex}" data-field="Abweichend"></label>
            </div>
            <div class="form-row">
                <label>Via-Halte 1: <input type="text" class="zug_entry" data-zug="${zugId}" data-group-index="${groupIndex}" data-field="Via-Halte 1"></label>
                <label>Via-Halte 2: <input type="text" class="zug_entry" data-zug="${zugId}" data-group-index="${groupIndex}" data-field="Via-Halte 2"></label>
                <label>Via-Halte 3: <input type="text" class="zug_entry" data-zug="${zugId}" data-group-index="${groupIndex}" data-field="Via-Halte 3"></label>
            </div>
            <div class="form-row action-row-group">
                <button class="export_formation btn-secondary" data-zug="${zugId}" data-group-index="${groupIndex}">⬇️ Wagenreihung exportieren</button>
                <button class="import_formation btn-secondary" data-zug="${zugId}" data-group-index="${groupIndex}">⬆️ Wagenreihung importieren</button>
                <button class="remove-group-btn btn-danger" data-zug="${zugId}" data-group-index="${groupIndex}">- Zugteil entfernen</button>
            </div>
        </div>
    `;
}

/**
 * Rendert die UI für alle Zugteile einer bestimmten Abfahrt und füllt sie mit Daten.
 * @param {number} departureIndex - Der 0-basierte Index der Abfahrt.
 */
function renderGroupsUI(departureIndex) {
    const zugId = departureIndex + 1;
    const container = document.getElementById(`zug${zugId}_groups_container`);
    if (!container) return;

    const { departure } = getDepartureAndGroup(departureIndex);
    container.innerHTML = departure.groups.map((_, groupIndex) => generateGroupSettingsHTML(departureIndex, groupIndex)).join('');

    // UI-Felder mit Daten aus dem Modell füllen
    departure.groups.forEach((group, groupIndex) => {
        const vias = group.vias || [];
        const setValue = (field, value) => {
            const el = document.querySelector(`.zug_entry[data-zug="${zugId}"][data-group-index="${groupIndex}"][data-field="${field}"]`);
            if (el) el.value = value || '';
        };
        setValue('Zugnummer', group.trainNumber);
        setValue('Ziel', group.destination);
        setValue('Abfahrt', group.scheduledTime);
        setValue('Abweichend', group.expectedTime);
        setValue('Via-Halte 1', vias[0]);
        setValue('Via-Halte 2', vias[1]);
        setValue('Via-Halte 3', vias[2]);
    });
}

function resizeDisplay() {    
    const container = document.querySelector('.display-container');
    const wrapper = document.querySelector('.screen-wrapper');
    if (!container || !wrapper) {
        console.warn('DOM elements not found in resizeDisplay');
        return; // Prevent errors if DOM isn’t ready
    }
    const scaleX = window.innerWidth / 4260;
    const scaleY = window.innerHeight / 1400;
    const scale = Math.min(scaleX, scaleY);
    wrapper.style.transform = `translateX(-50%) scale(${scale})`;
    container.style.height = `${1400 * scale}px`;
}

export function initEvents() {

    // Default departure time to current local time
    const departureTime = document.getElementById("departureTime");
    if (departureTime) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // adjust for local timezone
        departureTime.value = now.toISOString().slice(0, 16); // format YYYY-MM-DDTHH:mm
    }

    document.querySelectorAll('input[name="wahl"]').forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('Feature selection:', radio.value);
            trainDisplay.onFeatureButtonChange(radio.value);
        });
    });

    document.getElementById('display3_rotieren_checkbox').addEventListener('change', (e) => {
        config.rotate_3_6 = e.target.checked;
        if (config.rotate_3_6) {
            startRotation();
        } else {
            if (config.zug_rotation_timer) clearTimeout(config.zug_rotation_timer);
            config.current_rotating_zug = 3;
            const selectedRadio = document.querySelector('input[name="zug_select"]:checked');
            const selectedZug = selectedRadio ? parseInt(selectedRadio.value) : 3;
            if (selectedZug >= 3 && selectedZug <= 6) {
                config.current_display3_zug = selectedZug;
            } else {
                config.current_display3_zug = 3;
            }
            trainDisplay.update(config.current_display3_zug - 1, 'display2_zug2', 'display2_zug2_wagenreihung', false);
        }
        // Preserve feature rotation
        if (trainDisplay.rotating) {
            console.log('Restarting feature rotation to preserve state');
            trainDisplay.onFeatureButtonChange('rotierend');
        }
    });

    document.querySelectorAll('input[name="zug_select"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedZug = e.target.value;
            document.querySelectorAll('.settings-frame[id^="zug"]').forEach(frame => {
                frame.classList.add('hidden');
            });
            document.getElementById(`zug${selectedZug}_settings`).classList.remove('hidden');
            const selZugInt = parseInt(selectedZug);
            if (!config.rotate_3_6 && selZugInt >= 3 && selZugInt <= 6) {
                config.current_display3_zug = selZugInt;
                trainDisplay.update(config.current_display3_zug - 1, 'display2_zug2', 'display2_zug2_wagenreihung', false);
            }
        });
    });

    document.getElementById('platform_length_input').addEventListener('input', (e) => {
        trainData.platform.length = parseFloat(e.target.value) || 420;
        trainDisplay.updateAll();
    });

    document.getElementById('entry_stop_name')?.addEventListener('input', (e) => {
        trainData.current_stop = e.target.value;
        trainDisplay.updateAll();
    });

    document.getElementById('entry_gleis')?.addEventListener('input', (e) => {
        trainData.current_platform = e.target.value;
        trainDisplay.updateAll();
    });

    let abfahrten = false;
    let ankuenfte = false;
    document.getElementById('abfahrten_checkbox')?.addEventListener('change', (e) => {
        abfahrten = e.target.checked;
        // For future API use
    });
    document.getElementById('ankuenfte_checkbox')?.addEventListener('change', (e) => {
        ankuenfte = e.target.checked;
        // For future API use
    });

    document.getElementById('import_all_btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);

                // Unterstützt neues und altes JSON-Format
                if (Array.isArray(data.departures)) { // Neues Format
                    trainData.departures = data.departures.map(d => new Departure(d));
                    if (data.platform) {
                        trainData.platform = new Platform(data.platform);
                    }
                } else { // Altes Format: Konvertieren
                    trainData.departures = [];
                    for (let i = 1; i <= 6; i++) {
                        const oldData = data[`zug_${i}`];
                        if (!oldData) {
                            trainData.departures.push(new Departure());
                            continue;
                        }
                        const group = {
                            trainNumber: oldData.Zugnummer,
                            destination: oldData.Ziel,
                            vias: [oldData['Via-Halte 1 Small'], oldData['Via-Halte 2 Small'], oldData['Via-Halte 3 Small']].filter(Boolean),
                            scheduledTime: oldData.Abfahrt,
                            expectedTime: oldData.Abweichend,
                            coaches: (oldData.Wagenreihung || []).map(c => new Coach(c))
                        };
                        const departure = {
                            direction: oldData.Richtung,
                            startMeter: oldData.TrainStart,
                            scrollText: oldData.Informationen,
                            groups: [group],
                            ankunft: oldData.Ankunft,
                            ausfall: oldData.Ausfall,
                            gleiswechsel: oldData.Gleiswechsel,
                            infoscreen: oldData.Infoscreen,
                            skalieren: oldData.Skalieren,
                            verkehrtAb: oldData.VerkehrtAb,
                        };
                        trainData.departures.push(new Departure(departure));
                    }
                }

                // Synchronisiere alle UI-Felder mit dem geladenen Modell
                trainData.departures.forEach((departure, index) => {
                    const zugId = index + 1;

                    // Abfahrts-spezifische Felder aktualisieren
                    const setValue = (field, value) => {
                        const el = document.querySelector(`.zug_entry[data-zug="${zugId}"][data-field="${field}"]`);
                        if (el) el.value = value || '';
                    };
                    const setCheck = (field, checked) => {
                        const el = document.querySelector(`.zug_checkbox[data-zug="${zugId}"][data-field="${field}"]`);
                        if (el) el.checked = !!checked;
                    };
                    const setRadio = (name, value) => {
                        const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
                        if (el) el.checked = true;
                    };

                    setValue('Informationen', departure.scrollText);
                    setValue('TrainStart', departure.startMeter);
                    setValue('Gleiswechsel', departure.gleiswechsel);
                    setValue('VerkehrtAb', departure.verkehrtAb);

                    setCheck('Ankunft', departure.ankunft);
                    setCheck('Infoscreen', departure.infoscreen);
                    setCheck('Ausfall', departure.ausfall);
                    setCheck('Skalieren', departure.skalieren);

                    setRadio(`richtung${zugId}`, departure.direction);

                    // Rendere die Gruppen-UI für diese Abfahrt neu
                    renderGroupsUI(index);
                });

                // Globale Felder
                const platformLengthInput = document.querySelector('.zug_entry[data-field="PlatformLength"]');
                if (platformLengthInput) platformLengthInput.value = trainData.platform.length;

                trainDisplay.updateAll();
            } catch (error) {
                console.error('Failed to load JSON:', error);
                alert('Error loading JSON file. Please check the file format and console for details.');
                trainDisplay.updateAll();
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('export_all_btn').addEventListener('click', () => {
        const data = {
            platform: trainData.platform,
            departures: trainData.departures
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'train_data.json';
        link.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('download-btn').addEventListener('click', () => {
        // Ensure all displays are updated before capturing
        trainDisplay.updateAll();
        setTimeout(() => {
            const container = document.querySelector('.display-container');
            const wrapper = document.querySelector('.screen-wrapper');
            const screenWrapper = document.querySelector('.screen-wrapper');  // Capture the full screen-wrapper including header
            // Save old styles
            const oldContainerWidth = container.style.width;
            const oldContainerHeight = container.style.height;
            const oldWrapperTransform = wrapper.style.transform;
            const oldWrapperLeft = wrapper.style.left;
            const oldWrapperPosition = wrapper.style.position;
            // Set to full size
            container.style.width = '4260px';
            container.style.height = '1400px';
            wrapper.style.position = 'static';
            wrapper.style.left = '0';
            wrapper.style.transform = 'none';
            html2canvas(screenWrapper, {
                scale: 1,
                useCORS: true,
                backgroundColor: 'navy',
                width: 4260,
                height: 1400,
                windowWidth: 4260,
                windowHeight: 1400,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0
            }).then(canvas => {
                const link = document.createElement('a');
                // Dynamic filename with timestamp
                const now = new Date();
                const timestamp = now.getDate().toString().padStart(2, '0') + '.' +
                    (now.getMonth() + 1).toString().padStart(2, '0') + '.' +
                    now.getFullYear() + '_' +
                    now.getHours().toString().padStart(2, '0') + '.' +
                    now.getMinutes().toString().padStart(2, '0') + '.' +
                    now.getSeconds().toString().padStart(2, '0');
                link.download = `zim_${timestamp}.png`;
                link.href = canvas.toDataURL('image/png', 1.0);
                link.click();
                // Restore styles
                container.style.width = oldContainerWidth;
                container.style.height = oldContainerHeight;
                wrapper.style.transform = oldWrapperTransform;
                wrapper.style.left = oldWrapperLeft;
                wrapper.style.position = oldWrapperPosition;
            }).catch(error => {
                console.error('Screenshot failed:', error);
                alert('Failed to generate screenshot. Check console for details.');
                // Restore anyway
                container.style.width = oldContainerWidth;
                container.style.height = oldContainerHeight;
                wrapper.style.transform = oldWrapperTransform;
                wrapper.style.left = oldWrapperLeft;
                wrapper.style.position = oldWrapperPosition;
            });
        }, 500); // Delay to ensure all rendering is complete
    });

    // --- Event Delegation für dynamische UI-Elemente ---
    const settingsContainer = document.getElementById('train_settings_container');
    if (!settingsContainer) return;

    // Klick-Events (Buttons)
    settingsContainer.addEventListener('click', e => {
        // "Zugteil hinzufügen" Button
        if (e.target.matches('.add-group-btn')) {
            const departureIndex = parseInt(e.target.dataset.zug) - 1;
            const { departure } = getDepartureAndGroup(departureIndex);
            departure.groups.push(new TrainGroup());
            renderGroupsUI(departureIndex);
            trainDisplay.updateAll();
        }

        // "Zugteil entfernen" Button
        if (e.target.matches('.remove-group-btn')) {
            const departureIndex = parseInt(e.target.dataset.zug) - 1;
            const groupIndex = parseInt(e.target.dataset.groupIndex);
            const { departure } = getDepartureAndGroup(departureIndex);
            if (departure.groups.length > 1) {
                departure.groups.splice(groupIndex, 1);
                renderGroupsUI(departureIndex);
                trainDisplay.updateAll();
            } else {
                alert("Der letzte Zugteil kann nicht entfernt werden.");
            }
        }

        // "Wagenreihung importieren" Button
        if (e.target.matches('.import_formation')) {
            const departureIndex = parseInt(e.target.dataset.zug) - 1;
            const groupIndex = parseInt(e.target.dataset.groupIndex);
            
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (ev) => {
                const file = ev.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        const { group } = getDepartureAndGroupByIndex(departureIndex, groupIndex);
                        group.coaches = data.map(c => new Coach(c));
                        trainDisplay.updateAll();
                    } catch (error) {
                        console.error('Failed to import formation:', error);
                        alert('Error loading formation JSON.');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        // "Wagenreihung exportieren" Button
        if (e.target.matches('.export_formation')) {
            const departureIndex = parseInt(e.target.dataset.zug) - 1;
            const groupIndex = parseInt(e.target.dataset.groupIndex);
            const { group } = getDepartureAndGroupByIndex(departureIndex, groupIndex);
            const data = group.coaches || [];
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `zug_${departureIndex + 1}_gruppe_${groupIndex + 1}_formation.json`;
            link.click();
            URL.revokeObjectURL(url);
        }
    });

    // Input-Events (Textfelder)
    settingsContainer.addEventListener('input', e => {
        if (e.target.matches('.zug_entry')) {
            const departureIndex = parseInt(e.target.dataset.zug) - 1;
            const groupIndex = parseInt(e.target.dataset.groupIndex); // Wird bei Gruppen-Feldern vorhanden sein
            const field = e.target.dataset.field;

            if (!isNaN(groupIndex)) { // Es ist ein Gruppen-Feld
                const { group } = getDepartureAndGroupByIndex(departureIndex, groupIndex);
                if (field.startsWith('Via-Halte')) {
                    const viaIndex = parseInt(field.split(' ')[2]) - 1;
                    group.vias = group.vias || [];
                    group.vias[viaIndex] = e.target.value;
                    group.vias = group.vias.filter(v => v && v.trim() !== '');
                } else {
                    const modelField = { 'Zugnummer': 'trainNumber', 'Ziel': 'destination', 'Abfahrt': 'scheduledTime', 'Abweichend': 'expectedTime' }[field];
                    if(modelField) group[modelField] = e.target.value;
                }
            } else { // Es ist ein Abfahrts-Feld
                const { departure } = getDepartureAndGroup(departureIndex);
                const modelField = { 'Informationen': 'scrollText', 'TrainStart': 'startMeter', 'Gleiswechsel': 'gleiswechsel', 'VerkehrtAb': 'verkehrtAb' }[field];
                if(modelField) departure[modelField] = e.target.value;
            }
            trainDisplay.updateAll();
        }
    });

    // Change-Events (Checkboxes, Radios)
    settingsContainer.addEventListener('change', e => {
        if (e.target.matches('.zug_checkbox') || e.target.matches('.richtung_radio')) {
            const departureIndex = parseInt(e.target.dataset.zug) - 1;
            const { departure } = getDepartureAndGroup(departureIndex);
            const field = e.target.dataset.field;

            if (e.target.matches('.richtung_radio')) {
                departure.direction = parseInt(e.target.value);
            } else { // Checkbox
                departure[field.toLowerCase()] = e.target.checked;
            }
            trainDisplay.updateAll();
        }
    });

    window.addEventListener('resize', resizeDisplay);
    resizeDisplay();

    // Initiales Rendern aller Gruppen-UIs
    for (let i = 0; i < 6; i++) {
        renderGroupsUI(i);
    }
}