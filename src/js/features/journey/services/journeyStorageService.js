import { Journey } from '../journey.svelte.js';
import { Platform } from '../../station/platform.svelte.js';
import { lineColorService, COLOR_SCHEMES } from '../../../core/services/lineColorService.svelte.js';
import { formationRuleService } from '../../formation/formationRuleService.svelte.js';

/**
 * Service für Serialisierung und Deserialisierung des Store-Status (Export / Import).
 */
export class JourneyStorageService {
    /**
     * Exportiert den Store als JSON-kompatibles Objekt.
     * Enthält neben den Fahrten auch das aktive Farbsystem, damit ein Backup
     * den Look vollständig reproduziert.
     * @param {object} store - Der JourneyStore
     * @returns {object}
     */
    static exportState(store) {
        const rawState = {
            stationContext: {
                stationName: store.stationContext.stationName,
                stationId: store.stationContext.stationId,
                activePlatformName: store.stationContext?.platform?.name || 'default'
            },
            journeys: store.journeys,
            nrwMode: store.nrwMode,
            formatOptions: store.formatOptions,
            activeTracks: store.activeTracks,
            platforms: store.platforms,
            customStations: store.customStations,
            lineColorRules: lineColorService.rules,
            colorScheme: lineColorService.colorScheme,
            regionalAutoColors: lineColorService.regionalAutoColors,
            autoColorsEnabled: lineColorService.autoColorsEnabled,
            formationRules: formationRuleService.rules
        };

        try {
            // Svelte 5 Proxies dereferenzieren, um fehlerfreies Klonen / postMessage zu garantieren
            return JSON.parse(JSON.stringify(rawState));
        } catch {
            return rawState;
        }
    }

    /**
     * Importiert einen komplett exportierten Store-Zustand.
     * @param {object} store - Der JourneyStore (wird aktualisiert)
     * @param {object} data - Die importierten Rohdaten
     */
    static importState(store, data) {
        if (!data) return;

        store.nrwMode = data.nrwMode || false;
        if (data.formatOptions && typeof data.formatOptions === 'object') {
            store.formatOptions = { ...store.formatOptions, ...data.formatOptions };
        }
        store.saveSettings?.();
        store.activeTracks = data.activeTracks || [];
        store.customStations = data.customStations || [];
        store.saveCustomStations?.();

        if (data.platforms && Object.keys(data.platforms).length > 0) {
            store.platforms = {};
            for (const [key, platData] of Object.entries(data.platforms)) {
                store.platforms[key] = new Platform(platData);
            }
        } else {
            store.platforms = {
                'default': new Platform({ name: 'default' })
            };
        }

        if (data.stationContext) {
            store.stationContext.stationName = data.stationContext.stationName || '';
            store.stationContext.stationId = data.stationContext.stationId || '';
            
            const activeName = data.stationContext.activePlatformName || 'default';
            if (activeName && store.platforms[activeName]) {
                store.stationContext.platform = store.platforms[activeName];
                store.stationContext.activePlatformName = activeName;
            } else {
                const firstKey = Object.keys(store.platforms)[0] || 'default';
                if (!store.platforms[firstKey]) {
                    store.platforms[firstKey] = new Platform({ name: firstKey });
                }
                store.stationContext.platform = store.platforms[firstKey];
                store.stationContext.activePlatformName = firstKey;
            }
        }

        if (data.lineColorRules && Array.isArray(data.lineColorRules)) {
            lineColorService.importRules(data.lineColorRules);
        }

        // Farbsystem aus dem Backup übernehmen. Ältere Backups ohne diese Felder
        // lassen die aktuelle Wahl unverändert (rückwärtskompatibel).
        // Die Vergleiche verhindern unnötiges Leeren des Style-Caches bei jedem
        // ScreenSync-Broadcast.
        if (
            (data.colorScheme === COLOR_SCHEMES.DB_2026 || data.colorScheme === COLOR_SCHEMES.CLASSIC) &&
            data.colorScheme !== lineColorService.colorScheme
        ) {
            lineColorService.setColorScheme(data.colorScheme);
        }
        if (typeof data.regionalAutoColors === 'boolean' && data.regionalAutoColors !== lineColorService.regionalAutoColors) {
            lineColorService.setRegionalAutoColors(data.regionalAutoColors);
        }
        if (typeof data.autoColorsEnabled === 'boolean' && data.autoColorsEnabled !== lineColorService.autoColorsEnabled) {
            lineColorService.setAutoColorsEnabled(data.autoColorsEnabled);
        }

        if (data.formationRules && Array.isArray(data.formationRules)) {
            formationRuleService.importRules(data.formationRules);
        }

        store.journeys = (data.journeys || []).map(j => new Journey(j));
        store.updateAllJourneySectors?.();
    }
}
