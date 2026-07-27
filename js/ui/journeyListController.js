// js/ui/journeyListController.js
import { uiState } from './uiState.js';
import { journeyStore, trainDisplay } from '../main.js';
import { renderJourneyList } from './journeyListView.js';
import { saveStopsEditor } from './editorController.js';

export function initJourneyList() {
    const journeyList = document.getElementById('journey_list');

    // Add new journey
    document.getElementById('add_journey_btn')?.addEventListener('click', () => {
        journeyStore.addJourney();
        renderJourneyList();
        trainDisplay.updateAll();
    });

    // Event delegation on journey list
    journeyList?.addEventListener('click', (e) => {
        const target = e.target.closest('[data-journey-id]');
        
        // Autocomplete selection for stops (placed here as it uses LI elements inside the editor)
        if (e.target.tagName === 'LI' && e.target.closest('.stop-autocomplete-list')) {
            const li = e.target;
            const row = li.closest('.stop-editor-row');
            if (row && target) {
                const nameInput = row.querySelector('[data-prop="name"]');
                const kurzInput = row.querySelector('[data-prop="nameKurz"]');
                
                nameInput.value = li.dataset.name;
                kurzInput.value = li.dataset.kurz;
                
                const catInput = row.querySelector('[data-prop="stationCategory"]');
                if (catInput) catInput.value = li.dataset.kategorie !== '99' ? li.dataset.kategorie : '';
                
                li.closest('.stop-autocomplete-list').style.display = 'none';
                saveStopsEditor(target.dataset.journeyId, true);
            }
            return;
        }

        if (!target) return;
        const journeyId = target.dataset.journeyId;

        // Toggle visibility
        if (target.classList.contains('visibility-toggle')) {
            const journey = journeyStore.getJourney(journeyId);
            if (journey) {
                journey.visible = !journey.visible;
                renderJourneyList();
                trainDisplay.updateAll();
            }
            return;
        }

        // Reorder Up
        if (target.classList.contains('btn-reorder-up')) {
            journeyStore.moveJourneyGroupUp(journeyId);
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }

        // Reorder Down
        if (target.classList.contains('btn-reorder-down')) {
            journeyStore.moveJourneyGroupDown(journeyId);
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }

        // Expand Details
        if (target.classList.contains('expand-toggle') || target.classList.contains('journey-summary')) {
            uiState.expandedJourneyId = uiState.expandedJourneyId === journeyId ? null : journeyId;
            renderJourneyList();
            return;
        }

        // Delete Journey
        if (target.classList.contains('delete-journey-btn')) {
            journeyStore.removeJourney(journeyId);
            if (uiState.expandedJourneyId === journeyId) uiState.expandedJourneyId = null;
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }

        // Accordion Toggle for Formation Groups
        const header = e.target.closest('.formation-accordion-toggle');
        if (header) {
            const isInputOrButton = e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.closest('.btn-icon');
            if (!isInputOrButton) {
                const groupId = header.dataset.groupId;
                if (uiState.expandedGroups.has(groupId)) {
                    uiState.expandedGroups.delete(groupId);
                } else {
                    uiState.expandedGroups.add(groupId);
                }
                renderJourneyList();
                return;
            }
        }

        // Couple/Uncouple
        if (target.classList.contains('couple-btn')) {
            const journey = journeyStore.getJourney(journeyId);
            if (!journey) return;
            if (journey.couplingGroupId) {
                journeyStore.uncoupleJourney(journeyId);
            } else {
                const idx = journeyStore.journeys.findIndex(j => j.id === journeyId);
                const next = journeyStore.journeys[idx + 1];
                if (next) {
                    journeyStore.coupleJourneys(journeyId, next.id);
                }
            }
            renderJourneyList();
            trainDisplay.updateAll();
            return;
        }

        // Click on Link Badge (Ankunft/Wende)
        const badge = e.target.closest('.badge-link');
        if (badge) {
            e.stopPropagation(); // prevent expanding the current row
            const linkedId = badge.dataset.linkedId;
            if (linkedId) {
                uiState.expandedJourneyId = linkedId;
                renderJourneyList();
                
                setTimeout(() => {
                    const row = document.querySelector(`.journey-row[data-journey-id="${linkedId}"]`);
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 50);
            }
            return;
        }
    });
}
