// js/features/formation/formationPresets.js

/**
 * @typedef {Object} CoachPresetItem
 * @property {'control_car' | 'middle_car' | 'locomotive'} type - Wagentyp
 * @property {number | null} coachClass - Wagenklasse (1, 2 oder null bei Lok)
 * @property {number} length - Länge in Metern
 * @property {number | null} [wagonNumber] - Voreingestellte Wagennummer (optional)
 * @property {string[]} [amenities] - Liste von Piktogrammen / Ausstattungsmerkmalen
 * @property {string} [constructionType] - Baureihe oder Wagentypbezeichnung
 */

/**
 * @typedef {Object} FormationPreset
 * @property {string} id - Eindeutige Kennung
 * @property {string} name - Anzeigename des Presets
 * @property {string} category - Hauptkategorie ('Fernverkehr' | 'Regionalverkehr' | 'S-Bahn')
 * @property {string} subCategory - Zuggattungs-Kürzel (z.B. 'ICE', 'RE', 'S')
 * @property {string} description - Kurzbeschreibung für den Benutzer
 * @property {string} defaultGattung - Standard-Zuggattung
 * @property {number[]} supportedTractions - Unterstützte Traktionen (z.B. [1, 2])
 * @property {number} [wagonNumberOffset=10] - Nummernversatz für den 2. Zugteil bei Mehrfachtraktion
 * @property {CoachPresetItem[]} coaches - Wagenliste der Basiseinheit
 */

/**
 * Vordefinierte repräsentative Beispiel-Presets für DB-Formationen.
 * Leichtgewichtiges Datenformat (POJO), skaliert mühelos auf hunderte Einträge ohne Memory-Overhead.
 * @type {FormationPreset[]}
 */
export const FORMATION_PRESETS = [
    {
        id: 'ice4_12',
        name: 'ICE 4 (12-teilig, BR 412)',
        category: 'Fernverkehr',
        subCategory: 'ICE',
        description: 'Moderner 12-teiliger Standard-ICE mit 1. Klasse, Bordrestaurant, Rollstuhlbereich und Fahrradabteil.',
        defaultGattung: 'ICE',
        supportedTractions: [1],
        wagonNumberOffset: 10,
        coaches: [
            { type: 'control_car', coachClass: 1, length: 28, wagonNumber: 14, amenities: ['QUIET'], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 1, length: 28, wagonNumber: 12, amenities: [], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 1, length: 28, wagonNumber: 11, amenities: [], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 10, amenities: ['BOARD_RESTAURANT'], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 9,  amenities: ['WHEELCHAIR_SPACE'], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 7,  amenities: ['FAMILY'], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 6,  amenities: [], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 5,  amenities: [], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 4,  amenities: [], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 3,  amenities: [], constructionType: 'BR 412' },
            { type: 'middle_car',  coachClass: 2, length: 28, wagonNumber: 2,  amenities: [], constructionType: 'BR 412' },
            { type: 'control_car', coachClass: 2, length: 28, wagonNumber: 1,  amenities: ['BIKE_SPACE'], constructionType: 'BR 412' }
        ]
    },
    {
        id: 'ice3_8',
        name: 'ICE 3 (8-teilig, BR 403)',
        category: 'Fernverkehr',
        subCategory: 'ICE',
        description: 'Klassischer Hochgeschwindigkeitszug. Häufig auch in Doppeltraktion (16 Wagen, Wagen 21-38).',
        defaultGattung: 'ICE',
        supportedTractions: [1, 2],
        wagonNumberOffset: 10,
        coaches: [
            { type: 'control_car', coachClass: 1, length: 26, wagonNumber: 28, amenities: ['QUIET'], constructionType: 'BR 403' },
            { type: 'middle_car',  coachClass: 1, length: 25, wagonNumber: 27, amenities: [], constructionType: 'BR 403' },
            { type: 'middle_car',  coachClass: 1, length: 25, wagonNumber: 26, amenities: ['WHEELCHAIR_SPACE'], constructionType: 'BR 403' },
            { type: 'middle_car',  coachClass: 2, length: 25, wagonNumber: 25, amenities: ['BISTRO'], constructionType: 'BR 403' },
            { type: 'middle_car',  coachClass: 2, length: 25, wagonNumber: 24, amenities: [], constructionType: 'BR 403' },
            { type: 'middle_car',  coachClass: 2, length: 25, wagonNumber: 23, amenities: [], constructionType: 'BR 403' },
            { type: 'middle_car',  coachClass: 2, length: 25, wagonNumber: 22, amenities: [], constructionType: 'BR 403' },
            { type: 'control_car', coachClass: 2, length: 26, wagonNumber: 21, amenities: ['BIKE_SPACE'], constructionType: 'BR 403' }
        ]
    },
    {
        id: 're_dosto_5',
        name: 'RE Doppelstock (5 Wagen + BR 146)',
        category: 'Regionalverkehr',
        subCategory: 'RE',
        description: 'Standard-Wendezug der DB Regio mit Steuerwagen, 4 Mittelwagen und moderner E-Lok.',
        defaultGattung: 'RE',
        supportedTractions: [1],
        wagonNumberOffset: 0,
        coaches: [
            { type: 'control_car', coachClass: 2, length: 27, wagonNumber: 1, amenities: ['BIKE_SPACE', 'WHEELCHAIR_SPACE'], constructionType: 'DABpbzfa' },
            { type: 'middle_car',  coachClass: 2, length: 26, wagonNumber: 2, amenities: [], constructionType: 'DBza' },
            { type: 'middle_car',  coachClass: 2, length: 26, wagonNumber: 3, amenities: [], constructionType: 'DBza' },
            { type: 'middle_car',  coachClass: 2, length: 26, wagonNumber: 4, amenities: [], constructionType: 'DBza' },
            { type: 'middle_car',  coachClass: 1, length: 26, wagonNumber: 5, amenities: [], constructionType: 'DABza' },
            { type: 'locomotive',  coachClass: null, length: 19, wagonNumber: null, amenities: [], constructionType: 'BR 146' }
        ]
    },
    {
        id: 'desiro_hc_4',
        name: 'Siemens Desiro HC (4-teilig, BR 462)',
        category: 'Regionalverkehr',
        subCategory: 'RE',
        description: 'RRX-Triebzug mit einstöckigen Endwagen und doppelstöckigen Mittelwagen. Unterstützt Doppeltraktion.',
        defaultGattung: 'RE',
        supportedTractions: [1, 2],
        wagonNumberOffset: 4,
        coaches: [
            { type: 'control_car', coachClass: 1, length: 26, wagonNumber: 1, amenities: ['WHEELCHAIR_SPACE'], constructionType: 'BR 462' },
            { type: 'middle_car',  coachClass: 2, length: 26, wagonNumber: 2, amenities: [], constructionType: 'BR 462' },
            { type: 'middle_car',  coachClass: 2, length: 26, wagonNumber: 3, amenities: [], constructionType: 'BR 462' },
            { type: 'control_car', coachClass: 2, length: 26, wagonNumber: 2, amenities: ['BIKE_SPACE'], constructionType: 'BR 462' }
        ]
    },
    {
        id: 'sbahn_423_4',
        name: 'S-Bahn BR 423 (4-teilig)',
        category: 'S-Bahn',
        subCategory: 'S',
        description: '4-teiliger S-Bahn-Triebzug. Skalierbar als Kurzzug (1x), Vollzug (2x) oder Langzug (3x).',
        defaultGattung: 'S',
        supportedTractions: [1, 2, 3],
        wagonNumberOffset: 0,
        coaches: [
            { type: 'control_car', coachClass: 2, length: 17, wagonNumber: null, amenities: ['BIKE_SPACE'], constructionType: 'BR 423' },
            { type: 'middle_car',  coachClass: 2, length: 17, wagonNumber: null, amenities: ['WHEELCHAIR_SPACE'], constructionType: 'BR 433' },
            { type: 'middle_car',  coachClass: 2, length: 17, wagonNumber: null, amenities: [], constructionType: 'BR 433' },
            { type: 'control_car', coachClass: 2, length: 17, wagonNumber: null, amenities: ['BIKE_SPACE'], constructionType: 'BR 423' }
        ]
    }
];

/**
 * Gibt eine Liste aller verfügbaren Kategorien zurück.
 * @returns {string[]}
 */
export function getPresetCategories() {
    const cats = new Set(FORMATION_PRESETS.map(p => p.category));
    return ['Alle', ...Array.from(cats)];
}
