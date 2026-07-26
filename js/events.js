// js/events.js
import { initJourneyList } from './ui/journeyListController.js';
import { initEditor } from './ui/editorController.js';
import { initDragDrop } from './ui/dragDropController.js';
import { initSettings } from './ui/settingsController.js';
import { renderJourneyList } from './ui/journeyListView.js';

export function initEvents() {
    initJourneyList();
    initEditor();
    initDragDrop();
    initSettings();

    // Initiales Rendern der Liste nach dem Setup aller Event-Listener
    renderJourneyList();
}

// Falls andere Module (wie main.js) in Zukunft explizit rendern müssen
export { renderJourneyList };