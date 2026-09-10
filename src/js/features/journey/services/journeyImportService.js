import { Journey } from '../journey.svelte.js';
import { Stop } from '../../station/stop.svelte.js';
import { Platform } from '../../station/platform.svelte.js';
import { Formation } from '../../formation/formationModel.js';
import { FormationParser } from '../../formation/formationParser.js';
import { ansagenStore } from '../../../audio/ansagenStore.svelte.js';
import { JourneyCouplingService } from './journeyCouplingService.js';

/**
 * Service für Daten-Import und Ingestion (HAFAS Abfahrtstafeln, Zugläufe, Wagenreihung und IRIS).
 */
export class JourneyImportService {
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
            const journey = Journey.fromDepartureEntry(entry, isArrival);
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
        const journey = Journey.fromJourneyData(data, stationId);
        
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
            const arrJourney = Journey.fromJourneyData(data, stationId);
            const depJourney = Journey.fromJourneyData(data, stationId);
            
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
