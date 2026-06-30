// js/utils/formationUtils.js

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
 * @param {import('../models/platform.js').Platform} platform - Das Bahnsteig-Objekt.
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
