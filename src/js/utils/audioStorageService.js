import { BlobReader, ZipReader, Uint8ArrayWriter } from '@zip.js/zip.js';
import { ansagenStore } from './ansagenStore.svelte.js';

class WebZipStorageProvider {
    constructor() {
        this._cachedZipEntries = null;
        this._cachedZipReader = null;
        this._cachedZipMap = null;
        this._lastFileRef = null;
        this._initZipPromise = null;
    }

    async _ensureZipEntries() {
        const fileRef = ansagenStore.fileRef;
        if (!fileRef) return;

        if (this._lastFileRef !== fileRef) {
            if (this._cachedZipReader) {
                try { await this._cachedZipReader.close(); } catch(e) {}
            }
            this._cachedZipEntries = null;
            this._cachedZipMap = null;
            this._cachedZipReader = null;
            this._initZipPromise = null;
            this._lastFileRef = fileRef;
        }

        if (!this._cachedZipEntries) {
            if (!this._initZipPromise) {
                this._initZipPromise = (async () => {
                    try {
                        let file = fileRef;
                        if (typeof fileRef.getFile === 'function') {
                            file = await fileRef.getFile();
                        }
                        this._cachedZipReader = new ZipReader(new BlobReader(file));
                        this._cachedZipEntries = await this._cachedZipReader.getEntries();
                        this._cachedZipMap = new Map();
                        for (const entry of this._cachedZipEntries) {
                            const fn = entry.filename.replace(/\\/g, '/');
                            this._cachedZipMap.set(fn, entry);
                        }
                    } catch (e) {
                        console.error("Fehler beim Initialisieren des ZIP-Readers:", e);
                        this._initZipPromise = null;
                        this._cachedZipEntries = null;
                    }
                })();
            }
            await this._initZipPromise;
        }
    }

    _resolveZipEntry(filepath) {
        if (!this._cachedZipMap) return null;
        
        const searchPath = filepath.replace(/\\/g, '/');
        const basePaths = [
            searchPath,
            'site/' + searchPath
        ];
        
        // Fallback: Wenn 'variante2' (oder andere) gefragt ist, probiere 'variante1'
        if (searchPath.includes('/variante2/') || searchPath.includes('/variante3/')) {
            const fallback = searchPath.replace('/variante2/', '/variante1/')
                                       .replace('/variante3/', '/variante1/');
            if (fallback !== searchPath) {
                basePaths.push(fallback);
                basePaths.push('site/' + fallback);
            }
        }

        const extensions = ['.opus', '.wav'];

        for (const bp of basePaths) {
            for (const ext of extensions) {
                const p = bp + ext;
                const entry = this._cachedZipMap.get(p);
                if (entry) return entry;
            }
        }
        return null;
    }

    async getArrayBuffer(filepath) {
        await this._ensureZipEntries();
        if (!this._cachedZipEntries) return null;

        const entry = this._resolveZipEntry(filepath);
        if (!entry) {
            console.warn("File not found in ZIP:", filepath);
            return null;
        }

        const uint8 = await entry.getData(new Uint8ArrayWriter());
        return uint8.buffer;
    }
}

class TauriStorageProvider {
    async getArrayBuffer(filepath) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            let buffer;
            try {
                buffer = await invoke('get_audio_snippet', { 
                    zipPath: ansagenStore.fileRef, 
                    filePath: filepath + '.opus' 
                });
            } catch (e) {
                buffer = await invoke('get_audio_snippet', { 
                    zipPath: ansagenStore.fileRef, 
                    filePath: filepath + '.wav' 
                });
            }
            return new Uint8Array(buffer).buffer;
        } catch (e) {
            console.warn("Failed to fetch from Tauri command:", e);
            return null;
        }
    }
}

export class AudioStorageService {
    constructor() {
        this.webProvider = new WebZipStorageProvider();
        this.tauriProvider = new TauriStorageProvider();
    }

    async getAudioBuffer(filepath, audioContext) {
        let arrayBuffer = null;

        if (ansagenStore.isTauri) {
            arrayBuffer = await this.tauriProvider.getArrayBuffer(filepath);
        } else {
            arrayBuffer = await this.webProvider.getArrayBuffer(filepath);
        }

        if (!arrayBuffer) return null;
        
        return await audioContext.decodeAudioData(arrayBuffer);
    }
}

export const audioStorageService = new AudioStorageService();
