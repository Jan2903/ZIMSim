// js/models/formation.js
import { Coach } from './coach.js';

/**
 * Repräsentiert eine Zuggruppe innerhalb einer Formation (ein Zugteil).
 * Speichert alle DB-API transport-Tags zur Identifizierung.
 */
export class FormationGroup {
    constructor(data = {}) {
        this.name = data.name || '';   // Triebzugname ("T0423371", "ICE1130")

        // Transport-Tags (aus DB API, zur Identifizierung)
        this.transport = {
            category: data.transport?.category || '',           // "S", "ICE", "IC", "RE"
            destination: data.transport?.destination || { name: '' },  // { name: "Weil der Stadt" }
            journeyID: data.transport?.journeyID || '',         // Korrelation zur Journey
            line: data.transport?.line || '',                    // Liniennummer
            number: data.transport?.number ?? 0,                // Zugnummer als Zahl
            type: data.transport?.type || 'UNKNOWN'             // "HIGH_SPEED_TRAIN" etc.
        };

        this.coaches = (data.coaches || data.vehicles || []).map(c => new Coach(c));
    }

    /** Convenience: Ziel dieses Zugteils */
    get destination() {
        return this.transport.destination?.name || '';
    }

    /** Convenience: Formatierte Zugnummer (z.B. "ICE 1545", "S 7922") */
    get trainNumber() {
        const { category, number } = this.transport;
        if (!category && !number) return '';
        if (!category) return String(number);
        if (!number) return category;
        return `${category} ${number}`;
    }
}

/**
 * Repräsentiert die Wagenreihung einer Journey.
 * Enthält eine oder mehrere FormationGroups (Zugteile).
 */
export class Formation {
    constructor(data = {}) {
        this.groups = (data.groups || []).map(g => new FormationGroup(g));

        // Bahnsteig-Daten aus der DB API
        this.platform = data.platform || null;
        // { start: 0, end: 210, name: "2" }
    }

    /** Gesamtzahl der Wagen über alle Gruppen */
    get totalCoaches() {
        return this.groups.reduce((sum, g) => sum + g.coaches.length, 0);
    }

    /** Ist die Formation leer (keine Wagen)? */
    get isEmpty() {
        return this.groups.length === 0 || this.totalCoaches === 0;
    }
}
