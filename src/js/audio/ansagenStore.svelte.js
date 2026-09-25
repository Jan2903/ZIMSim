import { get, set, del } from 'idb-keyval';

export class AnsagenStore {
    status = $state('none'); // 'none' | 'loaded'
    fileName = $state('');
    fileRef = $state(null); // String (Tauri path), FileSystemFileHandle, or File object
    maxVias = $state(4); // 0-128 (feste Anzahl; allVias steuert 'Alle')
    allVias = $state(false);
    effectiveMaxVias = $derived(this.allVias ? -1 : this.maxVias);
    viaSortMode = $state(1); // 1 = Priorisiert, 2 = Standard
    
    // Varianten (1 = kurz, 2 = lang)
    variantZiel = $state(2);
    variantHerkunft = $state(1);
    variantVias = $state(1);
    variantZugteilung = $state(2);

    // Anschlüsse Einstellungen (voll konfigurierbar)
    anschluesseMaxCount = $state(3);
    anschluesseTimeWindow = $state(30); // Suchfenster in Minuten
    anschluesseMinTransfer = $state(4); // Mindestumsteigezeit normal (Minuten)
    anschluesseMinTransferOpposite = $state(2); // Mindestumsteigezeit direkt gegenüber (Minuten)
    anschluesseIncludeDelays = $state(true);
    anschluesseIncludeDeviations = $state(true);
    oppositeTrackPairs = $state({}); // { [stationIdOrKey]: [ [trackA, trackB], ... ] }

    constructor() {
        this.init();
    }

    async init() {
        try {
            const savedVias = localStorage.getItem('ansagen_max_vias');
            const savedAll = localStorage.getItem('ansagen_all_vias');

            if (savedAll !== null) {
                this.allVias = savedAll === 'true';
            }
            if (savedVias !== null) {
                this.maxVias = Math.max(0, Math.min(128, parseInt(savedVias, 10) || 0));
            }

            const sSort = localStorage.getItem('ansagen_via_sort_mode');
            if (sSort !== null) {
                this.viaSortMode = parseInt(sSort, 10);
            }

            const sZiel = localStorage.getItem('ansagen_variant_ziel');
            if (sZiel !== null) this.variantZiel = parseInt(sZiel, 10);

            const sHerkunft = localStorage.getItem('ansagen_variant_herkunft');
            if (sHerkunft !== null) this.variantHerkunft = parseInt(sHerkunft, 10);

            const sVias = localStorage.getItem('ansagen_variant_vias');
            if (sVias !== null) this.variantVias = parseInt(sVias, 10);

            const sZug = localStorage.getItem('ansagen_variant_zugteilung');
            if (sZug !== null) this.variantZugteilung = parseInt(sZug, 10);

            const sMaxCount = localStorage.getItem('ansagen_anschluesse_max_count');
            if (sMaxCount !== null) this.anschluesseMaxCount = parseInt(sMaxCount, 10);

            const sTimeWindow = localStorage.getItem('ansagen_anschluesse_time_window');
            if (sTimeWindow !== null) this.anschluesseTimeWindow = parseInt(sTimeWindow, 10);

            const sMinTransfer = localStorage.getItem('ansagen_anschluesse_min_transfer');
            if (sMinTransfer !== null) this.anschluesseMinTransfer = parseInt(sMinTransfer, 10);

            const sMinTransferOpp = localStorage.getItem('ansagen_anschluesse_min_transfer_opposite');
            if (sMinTransferOpp !== null) this.anschluesseMinTransferOpposite = parseInt(sMinTransferOpp, 10);

            const sIncDelays = localStorage.getItem('ansagen_anschluesse_include_delays');
            if (sIncDelays !== null) this.anschluesseIncludeDelays = sIncDelays === 'true';

            const sIncDevs = localStorage.getItem('ansagen_anschluesse_include_deviations');
            if (sIncDevs !== null) this.anschluesseIncludeDeviations = sIncDevs === 'true';

            const sPairs = localStorage.getItem('ansagen_opposite_track_pairs');
            if (sPairs) {
                try {
                    this.oppositeTrackPairs = JSON.parse(sPairs);
                } catch (e) {
                    console.error("Error parsing oppositeTrackPairs:", e);
                }
            }

            // If window.__TAURI__ exists, we are running in Tauri
            if (window.__TAURI__ || window.__TAURI_INTERNALS__) {
                this.isTauri = true;
                this.loadTauriPath();
            } else {
                await this.loadWebHandle();
            }
        } catch (e) {
            console.error("Error initializing AnsagenStore:", e);
        }
    }

    loadTauriPath() {
        const path = localStorage.getItem('ansagen_zip_path');
        if (path) {
            // Extract filename from path (works for both / and \)
            const name = path.split(/[/\\]/).pop();
            this.setFileRef(path, name);
        }
    }

    async loadWebHandle() {
        if (!window.showOpenFilePicker) return; // Not supported (e.g. iOS Safari)

        try {
            const handle = await get('ansagen_zip_handle');
            if (handle) {
                // We have a saved handle. It might require the user to grant permission
                // again when we actually try to read it, but we can restore the UI state.
                this.fileRef = handle;
                this.fileName = handle.name;
                this.status = 'loaded';
            }
        } catch (e) {
            console.error("Error loading web handle from IndexedDB", e);
        }
    }

    async setFileRef(ref, name) {
        this.fileRef = ref;
        this.fileName = name;
        this.status = 'loaded';

        if (this.isTauri && typeof ref === 'string') {
            localStorage.setItem('ansagen_zip_path', ref);
        } else if (!this.isTauri && ref && typeof ref === 'object' && ref.kind === 'file') {
            // It's a FileSystemFileHandle, save it to IndexedDB
            try {
                await set('ansagen_zip_handle', ref);
            } catch (e) {
                console.error("Error saving web handle", e);
            }
        }
    }

    async verifyPermission() {
        if (this.isTauri || !this.fileRef) return true;
        
        // Prüfen, ob FileSystemFileHandle API unterstützt wird
        if (typeof this.fileRef.queryPermission !== 'function') return true;

        try {
            const opts = { mode: 'read' };
            if ((await this.fileRef.queryPermission(opts)) === 'granted') {
                return true;
            }
            if ((await this.fileRef.requestPermission(opts)) === 'granted') {
                return true;
            }
            // Optional: Bei Ablehnung Verknüpfung direkt aufheben, damit UI konsistent ist
            // await this.clearFileRef();
            return false;
        } catch (e) {
            console.error("Fehler bei der Berechtigungsprüfung:", e);
            return false;
        }
    }

    async clearFileRef() {
        this.fileRef = null;
        this.fileName = '';
        this.status = 'none';

        if (this.isTauri) {
            localStorage.removeItem('ansagen_zip_path');
        } else {
            try {
                await del('ansagen_zip_handle');
            } catch (e) {
                console.error("Error deleting web handle", e);
            }
        }
    }

    /**
     * Liefert die konfigurierten Gleispaare für eine Station.
     * @param {string|null} stationId - Die Bahnhofs-IBNR oder ID
     * @returns {Array<[string, string]>} Liste von Gleispaaren
     */
    getOppositeTrackPairs(stationId = null) {
        const key = stationId || 'default';
        return this.oppositeTrackPairs[key] || this.oppositeTrackPairs['default'] || [];
    }

    /**
     * Speichert die Gleispaare für eine Station.
     * @param {string|null} stationId - Die Bahnhofs-IBNR oder ID
     * @param {Array<[string, string]>} pairs - Liste von Gleispaaren
     */
    setOppositeTrackPairs(stationId, pairs) {
        const key = stationId || 'default';
        this.oppositeTrackPairs[key] = pairs;
        localStorage.setItem('ansagen_opposite_track_pairs', JSON.stringify(this.oppositeTrackPairs));
    }

    /**
     * Fügt ein neues Gleispaar für eine Station hinzu.
     * @param {string|null} stationId - Die Bahnhofs-IBNR oder ID
     * @param {string} trackA - Erstes Gleis
     * @param {string} trackB - Zweites Gleis
     */
    addOppositeTrackPair(stationId, trackA, trackB) {
        if (!trackA || !trackB) return;
        const key = stationId || 'default';
        const list = [...(this.getOppositeTrackPairs(key))];
        const a = String(trackA).trim();
        const b = String(trackB).trim();
        if (a === b) return;
        const exists = list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
        if (!exists) {
            list.push([a, b]);
            this.setOppositeTrackPairs(key, list);
        }
    }

    /**
     * Entfernt ein Gleispaar anhand des Index.
     * @param {string|null} stationId - Die Bahnhofs-IBNR oder ID
     * @param {number} index - Index des zu entfernenden Paares
     */
    removeOppositeTrackPair(stationId, index) {
        const key = stationId || 'default';
        const list = [...(this.getOppositeTrackPairs(key))];
        if (index >= 0 && index < list.length) {
            list.splice(index, 1);
            this.setOppositeTrackPairs(key, list);
        }
    }

    /**
     * Setzt die maximale Anzahl an angesagten Anschlüssen.
     * @param {number|string} val
     */
    setAnschluesseMaxCount(val) {
        const num = Math.max(1, Math.min(10, parseInt(val, 10) || 3));
        this.anschluesseMaxCount = num;
        localStorage.setItem('ansagen_anschluesse_max_count', String(num));
    }

    /**
     * Setzt das Suchzeitfenster für Anschlüsse in Minuten.
     * @param {number|string} val
     */
    setAnschluesseTimeWindow(val) {
        const num = Math.max(5, Math.min(180, parseInt(val, 10) || 30));
        this.anschluesseTimeWindow = num;
        localStorage.setItem('ansagen_anschluesse_time_window', String(num));
    }

    /**
     * Setzt die Mindestumsteigezeit (normal) in Minuten.
     * @param {number|string} val
     */
    setAnschluesseMinTransfer(val) {
        const num = Math.max(1, Math.min(30, parseInt(val, 10) || 4));
        this.anschluesseMinTransfer = num;
        localStorage.setItem('ansagen_anschluesse_min_transfer', String(num));
    }

    /**
     * Setzt die Mindestumsteigezeit für gegenüberliegende Gleise in Minuten.
     * @param {number|string} val
     */
    setAnschluesseMinTransferOpposite(val) {
        const num = Math.max(0, Math.min(20, parseInt(val, 10) || 2));
        this.anschluesseMinTransferOpposite = num;
        localStorage.setItem('ansagen_anschluesse_min_transfer_opposite', String(num));
    }

    /**
     * Schaltet die Ansage von Verspätungen bei Anschlüssen ein/aus.
     * @param {boolean} val
     */
    setAnschluesseIncludeDelays(val) {
        this.anschluesseIncludeDelays = Boolean(val);
        localStorage.setItem('ansagen_anschluesse_include_delays', String(this.anschluesseIncludeDelays));
    }

    /**
     * Schaltet die Ansage von Haltabweichungen bei Anschlüssen ein/aus.
     * @param {boolean} val
     */
    setAnschluesseIncludeDeviations(val) {
        this.anschluesseIncludeDeviations = Boolean(val);
        localStorage.setItem('ansagen_anschluesse_include_deviations', String(this.anschluesseIncludeDeviations));
    }

    /**
     * Setzt die maximale Anzahl an Zwischenhalten in Ansagen (0-128).
     * @param {number|string} val
     */
    setMaxVias(val) {
        const num = Math.max(0, Math.min(128, parseInt(val, 10) || 0));
        this.maxVias = num;
        localStorage.setItem('ansagen_max_vias', String(num));
    }

    /**
     * Schaltet den "Alle Halte"-Modus für Ansagen ein oder aus.
     * @param {boolean} val
     */
    setAllVias(val) {
        this.allVias = Boolean(val);
        localStorage.setItem('ansagen_all_vias', String(this.allVias));
    }
}

export const ansagenStore = new AnsagenStore();
