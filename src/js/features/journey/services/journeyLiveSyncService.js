// src/js/features/journey/services/journeyLiveSyncService.js
import { JourneyImportService } from './journeyImportService.js';
import { JourneyCouplingService } from './journeyCouplingService.js';
import { journeyStore, trainDisplay } from '../../../core/state/stores.js';
import { liveDataConfig } from '../../../core/state/liveDataConfig.svelte.js';
import { Stop } from '../../station/stop.svelte.js';
import { DbNavProviderService } from '../../../core/services/dbNavProviderService.js';
import { DbWebProviderService } from '../../../core/services/dbWebProviderService.js';
import {
    getProviderLabel,
    getProviderMetaField,
    mapVerkehrsmittel
} from '../../../core/services/liveDataProviderService.js';

/**
 * @fileoverview Einheitlicher Synchronisations-Service für die Live-Daten-Provider.
 *
 * Kapselt das Laden der Bahnhofstafel, den Abgleich bestehender Fahrten (Hybrid-Modus)
 * und den Abruf der Wagenreihungen. Die provider-spezifischen Details liegen in den
 * Adapter-Klassen (dbNavProviderService.js / dbWebProviderService.js), die auf ein
 * gemeinsames Board-Format normalisieren.
 */
export class JourneyLiveSyncService {
    /**
     * Registry der verfügbaren Provider.
     * @type {Record<string, object>}
     */
    static PROVIDERS = {
        db_navigator: DbNavProviderService,
        dbweb: DbWebProviderService
    };

    /**
     * Liefert den Provider zu einer Provider-ID.
     * @param {string} providerId
     * @returns {object|null}
     */
    static getProvider(providerId) {
        return this.PROVIDERS[providerId] || null;
    }

    /**
     * Extrahiert Produktgattung und Zugnummer aus einem Journey-Objekt oder Namen.
     * @param {import('../journey.svelte.js').Journey} journey
     * @returns {{ gattung: string, zugnummer: string }}
     */
    static extractGattungAndNumber(journey) {
        const name = (journey.name || '').trim();
        const parts = name.split(/\s+/);

        let gattung = journey.produktGattung || '';
        let zugnummer = '';

        // Beispiel: "ICE 1545" oder "NX 89731" oder "RE 70 / 95835"
        const numMatch = name.match(/(\d{2,6})/);
        if (numMatch) {
            zugnummer = numMatch[1];
        }

        if (!gattung && parts.length > 0 && isNaN(Number(parts[0]))) {
            gattung = parts[0];
        }

        return {
            gattung: (gattung || 'ICE').toUpperCase(),
            zugnummer: zugnummer || ''
        };
    }

    /**
     * Matcht normalisierte Board-Einträge gegen eine Liste von Journeys.
     * @private
     * @param {Array<object>} entries - Normalisierte Board-Einträge
     * @param {Array<import('../journey.svelte.js').Journey>} targetJourneys
     * @param {string} providerId - Provider-ID
     * @returns {number} Anzahl neu gematchter Fahrten
     */
    static _matchDepartures(entries, targetJourneys, providerId) {
        const metaField = getProviderMetaField(providerId);
        let matched = 0;

        for (const entry of entries) {
            for (const j of targetJourneys) {
                // Bereits gematchte Fahrten überspringen
                if (metaField && j[metaField]) continue;

                const { zugnummer: jNum } = this.extractGattungAndNumber(j);

                // Match 1: Exakte oder enthaltene Zugnummer
                const numMatch = Boolean(
                    entry.trainNumber && jNum &&
                    (jNum === entry.trainNumber || j.name.includes(entry.trainNumber))
                );

                // Match 2: Selbe geplante Zeit und kompatible Gattung
                const timeMatch = Boolean(
                    entry.scheduledTime && j.scheduledTime === entry.scheduledTime &&
                    entry.category && (
                        j.name.toUpperCase().includes(entry.category.toUpperCase()) ||
                        (j.produktGattung && j.produktGattung.toUpperCase() === entry.category.toUpperCase())
                    )
                );

                if (numMatch || timeMatch) {
                    j.hasFormationAvailable = entry.formationAvailable !== false;
                    if (metaField && entry.providerMeta) {
                        j[metaField] = entry.providerMeta;
                    }
                    matched++;
                    break;
                }
            }
        }
        return matched;
    }

    /**
     * Lädt die Bahnhofstafel eines Providers und legt die Fahrten im Store ab.
     * @param {string} providerId - 'db_navigator' | 'dbweb'
     * @param {object} [options={}]
     * @param {string} [options.stationId=null] - Bahnhofs-ID (EVA)
     * @param {boolean} [options.isArrival=false] - true für Ankunftstafel
     * @param {boolean} [options.replace=false] - Vorherige Fahrten im Store leeren
     * @param {number} [options.maxVias] - Maximale Anzahl der Zwischenhalte
     * @param {string[]} [options.mots] - Neutrale Verkehrsmittel-IDs
     * @param {number} [options.lookbehindMinutes=30] - Minuten in die Vergangenheit
     * @param {number} [options.chunks=2] - Anzahl Stunden-Chunks
     * @returns {Promise<{ count: number, success: boolean, message?: string }>}
     */
    static async loadStationBoard(providerId, options = {}) {
        const provider = this.getProvider(providerId);
        if (!provider) {
            return { count: 0, success: false, message: `Unbekannte Datenquelle: ${providerId}` };
        }

        const targetStationId = options.stationId || journeyStore.stationContext.stationId;
        if (!targetStationId) {
            return { count: 0, success: false, message: 'Keine Bahnhofs-ID vorhanden.' };
        }

        const isArrival = options.isArrival === true;

        const { entries } = await provider.getBoard(targetStationId, {
            isDeparture: !isArrival,
            maxVias: options.maxVias ?? liveDataConfig.board.maxVias,
            mots: mapVerkehrsmittel(options.mots ?? liveDataConfig.board.verkehrsmittel, providerId),
            lookbehindMinutes: options.lookbehindMinutes ?? 30,
            chunks: options.chunks ?? options.maxChunks ?? 2
        });

        if (!entries || entries.length === 0) {
            return { count: 0, success: false, message: 'Keine Fahrten im aktuellen Zeitfenster gefunden.' };
        }

        if (options.replace) {
            journeyStore.clearJourneys();
        }

        const metaField = getProviderMetaField(providerId);
        const seenKeys = new Set();
        const createdJourneys = [];

        for (const entry of entries) {
            // Duplikate nach Zugnummer & Zeit (bzw. HAFAS-Reise-ID) filtern
            const dedupKey = `${entry.journeyId || entry.trainNumber}_${entry.scheduledTime}`;
            if (seenKeys.has(dedupKey)) continue;
            seenKeys.add(dedupKey);

            // Bereits im Store vorhandene HAFAS-Reise-ID überspringen
            if (entry.journeyId && journeyStore.journeys.some(j => j.journeyId === entry.journeyId)) {
                continue;
            }

            const journey = JourneyImportService.fromNormalizedEntry(entry, isArrival);
            journey.ankunft = isArrival;
            journey.hasFormationAvailable = entry.formationAvailable !== false;
            if (metaField && entry.providerMeta) {
                journey[metaField] = entry.providerMeta;
            }

            journeyStore.addJourney(journey);
            createdJourneys.push(journey);
        }

        if (JourneyCouplingService.detectCouplings(journeyStore.journeys)) {
            journeyStore.updateAllJourneySectors();
            journeyStore.syncDynamicTexts();
        }
        journeyStore.updateAllJourneySectors();
        journeyStore.autoLinkJourneys();
        trainDisplay.updateAll();

        return { count: createdJourneys.length, success: true };
    }

    /**
     * Gleicht bestehende Fahrten (z.B. aus IRIS) mit einer Quelle ab, um die
     * Wagenreihungs-Verfügbarkeit ([W]) und die provider-spezifischen Metadaten zu hinterlegen.
     * @param {string} providerId - 'db_navigator' | 'dbweb'
     * @param {object} [options={}]
     * @param {Array<import('../journey.svelte.js').Journey>} [options.journeys=null]
     * @param {string} [options.stationId=null]
     * @param {number} [options.lookbehindMinutes=30]
     * @param {number} [options.chunks=2]
     * @returns {Promise<{ matchedCount: number, totalDepartures: number }>}
     */
    static async enrichJourneys(providerId, options = {}) {
        const provider = this.getProvider(providerId);
        if (!provider) {
            return { matchedCount: 0, totalDepartures: 0 };
        }

        const targetJourneys = options.journeys || journeyStore.journeys;
        const targetStationId = options.stationId || journeyStore.stationContext.stationId;

        if (!targetStationId) {
            console.warn(`[JourneyLiveSyncService] Keine stationId vorhanden für den Abgleich mit ${getProviderLabel(providerId)}.`);
            return { matchedCount: 0, totalDepartures: 0 };
        }

        const { entries, totalDepartures } = await provider.getBoard(targetStationId, {
            isDeparture: true,
            maxVias: options.maxVias ?? liveDataConfig.board.maxVias,
            mots: mapVerkehrsmittel(options.mots ?? liveDataConfig.board.verkehrsmittel, providerId),
            lookbehindMinutes: options.lookbehindMinutes ?? 30,
            chunks: options.chunks ?? options.maxChunks ?? 2
        });

        const matchedCount = this._matchDepartures(entries, targetJourneys, providerId);

        trainDisplay.updateAll();
        return { matchedCount, totalDepartures };
    }

    /**
     * Ruft die Wagenreihung für eine Journey ab und weist sie zu.
     * Der Provider wird aus den Journey-Metadaten bestimmt, sonst aus der Konfiguration.
     * @param {import('../journey.svelte.js').Journey} journey
     * @returns {Promise<{ success: boolean, message?: string }>}
     */
    static async fetchFormationForJourney(journey) {
        if (!journey) return { success: false, message: 'Keine Fahrt ausgewählt.' };

        // Bevorzuge explizit vorhandene Metadaten
        let providerId = null;
        if (journey.dbWebMeta && !journey.dbNavMeta) {
            providerId = 'dbweb';
        } else if (journey.dbNavMeta && !journey.dbWebMeta) {
            providerId = 'db_navigator';
        }

        // Ansonsten anhand der konfigurierten Quelle
        if (!providerId) {
            providerId = liveDataConfig.formationSource === 'dbweb' ? 'dbweb' : 'db_navigator';
        }

        const provider = this.getProvider(providerId);
        if (!provider) {
            return { success: false, message: 'Keine aktive Wagenreihungs-Schnittstelle konfiguriert.' };
        }

        if (journey.isFetchingFormation) return { success: false, message: 'Anfrage läuft bereits.' };

        const meta = providerId === 'dbweb' ? journey.dbWebMeta : journey.dbNavMeta;
        const stationId = meta?.evaNumber || meta?.evaNr || journeyStore.stationContext.stationId;
        if (!stationId) {
            return { success: false, message: 'Keine Bahnhofs-EVA für Wagenreihung bekannt.' };
        }

        let category = meta?.category || meta?.kurztext;
        let trainNumber = meta?.trainNumber || meta?.zugnummer;

        // Fallback-Extraktion, falls noch kein vorheriger Board-Match stattfand
        if (!category || !trainNumber) {
            const extracted = this.extractGattungAndNumber(journey);
            category = category || extracted.gattung;
            trainNumber = trainNumber || extracted.zugnummer;
        }

        if (!trainNumber) {
            return { success: false, message: 'Keine Zugnummer zur Abfrage ermittelbar.' };
        }

        journey.isFetchingFormation = true;

        try {
            const data = await provider.getFormation({
                stationId: stationId,
                category: category,
                trainNumber: trainNumber,
                scheduledTime: journey.scheduledTime,
                providerMeta: meta
            });

            if (!data) {
                journey.hasFormationAvailable = false;
                return { success: false, message: `Keine Wagenreihung für ${category} ${trainNumber} gefunden.` };
            }

            // Der bestehende JourneyImportService parst beide Formate nativ
            JourneyImportService.importFormation(
                journey,
                data,
                journeyStore.platforms,
                journeyStore.stationContext
            );

            trainDisplay.updateAll();
            return { success: true };
        } catch (err) {
            console.error('[JourneyLiveSyncService] Fehler beim Formationsabruf:', err);
            return { success: false, message: err.message || 'Fehler beim Abruf der Wagenreihung.' };
        } finally {
            journey.isFetchingFormation = false;
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
            const data = await DbWebProviderService.getTripDetails(jId);
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
            console.error('[JourneyLiveSyncService] Fehler beim Laden der Fahrtdetails:', err);
            return { success: false, message: err.message || 'Fehler beim Detailabruf.' };
        }
    }

    /**
     * Lädt automatisch die Wagenreihung für sichtbare Fahrten (z.B. Haupt- und Nebenmonitor) nach,
     * sofern für diese eine Wagenreihung verfügbar ([W]) aber noch nicht geladen ist.
     * @param {number} [maxTrains=2] - Maximale Anzahl Fahrten, die sequenziell nachgeladen werden
     * @returns {Promise<number>} Anzahl erfolgreich geladener Formationen
     */
    static async autoFetchActiveFormations(maxTrains = 2) {
        const visibleJourneys = journeyStore.getVisibleJourneys();
        let fetched = 0;

        for (const j of visibleJourneys) {
            if (fetched >= maxTrains) break;

            const hasCoaches = j.formation?.groups?.some(g => g.coaches?.length > 0);
            if (j.hasFormationAvailable && !hasCoaches && !j.isFetchingFormation) {
                const res = await this.fetchFormationForJourney(j);
                if (res.success) {
                    fetched++;
                }
            }
        }

        return fetched;
    }
}
