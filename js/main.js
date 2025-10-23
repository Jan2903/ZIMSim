// js/main.js

import { TrainData } from './models/trainData.js';
import { TrainDisplay } from './displays/trainDisplay.js';
import { initEvents } from './events.js';
import './utils/utils.js'; // Für Preloading (wird automatisch ausgeführt)

export const train_data = new TrainData();
export const train_display = new TrainDisplay(train_data);

// Initialisierungen:
initEvents();