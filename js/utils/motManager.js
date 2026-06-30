// js/utils/motManager.js

export const MOT_NAMES = {
    'ICE': 'ICE',
    'EC_IC': 'EC/IC',
    'IR': 'IR',
    'REGIONAL': 'Regional',
    'SBAHN': 'S-Bahn',
    'BUS': 'Bus',
    'SCHIFF': 'Schiff',
    'UBAHN': 'U-Bahn',
    'TRAM': 'Straßenbahn',
    'ANRUFPFLICHTIG': 'Anrufpflichtig'
};

export const MOT_ALL_KEYS = Object.keys(MOT_NAMES);

export const MOT_PRESETS = {
    'FV': ['ICE', 'EC_IC', 'IR'],
    'NV': ['REGIONAL', 'SBAHN'],
    'SPNV': ['REGIONAL', 'SBAHN', 'UBAHN', 'TRAM'],
    'ÖPNV': ['REGIONAL', 'SBAHN', 'BUS', 'SCHIFF', 'UBAHN', 'TRAM', 'ANRUFPFLICHTIG'],
    'SPV': ['ICE', 'EC_IC', 'IR', 'REGIONAL', 'SBAHN', 'UBAHN', 'TRAM'],
    'ALL': MOT_ALL_KEYS
};

export const MOT_PRESET_NAMES = {
    'FV': 'Nur Fernverkehr (FV)',
    'NV': 'Nur Nahverkehr (NV)',
    'SPNV': 'Schienenpersonennahverkehr (SPNV)',
    'ÖPNV': 'Öffentl. Personennahverkehr (ÖPNV)',
    'SPV': 'Schienenpersonenverkehr (SPV)',
    'ALL': 'Alle Verkehrsmittel'
};

/**
 * Generates the smart header string based on the selected MOTs.
 * @param {string[]} selectedMots Array of selected MOT keys
 * @returns {string} The smart header string
 */
export function getSmartHeaderString(selectedMots) {
    if (selectedMots.length === MOT_ALL_KEYS.length) {
        return 'Verkehrsmittel: ' + MOT_PRESET_NAMES['ALL'];
    }

    if (selectedMots.length === 0) {
        return 'Verkehrsmittel: Keine';
    }

    // Check for exact preset matches
    for (const [presetKey, presetValues] of Object.entries(MOT_PRESETS)) {
        if (presetKey === 'ALL') continue;
        if (selectedMots.length === presetValues.length && presetValues.every(v => selectedMots.includes(v))) {
            return 'Verkehrsmittel: ' + MOT_PRESET_NAMES[presetKey];
        }
    }

    // Check for "ohne X" (1 or 2 missing)
    const missingMots = MOT_ALL_KEYS.filter(k => !selectedMots.includes(k));
    if (missingMots.length === 1 || missingMots.length === 2) {
        const missingNames = missingMots.map(k => MOT_NAMES[k]).join(', ');
        return 'Verkehrsmittel: ohne ' + missingNames;
    }

    // Default comma separated list, truncated if > 3
    const selectedNames = selectedMots.map(k => MOT_NAMES[k]);
    if (selectedNames.length > 3) {
        const firstThree = selectedNames.slice(0, 3).join(', ');
        const remainingCount = selectedNames.length - 3;
        return `Verkehrsmittel: ${firstThree} + ${remainingCount} weitere`;
    }

    return 'Verkehrsmittel: ' + selectedNames.join(', ');
}

/**
 * Maps a generic train/transport category to the corresponding MOT key.
 * @param {string} category The category string (e.g. "ICE", "RE", "S", "STR")
 * @returns {string} The MOT key or null if not found
 */
export function getMotForCategory(category) {
    if (!category) return null;
    const cat = category.toUpperCase().trim();
    
    if (cat === 'ICE') return 'ICE';
    if (['IC', 'EC'].includes(cat)) return 'EC_IC';
    if (['IR', 'IRE'].includes(cat)) return 'IR';
    if (['RE', 'RB', 'MEX', 'FEX', 'ME', 'NWB', 'ERX', 'HLB', 'WFB'].includes(cat)) return 'REGIONAL';
    if (['S'].includes(cat)) return 'SBAHN';
    if (['BUS', 'SEV'].includes(cat)) return 'BUS';
    if (['STR', 'TRAM'].includes(cat)) return 'TRAM';
    if (['U'].includes(cat)) return 'UBAHN';
    if (['AST', 'RUFBUS'].includes(cat)) return 'ANRUFPFLICHTIG';
    if (['SCHIFF', 'FÄHRE', 'FAEHRE'].includes(cat)) return 'SCHIFF';
    
    // Fallback based on text match
    if (cat.includes('ICE')) return 'ICE';
    if (cat.includes('IC') || cat.includes('EC')) return 'EC_IC';
    if (cat.includes('RE') || cat.includes('RB')) return 'REGIONAL';
    if (cat.includes('S')) return 'SBAHN';
    if (cat.includes('BUS')) return 'BUS';
    if (cat.includes('STR') || cat.includes('TRAM')) return 'TRAM';
    
    // Default to regional if completely unknown but seemingly train-like?
    // Let's just return REGIONAL as a catch-all for unknown trains if needed, or null.
    return 'REGIONAL'; 
}
