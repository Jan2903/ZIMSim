import { ansagenPlayer } from './ansagenPlayer.svelte.js';
import { getSimulatedTime } from '../core/utils/config.js';

export const ANNOUNCEMENT_TYPE = {
    EINFAHRT: 'EINFAHRT',
    REPLAY: 'REPLAY',
    AUSFALL_PLANZEIT: 'AUSFALL_PLANZEIT',
    AUSFALL: 'AUSFALL',
    GLEISWECHSEL: 'GLEISWECHSEL',
    FAHRTAENDERUNG: 'FAHRTAENDERUNG',
    VERSPAETUNG: 'VERSPAETUNG',
    REMINDER: 'REMINDER'
};

export const ANNOUNCEMENT_PRIORITY = {
    [ANNOUNCEMENT_TYPE.EINFAHRT]: 100,
    [ANNOUNCEMENT_TYPE.REPLAY]: 95,
    [ANNOUNCEMENT_TYPE.AUSFALL_PLANZEIT]: 90,
    [ANNOUNCEMENT_TYPE.AUSFALL]: 80,
    [ANNOUNCEMENT_TYPE.GLEISWECHSEL]: 75,
    [ANNOUNCEMENT_TYPE.FAHRTAENDERUNG]: 70,
    [ANNOUNCEMENT_TYPE.VERSPAETUNG]: 50,
    [ANNOUNCEMENT_TYPE.REMINDER]: 30
};

class AnnouncementQueueService {
    queue = $state([]);
    history = $state([]);
    currentAnnouncement = $state(null);

    constructor() {
        ansagenPlayer.onEnded = () => {
            this.currentAnnouncement = null;
            this.playNext();
        };
    }

    /**
     * Reiht eine Ansage priorisiert in die Warteschlange ein.
     * @param {object} item - Ansagenobjekt
     */
    enqueue(item) {
        if (!item || !item.playlist || item.playlist.length === 0) return;

        const priority = item.priority ?? (ANNOUNCEMENT_PRIORITY[item.type] || 50);
        const textSummary = item.textSummary || item.playlist.map(p => p.text).filter(Boolean).join(' ');

        const queueItem = {
            id: item.id || crypto.randomUUID(),
            journeyId: item.journeyId || '',
            trainName: item.trainName || '',
            type: item.type || ANNOUNCEMENT_TYPE.REMINDER,
            priority: priority,
            playlist: item.playlist,
            label: item.label || item.type,
            textSummary: textSummary,
            createdAt: item.createdAt || new Date(),
            simTimeMs: item.simTimeMs || getSimulatedTime().getTime(),
            trainCountdownTimeMs: item.trainCountdownTimeMs || 0
        };

        // --- Intelligente Deduplizierung ---
        if (queueItem.type === ANNOUNCEMENT_TYPE.VERSPAETUNG && queueItem.journeyId) {
            // Neuere Verspätung für denselben Zug ersetzt eine bereits wartende ältere Verspätung
            this.queue = this.queue.filter(
                q => !(q.journeyId === queueItem.journeyId && q.type === ANNOUNCEMENT_TYPE.VERSPAETUNG)
            );
        } else if (
            (queueItem.type === ANNOUNCEMENT_TYPE.AUSFALL || queueItem.type === ANNOUNCEMENT_TYPE.AUSFALL_PLANZEIT) &&
            queueItem.journeyId
        ) {
            // Bei Zugausfall: Alle wartenden Einfahrts- und Verspätungsansagen des Zuges verwerfen
            this.queue = this.queue.filter(
                q => !(q.journeyId === queueItem.journeyId && (q.type === ANNOUNCEMENT_TYPE.EINFAHRT || q.type === ANNOUNCEMENT_TYPE.VERSPAETUNG))
            );
        }

        // Einsortieren nach Priorität absteigend, bei gleicher Priorität FIFO (nach createdAt)
        this.queue.push(queueItem);
        this._sortQueue();

        // Falls aktuell nichts abgespielt wird, direkt Wiedergabe starten
        if (!ansagenPlayer.isPlaying && !this.currentAnnouncement) {
            this.playNext();
        }
    }

    /**
     * Startet das nächste verfügbare Ansagen-Element aus der Queue.
     */
    playNext() {
        if (ansagenPlayer.isPlaying) return;

        const currentSimTimeMs = getSimulatedTime().getTime();

        // Stale-Check vor dem Abspielen
        while (this.queue.length > 0) {
            const nextCandidate = this.queue[0];

            // 1. Einfahrt: Wenn der Zug bereits mehr als 45s vorbei ist -> verwerfen
            if (nextCandidate.type === ANNOUNCEMENT_TYPE.EINFAHRT && nextCandidate.trainCountdownTimeMs) {
                if (currentSimTimeMs - nextCandidate.trainCountdownTimeMs > 45000) {
                    console.log(`[AnnouncementQueue] Verwerfe veraltete Einfahrt für ${nextCandidate.trainName} (45s verstrichen).`);
                    this.queue.shift();
                    continue;
                }
            }

            // 2. Andere Ansagen für Züge, die bereits mehr als 60s in der Vergangenheit liegen -> verwerfen
            if (nextCandidate.trainCountdownTimeMs && (currentSimTimeMs - nextCandidate.trainCountdownTimeMs > 60000)) {
                console.log(`[AnnouncementQueue] Verwerfe veraltete Ansage (${nextCandidate.type}) für ${nextCandidate.trainName}.`);
                this.queue.shift();
                continue;
            }

            // Gültiges Element gefunden
            break;
        }

        if (this.queue.length === 0) {
            this.currentAnnouncement = null;
            return;
        }

        const item = this.queue.shift();
        this.currentAnnouncement = item;

        // In Verlauf (Historie) aufnehmen (max 50)
        this.history.unshift({
            id: crypto.randomUUID(),
            journeyId: item.journeyId,
            trainName: item.trainName,
            type: item.type,
            label: item.label,
            textSummary: item.textSummary,
            playedAt: new Date(),
            playlist: [...item.playlist],
            trainCountdownTimeMs: item.trainCountdownTimeMs
        });
        if (this.history.length > 50) {
            this.history.length = 50;
        }

        ansagenPlayer.play(item.playlist);
    }

    /**
     * Reiht eine historische Ansage erneut mit Replay-Priorität (95) ein.
     * @param {object} historyItem
     */
    replay(historyItem) {
        if (!historyItem || !historyItem.playlist || historyItem.playlist.length === 0) return;

        this.enqueue({
            journeyId: historyItem.journeyId,
            trainName: historyItem.trainName,
            type: ANNOUNCEMENT_TYPE.REPLAY,
            priority: ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.REPLAY],
            playlist: historyItem.playlist,
            label: `Wdh: ${historyItem.trainName} (${historyItem.label || historyItem.type})`,
            textSummary: historyItem.textSummary,
            trainCountdownTimeMs: historyItem.trainCountdownTimeMs || 0
        });
    }

    /**
     * Leert die Warteschlange.
     */
    clearQueue() {
        this.queue = [];
    }

    /**
     * Leert die Historie.
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * Stoppt die aktuelle Wiedergabe und verwirft alle wartenden Ansagen.
     */
    stopAll() {
        this.clearQueue();
        ansagenPlayer.stop();
        this.currentAnnouncement = null;
    }

    _sortQueue() {
        this.queue.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
        });
    }
}

export const announcementQueueService = new AnnouncementQueueService();
