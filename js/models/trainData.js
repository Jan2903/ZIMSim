import { Platform } from './platform.js';
import { Departure } from './departure.js';

export class TrainData {
    constructor() {
        this.platform = new Platform({
            length: 420,
            sections: [
                { name: 'A', startMeter: 0, endMeter: 70, cubePosition: 35 },//35
                { name: 'B', startMeter: 70, endMeter: 140, cubePosition: 100},
                { name: 'C', startMeter: 140, endMeter: 210, cubePosition: 175 },
                { name: 'D', startMeter: 210, endMeter: 280, cubePosition: 275 },//245
                { name: 'E', startMeter: 280, endMeter: 350, cubePosition: 315 },
                { name: 'F', startMeter: 350, endMeter: 420, cubePosition: 385 }
            ]
        });

        this.departures = [
            new Departure({
                direction: 1,      // Fährt nach rechts aus
                startMeter: 50,   // Zug hält an Meter 100
                scrollText: "Zugteilung in Hamm (Westf) Hbf",
                groups: [
                    // --- ZUGTEIL 1
                    {
                        trainNumber: "ICE 543",
                        destination: "Düsseldorf Hbf",
                        vias: ["Hamm (Westf) Hbf", "Dortmund Hbf", "Bochum Hbf"],
                        scheduledTime: "14:30",
                        expectedTime: "14:32",
                        coaches: [
                            { type: 'control_car', length: 25, coachClass: 1, coachNumber: '37', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '36', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '35', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '34', amenities: ['g'], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '33', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '32', amenities: [], open: true },
                            { type: 'control_car', length: 25, coachClass: 2, coachNumber: '31', amenities: ['f'], open: true }
                        ]
                    },
                    // --- ZUGTEIL 2
                    {
                        trainNumber: "ICE 553",
                        destination: "Köln Hbf",
                        vias: ["Hamm (Westf) Hbf", "Wuppertal Hbf", "Solingen Hbf"],
                        scheduledTime: "14:30",
                        expectedTime: "14:32",
                        coaches: [
                            { type: 'control_car', length: 25, coachClass: 1, coachNumber: '27', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 1, coachNumber: '26', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '25', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '24', amenities: [], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '23', amenities: ['dining'], open: true },
                            { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '22', amenities: [], open: true },
                            { type: 'control_car', length: 25, coachClass: 2, coachNumber: '21', amenities: ['bike'], open: true }
                        ]
                    }
                ]
            })
        ];
    }
}