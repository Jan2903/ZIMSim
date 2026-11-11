// src/js/core/state/liveDataConfig.svelte.js
/**
 * @fileoverview Globaler reaktiver Konfigurations-State für Live-Daten-Schnittstellen und Provider.
 * Verwaltet die angezeigte Detailansicht, die Wagenreihungs-Quelle und die gemeinsamen Board-Optionen
 * für DB Navigator und bahn.de. Der State wird persistent gespeichert.
 * Das `profile` bestimmt ausschließlich die angezeigte Detailansicht und NICHT, welche API abgefragt wird.
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
     * Angezeigte Detailansicht der Live-Daten-Einstellungen.
     * Bestimmt ausschließlich, welcher Detailblock rechts angezeigt wird - NICHT, welche API abgefragt wird.
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
     * Ob Wagenreihungen nach einem Tafel-Laden oder Formations-Abgleich automatisch
     * für sichtbare Züge nachgeladen werden.
     * @type {boolean}
     */
    autoFetchFormations: true,

    /**
     * Gemeinsame Optionen der Bahnhofstafel — gelten global für DB Navigator und DBweb.
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
 * Migriert dabei den alten Auto-Formations-Schalter (`board.fetchFormation` bzw.
 * `autoFetchActiveFormations`) auf `autoFetchFormations` und entfernt die Altkeys.
 * @returns {object}
 */
function loadPersistedConfig() {
    try {
        const persisted = StorageService.getItem(STORAGE_KEY, null);
        if (!persisted || typeof persisted !== 'object') {
            return createDefaults();
        }
        // Altkeys gezielt herauslösen, damit sie nicht ins Ergebnis gelangen.
        const { autoFetchActiveFormations, board: persistedBoard, ...rest } = persisted;
        const { fetchFormation, ...boardRest } = persistedBoard || {};
        const board = { ...DEFAULTS.board, ...boardRest };
        if (Array.isArray(board.verkehrsmittel)) {
            board.verkehrsmittel = [...board.verkehrsmittel];
        }
        // Migration: neuer Key zuerst, danach die bisherigen Altkeys, sonst Standard an.
        const autoFetchFormations =
            persisted.autoFetchFormations ?? fetchFormation ?? autoFetchActiveFormations ?? true;
        return {
            ...createDefaults(),
            ...rest,
            autoFetchFormations,
            board
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
