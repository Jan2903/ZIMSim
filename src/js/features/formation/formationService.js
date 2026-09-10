// js/features/formation/formationService.js
import { Formation, FormationGroup } from './formationModel.svelte.js';
import { Coach } from './coachModel.svelte.js';
import { FormationParser } from './formationParser.js';
import { Platform } from '../station/platform.svelte.js';

/**
 * Service für Operationen auf Wagenreihungen (Gruppen und Wagen).
 * Hält Fachlogik außerhalb von UI-Komponenten (Separation of Concerns & DRY).
 */
export class FormationService {
    /**
     * Erstellt einen neuen Standardwagen mit sinnvollen Standardwerten.
     * @param {string} [type='middle_car'] - 'middle_car', 'control_car' oder 'locomotive'
     * @returns {Coach}
     */
    static createDefaultCoach(type = 'middle_car') {
        const isLoco = type === 'locomotive';
        return new Coach({
            id: crypto.randomUUID(),
            type: type,
            coachClass: isLoco ? null : 2,
            length: isLoco ? 19 : 26,
            wagonIdentificationNumber: null,
            amenities: [],
            open: true,
            platformPosition: null
        });
    }

    /**
     * Erstellt eine neue FormationGroup (Zugteil) mit Vorbelegung aus der übergeordneten Journey.
     * @param {import('../journey/journey.svelte.js').Journey} journey
     * @returns {FormationGroup}
     */
    static createDefaultGroup(journey) {
        const dest = journey ? (journey.effectiveDestination || journey.destination || '') : '';
        const group = new FormationGroup({
            id: crypto.randomUUID(),
            name: '',
            transport: {
                category: '',
                destination: { name: dest },
                journeyID: journey ? journey.journeyId : '',
                line: '',
                number: 0,
                type: 'UNKNOWN'
            },
            coaches: [FormationService.createDefaultCoach('middle_car')]
        });

        // Automatische Kategorien- und Zugnummernerkennung aus journey.name falls möglich (z.B. "ICE 1545")
        if (journey && journey.name) {
            const parts = journey.name.trim().split(/\s+/);
            if (parts.length >= 2 && !isNaN(Number(parts[parts.length - 1]))) {
                group.transport.category = parts.slice(0, -1).join(' ');
                group.transport.number = Number(parts[parts.length - 1]);
            }
        }

        return group;
    }

    /**
     * Bereinigt die absoluten platformPosition-Koordinaten an allen Wagen.
     * Notwendig nach manueller Umordnung oder Längenänderung, damit
     * formationUtils die Meterpositionen dynamisch anhand von startMeter und Coach-Länge berechnet.
     * @param {FormationGroup|Formation} target
     */
    static cleanPlatformPositions(target) {
        if (!target) return;
        if (Array.isArray(target.groups)) {
            target.groups.forEach(g => FormationService.cleanPlatformPositions(g));
        } else if (Array.isArray(target.coaches)) {
            target.coaches.forEach(c => {
                c.platformPosition = null;
            });
        }
    }

    /**
     * Dreht die Wagenreihenfolge innerhalb einer einzelnen Gruppe um.
     * Bereinigt automatisch platformPosition (Edge-Case #4).
     * @param {FormationGroup} group
     */
    static reverseGroup(group) {
        if (!group || !Array.isArray(group.coaches)) return;
        group.coaches.reverse();
        FormationService.cleanPlatformPositions(group);
    }

    /**
     * Dreht die gesamte Formation um (Gruppenreihenfolge UND Wagen innerhalb jeder Gruppe).
     * Bereinigt automatisch platformPosition (Edge-Case #4).
     * @param {Formation} formation
     */
    static reverseFormation(formation) {
        if (!formation || !Array.isArray(formation.groups)) return;
        formation.groups.reverse();
        formation.groups.forEach(group => {
            if (Array.isArray(group.coaches)) {
                group.coaches.reverse();
            }
        });
        FormationService.cleanPlatformPositions(formation);
    }

    /**
     * Exportiert die gesamte Formation einer Journey als JSON-Datei und triggert den Download.
     * @param {import('../journey/journey.svelte.js').Journey} journey
     */
    static exportFormation(journey) {
        if (!journey || !journey.formation) return;
        const exportData = {
            version: 'zimsim-formation-1.0',
            exportedAt: new Date().toISOString(),
            journeyName: journey.effectiveDisplayName || journey.name,
            formation: journey.formation.toJSON()
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (journey.effectiveDisplayName || journey.name || 'formation').replace(/[^\w-]/g, '_');
        a.href = url;
        a.download = `formation_${safeName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Exportiert einen einzelnen Zugteil (FormationGroup) als JSON-Datei.
     * @param {FormationGroup} group
     */
    static exportGroup(group) {
        if (!group) return;
        const exportData = {
            version: 'zimsim-group-1.0',
            exportedAt: new Date().toISOString(),
            group: group.toJSON()
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (group.trainNumber || group.name || 'zugteil').replace(/[^\w-]/g, '_');
        a.href = url;
        a.download = `group_${safeName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Importiert eine Formation aus einem Rohdaten-Objekt (DB API oder ZIMSim JSON Export).
     * @param {import('../journey/journey.svelte.js').Journey} journey
     * @param {object} rawData
     * @param {object} platforms
     * @param {object} stationContext
     */
    static applyFormationData(journey, rawData, platforms = {}, stationContext = null) {
        if (!journey || !rawData) return false;

        // Fall 1: DB API Format (enthält fahrzeuggruppen oder web groups mit Gleis-Informationen)
        if (rawData.fahrzeuggruppen || rawData.gleis || (rawData.groups && !rawData.version && !rawData.formation)) {
            const parsedData = FormationParser.parse(rawData);
            journey.formation = new Formation(parsedData);
            if (parsedData.uiDirection !== undefined) {
                journey.direction = parsedData.uiDirection;
            }

            if (parsedData.platform && parsedData.platform.name && platforms) {
                const platformName = parsedData.platform.name;
                const newPlatform = new Platform(parsedData.platform);
                if (!platforms[platformName] || (newPlatform.sections && newPlatform.sections.length > 0)) {
                    platforms[platformName] = newPlatform;
                    if (stationContext && (Object.keys(platforms).length === 1 || stationContext.platform.name === platformName)) {
                        stationContext.platform = newPlatform;
                    }
                }
            }
            return true;
        }

        // Fall 2: ZIMSim Export Datei (Wrapper mit `formation`)
        if (rawData.formation) {
            journey.formation = new Formation(rawData.formation);
            return true;
        }

        // Fall 3: Ein Array von Gruppen
        if (Array.isArray(rawData)) {
            journey.formation = new Formation({ groups: rawData });
            return true;
        }

        // Fall 4: Einzelne Gruppe (z.B. group_export.json)
        if (rawData.group && rawData.group.coaches) {
            if (!journey.formation) journey.formation = new Formation();
            journey.formation.groups.push(new FormationGroup(rawData.group));
            return true;
        }

        return false;
    }
}
