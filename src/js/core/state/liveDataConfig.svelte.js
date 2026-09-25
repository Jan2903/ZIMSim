// src/js/core/state/liveDataConfig.svelte.js

/**
 * @fileoverview Globaler reaktiver Konfigurations-State für Live-Daten-Schnittstellen und Provider.
 * Verwaltet die aktive Fahrplan-Quelle, Wagenreihungs-Dienste und Provider-spezifische Optionen.
 */

export const liveDataConfig = $state({
    /**
     * Aktive Primärquelle für Fahrplandaten & Bahnhofstafel.
     * Mögliche Werte: 'iris' | 'db_navigator' | 'dbweb'
     * @type {'iris' | 'db_navigator' | 'dbweb'}
     */
    timetableSource: 'iris',

    /**
     * Quelle für automatische Wagenreihungen (Formationen).
     * Mögliche Werte: 'db_navigator' | 'dbweb' | 'none'
     * @type {'db_navigator' | 'dbweb' | 'none'}
     */
    formationSource: 'db_navigator',

    /**
     * Ob Wagenreihungen für sichtbare Züge (z. B. Slot 1/2) automatisch im Hintergrund
     * nachgeladen werden sollen, sobald eine Fahrt als [W] markiert ist.
     * @type {boolean}
     */
    autoFetchActiveFormations: false,

    /**
     * DB Navigator spezifische Optionen
     */
    dbNav: {
        queryType: 'departures', // 'departures' | 'arrivals'
        fetchFormation: true,
        fetchDetails: true,
        includeNearby: false
    },

    /**
     * DBweb spezifische Optionen (Zukunft / In Vorbereitung)
     */
    dbWeb: {
        isAvailable: false
    }
});
