// js/main.js
import { TrainData } from './models/trainData.js';
import { TrainDisplay } from './displays/trainDisplay.js';
import { initEvents } from './events.js';
import { preloadImages } from './utils/utils.js';

export const trainData = new TrainData();
export const trainDisplay = new TrainDisplay(trainData);

// Baut das HTML für Zug 1 bis 6 dynamisch auf (DRY-Prinzip)
function generateTrainSettingsUI() {
    const container = document.getElementById('train_settings_container');
    if (!container) return;

    let html = `
        <div class="settings-frame">
            <h3>Globale Einstellungen</h3>
            <div class="form-row">
                <label>Bahnsteiglänge (m): <input type="text" id="platform_length_input" class="short-input" value="420"></label>
                <label>Aktueller Halt: <input type="text" id="entry_stop_name" placeholder="z.B. Hannover Hbf"></label>
                <label>Aktuelles Gleis: <input type="text" id="entry_gleis" class="short-input" placeholder="z.B. 10"></label>
            </div>
        </div>
    `;
    
    for (let i = 1; i <= 6; i++) {
        // Zug 1 ist standardmäßig sichtbar, 2-6 sind versteckt
        const isHidden = i === 1 ? '' : 'hidden';
        
        let extraFieldsRow1 = '';
        let extraFieldsRow2 = '';

        // Nur Züge 3 bis 6 haben diese Extra-Optionen für Störungen
        if (i >= 3) {
            extraFieldsRow1 = `
                <label class="checkbox-label-vertical">Infoscreen: <input type="checkbox" class="zug_checkbox" data-zug="${i}" data-field="Infoscreen"></label>
            `;
            extraFieldsRow2 = `
                <label>Gleiswechsel: <input type="text" class="zug_entry short-input" data-zug="${i}" data-field="Gleiswechsel" value="0"></label>
                <label>Verkehrt ab: <input type="text" class="zug_entry short-input" data-zug="${i}" data-field="VerkehrtAb" value="0"></label>
                <label class="checkbox-label-vertical">Ausfall: <input type="checkbox" class="zug_checkbox" data-zug="${i}" data-field="Ausfall"></label>
            `;
        }

        // HTML für einen einzelnen Zug zusammenbauen
        html += `
            <div class="settings-frame ${isHidden}" id="zug${i}_settings">
                <h3>Einstellungen für Zug ${i}</h3>
                <div class="form-row">
                    <label>Informationen (Lauftext): <input type="text" class="zug_entry" data-zug="${i}" data-field="Informationen"></label>
                    <label class="radio-group">Richtung:
                        <div class="options">
                            <label><input type="radio" name="richtung${i}" value="0" class="richtung_radio" data-zug="${i}"> Links</label>
                            <label><input type="radio" name="richtung${i}" value="1" checked class="richtung_radio" data-zug="${i}"> Rechts</label>
                        </div>
                    </label>
                    <label>Startmeter: <input type="text" class="zug_entry short-input" data-zug="${i}" data-field="TrainStart" value="0"></label>
                </div>
                <div class="form-row">
                    <label class="checkbox-label-vertical">Ankunft: <input type="checkbox" class="zug_checkbox" data-zug="${i}" data-field="Ankunft"></label>
                    <label class="checkbox-label-vertical">Skalieren: <input type="checkbox" class="zug_checkbox" data-zug="${i}" data-field="Skalieren"></label>
                    ${extraFieldsRow1}
                    ${extraFieldsRow2}
                </div>

                <!-- Container für die Zugteile (Train Groups) -->
                <div class="train-groups-container" id="zug${i}_groups_container">
                    <!-- Dynamisch durch events.js befüllt -->
                </div>

                <div class="form-row action-row">
                    <button class="add-group-btn btn-secondary" data-zug="${i}">+ Zugteil hinzufügen</button>
                </div>
            </div>
        `;
    }
    
    // Alles auf einmal ins DOM schreiben (Performant!)
    container.innerHTML = html;
}

// Warten, bis das DOM vollständig geladen ist
document.addEventListener('DOMContentLoaded', () => {
    generateTrainSettingsUI(); // WICHTIG: Muss vor initEvents() aufgerufen werden!
    initEvents();
    preloadImages().then(() => {
        trainDisplay.updateAll();
    });
});