// js/features/journey/services/infoTextVisibilityService.js
import { ANSCHLUSSTAFEL_TEXT_TYPES } from './infoTextTypes.js';

/**
 * Layouttypen, die die Anschlusstafel-Anzeige verwenden.
 */
export const ANSCHLUSSTAFEL_LAYOUT_TYPES = new Set([
    'anschlusstafel',
    'anschlusstafel_zoom',
    'anschlusstafel_zoom_icons'
]);

/**
 * Steuert die Sichtbarkeit der Infotexte abhängig vom Anzeige-Layout.
 *
 * In den Anschlusstafel-Layouts bleiben nur die haltbezogenen Auto-Texte
 * sichtbar. In allen anderen Layouts werden alle Infotexte wieder eingeblendet.
 * Infoscreen-Journeys (Störungsbox) werden bewusst nicht angefasst.
 */
export class InfoTextVisibilityService {
    /**
     * Prüft, ob der Layouttyp ein Anschlusstafel-Layout ist.
     * @param {string} layoutType
     * @returns {boolean}
     */
    static isAnschlusstafelLayout(layoutType) {
        return ANSCHLUSSTAFEL_LAYOUT_TYPES.has(layoutType);
    }

    /**
     * Setzt die visible-Flags aller nicht-Infoscreen-Journeys für das Ziel-Layout.
     * @param {Array} journeys - Die Journeys des Stores
     * @param {string} layoutType - Der Ziel-Layouttyp
     * @returns {void}
     */
    static applyForLayoutType(journeys, layoutType) {
        const isAnschlusstafel = this.isAnschlusstafelLayout(layoutType);

        for (const journey of journeys || []) {
            // Infoscreen-Journeys versorgen die Störungsbox am unteren Rand.
            // Deren Texte dürfen NICHT ausgeblendet werden.
            if (journey.infoscreen) continue;

            for (const info of journey.infoTexts || []) {
                info.visible = isAnschlusstafel
                    ? ANSCHLUSSTAFEL_TEXT_TYPES.has(info.type)
                    : true;
            }
        }
    }
}
