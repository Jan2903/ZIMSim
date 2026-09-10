// js/models/journeyStore.svelte.js
import { Journey } from './journey.svelte.js';
import { Platform } from '../station/platform.svelte.js';
import { MOT_ALL_KEYS } from '../station/motManager.js';
import { JourneyReorderService } from './services/journeyReorderService.js';
import { JourneyCouplingService } from './services/journeyCouplingService.js';
import { JourneyLinkingService } from './services/journeyLinkingService.js';
import { JourneyFilterService } from './services/journeyFilterService.js';
import { DynamicTextService } from './services/dynamicTextService.js';
import { JourneyImportService } from './services/journeyImportService.js';
import { JourneyStorageService } from './services/journeyStorageService.js';

/**
 * Zentrale Datenverwaltung (Façade & reaktiver Svelte 5 Store).
 * Hält den reaktiven Zustand für Fahrten, Stationen, Gleise und Filter,
 * und delegiert Fachlogik an spezialisierte Services.
 */
export class JourneyStore {
    // Station-Kontext
    stationContext = $state({
        stationName: '',
        stationId: '',
        platform: new Platform()
    });

    // Speichert importierte Bahnsteigkonfigurationen (Key: Gleisbezeichnung)
    platforms = $state({});

    // Dynamische Journey-Liste (keine feste Anzahl)
    journeys = $state([]);

    // NRW-Modus (global)
    nrwMode = $state(false);

    // Verkehrsmittel Filter
    activeMots = $state([...MOT_ALL_KEYS]);

    // Gleis Filter
    activeTracks = $state([]);

    // Eigene vom User angelegte Stationen
    customStations = $state([]);

    constructor() {}

    /**
     * Fügt eine neue benutzerdefinierte Station hinzu.
     * @param {string} name
     * @returns {object}
     */
    addCustomStation(name) {
        const id = 'custom-' + crypto.randomUUID().split('-')[0];
        const newStation = {
            ibnr: id,
            name: name,
            aliases: [],
            nameKurz: name.substring(0, 15),
            ds100: 'X' + name.substring(0, 3).toUpperCase(),
            kategorie: 7
        };
        this.customStations.push(newStation);
        return newStation;
    }

    // ==========================================
    // Journey CRUD
    // ==========================================

    /**
     * Fügt eine neue Journey hinzu.
     * @param {object} [data] - Optionale Initialisierungsdaten
     * @returns {Journey} Die erstellte Journey
     */
    addJourney(data = {}) {
        const journey = new Journey(data);
        this.journeys.push(journey);
        return journey;
    }

    /**
     * Entfernt eine Journey anhand ihrer ID.
     * @param {string} id
     * @returns {boolean} true wenn gefunden und entfernt
     */
    removeJourney(id) {
        const idx = this.journeys.findIndex(j => j.id === id);
        if (idx < 0) return false;

        // Verknüpfung aufräumen
        this.unlinkJourney(id);

        // Coupling aufräumen
        const journey = this.journeys[idx];
        if (journey.couplingGroupId) {
            this.uncoupleJourney(id);
        }

        this.journeys.splice(idx, 1);
        return true;
    }

    /**
     * Findet eine Journey anhand ihrer ID.
     * @param {string} id
     * @returns {Journey|undefined}
     */
    getJourney(id) {
        return this.journeys.find(j => j.id === id);
    }

    /**
     * Aktualisiert den Store mit gemappten IRIS Daten.
     * @param {Array} journeysData 
     */
    upsertIrisJourneys(journeysData) {
        JourneyImportService.upsertIrisJourneys(
            this.journeys,
            journeysData,
            (jData) => this.addJourney(jData),
            (id) => this.removeJourney(id)
        );
    }

    // ==========================================
    // Reordering & Sortierung
    // ==========================================

    /**
     * Sortiert alle Fahrten aufsteigend nach ihrer Abfahrts-/Ankunftszeit.
     * Nutzt bevorzugt Echtzeitdaten (_effectiveTimeMs).
     */
    sortJourneys() {
        JourneyReorderService.sortJourneys(this.journeys);
    }

    /**
     * Ermittelt Start- und Endindex eines Journey-Blocks (inklusive Kupplung).
     * @param {string} id - Journey-ID
     * @returns {{startIndex: number, endIndex: number}|null}
     */
    getJourneyBlockBounds(id) {
        return JourneyReorderService.getBlockBounds(this.journeys, id);
    }

    /**
     * Verschiebt einen Block (einzeln oder gekuppelt) um eine Position nach oben.
     * @param {string} id - Journey-ID aus dem Block
     */
    moveJourneyGroupUp(id) {
        return JourneyReorderService.moveGroupUp(this.journeys, id);
    }

    /**
     * Verschiebt einen Block (einzeln oder gekuppelt) um eine Position nach unten.
     * @param {string} id - Journey-ID aus dem Block
     */
    moveJourneyGroupDown(id) {
        return JourneyReorderService.moveGroupDown(this.journeys, id);
    }

    /**
     * Verschiebt einen Block an einen Ziel-Index (Drag & Drop).
     * @param {string} id - Journey-ID aus dem gezogenen Block
     * @param {number} targetIndex - Wo der Block eingefügt werden soll (vor der Entnahme berechnet!)
     */
    moveJourneyGroupToIndex(id, targetIndex) {
        return JourneyReorderService.moveGroupToIndex(this.journeys, id, targetIndex);
    }

    // ==========================================
    // Display-Zuweisung & Filterung
    // ==========================================

    /**
     * Prüft, ob eine Journey in der Listenansicht ausgeblendet werden soll.
     * @param {object} journey
     * @param {boolean} [hideLinkedArrivals=false]
     * @param {boolean} [isExpanded=false]
     * @returns {boolean}
     */
    isJourneyHidden(journey, hideLinkedArrivals = false, isExpanded = false) {
        return JourneyFilterService.isJourneyHidden(
            journey,
            this.activeMots,
            this.activeTracks,
            this.journeys,
            hideLinkedArrivals,
            isExpanded
        );
    }

    /**
     * Gibt alle sichtbaren Journeys zurück (visible === true und passendes Verkehrsmittel).
     * @param {object} [options={ boardType: 'default' }] - Filter-Optionen
     * @returns {Journey[]}
     */
    getVisibleJourneys(options = { boardType: 'default' }) {
        return JourneyFilterService.getVisible(this.journeys, this.activeMots, this.activeTracks, options);
    }

    /**
     * Gibt alle sichtbaren Journey-Gruppen zurück (gekoppelte Züge zusammengefasst).
     * @param {object} [options={ boardType: 'default' }]
     * @returns {Journey[][]}
     */
    getVisibleJourneyGroups(options = { boardType: 'default' }) {
        return JourneyFilterService.getVisibleGroups(this.journeys, this.activeMots, this.activeTracks, options);
    }

    /**
     * Gibt die Journey(s) für einen bestimmten Screen-Slot zurück.
     * Bei gekoppelten Journeys werden alle Journeys der Coupling-Gruppe zurückgegeben.
     *
     * @param {number} slot - 1=Hauptmonitor, 2=Neben1, 3=Neben2
     * @param {object} [options={ boardType: 'default' }] - Filter-Optionen
     * @returns {Journey[]} Array von Journeys (1 oder mehrere bei Coupling)
     */
    getJourneysForSlot(slot, options = { boardType: 'default' }) {
        return JourneyFilterService.getForSlot(this.journeys, this.activeMots, this.activeTracks, slot, options);
    }

    /**
     * Expandiert eine Journey zu ihrer Coupling-Gruppe.
     * @param {object} journey
     * @returns {Journey[]}
     */
    expandCoupling(journey) {
        return JourneyCouplingService.expandCoupling(this.journeys, journey);
    }

    /**
     * Rückwärtskompatibilität für ältere Renderer-Aufrufe.
     * @deprecated Nutzen Sie expandCoupling()
     */
    _expandCoupling(journey) {
        return this.expandCoupling(journey);
    }

    /**
     * Gibt die Journeys zurück, die für den rotierenden Monitor verfügbar sind.
     * Das sind sichtbare Journeys, die nicht auf Slot 1 oder 2 liegen.
     * @param {object} [options={ boardType: 'default' }] - Filter-Optionen
     * @returns {Journey[]}
     */
    getRotatingJourneys(options = { boardType: 'default' }) {
        return JourneyFilterService.getRotating(this.journeys, this.activeMots, this.activeTracks, options);
    }

    // ==========================================
    // Coupling (Flügelzüge)
    // ==========================================

    /**
     * Koppelt zwei Journeys zu einem Zugverband.
     * @param {string} id1 - ID der ersten Journey
     * @param {string} id2 - ID der zweiten Journey
     */
    coupleJourneys(id1, id2) {
        return JourneyCouplingService.couple(this.journeys, id1, id2);
    }

    /**
     * Entkoppelt eine Journey aus ihrem Zugverband.
     * @param {string} id
     */
    uncoupleJourney(id) {
        return JourneyCouplingService.uncouple(this.journeys, id);
    }

    /**
     * Gibt alle Journeys einer Coupling-Gruppe zurück.
     * @param {string} groupId
     * @returns {Journey[]}
     */
    getCouplingGroup(groupId) {
        return JourneyCouplingService.getCouplingGroup(this.journeys, groupId);
    }

    // ==========================================
    // Ankunft & Abfahrt Verknüpfung (Fahrzeugtausch / Wende)
    // ==========================================

    /**
     * Holt die verknüpfte Ankunfts-Journey einer Abfahrt, 
     * oder die verknüpfte Abfahrts-Journey einer Ankunft.
     * @param {string} id - Die ID der Journey
     * @returns {Journey|null} Die verknüpfte Journey oder null
     */
    getLinkedJourney(id) {
        return JourneyLinkingService.getLinkedJourney(this.journeys, id);
    }

    /**
     * Verknüpft eine Ankunft mit einer Abfahrt (in beliebiger Reihenfolge).
     * Löst vorherige Verknüpfungen beider Partner automatisch und sauber auf.
     * @param {string} id1 - ID der ersten Journey
     * @param {string} id2 - ID der zweiten Journey
     * @returns {boolean} true bei Erfolg
     */
    linkJourneys(id1, id2) {
        const success = JourneyLinkingService.link(this.journeys, id1, id2);
        if (success) {
            this.syncDynamicTexts();
        }
        return success;
    }

    /**
     * Löst die Verknüpfung einer Journey auf (egal ob Ankunft oder Abfahrt).
     * @param {string} id - Journey-ID
     */
    unlinkJourney(id) {
        const success = JourneyLinkingService.unlink(this.journeys, id);
        this.syncDynamicTexts();
        return success;
    }

    /**
     * Schaltet den Modus einer Journey zwischen Ankunft und Abfahrt um
     * und bereinigt bestehende Verknüpfungen.
     * @param {string} id - Journey-ID
     */
    toggleJourneyMode(id) {
        const success = JourneyLinkingService.toggleMode(this.journeys, id);
        this.syncDynamicTexts();
        return success;
    }

    /**
     * Verknüpft automatisch Ankünfte mit Abfahrten (Wenden / Fahrzeugtausch / Durchfahrten).
     * Basiert auf einem physikalischen Zeitstrahl (Gleisbelegungsplan).
     */
    autoLinkJourneys() {
        JourneyLinkingService.autoLink(this.journeys);
        this.syncDynamicTexts();
    }

    // ==========================================
    // Dynamische Texte
    // ==========================================

    /**
     * Synchronisiert dynamisch generierte Infotexte (Ankunftstext, Zugteilung)
     * als verwaltbare Bausteine im infoTexts-Array der jeweiligen Journey.
     */
    syncDynamicTexts() {
        DynamicTextService.sync(this.journeys, this.stationContext.platform);
    }

    // ==========================================
    // Import
    // ==========================================

    /**
     * Importiert Journeys aus einem DB-API Abfahrtstafel-JSON.
     * @param {object} data - { entries: [...] }
     * @returns {Journey[]} Die erstellten Journeys
     */
    importFromDepartureList(data) {
        const created = JourneyImportService.importList(data, false, this.journeys);
        this.autoLinkJourneys();
        return created;
    }

    /**
     * Importiert Journeys aus einem DB-API Ankunftstafel-JSON.
     * @param {object} data - { entries: [...] }
     * @returns {Journey[]} Die erstellten Journeys
     */
    importFromArrivalList(data) {
        const created = JourneyImportService.importList(data, true, this.journeys);
        this.autoLinkJourneys();
        return created;
    }

    /**
     * Importiert eine Journey aus einem DB-API Journey/Zuglauf-JSON.
     * Erkennt automatisch unterschiedliche Ankunfts/Abfahrtsgleise (Fahrzeugtausch) 
     * und spaltet die Journey dann auf.
     * @param {object} data - Das Zuglauf-Objekt
     * @returns {Journey|Journey[]} Die erstellte(n) Journey(s)
     */
    importFromJourney(data) {
        const result = JourneyImportService.importJourney(data, this.stationContext.stationId, this.journeys);
        this.autoLinkJourneys();
        return result;
    }

    /**
     * Importiert eine Formation und weist sie einer Journey zu.
     * @param {string} journeyId - Die Journey-ID
     * @param {object} data - Das Formation-JSON (DB API Format)
     */
    importFormation(journeyId, data) {
        const journey = this.getJourney(journeyId);
        if (!journey) return;
        
        JourneyImportService.importFormation(journey, data, this.platforms, this.stationContext);
        this.syncDynamicTexts();
    }

    // ==========================================
    // Tracks / Gleise
    // ==========================================

    /**
     * Sammelt alle einzigartigen Gleise (Plan- und Echtzeit-Gleis) aus allen Journeys.
     * @returns {string[]} Sortierte Liste der Gleise
     */
    getAllTracks() {
        return JourneyFilterService.getAllTracks(this.journeys);
    }

    // ==========================================
    // Export / Import
    // ==========================================

    /**
     * Exportiert den gesamten Store als JSON-kompatibles Objekt.
     * @returns {object}
     */
    exportAll() {
        return JourneyStorageService.exportState(this);
    }

    /**
     * Importiert einen komplett exportierten Store.
     * @param {object} data
     */
    importAll(data) {
        JourneyStorageService.importState(this, data);
    }

    // ==========================================
    // Rückwärtskompatibilitäts-Helfer für Renderer
    // ==========================================

    /**
     * Gibt das Platform-Objekt zurück (für formationRenderer).
     * Behält die alte trainData.platform-Schnittstelle bei.
     */
    get platform() {
        return this.stationContext.platform;
    }
}
