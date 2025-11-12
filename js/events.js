// js/events.js
import { Coach } from './models/coach.js';
import { trainData, trainDisplay } from './main.js';
import { config } from './utils/config.js';
import { startRotation } from './utils/utils.js';

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

    document.querySelectorAll('.zug_entry').forEach(input => {
        input.addEventListener('input', (e) => {
            const zug = parseInt(e.target.dataset.zug);
            const field = e.target.dataset.field;
            if (!trainData.zugDaten[zug]) {
                trainData.initializeZugDaten();
            }
            trainData.zugDaten[zug][field] = e.target.value;
            if (field === "Zugnummer") {
                trainData.zugDaten[zug].Zugnummer_kurz = e.target.value;
            }
            trainDisplay.updateAll();
        });
    });

    document.querySelectorAll('.richtung_radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const zug = parseInt(e.target.dataset.zug);
            if (!trainData.zugDaten[zug]) {
                trainData.initializeZugDaten();
            }
            trainData.zugDaten[zug].Richtung = parseInt(e.target.value);
            trainDisplay.updateAll();
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
            trainDisplay.update(config.current_display3_zug, 'display2_zug2', 'display2_zug2_wagenreihung', false);
        }
        // Preserve feature rotation
        if (trainDisplay.rotating) {
            console.log('Restarting feature rotation to preserve state');
            trainDisplay.onFeatureButtonChange('rotierend');
        }
    });

    document.querySelectorAll('.zug_checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const zug = parseInt(e.target.dataset.zug);
            const field = e.target.dataset.field;
            if (!trainData.zugDaten[zug]) {
                trainData.initializeZugDaten();
            }
            trainData.zugDaten[zug][field] = e.target.checked;
            trainDisplay.updateAll();
        });
    });

    document.querySelectorAll('.zug_entry[data-field="PlatformLength"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const zug = parseInt(e.target.dataset.zug);
            trainData.zugDaten[zug].PlatformLength = parseFloat(e.target.value) || 420;
            trainDisplay.updateAll();
        });
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
                trainDisplay.update(config.current_display3_zug, 'display2_zug2', 'display2_zug2_wagenreihung', false);
            }
        });
    });

    document.getElementById('entry_stop_name').addEventListener('input', (e) => {
        trainData.current_stop = e.target.value;
        trainDisplay.updateAll();
    });

    document.getElementById('entry_gleis').addEventListener('input', (e) => {
        trainData.current_platform = e.target.value;
        trainDisplay.updateAll();
    });

    let abfahrten = false;
    let ankuenfte = false;
    document.getElementById('abfahrten_checkbox').addEventListener('change', (e) => {
        abfahrten = e.target.checked;
        // For future API use
    });
    document.getElementById('ankuenfte_checkbox').addEventListener('change', (e) => {
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
                console.log('Imported JSON:', data);
                trainData.initializeZugDaten();
                for (let key in data) {
                    if (!key.startsWith('zug_')) {
                        console.warn(`Skipping invalid key: ${key}`);
                        continue;
                    }
                    const zug = parseInt(key.split('_')[1]);
                    if (!zug || zug < 1 || zug > 6) {
                        console.warn(`Invalid zug number: ${zug} from key ${key}`);
                        continue;
                    }
                    const zugData = data[key];
                    if (zugData['Zugnummer kurz'] !== undefined) {
                        zugData.Zugnummer_kurz = zugData['Zugnummer kurz'];
                        delete zugData['Zugnummer kurz'];
                    }
                    const defaultData = {
                        Zugnummer: '',
                        Zugnummer_kurz: '',
                        Abfahrt: '',
                        Abweichend: '',
                        Ziel: '',
                        'Via-Halte 1': '',
                        'Via-Halte 2': '',
                        'Via-Halte 1 Small': '',
                        'Via-Halte 2 Small': '',
                        'Via-Halte 3 Small': '',
                        Informationen: '',
                        Ankunft: false,
                        Infoscreen: false,
                        Richtung: true,
                        TrainStart: 0,
                        Skalieren: false,
                        Zugteilung: false,
                        Wagenreihung: [],
                        PlatformLength: 420,
                        PlatformSections: [],
                        Gleiswechsel: '0',
                        Ausfall: false,
                        VerkehrtAb: '0',
                        'Via-Stations-Categories': {}
                    };
                    const mergedData = {
                        ...defaultData,
                        ...zugData,
                        Wagenreihung: Array.isArray(zugData.Wagenreihung) ? zugData.Wagenreihung.map(c => new Coach(c)) : defaultData.Wagenreihung,
                        PlatformSections: Array.isArray(zugData.PlatformSections) ? zugData.PlatformSections : defaultData.PlatformSections,
                        'Via-Stations-Categories': zugData['Via-Stations-Categories'] && typeof zugData['Via-Stations-Categories'] === 'object' ? zugData['Via-Stations-Categories'] : defaultData['Via-Stations-Categories'],
                        Zugnummer_kurz: zugData.Zugnummer_kurz || zugData.Zugnummer || '',
                        Richtung: Number.isInteger(zugData.Richtung) ? zugData.Richtung : 1,
                        Skalieren: typeof zugData.Skalieren === 'boolean' ? zugData.Skalieren : false,
                        Gleiswechsel: zugData.Gleiswechsel || '0',
                        TrainStart: parseFloat(zugData.TrainStart) || 0
                    };
                    trainData.zugDaten[zug] = mergedData;
                    console.log(`Updated zugDaten[${zug}]:`, trainData.zugDaten[zug]);
                    document.querySelectorAll(`.zug_entry[data-zug="${zug}"]`).forEach(input => {
                        const field = input.dataset.field;
                        try {
                            if (mergedData[field] !== undefined && mergedData[field] !== null) {
                                input.value = mergedData[field].toString();
                            } else {
                                input.value = '';
                            }
                        } catch (err) {
                            console.warn(`Failed to set input for zug ${zug}, field ${field}:`, err);
                        }
                    });

                    try {
                        const ankunftCheckbox = document.querySelector(`.zug_checkbox[data-zug="${zug}"][data-field="Ankunft"]`);
                        if (ankunftCheckbox) ankunftCheckbox.checked = !!mergedData.Ankunft;
                    } catch (err) {
                        console.warn(`Failed to set Ankunft for zug ${zug}:`, err);
                    }

                    try {
                        const infoscreenCheckbox = document.querySelector(`.zug_checkbox[data-zug="${zug}"][data-field="Infoscreen"]`);
                        if (infoscreenCheckbox) infoscreenCheckbox.checked = !!mergedData.Infoscreen;
                    } catch (err) {
                        console.warn(`Failed to set Infoscreen for zug ${zug}:`, err);
                    }

                    try {
                        const richtungValue = Number.isInteger(mergedData.Richtung) ? mergedData.Richtung.toString() : '1';
                        const richtungRadio = document.querySelector(`.richtung_radio[data-zug="${zug}"][value="${richtungValue}"]`);
                        if (richtungRadio) richtungRadio.checked = true;
                    } catch (err) {
                        console.warn(`Failed to set Richtung for zug ${zug}:`, err);
                    }
                    
                    try {
                        const skalierenCheckbox = document.querySelector(`.zug_checkbox[data-zug="${zug}"][data-field="Skalieren"]`);
                        if (skalierenCheckbox) skalierenCheckbox.checked = !!mergedData.Skalieren;
                    } catch (err) {
                        console.warn(`Failed to set Skalieren for zug ${zug}:`, err);
                    }

                    try {
                        const zugteilungCheckbox = document.querySelector(`.zug_checkbox[data-zug="${zug}"][data-field="Zugteilung"]`);
                        if (zugteilungCheckbox) zugteilungCheckbox.checked = !!mergedData.Zugteilung;
                    } catch (err) {
                        console.warn(`Failed to set Zugteilung for zug ${zug}:`, err);
                    }

                    try {
                        const gleiswechselInput = document.querySelector(`.zug_entry[data-zug="${zug}"][data-field="Gleiswechsel"]`);
                        if (gleiswechselInput) gleiswechselInput.value = mergedData.Gleiswechsel || '0';
                    } catch (err) {
                        console.warn(`Failed to set Gleiswechsel for ${zug}:`, err);
                    }

                    try {
                        const ausfallCheckbox = document.querySelector(`.zug_checkbox[data-zug="${zug}"][data-field="Ausfall"]`);
                        if (ausfallCheckbox) ausfallCheckbox.checked = !!mergedData.Ausfall;
                    } catch (err) {
                        console.warn(`Failed to set Ausfall for zug ${zug}:`, err);
                    }

                     try {
                        const verkehrtAbInput = document.querySelector(`.zug_entry[data-zug="${zug}"][data-field="VerkehrtAb"]`);
                        if (verkehrtAbInput) verkehrtAbInput.value = mergedData.Gleiswechsel || '0';
                    } catch (err) {
                        console.warn(`Failed to set VerkehrtAb for ${zug}:`, err);
                    }
                }
                trainDisplay.updateAll();
            } catch (error) {
                console.error('Failed to load JSON:', error);
                alert('Error loading JSON file. Please check the file format and console for details.');
                trainData.initializeZugDaten();
                trainDisplay.updateAll();
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('export_all_btn').addEventListener('click', () => {
        const data = {};
        for (let zug in trainData.zugDaten) {
            data[`zug_${zug}`] = trainData.zugDaten[zug];
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
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

    document.querySelectorAll('.import_formation').forEach(button => {
        button.addEventListener('click', (e) => {
            const zug = parseInt(e.target.dataset.zug);
            if (!trainData.zugDaten[zug]) {
                trainData.initializeZugDaten();
            }
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
                        trainData.zugDaten[zug].Wagenreihung = data.map(c => new Coach(c));
                        trainDisplay.updateAll();
                    } catch (error) {
                        console.error('Failed to import formation:', error);
                        alert('Error loading formation JSON.');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    });

    document.querySelectorAll('.export_formation').forEach(button => {
        button.addEventListener('click', (e) => {
            const zug = parseInt(e.target.dataset.zug);
            if (!trainData.zugDaten[zug]) {
                console.warn(`zugDaten[${zug}] is undefined`);
                return;
            }
            const data = trainData.zugDaten[zug].Wagenreihung || [];
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `zug_${zug}_formation.json`;
            link.click();
            URL.revokeObjectURL(url);
        });
    });

    window.addEventListener('resize', resizeDisplay);
    resizeDisplay();

}