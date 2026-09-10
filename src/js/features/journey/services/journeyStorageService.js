import { Journey } from '../journey.svelte.js';
import { Platform } from '../../station/platform.svelte.js';

/**
 * Service für Serialisierung und Deserialisierung des Store-Status (Export / Import).
 */
export class JourneyStorageService {
    /**
     * Exportiert den Store als JSON-kompatibles Objekt.
     * @param {object} store - Der JourneyStore
     * @returns {object}
     */
    static exportState(store) {
        return {
            stationContext: {
                stationName: store.stationContext.stationName,
                stationId: store.stationContext.stationId,
                activePlatformName: store.stationContext.platform.name || 'default'
            },
            journeys: store.journeys,
            nrwMode: store.nrwMode,
            activeTracks: store.activeTracks,
            platforms: store.platforms,
            customStations: store.customStations
        };
    }

    /**
     * Importiert einen komplett exportierten Store-Zustand.
     * @param {object} store - Der JourneyStore (wird aktualisiert)
     * @param {object} data - Die importierten Rohdaten
     */
    static importState(store, data) {
        if (!data) return;

        store.nrwMode = data.nrwMode || false;
        store.activeTracks = data.activeTracks || [];
        store.customStations = data.customStations || [];

        if (data.platforms) {
            store.platforms = {};
            for (const [key, platData] of Object.entries(data.platforms)) {
                store.platforms[key] = new Platform(platData);
            }
        } else {
            store.platforms = {};
        }

        if (data.stationContext) {
            store.stationContext.stationName = data.stationContext.stationName || '';
            store.stationContext.stationId = data.stationContext.stationId || '';
            
            const activeName = data.stationContext.activePlatformName;
            if (activeName && store.platforms[activeName]) {
                store.stationContext.platform = store.platforms[activeName];
            } else {
                store.stationContext.platform = new Platform();
            }
        }

        store.journeys = (data.journeys || []).map(j => new Journey(j));
    }
}
