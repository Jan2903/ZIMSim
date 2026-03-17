import { Coach } from './coach.js';

export class TrainGroup {
    constructor(data = {}) {
        this.groupId = data.groupId || '';
        this.trainNumber = data.trainNumber || '';
        this.destination = data.destination || '';
        this.vias = data.vias || [];
        this.scheduledTime = data.scheduledTime || '';
        this.expectedTime = data.expectedTime || '';
        
        // Umwandlung in Coach-Objekte
        this.coaches = (data.coaches || []).map(c => new Coach(c));
    }

    // Hilfsfunktion: Länge eines Zugteils berechnen
    getTotalLength() {
        return this.coaches.reduce((sum, coach) => sum + coach.length, 0);
    }
}