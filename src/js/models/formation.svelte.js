// js/models/formation.svelte.js
import { Coach } from './coach.svelte.js';

/**
 * Repräsentiert eine Zuggruppe innerhalb einer Formation (ein Zugteil).
 * Speichert alle DB-API transport-Tags zur Identifizierung.
 */
export class FormationGroup {
    name = $state('');
    transport = $state({
        category: '',
        destination: { name: '' },
        journeyID: '',
        line: '',
        number: 0,
        type: 'UNKNOWN'
    });
    coaches = $state([]);

    constructor(data = {}) {
        this.name = data.name || '';

        // Transport-Tags (aus DB API, zur Identifizierung)
        this.transport = {
            category: data.transport?.category || '',
            destination: data.transport?.destination || { name: '' },
            journeyID: data.transport?.journeyID || '',
            line: data.transport?.line || '',
            number: data.transport?.number ?? 0,
            type: data.transport?.type || 'UNKNOWN'
        };

        this.coaches = (data.coaches || data.vehicles || []).map(c => c instanceof Coach ? c : new Coach(c));
    }

    toJSON() {
        return {
            name: this.name,
            transport: this.transport,
            coaches: this.coaches
        };
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
    groups = $state([]);
    platformReference = $state(null);

    constructor(data = {}) {
        this.groups = (data.groups || []).map(g => g instanceof FormationGroup ? g : new FormationGroup(g));
        this.platformReference = data.platformReference || null;
    }

    toJSON() {
        return {
            groups: this.groups,
            platformReference: this.platformReference
        };
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
