// js/features/journey/services/journeyDbNavSyncService.js
import { DbNavApiService } from '../../../core/services/dbNavApiService.js';
import { JourneyImportService } from './journeyImportService.js';
import { journeyStore, trainDisplay } from '../../../core/state/stores.js';
import { Journey } from '../journey.svelte.js';
import { getSimulatedTime } from '../../../core/utils/config.js';

/**
 * @fileoverview Service für die Synchronisation und Anreicherung von Fahrten
 * mit DB Navigator / bahn.de Daten (Abfahrtstafel-Metadaten & Wagenreihung).
 */
export class JourneyDbNavSyncService {
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

        if (!gattung && parts.length > 0) {
            // Erste Komponente als Gattung nehmen, sofern sie keine Zahl ist
            if (isNaN(Number(parts[0]))) {
                gattung = parts[0];
            }
        }

        return {
            gattung: gattung || 'ICE',
            zugnummer: zugnummer || ''
        };
    }

    /**
     * Erzeugt einen ISO-Zeitstempel mit lokaler Zeitzonenabweichung (z.B. "2026-07-29T20:00:00+02:00")
     * für eine Journey anhand ihrer geplanten Uhrzeit (HH:MM).
     * @param {string} timeString - z.B. "14:35"
     * @returns {string}
     */
    static generateIsoDateTimeWithOffset(timeString) {
        const now = new Date();
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
     * Matcht ein Array von Abfahrtspositionen gegen eine Liste von Journeys.
     * @private
     * @param {Array<object>} departures
     * @param {Array<import('../journey.svelte.js').Journey>} targetJourneys
     * @param {string} targetStationId
     * @returns {number} Anzahl neu gematchter Fahrten
     */
    static _matchDepartures(departures, targetJourneys, targetStationId) {
        let matched = 0;
        for (const dep of departures) {
            const depTrainNumber = String(dep.zugnummer || dep.verkehrsmittelNummer || '').trim();
            const depGattung = String(dep.kurztext || '').trim();
            const hasWagenreihung = Boolean(dep.wagenreihung);
            const depTime = dep.abgangsDatum ? dep.abgangsDatum.substring(11, 16) : '';

            for (const j of targetJourneys) {
                // Bereits gematchte Fahrten überspringen
                if (j.dbNavMeta) continue;

                const { zugnummer: jNum } = this.extractGattungAndNumber(j);

                // Match 1: Exakte oder enthaltene Zugnummer
                const numMatch = Boolean(depTrainNumber && jNum && (jNum === depTrainNumber || j.name.includes(depTrainNumber)));
                
                // Match 2: Selbe geplante Zeit und ähnliche Gattung/Name
                const timeMatch = Boolean(depTime && j.scheduledTime === depTime && 
                    (depGattung && (j.name.toLowerCase().includes(depGattung.toLowerCase()) || (j.produktGattung && j.produktGattung.toLowerCase() === depGattung.toLowerCase()))));

                if (numMatch || timeMatch) {
                    j.hasFormation = hasWagenreihung;
                    j.dbNavMeta = {
                        abgangsDatum: dep.abgangsDatum,
                        ezAbgangsDatum: dep.ezAbgangsDatum,
                        kurztext: depGattung || j.produktGattung,
                        zugnummer: depTrainNumber || jNum,
                        evaNr: targetStationId,
                        zuglaufId: dep.zuglaufId || ''
                    };
                    matched++;
                    break;
                }
            }
        }
        return matched;
    }

    /**
     * Lädt die DB Navigator Abfahrtstafeln mit Lookbehind (-30 min) und optionalem 2. Chunk (+1h bis +2h),
     * und verknüpft die Wagenreihungs-Metadaten ([W] Indikator) mit den existierenden Journeys im Store.
     * @param {Array<import('../journey.svelte.js').Journey>} [journeys=null]
     * @param {string} [stationId=null]
     * @param {object} [options={}]
     * @param {number} [options.lookbehindMinutes=30] - Minuten in die Vergangenheit
     * @param {number} [options.maxChunks=2] - Maximale Anzahl Stunden-Chunks (1 oder 2)
     * @returns {Promise<{ matchedCount: number, totalDepartures: number }>}
     */
    static async enrichJourneysWithDbNav(journeys = null, stationId = null, options = {}) {
        const targetJourneys = journeys || journeyStore.journeys;
        const targetStationId = stationId || journeyStore.stationContext.stationId;

        if (!targetStationId) {
            console.warn('[JourneyDbNavSyncService] Keine stationId vorhanden für DBNav-Abfrage.');
            return { matchedCount: 0, totalDepartures: 0 };
        }

        const simDate = getSimulatedTime();
        const lookbehindMinutes = options.lookbehindMinutes ?? 30;
        const maxChunks = options.maxChunks ?? 2;

        // Startzeit für Chunk 1: simDate minus lookbehindMinutes (z.B. 30 Minuten zurück)
        const startDate = new Date(simDate.getTime() - lookbehindMinutes * 60 * 1000);
        const startY = startDate.getFullYear();
        const startM = String(startDate.getMonth() + 1).padStart(2, '0');
        const startD = String(startDate.getDate()).padStart(2, '0');
        const startH = String(startDate.getHours()).padStart(2, '0');
        const startMin = String(startDate.getMinutes()).padStart(2, '0');
        const chunk1DateStr = `${startY}-${startM}-${startD}`;
        const chunk1TimeStr = `${startH}:${startMin}`;

        let matchedCount = 0;
        let totalDepartures = 0;
        let lastDepTimeIso = null;

        // === Chunk 1: Lookbehind (-30 min) bis ca. +45-60 min ===
        const boardData1 = await DbNavApiService.getStationBoard(targetStationId, true, chunk1DateStr, chunk1TimeStr);
        if (boardData1 && Array.isArray(boardData1.bahnhofstafelAbfahrtPositionen)) {
            const deps1 = boardData1.bahnhofstafelAbfahrtPositionen;
            totalDepartures += deps1.length;
            matchedCount += this._matchDepartures(deps1, targetJourneys, targetStationId);

            if (deps1.length > 0) {
                lastDepTimeIso = deps1[deps1.length - 1].abgangsDatum;
            }
        }

        // === Chunk 2: Folgestunde für Züge in +1h bis +2h (nur falls noch ungematchte Fahrten existieren) ===
        const hasUnmatchedJourneys = targetJourneys.some(j => !j.dbNavMeta && j.scheduledTime);
        if (hasUnmatchedJourneys && maxChunks >= 2) {
            let chunk2DateStr = chunk1DateStr;
            let chunk2TimeStr = null;

            if (lastDepTimeIso) {
                chunk2DateStr = lastDepTimeIso.substring(0, 10);
                const [lh, lm] = lastDepTimeIso.substring(11, 16).split(':').map(Number);
                const nextMin = lm + 1;
                const c2Date = new Date(`${chunk2DateStr}T00:00:00`);
                c2Date.setHours(lh, nextMin, 0, 0);
                chunk2TimeStr = `${String(c2Date.getHours()).padStart(2, '0')}:${String(c2Date.getMinutes()).padStart(2, '0')}`;
                chunk2DateStr = `${c2Date.getFullYear()}-${String(c2Date.getMonth() + 1).padStart(2, '0')}-${String(c2Date.getDate()).padStart(2, '0')}`;
            } else {
                // Fallback: 1 Stunde nach Start von Chunk 1
                const c2Date = new Date(startDate.getTime() + 60 * 60 * 1000);
                chunk2TimeStr = `${String(c2Date.getHours()).padStart(2, '0')}:${String(c2Date.getMinutes()).padStart(2, '0')}`;
                chunk2DateStr = `${c2Date.getFullYear()}-${String(c2Date.getMonth() + 1).padStart(2, '0')}-${String(c2Date.getDate()).padStart(2, '0')}`;
            }

            const boardData2 = await DbNavApiService.getStationBoard(targetStationId, true, chunk2DateStr, chunk2TimeStr);
            if (boardData2 && Array.isArray(boardData2.bahnhofstafelAbfahrtPositionen)) {
                const deps2 = boardData2.bahnhofstafelAbfahrtPositionen;
                totalDepartures += deps2.length;
                matchedCount += this._matchDepartures(deps2, targetJourneys, targetStationId);
            }
        }

        console.log(`[JourneyDbNavSyncService] DBNav-Abgleich abgeschlossen: ${matchedCount} Fahrten gematcht (aus ${totalDepartures} DBNav-Abfahrten).`);
        return { matchedCount, totalDepartures };
    }

    /**
     * Lädt die Wagenreihung (Formation V4) für eine konkrete Fahrt und weist sie zu.
     * @param {import('../journey.svelte.js').Journey} journey
     * @returns {Promise<{ success: boolean, message?: string }>}
     */
    static async fetchFormationForJourney(journey) {
        if (!journey) return { success: false, message: 'Keine Fahrt übergeben.' };
        if (journey.isFetchingFormation) return { success: false, message: 'Anfrage läuft bereits.' };

        const stationId = journey.dbNavMeta?.evaNr || journeyStore.stationContext.stationId;
        if (!stationId) {
            return { success: false, message: 'Keine Bahnhofs-EVA bekannt.' };
        }

        let abgangsDatum = journey.dbNavMeta?.abgangsDatum;
        let kurztext = journey.dbNavMeta?.kurztext;
        let zugnummer = journey.dbNavMeta?.zugnummer;

        // Fallback-Extraktion, falls noch kein vorheriger Board-Match stattfand
        if (!abgangsDatum || !kurztext || !zugnummer) {
            const extracted = this.extractGattungAndNumber(journey);
            kurztext = extracted.gattung;
            zugnummer = extracted.zugnummer;
            abgangsDatum = this.generateIsoDateTimeWithOffset(journey.scheduledTime);
        }

        if (!zugnummer) {
            return { success: false, message: 'Keine Zugnummer zur Abfrage ermittelbar.' };
        }

        journey.isFetchingFormation = true;

        try {
            const data = await DbNavApiService.getFormation(stationId, abgangsDatum, kurztext, zugnummer);
            
            if (!data) {
                return { success: false, message: 'Keine Formationsdaten für diesen Zug erhalten.' };
            }

            // Bestehender JourneyImportService parst das V4-Format nativ
            JourneyImportService.importFormation(
                journey, 
                data, 
                journeyStore.platforms, 
                journeyStore.stationContext
            );

            journey.hasFormation = true;
            trainDisplay.updateAll();

            return { success: true };
        } catch (err) {
            console.error('[JourneyDbNavSyncService] Fehler beim Formationsabruf:', err);
            return { success: false, message: err.message || 'Fehler beim Abruf.' };
        } finally {
            journey.isFetchingFormation = false;
        }
    }

    /**
     * Lädt die Abfahrts- oder Ankunftstafel von DB Navigator und erzeugt Journeys im Store.
     * Unterstützt Lookbehind (-30 min) und mehrstündiges Laden (Standard: 2 Chunks).
     * @param {string} [stationId] - 7-stellige EVA-Nummer
     * @param {boolean} [isArrival=false] - true für Ankunftstafel
     * @param {boolean} [replaceExisting=false] - Vorherige Fahrten im Store leeren
     * @param {object} [options={}]
     * @param {number} [options.lookbehindMinutes=30] - Minuten in die Vergangenheit
     * @param {number} [options.chunks=2] - Anzahl Stunden-Chunks (Standard 2)
     * @returns {Promise<{ count: number, success: boolean, message?: string }>}
     */
    static async loadStationBoard(stationId = null, isArrival = false, replaceExisting = false, options = {}) {
        const targetStationId = stationId || journeyStore.stationContext.stationId;
        if (!targetStationId) {
            return { count: 0, success: false, message: 'Keine Bahnhofs-ID vorhanden.' };
        }

        const simDate = getSimulatedTime();
        const lookbehindMinutes = options.lookbehindMinutes ?? 30;
        const totalChunks = options.chunks ?? 2;

        const startDate = new Date(simDate.getTime() - lookbehindMinutes * 60 * 1000);
        let currDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        let currTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;

        if (replaceExisting) {
            journeyStore.clearJourneys();
        }

        const listKey = isArrival ? 'bahnhofstafelAnkunftPositionen' : 'bahnhofstafelAbfahrtPositionen';
        const allItems = [];

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            const data = await DbNavApiService.getStationBoard(targetStationId, !isArrival, currDateStr, currTimeStr);
            if (!data || !Array.isArray(data[listKey])) break;

            const chunkItems = data[listKey];
            if (chunkItems.length === 0) break;

            allItems.push(...chunkItems);

            // Nächster Chunk startet 1 Minute nach dem letzten Eintrag
            const lastItem = chunkItems[chunkItems.length - 1];
            const lastTimeIso = isArrival ? (lastItem.ankunftsDatum || lastItem.abgangsDatum) : lastItem.abgangsDatum;
            if (lastTimeIso && chunkIdx + 1 < totalChunks) {
                currDateStr = lastTimeIso.substring(0, 10);
                const [lh, lm] = lastTimeIso.substring(11, 16).split(':').map(Number);
                const nextMin = lm + 1;
                const nextDate = new Date(`${currDateStr}T00:00:00`);
                nextDate.setHours(lh, nextMin, 0, 0);
                currTimeStr = `${String(nextDate.getHours()).padStart(2, '0')}:${String(nextDate.getMinutes()).padStart(2, '0')}`;
                currDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
            } else {
                break;
            }
        }

        if (allItems.length === 0) {
            return { count: 0, success: false, message: 'Keine Fahrten im aktuellen Zeitfenster gefunden.' };
        }

        // Duplikate nach Zugnummer & Zeit filtern
        const seenKeys = new Set();
        const createdJourneys = [];

        for (const item of allItems) {
            const rawTime = isArrival ? (item.ankunftsDatum || item.abgangsDatum) : item.abgangsDatum;
            const ezTime = isArrival ? (item.ezAnkunftsDatum || item.ezAbgangsDatum) : item.ezAbgangsDatum;
            
            const schedTimeStr = rawTime ? rawTime.substring(11, 16) : '';
            const expTimeStr = ezTime ? ezTime.substring(11, 16) : '';

            const zugNr = String(item.zugnummer || item.verkehrsmittelNummer || '');
            const dedupKey = `${zugNr}_${schedTimeStr}`;
            if (seenKeys.has(dedupKey)) continue;
            seenKeys.add(dedupKey);

            const name = item.mitteltext || (item.kurztext ? `${item.kurztext} ${zugNr}`.trim() : zugNr || 'Zug');
            const dest = item.richtung || (isArrival ? (item.herkunft || '') : '');

            const journey = new Journey({
                name,
                destination: dest,
                scheduledTime: schedTimeStr,
                expectedTime: expTimeStr !== schedTimeStr ? expTimeStr : '',
                platform: item.gleis || '',
                ezGleis: item.ezGleis || '',
                ausfall: Boolean(item.ausfall),
                ankunft: isArrival,
                vias: Array.isArray(item.via) ? [...item.via] : [],
                hasFormation: Boolean(item.wagenreihung),
                dbNavMeta: {
                    abgangsDatum: item.abgangsDatum,
                    ezAbgangsDatum: item.ezAbgangsDatum,
                    kurztext: item.kurztext,
                    zugnummer: zugNr,
                    evaNr: targetStationId,
                    zuglaufId: item.zuglaufId || ''
                }
            });

            if (item.meldungen && Array.isArray(item.meldungen)) {
                journey.messages = item.meldungen.map(m => ({
                    priority: m.prioritaet || 1,
                    text: m.text || ''
                }));
            }

            journeyStore.addJourney(journey);
            createdJourneys.push(journey);
        }

        trainDisplay.updateAll();
        return { count: createdJourneys.length, success: true };
    }

    /**
     * Lädt automatisch die Wagenreihung für sichtbare Fahrten (z.B. Haupt- und Nebenmonitor),
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
            if (j.hasFormation && !hasCoaches && !j.isFetchingFormation) {
                const res = await this.fetchFormationForJourney(j);
                if (res.success) {
                    fetched++;
                }
            }
        }

        return fetched;
    }
}
