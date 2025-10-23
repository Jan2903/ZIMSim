// js/main.js
import { TrainData } from './models/trainData.js';
import { TrainDisplay } from './displays/trainDisplay.js';
import { initEvents } from './events.js';
import './utils/utils.js';

export const train_data = new TrainData();
export const train_display = new TrainDisplay(train_data);

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    train_display.update_all_displays(); // Initial render
});