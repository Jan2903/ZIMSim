import { BlobReader, ZipReader, Uint8ArrayWriter } from '@zip.js/zip.js';
import { ansagenStore } from './ansagenStore.svelte.js';

export class AnsagenPlayer {
    isPlaying = $state(false);
    playlist = $state([]);
    currentIndex = $state(-1);
    currentText = $state('');
    currentFile = $state('');
    totalFiles = $state(0);
    progressText = $derived(this.totalFiles > 0 ? `${this.currentIndex + 1} / ${this.totalFiles}` : '');

    _audioContext = null;
    _cachedZipEntries = null;
    _cachedZipReader = null;
    _sourceNodes = [];
    _timeouts = [];

    constructor() {}

    _initAudioContext() {
        if (!this._audioContext) {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }
    }

    async _getAudioBuffer(filepath) {
        let arrayBuffer = null;

        if (ansagenStore.isTauri) {
            // Fetch via Tauri command
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                const buffer = await invoke('get_audio_snippet', { 
                    zipPath: ansagenStore.fileRef, 
                    filePath: filepath 
                });
                arrayBuffer = new Uint8Array(buffer).buffer;
            } catch (e) {
                console.warn("Failed to fetch from Tauri command:", e);
                return null;
            }
        } else {
            // Web: extract from ZIP using zip.js
            const fileRef = ansagenStore.fileRef;
            if (!fileRef) return null;

            if (!this._cachedZipEntries) {
                let file = fileRef;
                if (typeof fileRef.getFile === 'function') {
                    file = await fileRef.getFile();
                }
                this._cachedZipReader = new ZipReader(new BlobReader(file));
                this._cachedZipEntries = await this._cachedZipReader.getEntries();
            }

            const searchPath = filepath.replace(/\\/g, '/');
            const entry = this._cachedZipEntries.find(e => {
                const fn = e.filename.replace(/\\/g, '/');
                return fn === searchPath || fn.endsWith('/' + searchPath);
            });

            if (!entry) {
                console.warn("File not found in ZIP:", filepath);
                return null;
            }

            const uint8 = await entry.getData(new Uint8ArrayWriter());
            arrayBuffer = uint8.buffer;
        }

        if (!arrayBuffer) return null;
        
        return await this._audioContext.decodeAudioData(arrayBuffer);
    }

    async play(playlist) {
        this.stop();
        if (!playlist || playlist.length === 0) return;

        this._initAudioContext();
        this.playlist = playlist;
        this.totalFiles = playlist.length;
        this.currentIndex = -1;
        this.isPlaying = true;

        let startTime = this._audioContext.currentTime + 0.1;

        for (let i = 0; i < playlist.length; i++) {
            if (!this.isPlaying) break; // If stopped during loading

            const item = playlist[i];
            const buffer = await this._getAudioBuffer(item.file);
            
            if (buffer) {
                const source = this._audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(this._audioContext.destination);
                source.start(startTime);
                
                this._sourceNodes.push(source);

                // Schedule UI update
                const timeUntilStart = (startTime - this._audioContext.currentTime) * 1000;
                const timeoutId = setTimeout(() => {
                    this.currentIndex = i;
                    this.currentText = item.text;
                    this.currentFile = item.file;
                }, Math.max(0, timeUntilStart));
                
                this._timeouts.push(timeoutId);

                startTime += buffer.duration;
            } else {
                // If audio fails, just update text immediately and wait 1s as a dummy gap
                const timeUntilStart = (startTime - this._audioContext.currentTime) * 1000;
                const timeoutId = setTimeout(() => {
                    this.currentIndex = i;
                    this.currentText = item.text;
                    this.currentFile = item.file + " (Fehlt)";
                }, Math.max(0, timeUntilStart));
                this._timeouts.push(timeoutId);
                startTime += 1.0;
            }
        }

        // Schedule end
        const timeUntilEnd = (startTime - this._audioContext.currentTime) * 1000;
        const endTimeoutId = setTimeout(() => {
            this.isPlaying = false;
        }, Math.max(0, timeUntilEnd));
        this._timeouts.push(endTimeoutId);
    }

    stop() {
        this.isPlaying = false;
        this.currentIndex = -1;
        this.currentText = '';
        this.currentFile = '';
        
        // Stop all playing audio nodes
        this._sourceNodes.forEach(node => {
            try { node.stop(); } catch(e) {}
        });
        this._sourceNodes = [];

        // Clear all scheduled UI updates
        this._timeouts.forEach(clearTimeout);
        this._timeouts = [];
    }

    async exportWav() {
        if (!this.playlist || this.playlist.length === 0) return;
        
        this._initAudioContext();
        
        // 1. Calculate total duration and collect all buffers
        let totalDuration = 0;
        const buffersToRender = [];
        
        for (const item of this.playlist) {
            const buffer = await this._getAudioBuffer(item.file);
            if (buffer) {
                buffersToRender.push(buffer);
                totalDuration += buffer.duration;
            }
        }

        if (buffersToRender.length === 0 || totalDuration === 0) return;

        // 2. Create Offline Context
        const sampleRate = buffersToRender[0].sampleRate;
        const offlineCtx = new OfflineAudioContext(
            buffersToRender[0].numberOfChannels,
            sampleRate * totalDuration,
            sampleRate
        );

        // 3. Schedule all buffers on offline context
        let currentTime = 0;
        for (const buffer of buffersToRender) {
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(offlineCtx.destination);
            source.start(currentTime);
            currentTime += buffer.duration;
        }

        // 4. Render
        const renderedBuffer = await offlineCtx.startRendering();

        // 5. Convert to WAV and trigger download
        const wavBlob = this._audioBufferToWav(renderedBuffer);
        const url = URL.createObjectURL(wavBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ansage_${new Date().getTime()}.wav`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // Helper to convert AudioBuffer to WAV Blob
    _audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        let result;
        if (numChannels === 2) {
            result = this._interleave(buffer.getChannelData(0), buffer.getChannelData(1));
        } else {
            result = buffer.getChannelData(0);
        }

        const dataLength = result.length * (bitDepth / 8);
        const bufferLen = 44 + dataLength;
        const arrayBuffer = new ArrayBuffer(bufferLen);
        const view = new DataView(arrayBuffer);

        // RIFF chunk descriptor
        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this._writeString(view, 8, 'WAVE');
        // FMT sub-chunk
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);
        // Data sub-chunk
        this._writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write PCM samples
        let offset = 44;
        for (let i = 0; i < result.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, result[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    _interleave(leftChannel, rightChannel) {
        const length = leftChannel.length + rightChannel.length;
        const result = new Float32Array(length);
        let inputIndex = 0;
        for (let index = 0; index < length; ) {
            result[index++] = leftChannel[inputIndex];
            result[index++] = rightChannel[inputIndex];
            inputIndex++;
        }
        return result;
    }

    _writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

export const ansagenPlayer = new AnsagenPlayer();
