// js/main.js
import { TrainData } from './models/trainData.js';
import { TrainDisplay } from './displays/trainDisplay.js';
import { initEvents } from './events.js';
import './utils/utils.js';

export const trainData = new TrainData();
export const trainDisplay = new TrainDisplay(trainData);

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    trainDisplay.updateAll(); // Initial render
});