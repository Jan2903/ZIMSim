// js/main.js
import { TrainData } from './models/trainData.js';
import { TrainDisplay } from './displays/trainDisplay.js';
import { initEvents } from './events.js';
import './utils/utils.js';

export const trainData = new TrainData();
export const trainDisplay = new TrainDisplay(trainData);

// Baut das HTML für Zug 1 bis 6 dynamisch auf (DRY-Prinzip)
function generateTrainSettingsUI() {
    const container = document.getElementById('train_settings_container');
    if (!container) return;

    let html = '';
    
    for (let i = 1; i <= 6; i++) {
        // Zug 1 ist standardmäßig sichtbar, 2-6 sind versteckt
        const isHidden = i === 1 ? '' : 'hidden';
        
        // Unterschiede in den Datenfeldern abfangen
        const via1 = i === 1 ? 'Via-Halte 1' : 'Via-Halte 1 Small';
        const via2 = i === 1 ? 'Via-Halte 2' : 'Via-Halte 2 Small';
        
        let extraFieldsRow1 = '';
        let extraFieldsRow2 = '';

        // Nur Züge 3 bis 6 haben diese Extra-Optionen
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
                <div class="form-row">
                    <label>Linie/Nummer: <input type="text" class="zug_entry" data-zug="${i}" data-field="Zugnummer" ${i===1 ? 'placeholder="z.B. ICE 123"' : ''}></label>
                    <label>Ziel: <input type="text" class="zug_entry" data-zug="${i}" data-field="Ziel" ${i===1 ? 'placeholder="z.B. Berlin Hbf"' : ''}></label>
                    <label>Zeit: <input type="text" class="zug_entry short-input" data-zug="${i}" data-field="Abfahrt" ${i===1 ? 'placeholder="14:30"' : ''}></label>
                    <label>Abw.: <input type="text" class="zug_entry short-input" data-zug="${i}" data-field="Abweichend"></label>
                    <label>Informationen: <input type="text" class="zug_entry" data-zug="${i}" data-field="Informationen"></label>
                    <label>Via-Halte: <input type="text" class="zug_entry" data-zug="${i}" data-field="${via1}"></label>
                    <label>Via-Prioritäten: <input type="text" class="zug_entry" data-zug="${i}" data-field="${via2}"></label>
                    <label class="checkbox-label-vertical">Ankunft: <input type="checkbox" class="zug_checkbox" data-zug="${i}" data-field="Ankunft"></label>
                    ${extraFieldsRow1}
                </div>
                <div class="form-row">
                    <label class="radio-group">Richtung:
                        <div class="options">
                            <label><input type="radio" name="richtung${i}" value="0" class="richtung_radio" data-zug="${i}"> Links</label>
                            <label><input type="radio" name="richtung${i}" value="1" checked class="richtung_radio" data-zug="${i}"> Rechts</label>
                        </div>
                    </label>
                    <label>Bahnsteiglänge: <input type="text" class="zug_entry short-input" data-zug="${i}" data-field="PlatformLength" value="420"></label>
                    <label>Startmeter: <input type="text" class="zug_entry short-input" data-zug="${i}" data-field="TrainStart" value="0"></label>
                    ${extraFieldsRow2}
                    <label class="checkbox-label-vertical">Skalieren: <input type="checkbox" class="zug_checkbox" data-zug="${i}" data-field="Skalieren"></label>
                    <label class="checkbox-label-vertical">Zugteilung: <input type="checkbox" class="zug_checkbox" data-zug="${i}" data-field="Zugteilung"></label>
                </div>
                <div class="form-row action-row">
                    <button class="export_formation btn-secondary" data-zug="${i}">⬇️ Wagenreihung exportieren</button>
                    <button class="import_formation btn-secondary" data-zug="${i}">⬆️ Wagenreihung importieren</button>
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
    trainDisplay.updateAll();
});