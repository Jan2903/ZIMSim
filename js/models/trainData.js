// js/models/trainData.js
export class TrainData {
    constructor() {
        this.zugDaten = {1: {}, 2: {}, 3: {}};
        this.initializeZugDaten();
        this.current_stop = '';
        this.current_platform = '';
        this.eva = '';
    }

    initializeZugDaten() {
        for (let i = 1; i <= 6; i++) {
            this.zugDaten[i] = {
                Zugnummer: '',
                Zugnummer_kurz: '',
                Abfahrt: '',
                Abweichend: '',
                Ziel: '',
                'Via-Halte 1': '',
                'Via-Halte 2': '',
                'Via-Halte 1 Small': '',
                'Via-Halte 2 Small': '',
                'Via-Halte 3 Small': '',
                Informationen: '',
                Richtung: 1,
                TrainStart: 0,
                Skalieren: false,
                Zugteilung: false,
                Wagenreihung: [],
                PlatformLength: 420,
                PlatformSections: [['A', 69.7], ['B', 135.8], ['C', 208], ['D', 266], ['E', 315.65]],
                Gleiswechsel: '0',
                'Via-Stations-Categories': {}
            };
        }
    }
}