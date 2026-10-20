// src/js/core/services/dbNavProviderService.js
import { DbNavApiService } from './dbNavApiService.js';
import { PROVIDER_CAPABILITIES, PROVIDER_LABELS } from './liveDataProviderService.js';
import { getSimulatedTime } from '../utils/config.js';
import { formatHHMM, formatYYYYMMDD } from '../utils/dateUtils.js';

/**
 * @fileoverview Provider-Adapter für die DB Navigator API (Vendo).
 *
 * Normalisiert die Vendo-Antworten auf das einheitliche Board-Format
 * (siehe liveDataProviderService.js) und kapselt die formation-spezifischen Details:
 * Der Wagenreihungs-Indikator und die exakte Gleisabschnitts-Würfelposition liefert
 * nur diese Quelle.
 */
export class DbNavProviderService {
    /** Eindeutige Provider-ID. */
    static id = 'db_navigator';

    /** Anzeigename des Providers. */
    static label = PROVIDER_LABELS.db_navigator;

    /** Fähigkeiten des Providers. */
    static capabilities = PROVIDER_CAPABILITIES.db_navigator;

    /**
     * Erzeugt einen ISO-Zeitstempel mit lokaler Zeitzonenabweichung (z.B. "2026-07-29T20:00:00+02:00")
     * für eine Journey anhand ihrer geplanten Uhrzeit (HH:MM).
     * @param {string} timeString - z.B. "14:35"
     * @returns {string}
     */
    static generateIsoDateTimeWithOffset(timeString) {
        const now = typeof getSimulatedTime === 'function' ? getSimulatedTime() : new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();

        if (timeString && timeString.includes(':')) {
            const [h, m] = timeString.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                hours = h;
                minutes = m;
            }
        }

        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

        // Zeitzonen-Offset berechnen (z.B. +02:00)
        const offsetMinutes = -date.getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const absOffset = Math.abs(offsetMinutes);
        const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
        const offsetMins = String(absOffset % 60).padStart(2, '0');
        const offsetStr = `${sign}${offsetHours}:${offsetMins}`;

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = '00';

        return `${year}-${month}-${day}T${hh}:${mm}:${ss}${offsetStr}`;
    }

    /**
     * Normalisiert einen Vendo-Bahnhofstafel-Eintrag auf das einheitliche Board-Format.
     * @param {object} item - Rohelement aus bahnhofstafelAbfahrt-/AnkunftPositionen
     * @param {boolean} isArrival - true bei einer Ankunftstafel
     * @param {string} stationId - Bahnhofs-ID (EVA) des aktuellen Bahnhofs
     * @returns {import('./liveDataProviderService.js').NormalizedEntry}
     */
    static normalizeEntry(item, isArrival, stationId) {
        const rawTime = isArrival ? (item.ankunftsDatum || item.abgangsDatum) : item.abgangsDatum;
        const ezTime = isArrival ? (item.ezAnkunftsDatum || item.ezAbgangsDatum) : item.ezAbgangsDatum;

        const schedTimeStr = rawTime ? rawTime.substring(11, 16) : '';
        const expTimeStr = ezTime ? ezTime.substring(11, 16) : '';

        const zugNr = String(item.zugnummer || item.verkehrsmittelNummer || '');
        const name = item.mitteltext || (item.kurztext ? `${item.kurztext} ${zugNr}`.trim() : zugNr || 'Zug');
        const dest = isArrival ? (item.herkunft || '') : (item.richtung || '');
        const origin = isArrival ? (item.richtung || '') : (item.herkunft || '');

        return {
            trainNumber: zugNr,
            category: item.kurztext || '',
            name: name,
            operator: '',
            destination: dest,
            origin: origin,
            scheduledTime: schedTimeStr,
            expectedTime: expTimeStr !== schedTimeStr ? expTimeStr : '',
            platform: item.gleis || '',
            expectedPlatform: item.ezGleis || '',
            cancelled: Boolean(item.ausfall),
            vias: Array.isArray(item.via) ? [...item.via] : [],
            // Die Vendo-API liefert einen verlässlichen Wagenreihungs-Indikator
            formationAvailable: Boolean(item.wagenreihung),
            messages: (item.meldungen || []).map(m => ({
                priority: m.prioritaet || 1,
                text: m.text || ''
            })),
            journeyId: '',
            providerMeta: {
                abgangsDatum: item.abgangsDatum,
                ezAbgangsDatum: item.ezAbgangsDatum,
                kurztext: item.kurztext,
                zugnummer: zugNr,
                evaNr: stationId,
                zuglaufId: item.zuglaufId || ''
            }
        };
    }

    /**
     * Lädt die Abfahrts- oder Ankunftstafel von DB Navigator und normalisiert die Einträge.
     * Unterstützt Lookbehind (-30 min) und mehrstündiges Laden (Standard: 2 Chunks).
     * @param {string} stationId - 7-stellige EVA-Nummer
     * @param {object} [options={}]
     * @param {boolean} [options.isDeparture=true] - true für Abfahrt, false für Ankunft
     * @param {string} [options.dateStr=null] - Datum im Format 'YYYY-MM-DD'
     * @param {string} [options.timeStr=null] - Anfragezeit im Format 'HH:MM'
     * @param {number} [options.lookbehindMinutes=30] - Minuten in die Vergangenheit
     * @param {number} [options.chunks=2] - Anzahl Stunden-Chunks
     * @param {string[]} [options.verkehrsmittel=null] - Vendo-Codes der Verkehrsmittel
     * @returns {Promise<{ entries: Array<object>, totalDepartures: number }>}
     */
    static async getBoard(stationId, options = {}) {
        if (!stationId) return { entries: [], totalDepartures: 0 };

        const {
            isDeparture = true,
            dateStr = null,
            timeStr = null,
            lookbehindMinutes = 30,
            chunks = 2,
            verkehrsmittel = null
        } = options;

        const simDate = getSimulatedTime();
        const startDate = new Date(simDate.getTime() - lookbehindMinutes * 60 * 1000);
        let currDateStr = dateStr || formatYYYYMMDD(startDate);
        let currTimeStr = timeStr || formatHHMM(startDate);

        const listKey = isDeparture ? 'bahnhofstafelAbfahrtPositionen' : 'bahnhofstafelAnkunftPositionen';
        const allItems = [];

        for (let chunkIdx = 0; chunkIdx < chunks; chunkIdx++) {
            const data = await DbNavApiService.getStationBoard(
                stationId, isDeparture, currDateStr, currTimeStr, verkehrsmittel
            );
            if (!data || !Array.isArray(data[listKey])) break;

            const chunkItems = data[listKey];
            if (chunkItems.length === 0) break;

            allItems.push(...chunkItems);

            // Nächster Chunk startet 1 Minute nach dem letzten Eintrag
            const lastItem = chunkItems[chunkItems.length - 1];
            const lastTimeIso = isDeparture
                ? (lastItem.abgangsDatum || lastItem.ankunftsDatum)
                : (lastItem.ankunftsDatum || lastItem.abgangsDatum);
            if (lastTimeIso && chunkIdx + 1 < chunks) {
                currDateStr = lastTimeIso.substring(0, 10);
                const [lh, lm] = lastTimeIso.substring(11, 16).split(':').map(Number);
                const nextMin = lm + 1;
                const nextDate = new Date(`${currDateStr}T00:00:00`);
                nextDate.setHours(lh, nextMin, 0, 0);
                currTimeStr = formatHHMM(nextDate);
                currDateStr = formatYYYYMMDD(nextDate);
            } else {
                break;
            }
        }

        const isArrival = !isDeparture;
        const entries = allItems.map(item => this.normalizeEntry(item, isArrival, stationId));

        return { entries: entries, totalDepartures: entries.length };
    }

    /**
     * Sucht Haltestellen über die Vendo Location Search API (z.B. für ÖPNV, Bus, Tram, Ausland).
     * @param {string} query - Suchbegriff
     * @returns {Promise<Array<{ id: string, name: string, type: string }>>}
     */
    static async searchStations(query) {
        if (!query || query.trim().length < 2) return [];

        const raw = await DbNavApiService.searchLocation(query);
        const list = Array.isArray(raw) ? raw : (raw?.locations || []);

        return list.map(item => ({
            id: item.id || item.extId || item.evaNr || '',
            name: item.name || '',
            type: item.locationType || item.type || 'Station'
        })).filter(item => item.id && item.name);
    }

    /**
     * Ruft die Wagenreihung (V4) für eine Fahrt ab.
     * @param {object} params
     * @param {string} params.stationId - EVA-Nummer des Bahnhofs
     * @param {string} params.category - Produktgattung (z.B. 'ICE')
     * @param {string} params.trainNumber - Zugnummer
     * @param {string} params.scheduledTime - Geplante Abfahrtszeit (HH:MM)
     * @param {object} [params.providerMeta] - Metadaten aus dem Board-Abgleich
     * @returns {Promise<object|null>} Rohdaten im App-Format für den FormationParser
     */
    static async getFormation(params = {}) {
        const meta = params.providerMeta || {};
        const zugnummer = meta.zugnummer || params.trainNumber;
        if (!zugnummer) return null;

        const kurztext = meta.kurztext || params.category;
        const abgangsDatum = meta.abgangsDatum || this.generateIsoDateTimeWithOffset(params.scheduledTime);

        return DbNavApiService.getFormation(params.stationId, abgangsDatum, kurztext, zugnummer);
    }

    /**
     * Ruft den vollständigen Zuglauf für eine Reise-ID ab.
     * @param {string} zuglaufId - Vendo-Zuglauf-ID
     * @returns {Promise<object|null>}
     */
    static async getTripDetails(zuglaufId) {
        if (!zuglaufId) return null;
        return DbNavApiService.getTripDetails(zuglaufId);
    }
}
