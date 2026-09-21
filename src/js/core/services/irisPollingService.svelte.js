import { IrisApiService } from './irisApiService.js';
import { IrisDataMapper } from './irisDataMapper.js';
import { journeyStore, trainDisplay } from '../state/stores.js';
import { getSimulatedTime } from '../utils/config.js';
import { irisAnnouncementService } from '../../audio/irisAnnouncementService.js';

export const irisConfig = $state({
    autoUpdateInterval: 0,
    futureWindowHours: 2,
    autoAnnouncements: false,
    autoSort: true,
});

class IrisPollingService {
    lastPollTime = $state(null);
    nextPollSecs = $state(0);
    upcomingAnnouncements = $state([]);
    isActive = $state(false);

    constructor() {
        this.pollingInterval = null;
        this.tickerInterval = null;
        this._lastSimulatedHour = null;
        this._lastEva = null;
        this.irisJourneysMap = new Map();
        this._mappedCache = new Map();
        
        // Spam-Schutz Mechanismen
        this._debounceTimer = null;
        this._abortController = null;
    }

    start() {
        this.stop();
        this.isActive = true;
        
        if (irisConfig.autoUpdateInterval > 0) {
            this.nextPollSecs = irisConfig.autoUpdateInterval;
        }
        
        // Ticker für Autoplay und Polling-Countdown (läuft sekündlich)
        this.tickerInterval = setInterval(() => this.tick(), 1000);
        this._lastSimulatedHour = getSimulatedTime().getHours();
        
        // Führe initialen Fetch mit Debounce aus, um API-Spam bei schnellem Klicken zu verhindern
        this._debouncedPollRealtime(true);
    }

    stop() {
        this.isActive = false;
        
        if (this.tickerInterval) {
            clearInterval(this.tickerInterval);
            this.tickerInterval = null;
        }
        
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        
        this.nextPollSecs = 0;
        this.upcomingAnnouncements = [];
        this._lastEva = null;
    }

    restart() {
        this.start();
    }

    /**
     * Debounced Wrapper für pollRealtime, wartet bevor er wirklich Netzwerk-Requests feuert.
     */
    _debouncedPollRealtime(isInitial = false) {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        
        // 300ms Debounce-Delay bei Initialisierung (User klickt schnell durch Bahnhöfe)
        const delay = isInitial ? 300 : 0;
        
        this._debounceTimer = setTimeout(() => {
            this.pollRealtime(isInitial);
        }, delay);
    }

    async pollRealtime(isInitial = false) {
        if (!journeyStore.stationContext.stationId) return;
        const eva = journeyStore.stationContext.stationId;
        const currentSimTime = getSimulatedTime();

        // Bahnhofswechsel erkennen -> Als Initial-Lauf behandeln
        if (!this._lastEva || this._lastEva !== eva) {
            this._lastEva = eva;
            isInitial = true;
        }
        
        // Laufende Anfragen abbrechen, falls ein neuer Bahnhof geladen wird
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();
        const signal = this._abortController.signal;
        
        try {
            // Check if hour changed or initial load, if so, load new base plan
            if (isInitial || currentSimTime.getHours() !== this._lastSimulatedHour) {
                this._lastSimulatedHour = currentSimTime.getHours();
                
                // Laden für -1h, aktuelle h, +1h bei Initialisierung, sonst nur nächste Stunde
                const basePlan = await IrisApiService.loadBasePlan(eva, currentSimTime, signal);
                if (isInitial) {
                    this.irisJourneysMap = basePlan || new Map();
                    this._mappedCache.clear();
                } else {
                    // Mergen des neuen Plans in die bestehende Map (alte Züge bleiben wg fchg erhalten)
                    for (const [id, raw] of (basePlan || new Map()).entries()) {
                        if (!this.irisJourneysMap.has(id)) {
                            this.irisJourneysMap.set(id, raw);
                        }
                    }
                }
            }

            // Using rchg for updates, fchg for initial or if last poll was > 90s ago
            let fetchType = isInitial ? 'fchg' : 'rchg';
            if (!isInitial && this.lastPollTime) {
                const timeSinceLastPoll = Date.now() - this.lastPollTime.getTime();
                if (timeSinceLastPoll > 90000) { // 90 Sekunden
                    fetchType = 'fchg';
                }
            }

            const realtimeXml = await IrisApiService.fetchRealtime(eva, fetchType, signal);
            
            if (realtimeXml) {
                // Lazy loading of plans for delayed trains in fchg/rchg
                await IrisApiService.loadMissingPlans(eva, realtimeXml, this.irisJourneysMap, currentSimTime, irisConfig.futureWindowHours, signal);
                
                // Merge realtime (mutates this.irisJourneysMap)
                IrisApiService.mergeRealtime(this.irisJourneysMap, realtimeXml);
                
                // Garbage Collection: Alte Züge löschen um Memory Leak zu vermeiden
                this._cleanupOldJourneys(currentSimTime);

                // Update display models über den Mapper
                const dirtyJourneysData = IrisDataMapper.mapToZimsimFormat(
                    this.irisJourneysMap, 
                    eva, 
                    currentSimTime,
                    irisConfig.futureWindowHours
                );

                for (const item of dirtyJourneysData) {
                    this._mappedCache.set(`${item.journeyId}_${item.ankunft}`, item);
                }

                // Sliding Window Check für alle Züge (auch ungeänderte)
                const pastThreshold = currentSimTime.getTime() - (3 * 60 * 1000);
                const futureThreshold = currentSimTime.getTime() + (irisConfig.futureWindowHours * 60 * 60 * 1000);
                const allJourneysData = [];

                for (const [key, item] of this._mappedCache.entries()) {
                    if (item._effectiveTimeMs && (item._effectiveTimeMs < pastThreshold || item._effectiveTimeMs > futureThreshold)) {
                        this._mappedCache.delete(key);
                    } else {
                        allJourneysData.push(item);
                    }
                }
                
                // Update journeyStore
                journeyStore.upsertIrisJourneys(allJourneysData);

                // Verknüpfe Ankünfte und Abfahrten (Durchfahrten/Wenden)
                journeyStore.autoLinkJourneys();
                
                trainDisplay.updateAll();
                
                // Optional automatisch sortieren
                if (irisConfig.autoSort) {
                    journeyStore.sortJourneys();
                }

                // Fachliche Ansagenlogik ansprechen: Baseline bei Start, sonst Änderungsprüfung
                if (isInitial) {
                    irisAnnouncementService.initializeBaseline(journeyStore.journeys, currentSimTime.getTime());
                } else {
                    irisAnnouncementService.checkChanges(journeyStore.journeys, currentSimTime.getTime());
                }
                
                this.lastPollTime = new Date();
            }
        } catch (e) {
            // Wenn der User schnell den Bahnhof gewechselt hat, ist der Abort beabsichtigt.
            if (e.name === 'AbortError') {
                console.log(`[IrisPollingService] Request aborted for EVA ${eva} (Changed station rapidly).`);
            } else {
                console.error('[IrisPollingService] Polling error:', e);
            }
        }
    }

    tick() {
        if (this.isActive && irisConfig.autoUpdateInterval > 0) {
            if (this.nextPollSecs > 0) {
                this.nextPollSecs--;
            }
            if (this.nextPollSecs <= 0) {
                // Regulärer Polling-Zyklus benötigt kein langes Debouncing
                this._debouncedPollRealtime(false);
                this.nextPollSecs = irisConfig.autoUpdateInterval;
            }
        }

        if (!journeyStore.journeys) return;
        const currentSimTime = getSimulatedTime();

        // Delegation an den fachlichen Ansagenservice
        irisAnnouncementService.tick(journeyStore.journeys, currentSimTime, irisConfig.autoAnnouncements);
        this.upcomingAnnouncements = irisAnnouncementService.upcomingAnnouncements;
    }

    /**
     * Bereinigt veraltete Einträge aus der irisJourneysMap (Garbage Collection).
     * Verhindert Memory-Leaks in lang laufenden Simulationen.
     * @param {Date} simTime Die aktuell simulierte Zeit
     */
    _cleanupOldJourneys(simTime) {
        const simTimeMs = simTime.getTime();
        const thresholdMs = 2 * 60 * 60 * 1000; // 2 Stunden in der Vergangenheit
        
        for (const [id, raw] of this.irisJourneysMap.entries()) {
            const primaryNode = raw.dp || raw.ar;
            if (!primaryNode || !primaryNode.pt) continue;
            
            const timeMs = IrisDataMapper._parseIrisDateTime(primaryNode.pt);
            if (timeMs && (simTimeMs - timeMs > thresholdMs)) {
                this.irisJourneysMap.delete(id);
            }
        }
    }
}

export const irisPollingService = new IrisPollingService();
