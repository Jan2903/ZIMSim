import { calculateCoachPositions, getSectorsForCoaches } from '../../formation/formationUtils.js';
import { formatDisplayName } from '../trainNumberFormatter.js';
import { JourneyCouplingService } from './journeyCouplingService.js';

/**
 * Service für die Erzeugung und Aktualisierung dynamischer Lauftext-Bausteine
 * (Ankunftskontext und Zugteilungs-/Schwächungshinweise).
 */
export class DynamicTextService {
    /**
     * Synchronisiert dynamisch generierte Infotexte (Ankunftstext, Zugteilung)
     * als verwaltbare Bausteine im infoTexts-Array der jeweiligen Journey.
     * @param {Array} journeys - Alle Journeys
     * @param {object} platform - Das Platform-Objekt des aktuellen Bahnhofs/Gleises
     */
    static sync(journeys, platform) {
        for (const journey of journeys) {
            const upsertText = (type, text) => {
                const existing = journey.infoTexts.find(t => t.type === type);
                if (text) {
                    if (existing) {
                        existing.text = text;
                    } else {
                        journey.infoTexts.unshift({
                            id: crypto.randomUUID(),
                            text: text,
                            visible: true,
                            type: type
                        });
                    }
                } else if (existing) {
                    journey.infoTexts = journey.infoTexts.filter(t => t.type !== type);
                }
            };

            // 1. Ankunftstext
            let arrivalText = "";
            if (!journey.ankunft && journey.linkedArrivalJourneyId) {
                const arrival = journeys.find(j => j.id === journey.linkedArrivalJourneyId);
                if (arrival) {
                    arrivalText = journey.generateArrivalContextText(arrival);
                }
            }
            upsertText('arrival-context', arrivalText);

            // 2. Schwächungstext (Zugteil endet in...)
            let strengtheningText = "";
            if (!journey.ankunft && !journey.infoscreen && !journey.hasTrackChange && !journey.ausfall && journey.verkehrtAb === "0") {
                const group = JourneyCouplingService.expandCoupling(journeys, journey);
                const primaryDest = (journey.destination || "").trim();
                const primaryDestLang = journey.destinationLang || journey.destination;
                
                if (group.length === 1 && journey.formation && journey.formation.groups && journey.formation.groups.length > 1) {
                    const { allCoaches } = calculateCoachPositions(group);
                    
                    let texts = [];
                    for (let i = 0; i < journey.formation.groups.length; i++) {
                        const formationGroup = journey.formation.groups[i];
                        const groupDest = (formationGroup.destination || "").trim();
                        
                        if (groupDest && groupDest !== primaryDest && groupDest !== primaryDestLang) {
                            const nrwName = formatDisplayName(formationGroup.trainNumber || journey.name, true);
                            const targetCoaches = allCoaches.filter(item => item.group === formationGroup);
                            const sectors = getSectorsForCoaches(targetCoaches, platform);
                            
                            if (sectors) {
                                const sectorParts = sectors.split('-');
                                const firstSection = sectorParts[0];
                                const lastSection = sectorParts.length > 1 ? sectorParts[1] : null;
                                const deSectionText = lastSection ? `in den Abschnitten ${firstSection} bis ${lastSection}` : `im Abschnitt ${firstSection}`;
                                const enSectionText = lastSection ? `in sections ${firstSection} to ${lastSection}` : `in section ${firstSection}`;
                                texts.push(`Zugteil ${nrwName} ${deSectionText} endet in ${groupDest} +++ Train segment ${nrwName} ${enSectionText} ends in ${groupDest}`);
                            } else {
                                texts.push(`Zugteil ${nrwName} endet in ${groupDest} +++ Train segment ${nrwName} ends in ${groupDest}`);
                            }
                        }
                    }
                    if (texts.length > 0) {
                        strengtheningText = texts.join(' +++ ');
                    }
                }
            }
            upsertText('strengthening', strengtheningText);
        }
    }
}
