// js/ui/dragDropController.js
import { journeyStore, trainDisplay } from '../main.js';
import { saveInlineFormation, saveStopsEditor } from './editorController.js';
import { renderJourneyList } from './journeyListView.js';

export function initDragDrop() {
    const journeyList = document.getElementById('journey_list');
    if (!journeyList) return;

    let dragSrcElement = null;
    let dragType = null; // 'coach' or 'group' or 'journey' or 'stop'
    let dragJourneyId = null;

    journeyList.addEventListener('dragstart', (e) => {
        const coachRow = e.target.closest('.coach-editor-row');
        const groupEditor = e.target.closest('.formation-group-editor');
        const stopRow = e.target.closest('.stop-editor-row');

        if (stopRow && (e.target === stopRow || stopRow.contains(e.target))) {
            dragSrcElement = stopRow;
            dragType = 'stop';
            dragJourneyId = stopRow.closest('.journey-details')?.dataset.journeyId;
            stopRow.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation();
            return;
        }

        if (coachRow && (e.target === coachRow || coachRow.contains(e.target))) {
            const groupHeader = e.target.closest('.group-editor-header');
            if (!groupHeader) {
                dragSrcElement = coachRow;
                dragType = 'coach';
                dragJourneyId = coachRow.closest('.journey-details')?.dataset.journeyId;
                coachRow.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
                return;
            }
        }
        if (groupEditor) {
            dragSrcElement = groupEditor;
            dragType = 'group';
            dragJourneyId = groupEditor.closest('.journey-details')?.dataset.journeyId;
            groupEditor.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            return;
        }

        const journeyRow = e.target.closest('.journey-row');
        if (journeyRow && !coachRow && !groupEditor && !stopRow) {
            dragSrcElement = journeyRow;
            dragType = 'journey';
            dragJourneyId = journeyRow.dataset.journeyId;
            journeyRow.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragJourneyId);
        }
    });

    journeyList.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragSrcElement || !dragJourneyId) return;

        const details = e.target.closest('.journey-details');
        if (dragType !== 'journey' && (!details || details.dataset.journeyId !== dragJourneyId)) {
            // Drop nur innerhalb der gleichen Journey erlauben (für Wagen, Gruppen und Halte)
            return;
        }

        if (dragType === 'stop') {
            const row = e.target.closest('.stop-editor-row');
            const stopList = e.target.closest('.stops-editor-list');

            if (row && row !== dragSrcElement) {
                const rect = row.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                if (after) {
                    row.parentNode.insertBefore(dragSrcElement, row.nextSibling);
                } else {
                    row.parentNode.insertBefore(dragSrcElement, row);
                }
            } else if (stopList && stopList !== dragSrcElement.parentNode && stopList.children.length === 0) {
                stopList.appendChild(dragSrcElement);
            }
        } else if (dragType === 'coach') {
            const row = e.target.closest('.coach-editor-row');
            const groupList = e.target.closest('.coach-editor-list');

            if (row && row !== dragSrcElement) {
                const rect = row.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                if (after) {
                    row.parentNode.insertBefore(dragSrcElement, row.nextSibling);
                } else {
                    row.parentNode.insertBefore(dragSrcElement, row);
                }
            } else if (groupList && groupList !== dragSrcElement.parentNode && groupList.children.length === 0) {
                groupList.appendChild(dragSrcElement);
            }
        } else if (dragType === 'group') {
            const row = e.target.closest('.formation-group-editor');
            if (row && row !== dragSrcElement) {
                const rect = row.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                if (after) {
                    row.parentNode.insertBefore(dragSrcElement, row.nextSibling);
                } else {
                    row.parentNode.insertBefore(dragSrcElement, row);
                }
            }
        } else if (dragType === 'journey') {
            e.preventDefault(); // allow drop
            const row = e.target.closest('.journey-row');
            if (row && row !== dragSrcElement) {
                const rect = row.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                
                document.querySelectorAll('.journey-row').forEach(r => {
                    r.classList.remove('drag-over-top', 'drag-over-bottom');
                });
                
                const targetJourneyId = row.dataset.journeyId;
                const bounds = journeyStore.getJourneyBlockBounds(targetJourneyId);
                if (bounds) {
                    if (after) {
                        const endRow = journeyList.children[bounds.endIndex];
                        if (endRow) endRow.classList.add('drag-over-bottom');
                    } else {
                        const startRow = journeyList.children[bounds.startIndex];
                        if (startRow) startRow.classList.add('drag-over-top');
                    }
                }
            }
        }
    });

    journeyList.addEventListener('drop', (e) => {
        if (dragType === 'journey') {
            e.preventDefault();
            const row = e.target.closest('.journey-row');
            if (row && dragJourneyId) {
                const targetJourneyId = row.dataset.journeyId;
                const bounds = journeyStore.getJourneyBlockBounds(targetJourneyId);
                if (bounds) {
                    const rect = row.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    let targetIndex = after ? bounds.endIndex + 1 : bounds.startIndex;
                    journeyStore.moveJourneyGroupToIndex(dragJourneyId, targetIndex);
                    renderJourneyList();
                    trainDisplay.updateAll();
                }
            }
            dragSrcElement = null;
            dragType = null;
            dragJourneyId = null;
            document.querySelectorAll('.journey-row').forEach(r => {
                r.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        }
    });

    journeyList.addEventListener('dragend', () => {
        if (dragType === 'journey') {
            if (dragSrcElement) dragSrcElement.classList.remove('dragging');
            document.querySelectorAll('.journey-row').forEach(r => {
                r.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        } else if (dragSrcElement) {
            dragSrcElement.classList.remove('dragging');
            if (dragJourneyId) {
                if (dragType === 'stop') {
                    saveStopsEditor(dragJourneyId);
                } else {
                    saveInlineFormation(dragJourneyId);
                }
            }
        }
        dragSrcElement = null;
        dragType = null;
        dragJourneyId = null;
    });
}
