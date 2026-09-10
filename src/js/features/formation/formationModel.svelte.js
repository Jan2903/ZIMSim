// js/features/formation/formationModel.svelte.js
import { Coach } from './coachModel.svelte.js';

/**
 * Repräsentiert eine Zuggruppe innerhalb einer Formation (ein Zugteil).
 * Speichert alle DB-API transport-Tags zur Identifizierung und hält die Liste der Wagen.
 */
export class FormationGroup {
    id = '';
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
        this.id = data.id || crypto.randomUUID();
        this.name = data.name || '';

        const destName = data.transport?.destination?.name !== undefined
            ? data.transport.destination.name
            : (typeof data.transport?.destination === 'string' ? data.transport.destination : '');

        this.transport = {
            category: data.transport?.category || '',
            destination: { name: destName || '' },
            journeyID: data.transport?.journeyID || '',
            line: data.transport?.line || '',
            number: data.transport?.number ?? 0,
            type: data.transport?.type || 'UNKNOWN'
        };

        this.coaches = (data.coaches || data.vehicles || []).map(c => c instanceof Coach ? c : new Coach(c));
    }

    /** Convenience: Ziel dieses Zugteils */
    get destination() {
        return this.transport.destination?.name || '';
    }

    set destination(val) {
        if (!this.transport.destination) {
            this.transport.destination = { name: val || '' };
        } else {
            this.transport.destination.name = val || '';
        }
    }

    /** Convenience: Formatierte Zugnummer (z.B. "ICE 1545", "S 7922") */
    get trainNumber() {
        const { category, number } = this.transport;
        if (!category && !number) return '';
        if (!category) return String(number);
        if (!number) return category;
        return `${category} ${number}`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            transport: this.transport,
            coaches: this.coaches
        };
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

    /** Gesamtzahl der Wagen über alle Gruppen */
    get totalCoaches() {
        return this.groups.reduce((sum, g) => sum + g.coaches.length, 0);
    }

    /** Ist die Formation leer (keine Wagen)? */
    get isEmpty() {
        return this.groups.length === 0 || this.totalCoaches === 0;
    }

    toJSON() {
        return {
            groups: this.groups,
            platformReference: this.platformReference
        };
    }
}
