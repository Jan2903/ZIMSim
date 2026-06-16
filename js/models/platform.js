export class Platform {
    constructor(data = {}) {
        this.length = data.length || 400;
        this.currentLocation = data.currentLocation !== undefined ? data.currentLocation : 100;
        this.sections = data.sections || [
            // Standard-Sektoren, falls nichts übergeben wird
            { name: 'A', startMeter: 0, endMeter: 100, cubePosition: 50 },
            { name: 'B', startMeter: 100, endMeter: 200, cubePosition: 150 },
            { name: 'C', startMeter: 200, endMeter: 200, cubePosition: 200 },
            { name: 'D', startMeter: 200, endMeter: 300, cubePosition: 250 },
            { name: 'E', startMeter: 300, endMeter: 400, cubePosition: 350 }
        ];
    }
}