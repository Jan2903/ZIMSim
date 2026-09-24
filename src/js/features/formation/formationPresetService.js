// js/features/formation/formationPresetService.js
import { Formation, FormationGroup } from './formationModel.svelte.js';
import { Coach } from './coachModel.svelte.js';
import { FormationService } from './formationService.js';
import { FORMATION_PRESETS } from './formationPresets.js';

/**
 * Service für das Instanziieren und Anwenden von Wagenreihungs-Vorlagen (Presets).
 * Erzeugt erst bei Zuweisung reaktive Svelte 5 Models, um Memory und CPU zu schonen.
 */
export class FormationPresetService {
    /**
     * Gibt alle registrierten Presets zurück.
     * @returns {import('./formationPresets.js').FormationPreset[]}
     */
    static getPresets() {
        return FORMATION_PRESETS;
    }

    /**
     * Sucht ein Preset anhand seiner Kennung.
     * @param {string} id
     * @returns {import('./formationPresets.js').FormationPreset | null}
     */
    static getPresetById(id) {
        return FORMATION_PRESETS.find(p => p.id === id) || null;
    }

    /**
     * Erzeugt eine vollständig instanziierte Formation basierend auf einem Preset.
     * Unterstützt Mehrfachtraktion (Doppel-/Dreifachzug), Ausrichtungsumkehr und Wagennummern-Offset.
     *
     * @param {string | import('./formationPresets.js').FormationPreset} presetOrId
     * @param {object} [options={}]
     * @param {number} [options.traction=1] - Traktionsfaktor (1 = Einzel, 2 = Doppel, 3 = Dreifach)
     * @param {boolean} [options.reverse=false] - Reihung der Wagen und Zugteile umkehren
     * @param {boolean} [options.offsetWagons=true] - Bei Mehrfachtraktion Nummernversatz anwenden
     * @param {string} [options.destination] - Zielbahnhof für die Zugteile
     * @param {string} [options.category] - Zuggattung (z.B. "ICE")
     * @param {number|string} [options.trainNumber] - Zugnummer
     * @param {import('../journey/journey.svelte.js').Journey} [journey=null] - Optionale Bezugs-Journey
     * @returns {Formation | null}
     */
    static createFormationFromPreset(presetOrId, options = {}, journey = null) {
        const preset = typeof presetOrId === 'string' ? this.getPresetById(presetOrId) : presetOrId;
        if (!preset || !Array.isArray(preset.coaches) || preset.coaches.length === 0) {
            return null;
        }

        const traction = Math.max(1, Math.min(Number(options.traction) || 1, 3));
        const reverse = Boolean(options.reverse);
        const offsetWagons = options.offsetWagons !== false;

        const dest = options.destination !== undefined
            ? options.destination
            : (journey ? (journey.effectiveDestination || journey.destination || '') : '');

        let cat = options.category !== undefined
            ? options.category
            : (journey ? (journey.produktGattung || '') : '');

        let num = options.trainNumber !== undefined
            ? Number(options.trainNumber) || 0
            : 0;

        if (!cat && journey && journey.name) {
            const parts = journey.name.trim().split(/\s+/);
            if (parts.length >= 2 && !isNaN(Number(parts[parts.length - 1]))) {
                cat = parts.slice(0, -1).join(' ');
                if (!num) num = Number(parts[parts.length - 1]);
            } else {
                cat = parts[0] || preset.defaultGattung || 'ICE';
            }
        }
        if (!cat) cat = preset.defaultGattung || 'ICE';

        const groups = [];

        for (let unit = 0; unit < traction; unit++) {
            const unitNumber = unit + 1;
            const wagonOffset = offsetWagons ? unit * (preset.wagonNumberOffset || 10) : 0;

            const coaches = preset.coaches.map(cDef => {
                let wNum = null;
                if (cDef.wagonNumber !== null && cDef.wagonNumber !== undefined) {
                    wNum = Number(cDef.wagonNumber) + wagonOffset;
                }

                return new Coach({
                    id: crypto.randomUUID(),
                    type: cDef.type,
                    coachClass: cDef.coachClass,
                    length: cDef.length || (cDef.type === 'locomotive' ? 19 : 26),
                    wagonIdentificationNumber: wNum,
                    amenities: [...(cDef.amenities || [])],
                    open: true,
                    constructionType: cDef.constructionType || '',
                    platformPosition: null
                });
            });

            if (reverse) {
                coaches.reverse();
            }

            const groupName = traction > 1 ? `${preset.name} (${unitNumber})` : preset.name;

            const group = new FormationGroup({
                id: crypto.randomUUID(),
                name: groupName,
                transport: {
                    category: cat,
                    destination: { name: dest },
                    journeyID: journey ? journey.journeyId : '',
                    line: journey ? (journey.line || '') : '',
                    number: num,
                    type: 'TRAIN'
                },
                coaches: coaches
            });

            groups.push(group);
        }

        if (reverse && groups.length > 1) {
            groups.reverse();
        }

        const formation = new Formation({ groups });
        FormationService.cleanPlatformPositions(formation);

        return formation;
    }

    /**
     * Weist einer Journey direkt eine Formation aus einem Preset zu.
     * @param {import('../journey/journey.svelte.js').Journey} journey
     * @param {string | import('./formationPresets.js').FormationPreset} presetOrId
     * @param {object} [options={}]
     * @returns {boolean} true bei Erfolg
     */
    static applyPresetToJourney(journey, presetOrId, options = {}) {
        if (!journey) return false;

        const formation = this.createFormationFromPreset(presetOrId, options, journey);
        if (!formation) return false;

        journey.formation = formation;
        return true;
    }
}
