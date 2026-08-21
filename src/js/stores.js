import { JourneyStore } from './models/journeyStore.svelte.js';
import { TrainDisplay } from './displays/trainDisplay.js';

export const journeyStore = new JourneyStore();
export const trainDisplay = new TrainDisplay(journeyStore);
