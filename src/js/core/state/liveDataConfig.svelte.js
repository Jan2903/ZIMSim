// src/js/core/state/liveDataConfig.svelte.js
/**
 * @fileoverview Globaler reaktiver Konfigurations-State für Live-Daten-Schnittstellen und Provider.
 * Verwaltet das aktive Optionsprofil, die Wagenreihungs-Quelle und die gemeinsamen Board-Optionen
 * für DB Navigator und bahn.de. Der State wird persistent gespeichert.
 */
import { StorageService } from '../services/storageService.js';

/**
 * LocalStorage-Key für die Live-Daten-Konfiguration.
 * @type {string}
 */
const STORAGE_KEY = 'zimsim_live_data_config';

/**
 * Standard-Konfiguration der Live-Daten-Schnittstellen.
 * @type {object}
 */
const DEFAULTS = {
    /**
     * Aktives Optionsprofil der Live-Daten-Einstellungen.
     * Bestimmt, welcher Optionsblock angezeigt wird - NICHT, welche API automatisch befragt wird.
     * Mögliche Werte: 'iris' | 'db_navigator' | 'dbweb'
     * @type {'iris' | 'db_navigator' | 'dbweb'}
     */
    profile: 'iris',

    /**
     * Quelle für Wagenreihungen (Formationen) bei Fahrten ohne eigene Quellen-Metadaten (z. B. aus IRIS).
     * Mögliche Werte: 'db_navigator' | 'dbweb'
     * @type {'db_navigator' | 'dbweb'}
     */
    formationSource: 'db_navigator',

    /**
     * Ob Wagenreihungen für sichtbare Züge (z. B. Slot 1/2) automatisch im Hintergrund
     * nachgeladen werden sollen, sobald eine Fahrt als [W] markiert ist.
     * @type {boolean}
     */
    autoFetchActiveFormations: false,

    /**
     * Gemeinsame Optionen der Bahnhofstafel für DB Navigator und bahn.de.
     * @type {object}
     */
    board: {
        /**
         * Abfrage-Typ der Bahnhofstafel.
         * @type {'departures' | 'arrivals'}
         */
        queryType: 'departures',

        /**
         * Maximale Anzahl der Zwischenhalte (Vias), sofern die Quelle welche liefert.
         * @type {number}
         */
        maxVias: 8,

        /**
         * Ob Wagenreihungen nach dem Laden der Tafel automatisch für sichtbare Züge abgerufen werden.
         * @type {boolean}
         */
        fetchFormation: true,

        /**
         * Verkehrsmittel-Filter der Bahnhofstafel als neutrale IDs (HAFAS-Kürzel).
         * Die Zuordnung zu den provider-spezifischen Codes erfolgt in der Provider-Fassade.
         * @type {string[]}
         */
        verkehrsmittel: [
            'ICE', 'EC_IC', 'IR', 'REGIONAL', 'SBAHN',
            'BUS', 'SCHIFF', 'UBAHN', 'TRAM', 'ANRUFPFLICHTIG'
        ]
    }
};

/**
 * Erzeugt eine tiefe Kopie der Standard-Konfiguration.
 * @returns {object}
 */
function createDefaults() {
    return {
        ...DEFAULTS,
        board: { ...DEFAULTS.board, verkehrsmittel: [...DEFAULTS.board.verkehrsmittel] }
    };
}

/**
 * Lädt die persistierte Konfiguration und führt sie mit den Standardwerten zusammen.
 * @returns {object}
 */
function loadPersistedConfig() {
    try {
        const persisted = StorageService.getItem(STORAGE_KEY, null);
        if (!persisted || typeof persisted !== 'object') {
            return createDefaults();
        }
        return {
            ...createDefaults(),
            ...persisted,
            board: { ...DEFAULTS.board, ...(persisted.board || {}) }
        };
    } catch (e) {
        console.warn('[LiveDataConfig] Fehler beim Laden der Konfiguration:', e);
        return createDefaults();
    }
}

/**
 * Globaler reaktiver Konfigurations-State der Live-Daten-Schnittstellen.
 */
export const liveDataConfig = $state(loadPersistedConfig());

/**
 * Speichert die aktuelle Konfiguration persistent.
 * @returns {void}
 */
export function saveLiveDataConfig() {
    try {
        StorageService.setItem(STORAGE_KEY, JSON.parse(JSON.stringify(liveDataConfig)));
    } catch (e) {
        console.warn('[LiveDataConfig] Fehler beim Speichern der Konfiguration:', e);
    }
}

// Persistenz automatisch auslösen, sobald sich ein Wert ändert.
// Das Lesen von liveDataConfig innerhalb des Effekts erzeugt die Reaktivitäts-Abhängigkeit.
$effect.root(() => {
    $effect(() => {
        saveLiveDataConfig();
    });
});
