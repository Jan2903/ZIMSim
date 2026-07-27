// js/ui/settingsController.js
import { uiState } from './uiState.js';
import { journeyStore, trainDisplay } from '../main.js';
import { renderJourneyList, renderTrackFilter } from './journeyListView.js';
import { config, timeConfig, setSimulatedTime, getSimulatedTime } from '../utils/config.js';
import { toggleDebugMeters } from '../displays/formationRenderer.js';
import { StationService } from '../utils/stationService.js';
import { MOT_PRESETS, getSmartHeaderString } from '../utils/motManager.js';
import { formatDisplayName } from '../utils/trainNumberFormatter.js';
import { FormationGroup } from '../models/formation.js';

export function initSettings() {
    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            toggleDebugMeters();
            trainDisplay.updateAll();
        }
    });

    // --- Modal Closing ---
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.closeModal;
            document.getElementById(modalId)?.classList.add('hidden');
        });
    });

    // --- Station Search ---
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

    // --- Track Filter ---
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
            uiState.manualTracks.add(val);
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

    // --- MOT Filter ---
    const motCheckboxes = document.querySelectorAll('.mot_dep');
    const motSummary = document.getElementById('mot_summary');
    const motPresetBtns = document.querySelectorAll('.mot-preset-btn');

    function updateMotSummary() {
        if (!motSummary || motCheckboxes.length === 0) return;
        const selected = Array.from(motCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        motSummary.innerText = getSmartHeaderString(selected);
        journeyStore.activeMots = selected;
        renderJourneyList();
        trainDisplay.updateAll();
    }

    motCheckboxes.forEach(cb => cb.addEventListener('change', updateMotSummary));

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

    if (motCheckboxes.length > 0) {
        journeyStore.activeMots = Array.from(motCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (motSummary) motSummary.innerText = getSmartHeaderString(journeyStore.activeMots);
    }

    // --- Feature & Layout ---
    document.querySelectorAll('input[name="wahl"]').forEach(radio => {
        radio.addEventListener('change', () => {
            trainDisplay.onFeatureButtonChange(radio.value);
        });
    });

    document.querySelectorAll('input[name="layout_select"]').forEach(radio => {
        radio.addEventListener('change', () => {
            trainDisplay.switchLayout(radio.value);
        });
    });

    const perfCheckbox = document.getElementById('performance_mode_checkbox');
    if (perfCheckbox) {
        perfCheckbox.checked = config.performance_mode;
        perfCheckbox.addEventListener('change', (e) => {
            config.performance_mode = e.target.checked;
            localStorage.setItem('zimsim_performance_mode', e.target.checked);
        });
    }

    // --- Platform ---
    document.getElementById('platform_length')?.addEventListener('input', (e) => {
        journeyStore.stationContext.platform.length = parseInt(e.target.value) || 420;
        trainDisplay.updateAll();
    });

    document.getElementById('platform_location')?.addEventListener('input', (e) => {
        journeyStore.stationContext.platform.currentLocation = parseInt(e.target.value) || 0;
        trainDisplay.updateAll();
    });

    // --- NRW Mode ---
    document.getElementById('nrw_mode_checkbox')?.addEventListener('change', (e) => {
        journeyStore.nrwMode = e.target.checked;
        journeyStore.journeys.forEach(journey => {
            journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
        });
        renderJourneyList();
        trainDisplay.updateAll();
    });

    // --- Time ---
    const customTimeInput = document.getElementById('custom_time_input');
    const autoUpdateTimeCheckbox = document.getElementById('auto_update_time_checkbox');
    const setCurrentTimeBtn = document.getElementById('set_current_time_btn');

    function updateTimeInputFromState() {
        if (!customTimeInput || document.activeElement === customTimeInput) return;
        const simTime = getSimulatedTime();
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
            setSimulatedTime(getSimulatedTime(), e.target.checked);
        });
    }

    if (setCurrentTimeBtn) {
        setCurrentTimeBtn.addEventListener('click', () => {
            setSimulatedTime(new Date());
            updateTimeInputFromState();
        });
    }

    setInterval(() => {
        if (timeConfig.isRunning) {
            updateTimeInputFromState();
        }
    }, 1000);
    updateTimeInputFromState();

    // --- Export / Import ---
    document.getElementById('download-btn')?.addEventListener('click', () => {
        const canvas = document.getElementById('zimCanvas');
        if (!canvas) return;
        
        // Zeit formatieren (Simulierte Zeit)
        const simTime = getSimulatedTime();
        const yyyy = simTime.getFullYear();
        const MM = String(simTime.getMonth() + 1).padStart(2, '0');
        const dd = String(simTime.getDate()).padStart(2, '0');
        const hh = String(simTime.getHours()).padStart(2, '0');
        const mm = String(simTime.getMinutes()).padStart(2, '0');
        const ss = String(simTime.getSeconds()).padStart(2, '0');
        const dateStr = `${yyyy}-${MM}-${dd}_${hh}-${mm}-${ss}`;

        // Bahnhof formatieren (Leerzeichen durch Unterstriche ersetzen)
        const stationRaw = journeyStore.stationContext.stationName || 'Kein_Bahnhof';
        const stationStr = stationRaw.trim().replace(/\s+/g, '_');

        // Gleise formatieren
        let tracksStr = 'Gleise_Alle';
        const trackCheckboxes = document.querySelectorAll('.track_dep');
        if (journeyStore.activeTracks && journeyStore.activeTracks.length > 0) {
            if (trackCheckboxes.length === 0 || journeyStore.activeTracks.length < trackCheckboxes.length) {
                tracksStr = `Gleis_${journeyStore.activeTracks.join('-')}`;
            }
        }

        const fileName = `ZIMSim_${stationStr}_${tracksStr}_${dateStr}.png`;

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = fileName;
        a.click();
    });

    document.getElementById('export_all_btn')?.addEventListener('click', () => {
        const data = journeyStore.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'zimsim_export.json';
        a.click();
    });

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

    // --- DB Import Modal ---
    document.getElementById('import_db_btn')?.addEventListener('click', () => {
        document.getElementById('db_import_modal')?.classList.remove('hidden');
    });

    document.querySelectorAll('input[name="import_type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const hint = document.getElementById('import_type_hint');
            if (!hint) return;
            const hints = {
                'departure_list': 'Füge das JSON einer DB-Abfahrtstafel ein (entries[]-Array).',
                'arrival_list': 'Füge das JSON einer DB-Ankunftstafel ein (entries[]-Array).',
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
            } else if (type === 'arrival_list') {
                journeyStore.importFromArrivalList(data);
                journeyStore.journeys.forEach(journey => {
                    journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
                });
            } else if (type === 'journey') {
                journeyStore.importFromJourney(data);
                journeyStore.journeys.forEach(journey => {
                    journey.displayNameOverride = formatDisplayName(journey.name, journeyStore.nrwMode);
                });
            } else if (type === 'formation') {
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

    // --- Window Resize (Skalierung) ---
    window.addEventListener('resize', () => {
        const canvas = document.getElementById('zimCanvas');
        const container = document.getElementById('display-container');
        if (!canvas || !container) return;

        const layoutWidth = trainDisplay.currentLayout.width;
        const layoutHeight = trainDisplay.currentLayout.height;
        const containerWidth = container.clientWidth;
        if (containerWidth === 0) return;

        const scale = containerWidth / layoutWidth;
        const scaledHeight = layoutHeight * scale;

        canvas.style.transform = `scale(${scale})`;
        canvas.style.transformOrigin = 'top left';
        container.style.height = `${scaledHeight}px`;
    });

    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
}
