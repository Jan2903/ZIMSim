import { ansagenStore } from './ansagenStore.svelte.js';
import { audioStorageService } from '../core/services/audioStorageService.js';
import { wavExporter } from './wavExporter.js';

export class AnsagenPlayer {
    isPlaying = $state(false);
    playlist = $state([]);
    currentIndex = $state(-1);
    currentText = $state('');
    currentFile = $state('');
    totalFiles = $state(0);
    progressText = $derived(this.totalFiles > 0 ? `${this.currentIndex + 1} / ${this.totalFiles}` : '');

    _audioContext = null;
    _sourceNodes = [];
    _timeouts = [];
    _playId = 0;
    _bufferCache = new Map();
    _maxCacheSize = 500; // LRU Cache Limit (ca. 75 MB max)
    
    // Config for Look-ahead scheduling
    _preloadCount = 2;

    constructor() {}

    _initAudioContext() {
        if (!this._audioContext) {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }
    }

    _getAudioBuffer(filepath) {
        if (this._bufferCache.has(filepath)) {
            // LRU: Element wurde benutzt, also ans Ende der Map schieben
            const cachedPromise = this._bufferCache.get(filepath);
            this._bufferCache.delete(filepath);
            this._bufferCache.set(filepath, cachedPromise);
            return cachedPromise;
        }

        const fetchPromise = audioStorageService.getAudioBuffer(filepath, this._audioContext).catch(e => {
            console.warn(`Fehler beim Laden von ${filepath}:`, e);
            this._bufferCache.delete(filepath);
            return null;
        });

        // LRU Limit
        if (this._bufferCache.size >= this._maxCacheSize) {
            const oldestKey = this._bufferCache.keys().next().value;
            this._bufferCache.delete(oldestKey);
        }

        this._bufferCache.set(filepath, fetchPromise);
        return fetchPromise;
    }
    _isPreparing = false;

    enqueue(newPlaylist) {
        if (!newPlaylist || newPlaylist.length === 0) return;
        
        if (this.isPlaying || this._isPreparing) {
            this.playlist.push({ file: '', text: '' });
            this.playlist.push(...newPlaylist);
            this.totalFiles = this.playlist.length;
        } else {
            this.play([...newPlaylist]);
        }
    }

    async play(playlist) {
        this._isPreparing = true;
        let hasPermission = true;
        if (ansagenStore.fileRef) {
            hasPermission = await ansagenStore.verifyPermission();
            if (!hasPermission) {
                console.warn("Wiedergabe: Fehlende Dateiberechtigungen für die ZIP-Datei. Nutze TTS Fallback.");
            }
        }

        this.stop();
        if (!playlist || playlist.length === 0) {
            this._isPreparing = false;
            return;
        }

        // Kopie anlegen, damit wir sie zur Laufzeit mit enqueue() verlängern können
        this.playlist = [...playlist];
        this.totalFiles = this.playlist.length;
        this.currentIndex = -1;
        this.isPlaying = true;
        this._isPreparing = false;
        
        const currentPlayId = ++this._playId;

        // TTS Fallback Mode
        if (!ansagenStore.fileRef || !hasPermission) {
            this._playTTS(this.playlist, currentPlayId);
            return;
        }

        this._initAudioContext();
        
        // Start Look-ahead Scheduler
        this._schedulePlayback(this.playlist, currentPlayId);
    }

    async _schedulePlayback(playlist, playId) {
        let startTime = this._audioContext.currentTime + 0.1;
        let i = 0;
        
        while (this._playId === playId && this.isPlaying) {
            if (i < playlist.length) {
                const item = playlist[i];

                // Künstliche Pause, wenn keine Datei angegeben ist
                if (!item.file) {
                    startTime += 1.5; // 1.5 Sekunden Pause
                    i++;
                    continue;
                }

                const buffer = await this._getAudioBuffer(item.file);
                
                if (this._playId !== playId || !this.isPlaying) break;

                if (buffer) {
                    // Buffer loaded, schedule it
                    const source = this._audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(this._audioContext.destination);
                    
                    // If we fell behind, play immediately
                    if (startTime < this._audioContext.currentTime) {
                        startTime = this._audioContext.currentTime;
                    }
                    
                    source.start(startTime);
                    this._sourceNodes.push(source);

                    // Schedule UI update
                    const timeUntilStart = (startTime - this._audioContext.currentTime) * 1000;
                    const currentIndex = i; // capture loop variable
                    const timeoutId = setTimeout(() => {
                        if (this._playId === playId) {
                            this.currentIndex = currentIndex;
                            this.currentText = item.text;
                            this.currentFile = item.file;
                        }
                    }, Math.max(0, timeUntilStart));
                    this._timeouts.push(timeoutId);

                    startTime += buffer.duration;
                } else {
                    // Audio missing -> on-the-fly TTS fallback
                    if (startTime < this._audioContext.currentTime) {
                        startTime = this._audioContext.currentTime;
                    }
                    
                    const timeUntilStart = (startTime - this._audioContext.currentTime) * 1000;
                    
                    // Wait until the Web Audio playback reaches this point
                    if (timeUntilStart > 0) {
                        await new Promise(resolve => {
                            const id = setTimeout(resolve, timeUntilStart);
                            this._timeouts.push(id);
                        });
                    }
                    
                    if (this._playId !== playId || !this.isPlaying) break;
                    
                    const currentIndex = i;
                    this.currentIndex = currentIndex;
                    this.currentText = item.text;
                    this.currentFile = item.file + " (TTS Fallback)";

                    if (window.speechSynthesis && item.text && item.text.trim() !== '' && item.text.toLowerCase() !== 'gong') {
                        await new Promise(resolve => {
                            const utterance = new SpeechSynthesisUtterance(item.text);
                            let lang = 'de-DE';
                            if (item.file.startsWith('en/')) lang = 'en-US';
                            if (item.file.startsWith('fr/')) lang = 'fr-FR';
                            utterance.lang = lang;
                            
                            utterance.onend = resolve;
                            utterance.onerror = resolve;
                            
                            window.speechSynthesis.speak(utterance);
                        });
                    } else if (!item.text || item.text.trim() === '' || item.text.toLowerCase() === 'gong') {
                        await new Promise(resolve => {
                            const id = setTimeout(resolve, 1000);
                            this._timeouts.push(id);
                        });
                    }

                    // Resync Web Audio startTime since real time has passed
                    startTime = this._audioContext.currentTime + 0.1;
                }
                
                i++;
            } else {
                // We reached the end of the currently scheduled playlist.
                // Check if all scheduled audio has finished playing.
                if (this._audioContext.currentTime >= startTime) {
                    this.isPlaying = false;
                    this._sourceNodes = [];
                    this._timeouts = [];
                    break;
                } else {
                    // Wait 200ms and check again (allows enqueue to append to playlist)
                    await new Promise(r => setTimeout(r, 200));
                }
            }
        }
    }

    async _playTTS(playlist, currentPlayId) {
        if (!window.speechSynthesis) {
            this.isPlaying = false;
            return;
        }

        for (let i = 0; i < playlist.length; i++) {
            if (this._playId !== currentPlayId || !this.isPlaying) return;
            
            const item = playlist[i];
            this.currentIndex = i;
            this.currentText = item.text;
            this.currentFile = "";

            if (!item.text || item.text.trim() === '' || item.text.toLowerCase() === 'gong') {
                await new Promise(resolve => {
                    const timeoutId = setTimeout(resolve, 1000);
                    this._timeouts.push(timeoutId);
                });
                continue;
            }

            await new Promise(resolve => {
                const utterance = new SpeechSynthesisUtterance(item.text);
                let lang = 'de-DE';
                if (item.file.startsWith('en/')) lang = 'en-US';
                if (item.file.startsWith('fr/')) lang = 'fr-FR';
                utterance.lang = lang;
                
                utterance.onend = resolve;
                utterance.onerror = resolve;
                
                window.speechSynthesis.speak(utterance);
            });
        }

        if (this._playId === currentPlayId) {
            this.isPlaying = false;
            this.currentIndex = -1;
            this.currentText = '';
            this.currentFile = '';
        }
    }

    stop() {
        this._playId++;
        this.isPlaying = false;
        this.currentIndex = -1;
        this.currentText = '';
        this.currentFile = '';
        
        this._sourceNodes.forEach(node => {
            try { node.stop(); } catch(e) {}
        });
        this._sourceNodes = [];

        this._timeouts.forEach(clearTimeout);
        this._timeouts = [];
        
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    async exportWav() {
        if (!this.playlist || this.playlist.length === 0) return;
        this._initAudioContext();
        await wavExporter.exportWav(this.playlist, this._audioContext);
    }
}

export const ansagenPlayer = new AnsagenPlayer();
