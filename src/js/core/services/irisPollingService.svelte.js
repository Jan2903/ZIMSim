import { IrisApiService } from './irisApiService.js';
import { IrisDataMapper } from './irisDataMapper.js';
import { journeyStore, trainDisplay } from '../state/stores.js';
import { getSimulatedTime } from '../utils/config.js';
import { irisAnnouncementService } from '../../audio/irisAnnouncementService.js';
import { yieldToMain } from '../utils/yieldUtils.js';

// Re-Export für externe Konsumenten (Rückwärtskompatibilität)
export { yieldToMain };

export const irisConfig = $state({
    autoUpdateInterval: 0,
    futureWindowHours: 2,
    lookbehindMinutes: 30, // Vergangenheits-Puffer für Standzeiten und Wenden (in Minuten)
    autoAnnouncements: false,
    autoSort: true,
});

class IrisPollingService {
    lastPollTime = $state(null);
    nextPollSecs = $state(0);
    upcomingAnnouncements = $state([]);
    isActive = $state(false);
    isFetching = $state(false);

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
        this.isFetching = false;
        
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
        if (delay > 0) this.isFetching = true;
        
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
        this.isFetching = true;
        
        try {
            let newlyLoadedIds = null;

            // Check if hour changed or initial load, if so, load new base plan
            if (isInitial || currentSimTime.getHours() !== this._lastSimulatedHour) {
                this._lastSimulatedHour = currentSimTime.getHours();
                
                // Laden für -1h, aktuelle h, +1h bei Initialisierung, sonst nur nächste Stunde
                const basePlan = await IrisApiService.loadBasePlan(eva, currentSimTime, signal);
                if (isInitial) {
                    this.irisJourneysMap = basePlan || new Map();
                    this._mappedCache.clear();
                } else {
                    newlyLoadedIds = new Set();
                    // Mergen des neuen Plans in die bestehende Map (alte Züge bleiben wg fchg erhalten)
                    for (const [id, raw] of (basePlan || new Map()).entries()) {
                        if (!this.irisJourneysMap.has(id)) {
                            this.irisJourneysMap.set(id, raw);
                            newlyLoadedIds.add(id);
                        }
                    }
                }
            }

            await yieldToMain(signal);

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
                await yieldToMain(signal);

                // Lazy loading of plans for delayed trains in fchg/rchg
                await IrisApiService.loadMissingPlans(eva, realtimeXml, this.irisJourneysMap, currentSimTime, irisConfig.futureWindowHours, signal);
                
                // Merge realtime (mutates this.irisJourneysMap und liefert geänderte IDs)
                const changedIds = IrisApiService.mergeRealtime(this.irisJourneysMap, realtimeXml);
                if (newlyLoadedIds) {
                    for (const id of newlyLoadedIds) {
                        changedIds.add(id);
                    }
                }
                
                // Garbage Collection: Alte Züge löschen um Memory Leak zu vermeiden
                this._cleanupOldJourneys(currentSimTime);

                await yieldToMain(signal);

                // Wenn Initial oder fchg, alle mappen. Bei rchg nur die veränderten Züge mappen (Dirty-Tracking).
                const dirtyIdsToMap = (isInitial || fetchType === 'fchg') ? null : changedIds;

                // Update display models über den Mapper
                const lookbehindMinutes = irisConfig.lookbehindMinutes ?? 30;
                const dirtyJourneysData = IrisDataMapper.mapToZimsimFormat(
                    this.irisJourneysMap, 
                    eva, 
                    currentSimTime,
                    irisConfig.futureWindowHours,
                    dirtyIdsToMap,
                    lookbehindMinutes
                );

                for (const item of dirtyJourneysData) {
                    this._mappedCache.set(`${item.journeyId}_${item.ankunft}`, item);
                }

                // Sliding Window Check für alle Züge (inkl. Lookbehind für Wenden/Standzeiten)
                const pastThreshold = currentSimTime.getTime() - (lookbehindMinutes * 60 * 1000);
                const futureThreshold = currentSimTime.getTime() + (irisConfig.futureWindowHours * 60 * 60 * 1000);
                const allJourneysData = [];

                for (const [key, item] of this._mappedCache.entries()) {
                    // Defensiv: Züge ohne Zeitstempel sollten nicht existieren, aber sicher entfernen
                    if (!item._effectiveTimeMs) {
                        console.warn(`[IrisPollingService] Zombie-Eintrag ohne Zeitstempel entfernt: ${key}`);
                        this._mappedCache.delete(key);
                        continue;
                    }
                    // Löschen wenn außerhalb des Fensters oder wenn der Zug in irisJourneysMap nicht mehr existiert
                    if (!this.irisJourneysMap.has(item.journeyId) || item._effectiveTimeMs < pastThreshold || item._effectiveTimeMs > futureThreshold) {
                        this._mappedCache.delete(key);
                    } else {
                        allJourneysData.push(item);
                    }
                }
                
                await yieldToMain(signal);

                // Update journeyStore
                journeyStore.upsertIrisJourneys(allJourneysData);

                await yieldToMain(signal);

                // Verknüpfe Ankünfte und Abfahrten (Durchfahrten/Wenden).
                // Optimierung: Bei rchg nur neu linken, wenn sich mindestens ein Gleis geändert hat.
                // Reine Verspätungsupdates (ct ohne cp) ändern die physische Gleisbelegung nicht.
                const hasPlatformChange = isInitial || fetchType === 'fchg' || (() => {
                    for (const id of changedIds) {
                        const raw = this.irisJourneysMap.get(id);
                        if (raw?.rt && (raw.rt.ar?.cp || raw.rt.dp?.cp)) return true;
                    }
                    return false;
                })();

                if (hasPlatformChange) {
                    journeyStore.autoLinkJourneys();
                }
                
                trainDisplay.updateAll();
                
                // Optional automatisch sortieren
                if (irisConfig.autoSort) {
                    journeyStore.sortJourneys();
                }

                await yieldToMain(signal);

                // Fachliche Ansagenlogik ansprechen: Baseline bei Start, sonst Änderungsprüfung
                if (isInitial) {
                    irisAnnouncementService.initializeBaseline(journeyStore.journeys, currentSimTime.getTime());
                } else {
                    irisAnnouncementService.checkChanges(journeyStore.journeys, currentSimTime.getTime(), irisConfig.autoAnnouncements);
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
        } finally {
            this.isFetching = false;
        }
    }

    tick() {
        if (this.isActive && irisConfig.autoUpdateInterval > 0) {
            if (this.nextPollSecs > 0) {
                this.nextPollSecs--;
            }
            if (this.nextPollSecs <= 0) {
                if (this.isFetching) {
                    // Vorheriger Poll noch aktiv: Countdown zurücksetzen statt laufende Anfrage abzubrechen.
                    // Der Abort-Mechanismus bleibt explizit Stationswechseln vorbehalten.
                    this.nextPollSecs = irisConfig.autoUpdateInterval;
                } else {
                    // Regulärer Polling-Zyklus benötigt kein langes Debouncing
                    this._debouncedPollRealtime(false);
                    this.nextPollSecs = irisConfig.autoUpdateInterval;
                }
            }
        }

        if (!journeyStore.journeys) return;
        const currentSimTime = getSimulatedTime();

        // Delegation an den fachlichen Ansagenservice
        irisAnnouncementService.tick(journeyStore.journeys, currentSimTime, irisConfig.autoAnnouncements);
        this.upcomingAnnouncements = irisAnnouncementService.upcomingAnnouncements;
    }

    /**
     * Bereinigt veraltete Einträge aus der irisJourneysMap und dem _mappedCache (Garbage Collection).
     * Verhindert Memory-Leaks in lang laufenden Simulationen unter Berücksichtigung des Lookbehinds.
     * @param {Date} simTime Die aktuell simulierte Zeit
     */
    _cleanupOldJourneys(simTime) {
        const simTimeMs = simTime.getTime();
        const lookbehindMs = (irisConfig.lookbehindMinutes ?? 30) * 60 * 1000;
        const thresholdMs = Math.max(2 * 60 * 60 * 1000, lookbehindMs + (60 * 60 * 1000));
        
        for (const [id, raw] of this.irisJourneysMap.entries()) {
            const primaryNode = raw.dp || raw.ar;
            if (!primaryNode || !primaryNode.pt) continue;
            
            const timeMs = IrisDataMapper._parseIrisDateTime(primaryNode.pt);
            if (timeMs && (simTimeMs - timeMs > thresholdMs)) {
                this.irisJourneysMap.delete(id);
                this._mappedCache.delete(`${id}_true`);
                this._mappedCache.delete(`${id}_false`);
            }
        }
    }
}

export const irisPollingService = new IrisPollingService();
