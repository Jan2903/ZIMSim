import { TrainGroup } from './trainGroup.js';

export class Departure {
    constructor(data = {}) {
        this.direction = data.direction !== undefined ? data.direction : 1; // 1 = Rechts, 0 = Links
        this.startMeter = data.startMeter || 0; // Wo am Bahnsteig hält der Zugverband?
        this.scrollText = data.scrollText || ''; // z.B. "Heute umgekehrte Wagenreihung"

        // Wandelt die Zugteile in TrainGroup-Objekte um
        this.groups = (data.groups || []).map(g => new TrainGroup(g));

        // Zusätzliche Eigenschaften für die Anzeige-Logik
        this.ankunft = data.ankunft || false;
        this.ausfall = data.ausfall || false;
        this.gleiswechsel = data.gleiswechsel || '0';
        this.infoscreen = data.infoscreen || false;
        this.skalieren = data.skalieren || false;
        this.verkehrtAb = data.verkehrtAb || '0';
        this.zugteilung = data.zugteilung || false; // UI-bezogenes Flag
    }
}