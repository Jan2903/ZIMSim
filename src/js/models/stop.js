// js/models/stop.js
import { StationService } from '../utils/stationService.js';

/**
 * Repräsentiert einen einzelnen Halt einer Fahrt.
 * Enthält Zeitdaten, Gleis, Kategorie/Nummer (pro Halt änderbar) und Meldungen.
 */
export class Stop {
    constructor(data = {}) {
        this.id = data.id || crypto.randomUUID();
        this.name = data.name || '';
        this.extId = data.extId || '';          // EVA-Nr / IBNR (z.B. "8000152")

        // Zeiten — null wenn nicht vorhanden (z.B. kein departure am letzten Halt)
        this.departure = data.departure ? {
            scheduled: data.departure.scheduled || data.departure.sollzeit || '',
            expected: data.departure.expected || data.departure.ezZeit || ''
        } : null;

        this.arrival = data.arrival ? {
            scheduled: data.arrival.scheduled || data.arrival.sollzeit || '',
            expected: data.arrival.expected || data.arrival.ezZeit || ''
        } : null;

        this.platform = data.platform || data.gleis || '';
        this.ezGleis = data.ezGleis || '';

        // Halt-Status
        this.cancelled = data.cancelled || false;   // Halt entfällt
        this.additional = data.additional || false;  // Zusatzhalt

        // Halt-basierte Zugnummer (kann sich pro Halt ändern!)
        this.category = data.category || data.kategorie || '';
        this.number = data.number || data.nummer || '';
        this.line = data.line || '';

        this.routeIndex = data.routeIndex ?? data.routeIdx ?? -1;

        // Vias & Displays
        this.showAsVia = data.showAsVia || false;
        this.nameKurz = data.nameKurz || '';
        this.stationCategory = data.stationCategory || 99;
        this.boardingType = data.boardingType || null; // null, 'ein', 'aus'

        if (data.risNotizen) {
            if (data.risNotizen.some(r => r.key === 'text.realtime.stop.exit.disabled')) {
                this.boardingType = 'ein';
            } else if (data.risNotizen.some(r => r.key === 'text.realtime.stop.entry.disabled')) {
                this.boardingType = 'aus';
            }
        }

        // Meldungen
        this.messages = (data.messages || data.priorisierteMeldungen || []).map(m => ({
            priority: m.priority || m.prioritaet || 'NIEDRIG',
            text: m.text || '',
            type: m.type || ''
        }));
    }

    /**
     * Reichert den Halt mit Daten aus der stations.csv an, falls vorhanden.
     */
    enrichWithStationData() {
        if (!StationService.isLoaded) return;
        const station = StationService.getStationByIdOrName(this.extId, this.name);
        if (station) {
            this.nameKurz = station.nameKurz || this.nameKurz;
            this.stationCategory = station.kategorie || this.stationCategory;
        }
    }

    /** Hat dieser Halt eine Abfahrt? */
    get hasDeparture() { return this.departure !== null; }

    /** Hat dieser Halt eine Ankunft? */
    get hasArrival() { return this.arrival !== null; }

    /** Formatierte Abfahrtszeit (nur HH:MM) */
    get departureTime() {
        if (!this.departure) return '';
        return Stop.formatTime(this.departure.scheduled);
    }

    /** Formatierte Ankunftszeit (nur HH:MM) */
    get arrivalTime() {
        if (!this.arrival) return '';
        return Stop.formatTime(this.arrival.scheduled);
    }

    /**
     * Extrahiert HH:MM aus einem ISO-Datetime-String oder gibt den Wert direkt zurück.
     * @param {string} timeStr - z.B. "2026-06-15T07:39:00" oder "07:39"
     * @returns {string} z.B. "07:39"
     */
    static formatTime(timeStr) {
        if (!timeStr) return '';
        if (timeStr.includes('T')) {
            const parts = timeStr.split('T')[1];
            return parts ? parts.substring(0, 5) : timeStr;
        }
        return timeStr;
    }
}
