import { get, set, del } from 'idb-keyval';

export class AnsagenStore {
    status = $state('none'); // 'none' | 'loaded'
    fileName = $state('');
    fileRef = $state(null); // String (Tauri path), FileSystemFileHandle, or File object
    isTauri = $state(false);

    constructor() {
        this.init();
    }

    async init() {
        try {
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
