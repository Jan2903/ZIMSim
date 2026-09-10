import { Journey } from '../journey.svelte.js';
import { Stop } from '../../station/stop.svelte.js';
import { Platform } from '../../station/platform.svelte.js';
import { Formation } from '../../formation/formationModel.js';
import { FormationParser } from '../../formation/formationParser.js';
import { ansagenStore } from '../../../audio/ansagenStore.svelte.js';
import { JourneyCouplingService } from './journeyCouplingService.js';
import { parseTrainName } from '../trainNumberFormatter.js';
import { RisTextService } from '../../../core/services/risTextService.js';
import { StationService } from '../../station/stationService.js';

/**
 * Service für Daten-Import und Ingestion (HAFAS Abfahrtstafeln, Zugläufe, Wagenreihung und IRIS).
 */
export class JourneyImportService {
    /**
     * Extrahiert Verspätungsgründe (RIS R-Presets) und Infotexte aus rohen Meldungen.
     * @private
     */
    static _extractDelayReasonAndInfoTexts(rawMeldungen, checkAusfall = false) {
        const infoTexts = [];
        let delayReason = '';
        let ausfall = false;
        const rPresets = RisTextService.getPresetsByType('R');

        rawMeldungen.forEach(m => {
            if (checkAusfall && (m.type === 'HALT_AUSFALL' || m.text === 'Halt entfällt')) {
                ausfall = true;
                return;
            }

            if (rPresets.some(p => p.text === m.text)) {
                if (!delayReason) delayReason = m.text;
            } else {
                infoTexts.push({
                    id: crypto.randomUUID(),
                    text: (m.text || '').replace(/^Information:\s*/i, '').trim(),
                    visible: true,
                    type: 'Q'
                });
            }
        });

        return { infoTexts, delayReason, ausfall };
    }

    /**
     * Erstellt eine Journey aus einem DB-API Abfahrtstafel-Eintrag.
     * @param {object} entry - Ein Eintrag aus dem entries[]-Array
     * @param {boolean} [isArrival=false] - true, wenn der Eintrag von einer Ankunftstafel stammt
     * @returns {Journey}
     */
    static fromDepartureEntry(entry, isArrival = false) {
        const vm = entry.verkehrmittel || {};
        const parsedName = parseTrainName(vm.name, vm.linienNummer, vm.langText);

        const rawMeldungen = entry.meldungen || [];
        const { infoTexts, delayReason, ausfall } = this._extractDelayReasonAndInfoTexts(rawMeldungen, true);

        let viasArray = entry.vias || entry.zuglauf || entry.route || entry.ueber || [];
        const fallbackDestination = viasArray.length > 0 ? viasArray[viasArray.length - 1] : '';
        const finalDest = entry.terminus || fallbackDestination;

        let destLang = finalDest;
        let destKurz = finalDest;

        if (StationService.isLoaded) {
            const destStation = StationService.getStationByIdOrName(null, finalDest);
            if (destStation) {
                destLang = destStation.name;
                destKurz = destStation.nameKurz;
            }
        }

        // Ansatz A: Bei Abfahrten steht der aktuelle Bahnhof als erstes Element in den Vias.
        // Das Ziel stand früher als letztes Element drin und wurde weggeschnitten.
        // Wir behalten das Ziel nun als letzten "Halt" in der Liste, damit es als ausfallend markiert werden kann.
        if (!isArrival && viasArray.length > 0) {
            viasArray = viasArray.slice(1);
        }

        const journey = new Journey({
            journeyId: entry.journeyId || '',
            name: parsedName,
            produktGattung: vm.produktGattung || '',
            operator: vm.kurzText || '',
            destination: finalDest,
            destinationLang: destLang,
            destinationKurz: destKurz,
            scheduledTime: Stop.formatTime(entry.zeit),
            expectedTime: Stop.formatTime(entry.ezZeit),
            platform: entry.gleis || '',
            ezGleis: entry.ezGleis || '',
            ausfall: ausfall,
            vias: viasArray,
            messages: rawMeldungen.map(m => ({
                priority: m.prioritaet,
                text: m.text
            })),
            infoTexts: infoTexts,
            delayReason: delayReason
        });

        // Wenn durch Migration Dummy-Stops aus den Vias erzeugt wurden, reichern wir sie an
        journey.stops.forEach(s => s.enrichWithStationData());

        return journey;
    }

    /**
     * Erstellt eine Journey aus einem DB-API Journey/Zuglauf-Objekt.
     * @param {object} data - Das Zuglauf-Objekt
     * @param {string} [stationId] - Optionale Station-ID für Auto-Sync
     * @returns {Journey}
     */
    static fromJourneyData(data, stationId) {
        const vm = data.verkehrmittel || {};
        const parsedName = parseTrainName(vm.name, vm.linienNummer, vm.langText);

        const rawMeldungen = data.priorisierteMeldungen || [];
        const { infoTexts, delayReason } = this._extractDelayReasonAndInfoTexts(rawMeldungen, false);

        const journey = new Journey({
            name: parsedName,
            produktGattung: vm.produktGattung || '',
            operator: vm.kurzText || '',
            journeyId: data.journeyId || '',
            destination: data.ziel || '',
            scheduledTime: '', // Wird durch syncFromCurrentStop berechnet
            expectedTime: '',  // Wird durch syncFromCurrentStop berechnet
            platform: '',      // Wird durch syncFromCurrentStop berechnet
            ezGleis: '',       // Wird durch syncFromCurrentStop berechnet
            ausfall: data.cancelled || false,
            zugattribute: data.zugattribute || [],
            messages: rawMeldungen.map(m => ({
                priority: m.prioritaet,
                text: m.text
            })),
            infoTexts: infoTexts,
            delayReason: delayReason,
            stops: (data.halte || []).map(halt => new Stop({
                name: halt.name,
                extId: halt.extId,
                departure: halt.abfahrt || null,
                arrival: halt.ankunft || null,
                platform: halt.gleis || '',
                ezGleis: halt.ezGleis || '',
                cancelled: halt.priorisierteMeldungen?.some(m => m.type === 'HALT_AUSFALL') || false,
                category: halt.kategorie || '',
                number: halt.nummer || '',
                routeIndex: halt.routeIdx,
                messages: halt.priorisierteMeldungen || [],
                risNotizen: halt.risNotizen || []
            }))
        });

        // Stationen anreichern
        journey.stops.forEach(s => s.enrichWithStationData());

        // Auto-Generate Vias für den importierten Zuglauf
        journey.autoGenerateVias();
        journey.autoGenerateAudioVias(ansagenStore.maxVias, ansagenStore.viaSortMode);

        // Auto-sync wenn Station-ID bekannt
        if (stationId) {
            journey.syncFromCurrentStop(stationId);
        }

        return journey;
    }

    /**
     * Importiert eine Liste von Abfahrten oder Ankünften aus einem DB-API JSON.
     * @param {object} data - { entries: [...] }
     * @param {boolean} isArrival - true bei Ankunftstafel
     * @param {Array} journeys - Bestehende Journeys im Store
     * @returns {Journey[]} Die neu erstellten Journeys
     */
    static importList(data, isArrival, journeys) {
        const entries = data.entries || [];
        const created = [];

        for (const entry of entries) {
            const journey = this.fromDepartureEntry(entry, isArrival);
            journey.ankunft = isArrival;
            
            // Audio-Vias für importierte IRIS Journeys generieren (Display Vias werden von der DB API geliefert)
            if (!isArrival) {
                journey.autoGenerateAudioVias(ansagenStore.maxVias, ansagenStore.viaSortMode);
            }

            // Duplikate vermeiden: Selbe HAFAS journeyId + selbe Ankunft/Abfahrt-Rolle
            if (journey.journeyId) {
                const isDuplicate = journeys.some(j => 
                    j.journeyId === journey.journeyId && j.ankunft === isArrival
                );
                if (isDuplicate) continue;
            }

            journeys.push(journey);
            created.push(journey);
        }

        // Auto-Coupling erkennen: Gleiche Zeit + Gleiches Gleis = Flügelzug
        JourneyCouplingService.detectCouplings(created);

        return created;
    }

    /**
     * Importiert eine Journey aus einem DB-API Journey/Zuglauf-JSON.
     * Erkennt automatisch unterschiedliche Ankunfts/Abfahrtsgleise (Fahrzeugtausch) 
     * und spaltet die Journey dann bei Bedarf auf.
     *
     * @param {object} data - Das Zuglauf-Objekt
     * @param {string} stationId - EVA-ID des aktuellen Bahnhofs
     * @param {Array} journeys - Liste aller Journeys im Store
     * @returns {Journey|Journey[]} Die erstellte(n) Journey(s)
     */
    static importJourney(data, stationId, journeys) {
        // Initial als eine Journey parsen, um Gleise am aktuellen Halt zu prüfen
        const journey = this.fromJourneyData(data, stationId);
        
        let splitNeeded = false;
        let aPlan, aEz, dPlan, dEz;

        const idx = journey._currentStopIndex;
        if (idx >= 0 && data.halte && data.halte[idx]) {
            const haltData = data.halte[idx];
            if (haltData.ankunft && haltData.abfahrt) {
                aPlan = haltData.ankunft.gleis || '';
                aEz = haltData.ankunft.ezGleis || '';
                dPlan = haltData.abfahrt.gleis || '';
                dEz = haltData.abfahrt.ezGleis || '';
                
                const arrGleis = aEz || aPlan;
                const depGleis = dEz || dPlan;
                
                if (arrGleis && depGleis && arrGleis !== depGleis) {
                    splitNeeded = true;
                }
            }
        }

        if (splitNeeded) {
            // Wir splitten die Journey in getrennte Ankunft und Abfahrt!
            const arrJourney = this.fromJourneyData(data, stationId);
            const depJourney = this.fromJourneyData(data, stationId);
            
            // 1. Reine Ankunft
            arrJourney.id = crypto.randomUUID();
            arrJourney.ankunft = true;
            arrJourney.platform = aPlan;
            arrJourney.ezGleis = aEz;
            arrJourney.stops = arrJourney.stops.slice(0, idx + 1);
            if (arrJourney.stops.length > 0) {
                arrJourney.stops[arrJourney.stops.length - 1].departure = null;
                arrJourney.destination = arrJourney.stops[0]?.name || '';
            }

            // 2. Reine Abfahrt
            depJourney.id = crypto.randomUUID();
            depJourney.ankunft = false;
            depJourney.platform = dPlan;
            depJourney.ezGleis = dEz;
            depJourney.stops = depJourney.stops.slice(idx);
            depJourney._currentStopIndex = 0;
            if (depJourney.stops.length > 0) {
                depJourney.stops[0].arrival = null;
                depJourney.destination = depJourney.stops[depJourney.stops.length - 1]?.name || '';
            }

            journeys.push(arrJourney);
            journeys.push(depJourney);
            return [arrJourney, depJourney];
        }

        journeys.push(journey);
        return journey;
    }

    /**
     * Importiert eine Formation und weist sie einer Journey zu.
     * Aktualisiert bei Bedarf auch die Bahnsteigkonfiguration.
     *
     * @param {Journey} journey - Die Ziel-Journey
     * @param {object} data - Das Formation-JSON (DB API Format)
     * @param {object} platforms - platforms-Objekt des Stores
     * @param {object} stationContext - stationContext des Stores
     */
    static importFormation(journey, data, platforms, stationContext) {
        if (!journey) return;
        
        const parsedData = FormationParser.parse(data);
        journey.formation = new Formation(parsedData);
        if (parsedData.uiDirection !== undefined) {
            journey.direction = parsedData.uiDirection;
        }

        // Bahnsteigdaten speichern/aktualisieren, falls vorhanden
        if (parsedData.platform && parsedData.platform.name) {
            const platformName = parsedData.platform.name;
            const newPlatform = new Platform(parsedData.platform);
            
            // Entweder es gibt den Bahnsteig noch nicht, oder der neue hat Sektoren (und der alte vllt nicht)
            if (!platforms[platformName] || (newPlatform.sections && newPlatform.sections.length > 0)) {
                platforms[platformName] = newPlatform;
                
                // Falls es der erste importierte Bahnsteig ist oder wir den aktuellen Bahnsteig aktualisieren, direkt anwenden
                if (Object.keys(platforms).length === 1 || stationContext.platform.name === platformName) {
                    stationContext.platform = newPlatform;
                }
            }
        }
    }

    /**
     * Aktualisiert den Store mit gemappten IRIS Echtzeitdaten.
     * Verhindert unnötiges Svelte-Reaktivitäts-Spamming durch gezielte Property-Vergleiche
     * und Deep-Diffing von Stops/Meldungen.
     *
     * @param {Array} journeys - Bestehende Journeys im Store
     * @param {Array} journeysData - Neu gemappte IRIS-Daten
     * @param {Function} onAddJourney - Callback zum Hinzufügen einer Journey
     * @param {Function} onRemoveJourney - Callback zum sauberen Entfernen einer Journey
     */
    static upsertIrisJourneys(journeys, journeysData, onAddJourney, onRemoveJourney) {
        const activeIds = new Set(journeysData.map(d => `${d.journeyId}_${d.ankunft}`));
        
        // Remove outdated journeys
        for (let i = journeys.length - 1; i >= 0; i--) {
            const j = journeys[i];
            if (!activeIds.has(`${j.journeyId}_${j.ankunft}`)) {
                onRemoveJourney(j.id);
            }
        }
        
        // Add or update
        for (const jData of journeysData) {
            let existing = journeys.find(j => j.journeyId === jData.journeyId && j.ankunft === jData.ankunft);
            if (existing) {
                // Update existing fields where relevant for realtime, avoiding unnecessary reactivity
                if (existing.expectedTime !== jData.expectedTime) existing.expectedTime = jData.expectedTime;
                if (existing.ezGleis !== jData.ezGleis) existing.ezGleis = jData.ezGleis;
                if (existing.delayReason !== jData.delayReason) existing.delayReason = jData.delayReason;
                if (existing.ausfall !== jData.ausfall) existing.ausfall = jData.ausfall;
                if (existing._effectiveTimeMs !== jData._effectiveTimeMs) existing._effectiveTimeMs = jData._effectiveTimeMs;
                
                // Deep compare arrays to avoid Svelte reactivity spam
                const currentStopsStr = JSON.stringify(existing.stops.map(s => ({...s, id: ''})));
                const newStopsStr = JSON.stringify(jData.stops.map(s => ({...s, id: ''})));
                
                if (currentStopsStr !== newStopsStr) {
                    existing.stops = jData.stops.map(s => {
                        const prevStop = existing.stops.find(old => old.name === s.name);
                        const data = { ...s };
                        if (prevStop) data.id = prevStop.id;
                        else data.id = crypto.randomUUID();
                        return new Stop(data);
                    });
                }
                
                if (JSON.stringify(existing.qosMessages) !== JSON.stringify(jData.qosMessages)) {
                    existing.qosMessages = jData.qosMessages;
                }
            } else {
                onAddJourney(jData);
            }
        }
    }
}
