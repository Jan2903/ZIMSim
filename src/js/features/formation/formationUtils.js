// js/utils/formationUtils.js
import { parseTrack } from '../../core/utils/trackUtils.js';

/**
 * Berechnet die absoluten Meter-Positionen (startM, endM) für alle Wagen einer oder mehrerer Journeys.
 * Übernimmt Vererbung von Zielen und Zugnummern (wichtig für Kupplungs-Erkennung).
 *
 * @param {import('../models/journey.js').Journey[]} journeys - Array von Fahrt-Daten (1+ bei Flügelzügen).
 * @returns {object} Ein Objekt mit allCoaches, isMultipleTrains, groupProperties und allFormationGroups
 */
export function calculateCoachPositions(journeys) {
    if (!journeys || journeys.length === 0) {
        return { allCoaches: [], isMultipleTrains: false, groupProperties: new Map(), allFormationGroups: [] };
    }

    const primary = journeys[0];
    const startMeter = primary.startMeter || 0;

    // FormationGroups aus allen Journeys zusammenführen (für Flügelzüge)
    const allFormationGroups = journeys.flatMap(j => j.formation ? j.formation.groups : []);

    // Vererbung von leeren Zielen/Zugnummern für den Kupplungs-Check
    const groupProperties = new Map();
    let lastValidDest = '';
    let lastValidNum = '';

    allFormationGroups.forEach(group => {
        const dest = group.destination || lastValidDest;
        const num = group.trainNumber || lastValidNum;

        groupProperties.set(group, { destination: dest, trainNumber: num });

        if (group.destination) lastValidDest = group.destination;
        if (group.trainNumber) lastValidNum = group.trainNumber;
    });

    const uniqueTrainNumbers = new Set();
    groupProperties.forEach(props => {
        if (props.trainNumber) uniqueTrainNumbers.add(props.trainNumber);
    });
    const isMultipleTrains = uniqueTrainNumbers.size > 1;

    // 1. Zuerst ALLE Wagen (inklusive Loks) in eine flache Liste bringen,
    // um die physischen Meter-Positionen korrekt aufzusummieren.
    let allCoaches = [];
    allFormationGroups.forEach(group => {
        const props = groupProperties.get(group);
        group.coaches.forEach(coach => {
            allCoaches.push({
                coach,
                group,
                inheritedDestination: props.destination,
                inheritedTrainNumber: props.trainNumber
            });
        });
    });

    if (allCoaches.length > 0) {
        // 2. Start- und End-Meter für jeden Wagen sicherstellen (als absolute Koordinaten)
        let currentMeter = startMeter;
        allCoaches.forEach(item => {
            if (item.coach.platformPosition && typeof item.coach.platformPosition.start === 'number') {
                item.startM = item.coach.platformPosition.start;
                item.endM = item.coach.platformPosition.end;
                currentMeter = item.endM; // Synchronisieren für evtl. folgende Wagen ohne Daten
            } else {
                item.startM = currentMeter;
                item.endM = currentMeter + item.coach.length;
                currentMeter = item.endM;
            }
        });
    }

    return { allCoaches, isMultipleTrains, groupProperties, allFormationGroups };
}

/**
 * Ermittelt die zutreffenden Sektoren für eine Liste von Wagen basierend auf deren Mitte.
 *
 * @param {Array} coaches - Array von Wagen-Objekten mit startM und endM.
 * @param {import('../station/platform.svelte.js').Platform} platform - Das Bahnsteig-Objekt.
 * @returns {string} Die Sektoren als String (z.B. "A", "A-C" oder "").
 */
export function getSectorsForCoaches(coaches, platform) {
    if (!platform || !platform.sections || platform.sections.length === 0) return "";

    const activeSectors = new Set();
    
    for (const coach of coaches) {
        if (typeof coach.startM !== 'number' || typeof coach.endM !== 'number') continue;
        
        const centerM = (coach.startM + coach.endM) / 2;
        
        for (const sec of platform.sections) {
            if (centerM >= sec.startMeter && centerM <= sec.endMeter) {
                activeSectors.add(sec.name);
                break;
            }
        }
    }

    const sectorArr = Array.from(activeSectors).sort();
    if (sectorArr.length === 0) return "";
    if (sectorArr.length === 1) return sectorArr[0];
    return `${sectorArr[0]}-${sectorArr[sectorArr.length - 1]}`;
}

/**
 * Ermittelt das am besten passende Bahnsteig-Objekt für eine Journey.
 * Berücksichtigt Gleisbezeichnungen, Basenummern, Präfixe und Fallback auf stationContext.platform.
 *
 * @param {object} journey - Die betroffene Fahrt
 * @param {object} [platforms={}] - Map von Bahnsteig-Objekten nach Name
 * @param {object} [stationContext=null] - Stations-Kontext mit aktivem Bahnsteig
 * @returns {import('../station/platform.svelte.js').Platform|null}
 */
export function getPlatformForJourney(journey, platforms = {}, stationContext = null) {
    if (!journey) return stationContext?.platform || null;
    const trackStr = journey.ezGleis || journey.platform;
    if (!trackStr) return stationContext?.platform || null;
    const parsed = parseTrack(trackStr);
    return (parsed && platforms[parsed.base]) ||
           platforms[trackStr] ||
           (parsed && platforms[`Gleis ${parsed.base}`]) ||
           platforms[`Gleis ${trackStr}`] ||
           stationContext?.platform ||
           null;
}

/**
 * Berechnet rein dynamisch die Bahnsteigabschnitte für eine Journey basierend auf Formation und Bahnsteig.
 * Ignoriert eventuelle manuelle Overrides in targetJourney.sectors.
 *
 * @param {object} targetJourney - Die betroffene Fahrt
 * @param {Array<object>} allJourneys - Alle Fahrten des aktuellen Gleises (für Flügelzug-Positionierung)
 * @param {import('../station/platform.svelte.js').Platform} platform - Das Bahnsteig-Objekt
 * @returns {string} Berechnete Sektoren als String (z.B. "A-C", "D-E" oder "")
 */
export function calculatePlatformSectors(targetJourney, allJourneys, platform) {
    if (!targetJourney || !platform) return "";
    if (!targetJourney.formation || !targetJourney.formation.groups) return "";
    
    const sectors = new Set();
    let hasStaticSectorInfo = false;
    for (const group of targetJourney.formation.groups) {
        if (!group.coaches) continue;
        for (const coach of group.coaches) {
            const pos = coach.platformPosition;
            if (pos) {
                if (pos.sector) {
                    sectors.add(pos.sector);
                    hasStaticSectorInfo = true;
                } else if (pos.name && pos.name.length === 1) {
                    sectors.add(pos.name);
                    hasStaticSectorInfo = true;
                }
            }
        }
    }
    
    if (hasStaticSectorInfo) {
        const sectorArr = Array.from(sectors).sort();
        if (sectorArr.length === 0) return "";
        if (sectorArr.length === 1) return sectorArr[0];
        return `${sectorArr[0]}-${sectorArr[sectorArr.length - 1]}`;
    }

    if (allJourneys && platform) {
        const { allCoaches } = calculateCoachPositions(allJourneys);
        const targetGroups = new Set(targetJourney.formation.groups);
        
        const targetCoaches = [];
        
        for (const item of allCoaches) {
            if (targetGroups.has(item.group)) {
                targetCoaches.push(item);
            }
        }
        
        if (targetCoaches.length > 0) {
            return getSectorsForCoaches(targetCoaches, platform);
        }
    }

    return "";
}

/**
 * Ermittelt die Bahnsteigabschnitte für eine Journey.
 * Priorität:
 * 1. targetJourney.sectors (manueller Override)
 * 2. coach.platformPosition.sector (statischer Sektor aus Fahrplandaten)
 * 3. Metrische Berechnung über calculateCoachPositions und getSectorsForCoaches
 *
 * @param {object} targetJourney - Die betroffene Fahrt
 * @param {Array<object>} allJourneys - Alle Fahrten des aktuellen Gleises (für Flügelzug-Positionierung)
 * @param {import('../station/platform.svelte.js').Platform} platform - Das Bahnsteig-Objekt
 * @returns {string} Sektoren als String (z.B. "C-E", "B" oder "")
 */
export function getPlatformSectors(targetJourney, allJourneys, platform) {
    if (!targetJourney) return "";
    if (targetJourney.sectors) return targetJourney.sectors;
    return calculatePlatformSectors(targetJourney, allJourneys, platform);
}

/**
 * Prüft, ob ein Wagen ein 1.-Klasse-Wagen ist (Klasse 1 oder gemischt 1/2).
 * @param {object} coach - Das Wagen-Objekt
 * @returns {boolean}
 */
export function isCoachFirstClass(coach) {
    if (!coach) return false;
    return coach.coachClass === 1 || 
           coach.coachClass === '1' || 
           coach.coachClass === '1/2' || 
           (typeof coach.isFirstClass === 'function' && coach.isFirstClass());
}

/**
 * Berechnet rein dynamisch die Bahnsteigabschnitte der 1. Klasse für eine Journey.
 * Ignoriert eventuelle manuelle Overrides in targetJourney.sectorsFirstClass.
 * Gibt die Abschnitte einzeln als kommagetrennte Liste zurück (z.B. "A", "A, B" oder "").
 *
 * @param {object} targetJourney - Die betroffene Fahrt
 * @param {Array<object>} allJourneys - Alle Fahrten des aktuellen Gleises (für Flügelzug-Positionierung)
 * @param {import('../station/platform.svelte.js').Platform} platform - Das Bahnsteig-Objekt
 * @returns {string} Berechnete 1.-Klasse-Sektoren als String (z.B. "A", "A, B" oder "")
 */
export function calculatePlatformFirstClassSectors(targetJourney, allJourneys, platform) {
    if (!targetJourney || !platform) return "";
    if (!targetJourney.formation || !targetJourney.formation.groups) return "";

    const sectors = new Set();
    let hasStaticSectorInfo = false;
    for (const group of targetJourney.formation.groups) {
        if (!group.coaches) continue;
        for (const coach of group.coaches) {
            if (!isCoachFirstClass(coach)) continue;

            const pos = coach.platformPosition;
            if (pos) {
                if (pos.sector) {
                    sectors.add(pos.sector);
                    hasStaticSectorInfo = true;
                } else if (pos.name && pos.name.length === 1) {
                    sectors.add(pos.name);
                    hasStaticSectorInfo = true;
                }
            }
        }
    }

    if (hasStaticSectorInfo) {
        const sectorArr = Array.from(sectors).sort();
        return sectorArr.join(', ');
    }

    if (allJourneys && platform && platform.sections && platform.sections.length > 0) {
        const { allCoaches } = calculateCoachPositions(allJourneys);
        const targetGroups = new Set(targetJourney.formation.groups);

        const targetCoaches = [];
        for (const item of allCoaches) {
            if (targetGroups.has(item.group) && isCoachFirstClass(item.coach)) {
                targetCoaches.push(item);
            }
        }

        if (targetCoaches.length > 0) {
            const activeSectors = new Set();
            for (const item of targetCoaches) {
                if (typeof item.startM !== 'number' || typeof item.endM !== 'number') continue;
                const centerM = (item.startM + item.endM) / 2;
                for (const sec of platform.sections) {
                    if (centerM >= sec.startMeter && centerM <= sec.endMeter) {
                        activeSectors.add(sec.name);
                        break;
                    }
                }
            }
            const sectorArr = Array.from(activeSectors).sort();
            return sectorArr.join(', ');
        }
    }

    return "";
}

/**
 * Ermittelt die 1.-Klasse-Bahnsteigabschnitte für eine Journey.
 * Priorität:
 * 1. targetJourney.sectorsFirstClass (manueller Override)
 * 2. coach.platformPosition.sector (statischer Sektor aus Fahrplandaten)
 * 3. Metrische Berechnung über calculateCoachPositions und Platform-Sektoren
 *
 * @param {object} targetJourney - Die betroffene Fahrt
 * @param {Array<object>} allJourneys - Alle Fahrten des aktuellen Gleises (für Flügelzug-Positionierung)
 * @param {import('../station/platform.svelte.js').Platform} platform - Das Bahnsteig-Objekt
 * @returns {string} Sektoren als String (z.B. "A", "A, B" oder "")
 */
export function getPlatformFirstClassSectors(targetJourney, allJourneys, platform) {
    if (!targetJourney) return "";
    if (targetJourney.sectorsFirstClass) return targetJourney.sectorsFirstClass;
    return calculatePlatformFirstClassSectors(targetJourney, allJourneys, platform);
}
