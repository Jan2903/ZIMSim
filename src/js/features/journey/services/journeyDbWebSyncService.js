// js/features/journey/services/journeyDbWebSyncService.js
import { DbWebApiService } from '../../../core/services/dbWebApiService.js';
import { JourneyImportService } from './journeyImportService.js';
import { journeyStore, trainDisplay } from '../../../core/state/stores.js';
import { Stop } from '../../station/stop.svelte.js';
import { getSimulatedTime } from '../../../core/utils/config.js';
import { formatHHMM, formatYYYYMMDD } from '../../../core/utils/dateUtils.js';

/**
 * @fileoverview Service für die Synchronisation und Anreicherung von Fahrten
 * mit der bahn.de Web API (Abfahrtstafel, Zuglauf und Wagenreihung).
 * Unterstützt sowohl den reinen DBweb-Modus als auch den Hybrid-Abgleich mit IRIS.
 */
export class JourneyDbWebSyncService {
    /**
     * Extrahiert Produktgattung und Zugnummer aus einem Journey-Objekt oder Namen.
     * @param {import('../journey.svelte.js').Journey} journey
     * @returns {{ gattung: string, zugnummer: string }}
     */
    static extractGattungAndNumber(journey) {
        const name = (journey.name || '').trim();
        let gattung = journey.produktGattung || '';
        let zugnummer = '';

        const numMatch = name.match(/(\d{1,6})/);
        if (numMatch) {
            zugnummer = numMatch[1];
        }

        const parts = name.split(/\s+/);
        if (!gattung && parts.length > 0 && isNaN(Number(parts[0]))) {
            gattung = parts[0];
        }

        return {
            gattung: (gattung || 'ICE').toUpperCase(),
            zugnummer: zugnummer || ''
        };
    }

    /**
     * Matcht ein Array von bahn.de Einträgen gegen eine Liste von existierenden Journeys (z.B. aus IRIS).
     * @private
     * @param {Array<object>} entries
     * @param {Array<import('../journey.svelte.js').Journey>} targetJourneys
     * @param {string} targetStationId
     * @returns {number} Anzahl neu gematchter Fahrten
     */
    static _matchDepartures(entries, targetJourneys, targetStationId) {
        let matched = 0;
        for (const entry of entries) {
            const vm = entry.verkehrmittel || {};
            const depTrainNumber = String(vm.langText || vm.name || vm.linienNummer || '').replace(/\D/g, '').trim();
            const depGattung = String(vm.kurzText || vm.produktGattung || '').trim().toUpperCase();
            const depTime = entry.zeit ? entry.zeit.substring(11, 16) : '';

            for (const j of targetJourneys) {
                // Bereits gematchte Fahrten überspringen
                if (j.dbWebMeta) continue;

                const { gattung: jGattung, zugnummer: jNum } = this.extractGattungAndNumber(j);

                // Match 1: Exakte oder enthaltene Zugnummer
                const numMatch = Boolean(depTrainNumber && jNum && (jNum === depTrainNumber || j.name.includes(depTrainNumber)));

                // Match 2: Selbe geplante Zeit und übereinstimmende Produktgattung
                const timeMatch = Boolean(
                    depTime && j.scheduledTime === depTime &&
                    depGattung && (jGattung === depGattung || j.name.toUpperCase().includes(depGattung))
                );

                if (numMatch || timeMatch) {
                    j.hasFormationAvailable = true;
                    j.dbWebMeta = {
                        evaNumber: entry.bahnhofsId || targetStationId,
                        category: depGattung || jGattung,
                        trainNumber: depTrainNumber || jNum,
                        time: entry.zeit,
                        journeyId: entry.journeyId || ''
                    };

                    // Vias behutsam anreichern, falls die Fahrt noch gar keine Zwischenhalte hatte
                    if ((!j.vias || j.vias.length === 0) && Array.isArray(entry.ueber) && entry.ueber.length > 1) {
                        j.vias = entry.ueber.slice(1);
                    }

                    matched++;
                    break;
                }
            }
        }
        return matched;
    }

    /**
     * Hybrid-Sync: Gleicht bestehende Fahrten (z.B. aus IRIS) mit bahn.de ab,
     * ohne die detaillierten IRIS-Halte oder RIS-Meldungen zu überschreiben.
     * Schaltet Wagenreihungen ([W]) frei und hinterlegt bahn.de-Metadaten.
     *
     * @param {Array<import('../journey.svelte.js').Journey>} [journeys=null]
     * @param {string} [stationId=null]
     * @returns {Promise<{ matchedCount: number, totalDepartures: number }>}
     */
    static async enrichJourneysWithDbWeb(journeys = null, stationId = null) {
        const targetJourneys = journeys || journeyStore.journeys;
        const targetStationId = stationId || journeyStore.stationContext.stationId;

        if (!targetStationId) {
            console.warn('[JourneyDbWebSyncService] Keine stationId vorhanden für bahn.de Abgleich.');
            return { matchedCount: 0, totalDepartures: 0 };
        }

        const simDate = getSimulatedTime();
        const dateStr = formatYYYYMMDD(simDate);
        const timeStr = `${formatHHMM(simDate)}:00`;

        let matchedCount = 0;
        let totalDepartures = 0;

        const data = await DbWebApiService.getStationBoard(targetStationId, true, dateStr, timeStr, 8);
        if (data && Array.isArray(data.entries)) {
            totalDepartures = data.entries.length;
            matchedCount = this._matchDepartures(data.entries, targetJourneys, targetStationId);
        }

        trainDisplay.updateAll();
        return { matchedCount, totalDepartures };
    }

    /**
     * Ruft Abfahrten oder Ankünfte von bahn.de ab und importiert sie in den Store.
     * Nutzt immer 8 Zwischenhalte (maxVias = 8) für originalgetreue ZIM-Vias.
     *
     * @param {string|number} eva - 7-stellige IBNR/EVA-Nummer
     * @param {boolean} [isDeparture=true] - true für Abfahrten, false für Ankünfte
     * @param {object} [options={}] - Optionale Filter (dateStr, timeStr, mots, clearBefore=false)
     * @returns {Promise<{ success: boolean, count: number, message?: string }>}
     */
    static async syncStationBoard(eva, isDeparture = true, options = {}) {
        if (!eva) {
            return { success: false, count: 0, message: 'Keine Bahnhofs-ID (EVA/IBNR) angegeben.' };
        }

        try {
            const data = await DbWebApiService.getStationBoard(
                eva,
                isDeparture,
                options.dateStr || null,
                options.timeStr || null,
                8, // Immer 8 Vias für ZIM-Anzeiger
                options.mots || null
            );

            if (!data || !Array.isArray(data.entries)) {
                return { success: false, count: 0, message: 'Keine Fahrplandaten von bahn.de erhalten.' };
            }

            if (options.clearBefore) {
                journeyStore.journeys = [];
            }

            const rawEntries = data.entries;
            const created = isDeparture
                ? journeyStore.importFromDepartureList(data)
                : journeyStore.importFromArrivalList(data);

            // Reichere die erstellten Journeys mit dbWebMeta für späteren Wagenreihungsabruf an
            for (const j of created) {
                const match = rawEntries.find(e => e.journeyId === j.journeyId);
                if (match) {
                    const vm = match.verkehrmittel || {};
                    const extracted = this.extractGattungAndNumber(j);
                    
                    j.dbWebMeta = {
                        evaNumber: match.bahnhofsId || String(eva),
                        category: vm.kurzText || extracted.gattung,
                        trainNumber: extracted.zugnummer || vm.name,
                        time: match.zeit,
                        journeyId: match.journeyId || ''
                    };
                    j.hasFormationAvailable = true;
                }
            }

            trainDisplay.updateAll();
            return { success: true, count: created.length };

        } catch (err) {
            console.error('[JourneyDbWebSyncService] Fehler beim Laden der Tafel:', err);
            return { success: false, count: 0, message: err.message || 'Fehler beim Laden.' };
        }
    }

    /**
     * Lädt den vollständigen Zuglauf (alle Zwischenhalte wie bei IRIS) für eine Fahrt nach.
     * @param {import('../journey.svelte.js').Journey} journey
     * @returns {Promise<{ success: boolean, stopsCount?: number, message?: string }>}
     */
    static async enrichTripDetails(journey) {
        if (!journey) return { success: false, message: 'Keine Fahrt angegeben.' };
        const jId = journey.journeyId || journey.dbWebMeta?.journeyId;
        if (!jId) {
            return { success: false, message: 'Keine Journey-ID für Detailabruf vorhanden.' };
        }

        try {
            const data = await DbWebApiService.getTripDetails(jId, false);
            if (!data || !Array.isArray(data.halte)) {
                return { success: false, message: 'Keine Haltestellendaten erhalten.' };
            }

            // Haltestellen über Stop-Modell mappen
            journey.stops = data.halte.map(halt => new Stop({
                name: halt.name,
                extId: halt.extId,
                departure: halt.abfahrt ? {
                    scheduled: halt.abfahrt.sollzeit || '',
                    expected: halt.abfahrt.echtzeit || ''
                } : null,
                arrival: halt.ankunft ? {
                    scheduled: halt.ankunft.sollzeit || '',
                    expected: halt.ankunft.echtzeit || ''
                } : null,
                platform: halt.gleis || '',
                ezGleis: halt.ezGleis || '',
                cancelled: halt.priorisierteMeldungen?.some(m => m.type === 'HALT_AUSFALL') || false,
                category: halt.kategorie || '',
                number: halt.nummer || '',
                routeIndex: halt.routeIdx,
                messages: halt.priorisierteMeldungen || [],
                risNotizen: halt.risNotizen || []
            }));

            // Haltestellen mit Station-DB anreichern
            journey.stops.forEach(s => s.enrichWithStationData());

            trainDisplay.updateAll();
            return { success: true, stopsCount: journey.stops.length };
        } catch (err) {
            console.error('[JourneyDbWebSyncService] Fehler beim Laden der Fahrtdetails:', err);
            return { success: false, message: err.message || 'Fehler beim Detailabruf.' };
        }
    }

    /**
     * Ruft die Wagenreihung von bahn.de für eine konkrete Fahrt ab und weist sie zu.
     * @param {import('../journey.svelte.js').Journey} journey
     * @returns {Promise<{ success: boolean, message?: string }>}
     */
    static async fetchFormationForJourney(journey) {
        if (!journey) return { success: false, message: 'Keine Fahrt übergeben.' };
        if (journey.isFetchingFormation) return { success: false, message: 'Anfrage läuft bereits.' };

        const stationId = journey.dbWebMeta?.evaNumber || journeyStore.stationContext.stationId;
        if (!stationId) {
            return { success: false, message: 'Keine Bahnhofs-EVA für Wagenreihung bekannt.' };
        }

        let category = journey.dbWebMeta?.category;
        let trainNumber = journey.dbWebMeta?.trainNumber;
        let rawTime = journey.dbWebMeta?.time;

        // Fallback-Extraktion falls noch kein dbWebMeta vorliegt
        if (!category || !trainNumber) {
            const extracted = this.extractGattungAndNumber(journey);
            category = extracted.gattung;
            trainNumber = extracted.zugnummer;
        }

        if (!trainNumber) {
            return { success: false, message: 'Keine Zugnummer für Wagenreihung ermittelbar.' };
        }

        const simDate = getSimulatedTime();
        let dateStr = formatYYYYMMDD(simDate);
        let timeStr = `${dateStr}T${journey.scheduledTime || formatHHMM(simDate)}:00Z`;

        if (rawTime) {
            dateStr = rawTime.slice(0, 10);
            timeStr = rawTime.includes('Z') ? rawTime : `${rawTime}Z`;
        }

        journey.isFetchingFormation = true;

        try {
            const data = await DbWebApiService.getFormation(
                category,
                trainNumber,
                dateStr,
                timeStr,
                stationId
            );

            if (!data) {
                journey.hasFormationAvailable = false;
                return { success: false, message: `Keine Wagenreihung für ${category} ${trainNumber} gefunden.` };
            }

            // Der bestehende JourneyImportService parst das Web-Format direkt
            JourneyImportService.importFormation(
                journey,
                data,
                journeyStore.platforms,
                journeyStore.stationContext
            );

            trainDisplay.updateAll();
            return { success: true };

        } catch (err) {
            console.error('[JourneyDbWebSyncService] Fehler beim Formationsabruf:', err);
            return { success: false, message: err.message || 'Fehler beim Abruf der Wagenreihung.' };
        } finally {
            journey.isFetchingFormation = false;
        }
    }

    /**
     * Lädt automatisch Wagenreihungen für alle aktuell sichtbaren Züge nach.
     * @returns {Promise<void>}
     */
    static async autoFetchActiveFormations() {
        const visible = journeyStore.journeys.filter(j => 
            j.displaySlot !== null && 
            !j.ankunft && 
            (!j.formation || !j.formation.groups || j.formation.groups.length === 0)
        );

        for (const j of visible) {
            await this.fetchFormationForJourney(j);
        }
    }
}
