// js/displays/core/hardwareProfiles.js

/**
 * Definition der physischen Hardware-Profile für ZIM-Monitore.
 * Entkoppelt die Hardware-Geometrie (Maße, Aspektverhältnis, Gehäuse/Rahmen)
 * vollständig von der fachlichen Inhaltsbelegung.
 */
export const HARDWARE_PROFILES = {
    // 1. Standard Doppelmonitor mit DB-Gehäuse (3890×1080 brutto mit 50px Steg)
    zim2x32_casing: {
        id: 'zim2x32_casing',
        legacyKey: 'standard',
        name: 'ZIM 2×32" / 2×43" Überkopf (mit Gehäuse)',
        category: 'overhead',
        width: 3890,
        height: 1080,
        bezel: {
            type: 'hanging_dual',
            width: 4430,
            height: 1600,
            offsetX: 270,
            offsetY: 260,
            hasBezelGap: true,
            gapWidth: 50,
            gapX: 1920
        },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 1920, h: 1080 },
            { id: 'slot_2', x: 1970, y: 0, w: 1920, h: 1080 }
        ]
    },

    // 2. Standard Doppelmonitor randlos (3840×1080 für Kiosk / Multi-Monitor)
    zim2x32_frameless: {
        id: 'zim2x32_frameless',
        legacyKey: 'standard_frameless',
        name: 'ZIM 2×32" / 2×43" Randlos (3840×1080 Kiosk)',
        category: 'overhead',
        width: 3840,
        height: 1080,
        bezel: { type: 'none' },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 1920, h: 1080 },
            { id: 'slot_2', x: 1920, y: 0, w: 1920, h: 1080 }
        ]
    },

    // 3. Triple-Monitor mit Gehäuse (5860×1080 brutto mit 2× 50px Stegen)
    zim3screen_casing: {
        id: 'zim3screen_casing',
        legacyKey: 'standard_3screen',
        name: 'ZIM 3-Screen Überkopf (mit Gehäuse)',
        category: 'overhead',
        width: 5860,
        height: 1080,
        bezel: {
            type: 'hanging_triple',
            width: 6400,
            height: 1600,
            offsetX: 270,
            offsetY: 260,
            hasBezelGap: true,
            gapWidth: 50,
            gaps: [1920, 3940]
        },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 1920, h: 1080 },
            { id: 'slot_2', x: 1970, y: 0, w: 1920, h: 1080 },
            { id: 'slot_3', x: 3940, y: 0, w: 1920, h: 1080 }
        ]
    },

    // 4. Triple-Monitor randlos (5760×1080 Kiosk)
    zim3screen_frameless: {
        id: 'zim3screen_frameless',
        legacyKey: 'standard_3screen_frameless',
        name: 'ZIM 3-Screen Randlos (5760×1080 Kiosk)',
        category: 'overhead',
        width: 5760,
        height: 1080,
        bezel: { type: 'none' },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 1920, h: 1080 },
            { id: 'slot_2', x: 1920, y: 0, w: 1920, h: 1080 },
            { id: 'slot_3', x: 3840, y: 0, w: 1920, h: 1080 }
        ]
    },

    // 5. Einzelschirm Überkopf (1920×1080)
    zim32_single: {
        id: 'zim32_single',
        legacyKey: 'standard_screen1',
        name: 'ZIM 32" / 43" / 46" Einzelschirm (1920×1080)',
        category: 'overhead',
        width: 1920,
        height: 1080,
        bezel: {
            type: 'hanging_single',
            width: 2460,
            height: 1600,
            offsetX: 270,
            offsetY: 260
        },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 1920, h: 1080 }
        ]
    },

    // 6. ZIMwide gestreckt (2560×1080, 21:9 Bar-Type)
    zimwide: {
        id: 'zimwide',
        name: 'ZIMwide (2560×1080 Bar-Type Unterführung)',
        category: 'stretched',
        width: 2560,
        height: 1080,
        bezel: {
            type: 'stretched_single',
            width: 2760,
            height: 1260,
            offsetX: 100,
            offsetY: 90
        },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 2560, h: 1080 }
        ]
    },

    // 7. ZIMultrawide nahtlos (3840×1080, 32:9 nahtloses Panel ohne Steg)
    zimultrawide: {
        id: 'zimultrawide',
        name: 'ZIMultrawide (3840×1080 nahtlos ohne Mittelsteg)',
        category: 'stretched',
        width: 3840,
        height: 1080,
        bezel: {
            type: 'stretched_dual',
            width: 4040,
            height: 1260,
            offsetX: 100,
            offsetY: 90
        },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 3840, h: 1080 }
        ]
    },

    // 8. ZIMvitrine 32" / 43" Landscape (1920×1080 mit Standfuß)
    zimvitrine32: {
        id: 'zimvitrine32',
        legacyKey: 'zimvitrine32wagenstand',
        name: 'ZIMvitrine 32" / 43" (16:9 Landscape mit Standfuß)',
        category: 'vitrine',
        width: 1920,
        height: 1080,
        bezel: {
            type: 'vitrine',
            width: 2120,
            height: 1380,
            offsetX: 100,
            offsetY: 100
        },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 1920, h: 1080 }
        ]
    },

    // 9. ZIMvitrine 65h Portrait (1080×1920 9:16 Stele mit Sockel)
    zimvitrine65h: {
        id: 'zimvitrine65h',
        name: 'ZIMvitrine 65h (9:16 Portrait Aushangstele)',
        category: 'stele',
        width: 1080,
        height: 1920,
        bezel: {
            type: 'stele',
            width: 1240,
            height: 2220,
            offsetX: 80,
            offsetY: 100
        },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 1080, h: 1920 }
        ]
    },

    // 10. ZIM 200 / 150 Hallen-Großtafel (3840×2160 4K)
    zim200_hall: {
        id: 'zim200_hall',
        name: 'ZIM 200 / 150 (3840×2160 4K Hallenanzeiger)',
        category: 'hall',
        width: 3840,
        height: 2160,
        scaleFactor: 2.0,
        bezel: { type: 'none' },
        slots: [
            { id: 'slot_1', x: 0, y: 0, w: 3840, h: 2160 }
        ]
    }
};

/**
 * Sucht ein Hardware-Profil anhand seiner ID oder eines Legacy-Layout-Keys.
 * @param {string} key
 * @returns {object} Das gefundene Hardware-Profil oder zim2x32_casing als Fallback
 */
export function getHardwareProfile(key) {
    if (!key) return HARDWARE_PROFILES.zim2x32_casing;
    if (HARDWARE_PROFILES[key]) return HARDWARE_PROFILES[key];
    
    // Nach Legacy-Key suchen (z.B. 'standard', 'voranzeiger', 'zimvitrine32wagenstand')
    for (const profile of Object.values(HARDWARE_PROFILES)) {
        if (profile.legacyKey === key) return profile;
    }

    if (key === 'voranzeiger') return HARDWARE_PROFILES.zim32_single;
    if (key === 'standard_4k') return HARDWARE_PROFILES.zim200_hall;
    
    return HARDWARE_PROFILES.zim2x32_casing;
}
