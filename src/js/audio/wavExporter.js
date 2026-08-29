import { ansagenStore } from './ansagenStore.svelte.js';
import { audioStorageService } from '../core/services/audioStorageService.js';

export class WavExporter {
    async exportWav(playlist, audioContext) {
        if (!playlist || playlist.length === 0) return;
        
        if (!await ansagenStore.verifyPermission()) {
            console.warn("Export abgebrochen: Fehlende Dateiberechtigungen für die ZIP-Datei.");
            return;
        }
        
        // 1. Calculate total duration and collect all buffers concurrently
        const listToExport = [...playlist];
        const loadPromises = listToExport.map(item => audioStorageService.getAudioBuffer(item.file, audioContext));
        const loadedBuffers = await Promise.all(loadPromises);

        let totalDuration = 0;
        const buffersToRender = [];
        
        for (const buffer of loadedBuffers) {
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

export const wavExporter = new WavExporter();
