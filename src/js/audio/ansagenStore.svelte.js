import { get, set, del } from 'idb-keyval';

export class AnsagenStore {
    status = $state('none'); // 'none' | 'loaded'
    fileName = $state('');
    fileRef = $state(null); // String (Tauri path), FileSystemFileHandle, or File object
    isTauri = $state(false);
    maxVias = $state(4); // 0-5, 6 means 'All'
    viaSortMode = $state(1); // 1 = Priorisiert, 2 = Standard
    
    // Varianten (1 = kurz, 2 = lang)
    variantZiel = $state(2);
    variantHerkunft = $state(1);
    variantVias = $state(1);
    variantZugteilung = $state(2);

    constructor() {
        this.init();
    }

    async init() {
        try {
            const savedVias = localStorage.getItem('ansagen_max_vias');
            if (savedVias !== null) {
                this.maxVias = parseInt(savedVias, 10);
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
}

export const ansagenStore = new AnsagenStore();
