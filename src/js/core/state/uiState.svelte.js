// js/models/uiState.svelte.js
export const uiState = $state({
    activeTab: 'fahrten',
    expandedJourneyId: null,
    expandedGroups: [],
    manualTracks: [],
    editingFormationJourneyId: null,
    hideLinkedArrivals: true,
    enableDragAndDrop: typeof window !== 'undefined' ? !window.matchMedia("(pointer: coarse)").matches : true
});
