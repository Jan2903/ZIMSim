// js/models/uiState.svelte.js

// Reihenfolge der Tabs in der Einstellungs-Navigationsleiste (ARIA-Tabs-Muster)
export const TAB_ORDER = ['fahrten', 'station', 'livedata', 'audio', 'system'];

export const uiState = $state({
    activeTab: 'fahrten',
    // Einmal gemountete Tab-Panels bleiben im DOM und werden nur ausgeblendet.
    // Dadurch erfolgt der Tab-Wechsel ohne DOM-Neuaufbau und ist sofort sichtbar.
    mountedTabs: ['fahrten'],
    // Panels, die aktuell ihre Einblend-Animation ausführen (nur beim ersten Öffnen)
    enteringTabs: [],
    expandedJourneyId: null,
    expandedGroups: [],
    manualTracks: [],
    editingFormationJourneyId: null,
    hideLinkedArrivals: true,
    enableDragAndDrop: typeof window !== 'undefined' ? !window.matchMedia("(pointer: coarse)").matches : true
});

/**
 * Aktiviert einen Tab der Einstellungs-Navigationsleiste.
 * Noch nicht gemountete Panels werden lazy aufgebaut und anschließend persistent
 * (ausgeblendet) im DOM gehalten, damit Tab-Wechsel ohne Verzögerung erfolgen.
 * @param {string} tab - Tab-ID ('fahrten' | 'station' | 'livedata' | 'audio' | 'system')
 * @returns {void}
 */
export function selectTab(tab) {
    if (!uiState.mountedTabs.includes(tab)) {
        uiState.mountedTabs = [...uiState.mountedTabs, tab];
        uiState.enteringTabs = [...uiState.enteringTabs, tab];
        // Sicherheitsnetz: Marker auch dann entfernen, wenn kein animationend-Event
        // eintrifft (z. B. bei deaktivierter Animation im Browser).
        setTimeout(() => finishTabEnter(tab), 400);
    }
    uiState.activeTab = tab;
}

/**
 * Markiert die Einblend-Animation eines Tab-Panels als abgeschlossen.
 * @param {string} tab - Tab-ID
 * @returns {void}
 */
export function finishTabEnter(tab) {
    if (uiState.enteringTabs.includes(tab)) {
        uiState.enteringTabs = uiState.enteringTabs.filter(t => t !== tab);
    }
}
