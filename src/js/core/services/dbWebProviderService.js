// src/js/core/services/dbWebProviderService.js
import { DbWebApiService } from './dbWebApiService.js';
import { PROVIDER_CAPABILITIES, PROVIDER_LABELS } from './liveDataProviderService.js';
import { getSimulatedTime } from '../utils/config.js';
import { formatHHMM, formatYYYYMMDD } from '../utils/dateUtils.js';
import { parseTrainName } from '../../features/journey/trainNumberFormatter.js';

/**
 * @fileoverview Provider-Adapter für die bahn.de Web API (Reiselösung).
 *
 * Normalisiert die HAFAS-Antworten auf das einheitliche Board-Format
 * (siehe liveDataProviderService.js) und kapselt die formation-spezifischen Details:
 * Nur diese Quelle liefert Zwischenhalte (Vias), RIS-Gründe (R/Q) und eine HAFAS-Reise-ID.
 */
export class DbWebProviderService {
    /** Eindeutige Provider-ID. */
    static id = 'dbweb';

    /** Anzeigename des Providers. */
    static label = PROVIDER_LABELS.dbweb;

    /** Fähigkeiten des Providers. */
    static capabilities = PROVIDER_CAPABILITIES.dbweb;

    /**
     * Normalisiert einen bahn.de-Eintrag auf das einheitliche Board-Format.
     * @param {object} entry - Rohelement aus dem entries[]-Array
     * @param {boolean} isArrival - true bei einer Ankunftstafel
     * @returns {import('./liveDataProviderService.js').NormalizedEntry}
     */
    static normalizeEntry(entry, isArrival = false) {
        const vm = entry.verkehrmittel || {};
        const name = parseTrainName(vm.name, vm.linienNummer, vm.langText);

        // Vias: die Quelle liefert die Zwischenhalte inkl. des aktuellen Bahnhofs
        const vias = Array.isArray(entry.vias)
            ? [...entry.vias]
            : (Array.isArray(entry.zuglauf)
                ? [...entry.zuglauf]
                : (Array.isArray(entry.route)
                    ? [...entry.route]
                    : (Array.isArray(entry.ueber) ? [...entry.ueber] : [])));

        const rawMessages = Array.isArray(entry.meldungen) ? entry.meldungen : [];
        const ausfall = rawMessages.some(m => m.type === 'HALT_AUSFALL' || m.text === 'Halt entfällt');

        const fallbackDestination = vias.length > 0 ? vias[vias.length - 1] : '';
        const destination = entry.terminus || fallbackDestination;

        const trainNumber = String(vm.langText || vm.name || vm.linienNummer || '').replace(/\D/g, '').trim();

        return {
            trainNumber: trainNumber,
            category: vm.kurzText || vm.produktGattung || '',
            name: name,
            operator: vm.kurzText || '',
            destination: destination,
            origin: '',
            scheduledTime: entry.zeit ? entry.zeit.substring(11, 16) : '',
            expectedTime: entry.ezZeit ? entry.ezZeit.substring(11, 16) : '',
            platform: entry.gleis || '',
            expectedPlatform: entry.ezGleis || '',
            cancelled: Boolean(entry.cancelled) || ausfall,
            vias: vias,
            // Die bahn.de-API liefert keinen Wagenreihungs-Indikator - unbekannt
            formationAvailable: null,
            messages: rawMessages.map(m => ({
                priority: m.prioritaet,
                text: m.text || '',
                type: m.type
            })),
            journeyId: entry.journeyId || '',
            providerMeta: {
                evaNumber: entry.bahnhofsId || '',
                category: vm.kurzText || '',
                trainNumber: trainNumber,
                time: entry.zeit,
                journeyId: entry.journeyId || ''
            }
        };
    }

    /**
     * Lädt die Abfahrts- oder Ankunftstafel von bahn.de und normalisiert die Einträge.
     * @param {string} stationId - 7-stellige IBNR/EVA-Nummer
     * @param {object} [options={}]
     * @param {boolean} [options.isDeparture=true] - true für Abfahrt, false für Ankunft
     * @param {string} [options.dateStr=null] - Datum im Format 'YYYY-MM-DD'
     * @param {string} [options.timeStr=null] - Anfragezeit im Format 'HH:MM:SS'
     * @param {number} [options.maxVias=8] - Maximale Anzahl der Zwischenhalte
     * @param {string[]} [options.mots=null] - HAFAS-Verkehrsmittel-Codes
     * @returns {Promise<{ entries: Array<object>, totalDepartures: number }>}
     */
    static async getBoard(stationId, options = {}) {
        if (!stationId) return { entries: [], totalDepartures: 0 };

        const {
            isDeparture = true,
            dateStr = null,
            timeStr = null,
            maxVias = 8,
            mots = null
        } = options;

        const data = await DbWebApiService.getStationBoard(
            stationId,
            isDeparture,
            dateStr,
            timeStr,
            maxVias,
            mots
        );

        if (!data || !Array.isArray(data.entries)) {
            return { entries: [], totalDepartures: 0 };
        }

        const isArrival = !isDeparture;
        const entries = data.entries.map(entry => this.normalizeEntry(entry, isArrival));

        return { entries: entries, totalDepartures: entries.length };
    }

    /**
     * Sucht Haltestellen über die bahn.de-Ortsuche (inkl. Ausland & Nahverkehr).
     * @param {string} query - Suchbegriff
     * @param {number} [limit=10] - Maximale Anzahl der Treffer
     * @returns {Promise<Array<{ id: string, name: string, type: string }>>}
     */
    static async searchStations(query, limit = 10) {
        if (!query || !query.trim()) return [];

        const list = await DbWebApiService.searchLocation(query, limit);

        return (list || []).map(item => ({
            id: item.extId || item.id || '',
            name: item.name || '',
            type: item.type || 'ST'
        })).filter(item => item.id && item.name);
    }

    /**
     * Ruft die Wagenreihung (vehicle-sequence) für eine Fahrt ab.
     * @param {object} params
     * @param {string} params.stationId - EVA-Nummer des Bahnhofs
     * @param {string} params.category - Produktgattung (z.B. 'ICE')
     * @param {string} params.trainNumber - Zugnummer
     * @param {string} params.scheduledTime - Geplante Abfahrtszeit (HH:MM)
     * @param {object} [params.providerMeta] - Metadaten aus dem Board-Abgleich
     * @returns {Promise<object|null>} Rohdaten im Web-Format für den FormationParser
     */
    static async getFormation(params = {}) {
        const meta = params.providerMeta || {};
        const trainNumber = meta.trainNumber || params.trainNumber;
        if (!trainNumber) return null;

        const category = meta.category || params.category;

        const simDate = getSimulatedTime();
        let dateStr = formatYYYYMMDD(simDate);
        let timeStr = `${dateStr}T${params.scheduledTime || formatHHMM(simDate)}:00Z`;

        if (meta.time) {
            dateStr = meta.time.slice(0, 10);
            timeStr = meta.time.includes('Z') ? meta.time : `${meta.time}Z`;
        }

        return DbWebApiService.getFormation(category, trainNumber, dateStr, timeStr, params.stationId);
    }

    /**
     * Ruft den vollständigen Zuglauf (alle Zwischenhalte) für eine Reise-ID ab.
     * @param {string} journeyId - HAFAS-Reise-ID
     * @returns {Promise<object|null>}
     */
    static async getTripDetails(journeyId) {
        if (!journeyId) return null;
        return DbWebApiService.getTripDetails(journeyId);
    }
}
