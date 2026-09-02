import { IrisApiService } from './irisApiService.js';
import { IrisDataMapper } from './irisDataMapper.js';
import { journeyStore, trainDisplay } from '../state/stores.js';
import { getSimulatedTime } from '../utils/config.js';
import { ansagenStore } from '../../audio/ansagenStore.svelte.js';

export const irisConfig = $state({
    autoUpdateInterval: 0,
    futureWindowHours: 2,
    autoAnnouncements: false,
    autoSort: true,
});
import { ansagenPlayer } from '../../audio/ansagenPlayer.svelte.js';
import { AnsagenGenerator } from '../../audio/ansagenGenerator.js';

class IrisPollingService {
    lastPollTime = $state(null);
    nextPollSecs = $state(0);
    upcomingAnnouncements = $state([]);
    isActive = $state(false);

    constructor() {
        this.pollingInterval = null;
        this.tickerInterval = null;
        this.generator = new AnsagenGenerator();
        this._lastSimulatedHour = null;
        this.irisJourneysMap = new Map();
        
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
        
        // Ticker for Autoplay and Polling Countdown (runs every second)
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
                } else {
                    // Mergen des neuen Plans in die bestehende Map (alte Züge bleiben wg fchg erhalten)
                    for (const [id, raw] of (basePlan || new Map()).entries()) {
                        if (!this.irisJourneysMap.has(id)) {
                            this.irisJourneysMap.set(id, raw);
                        }
                    }
                }
            }

            // Using rchg for updates, fchg for initial
            const fetchType = isInitial ? 'fchg' : 'rchg';
            const realtimeXml = await IrisApiService.fetchRealtime(eva, fetchType, signal);
            
            if (realtimeXml) {
                // Lazy loading of plans for delayed trains in fchg/rchg
                await IrisApiService.loadMissingPlans(eva, realtimeXml, this.irisJourneysMap, signal);
                
                // Keep track of old state for change announcements
                const oldHashes = new Map();
                if (irisConfig.autoAnnouncements) {
                    for (const [id, j] of this.irisJourneysMap.entries()) {
                        oldHashes.set(id, this._hashJourney(j));
                    }
                }
                
                // Merge realtime (this mutates this.irisJourneysMap)
                IrisApiService.mergeRealtime(this.irisJourneysMap, realtimeXml);
                
                // Garbage Collection: Alte Züge löschen um Memory Leak zu vermeiden
                this._cleanupOldJourneys(currentSimTime);

                // Update display models über den neuen Mapper
                const journeysData = IrisDataMapper.mapToZimsimFormat(
                    this.irisJourneysMap, 
                    eva, 
                    currentSimTime,
                    irisConfig.futureWindowHours
                );
                
                // Update journeyStore in-place to avoid destroying UI state
                const activeIds = new Set(journeysData.map(d => `${d.journeyId}_${d.ankunft}`));
                
                // Remove outdated journeys
                for (let i = journeyStore.journeys.length - 1; i >= 0; i--) {
                    const j = journeyStore.journeys[i];
                    if (!activeIds.has(`${j.journeyId}_${j.ankunft}`)) {
                        journeyStore.removeJourney(j.id);
                    }
                }
                
                // Add or update
                for (const jData of journeysData) {
                    let existing = journeyStore.journeys.find(j => j.journeyId === jData.journeyId && j.ankunft === jData.ankunft);
                    if (existing) {
                        // Update existing fields where relevant for realtime
                        existing.expectedTime = jData.expectedTime;
                        existing.ezGleis = jData.ezGleis;
                        existing.delayReason = jData.delayReason;
                        existing.ausfall = jData.ausfall;
                        existing._effectiveTimeMs = jData._effectiveTimeMs;
                    } else {
                        journeyStore.addJourney(jData);
                    }
                }

                // Verknüpfe Ankünfte und Abfahrten (Durchfahrten/Wenden)
                journeyStore.autoLinkJourneys();
                
                trainDisplay.updateAll();
                
                // Optional automatisch sortieren
                if (irisConfig.autoSort) {
                    journeyStore.sortJourneys();
                }

                // Check for changes and trigger announcements
                if (irisConfig.autoAnnouncements) {
                    this._checkForChanges(oldHashes);
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
        const simTimeMs = getSimulatedTime().getTime();
        const newUpcoming = [];

        for (const journey of journeyStore.journeys) {
            // Ansagen-Logik für Durchfahrten anpassen
            if (journey.ankunft) {
                const linkedDep = journeyStore.journeys.find(j => !j.ankunft && j.linkedArrivalJourneyId === journey.id);
                if (linkedDep && linkedDep.name === journey.name) {
                    continue; // Ankunft bei Durchfahrt überspringen, Abfahrt triggert die Ansage!
                }
            }

            let effectiveTimeMs = journey._effectiveTimeMs;
            
            if (!journey.ankunft && journey.linkedArrivalJourneyId) {
                const linkedArr = journeyStore.journeys.find(j => j.ankunft && j.id === journey.linkedArrivalJourneyId);
                if (linkedArr && linkedArr.name === journey.name) {
                    effectiveTimeMs = linkedArr._effectiveTimeMs; // Nutze Ankunftszeit für Countdown
                }
            }

            if (!effectiveTimeMs) continue;
            
            const diffSecs = Math.floor((effectiveTimeMs - simTimeMs) / 1000);
            
            if (diffSecs > 0 && diffSecs <= 3600 && !journey._hasPlayedEinfahrt) {
                // Collect for upcoming preview
                newUpcoming.push({
                    journeyId: journey.journeyId,
                    name: journey.name,
                    dest: journey.destinationKurz || journey.destination,
                    countdown: diffSecs,
                    type: 'Einfahrt'
                });
            }
            
            // Einfahrt: 60 Sekunden vorher
            if (irisConfig.autoAnnouncements && diffSecs === 60 && !journey._hasPlayedEinfahrt) {
                journey._hasPlayedEinfahrt = true;
                this._playEinfahrt(journey);
            }
        }
        
        // Sort ascending by countdown and keep top 4
        newUpcoming.sort((a, b) => a.countdown - b.countdown);
        this.upcomingAnnouncements = newUpcoming.slice(0, 4);
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

    _hashJourney(j) {
        const ar = j.rt?.ar || {};
        const dp = j.rt?.dp || {};
        return `${ar.ct || ''}_${ar.cp || ''}_${ar.cs || ''}_${dp.ct || ''}_${dp.cp || ''}_${dp.cs || ''}`;
    }

    _checkForChanges(oldHashes) {
        for (const journey of journeyStore.journeys) {
            const raw = this.irisJourneysMap.get(journey.journeyId);
            if (!raw) continue;
            
            const oldHash = oldHashes.get(journey.journeyId);
            const newHash = this._hashJourney(raw);
            
            if (oldHash && oldHash !== newHash) {
                if (journey._hasPlayedEinfahrt) {
                    this._playInformation(journey);
                }
            }
        }
    }

    _playEinfahrt(journey) {
        const playlist = this.generator.generateEinfahrt(journey);
        if (playlist && playlist.length > 0) {
            ansagenPlayer.enqueue(playlist);
        }
    }

    _playInformation(journey) {
        const playlist = this.generator.generateInformation(journey);
        if (playlist && playlist.length > 0) {
            ansagenPlayer.enqueue(playlist);
        }
    }
}

export const irisPollingService = new IrisPollingService();
