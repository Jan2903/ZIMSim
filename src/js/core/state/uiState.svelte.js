// js/models/uiState.svelte.js

// Reihenfolge der Tabs in der Einstellungs-Navigationsleiste (ARIA-Tabs-Muster)
export const TAB_ORDER = ['fahrten', 'station', 'livedata', 'audio', 'display', 'system'];

// Zuletzt aktiver Tab, damit ein Reload nicht immer auf "Fahrten" zurückspringt
const STORAGE_KEY_ACTIVE_TAB = 'zimsim_active_tab';

/**
 * Liest den zuletzt aktiven Tab aus dem localStorage.
 * Ungültige oder veraltete IDs fallen auf 'fahrten' zurück.
 * @returns {string} Gültige Tab-ID aus TAB_ORDER
 */
function readStoredTab() {
    if (typeof localStorage === 'undefined') return 'fahrten';
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
    return TAB_ORDER.includes(stored) ? stored : 'fahrten';
}

const initialTab = readStoredTab();

export const uiState = $state({
    activeTab: initialTab,
    // Einmal gemountete Tab-Panels bleiben im DOM und werden nur ausgeblendet.
    // Dadurch erfolgt der Tab-Wechsel ohne DOM-Neuaufbau und ist sofort sichtbar.
    // Beim Laden wird nur der wiederhergestellte Tab gemountet (keine Einblend-Animation).
    mountedTabs: [initialTab],
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
 * @param {string} tab - Tab-ID ('fahrten' | 'station' | 'livedata' | 'audio' | 'display' | 'system')
 * @returns {void}
 */
export function selectTab(tab) {
    if (!TAB_ORDER.includes(tab)) return;
    if (!uiState.mountedTabs.includes(tab)) {
        uiState.mountedTabs = [...uiState.mountedTabs, tab];
        uiState.enteringTabs = [...uiState.enteringTabs, tab];
        // Sicherheitsnetz: Marker auch dann entfernen, wenn kein animationend-Event
        // eintrifft (z. B. bei deaktivierter Animation im Browser).
        setTimeout(() => finishTabEnter(tab), 400);
    }
    uiState.activeTab = tab;
    // Zuletzt aktiven Tab persistieren; in Privatmodus/WebViews kann localStorage blockiert sein.
    try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, tab);
    } catch {
        /* Persistenz ist optional */
    }
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
