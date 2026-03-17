export class Platform {
    constructor(data = {}) {
        this.length = data.length || 420;
        this.sections = data.sections || [
            // Standard-Sektoren, falls nichts übergeben wird
            { name: 'A', startMeter: 0, endMeter: 50, cubePosition: 25 },
            { name: 'B', startMeter: 50, endMeter: 100, cubePosition: 75 },
            { name: 'C', startMeter: 100, endMeter: 150, cubePosition: 125 }
        ];
    }
}