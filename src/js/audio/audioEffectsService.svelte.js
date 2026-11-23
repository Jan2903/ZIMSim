// src/js/audio/audioEffectsService.svelte.js
import { ansagenStore } from './ansagenStore.svelte.js';
import { audioStorageService } from '../core/services/audioStorageService.js';

/**
 * Vordefinierte Presets für authentische Bahnhofs-Akustik und ELA-Lautsprecher.
 */
export const AUDIO_EFFECT_PRESETS = {
    hall_large: {
        id: 'hall_large',
        name: 'Große Bahnhofshalle',
        description: 'Langer Nachhall historischer Hallen (z. B. Leipzig, Köln, Frankfurt Hbf)',
        reverbWet: 35,
        reverbDecay: 2.8,
        reverbPreDelay: 35,
        filterEnabled: true,
        filterLowCut: 220,
        filterHighCut: 6500,
        filterPeakGain: 2.5,
        delayEnabled: true,
        delayWet: 18,
        delayTime: 85,
        outputGain: 100
    },
    hall_medium: {
        id: 'hall_medium',
        name: 'Überdachter Bahnsteig / Mittlere Halle',
        description: 'Typische Akustik unter einem Bahnsteigdach oder in modernen Durchgangshallen',
        reverbWet: 22,
        reverbDecay: 1.6,
        reverbPreDelay: 20,
        filterEnabled: true,
        filterLowCut: 200,
        filterHighCut: 7500,
        filterPeakGain: 2.0,
        delayEnabled: true,
        delayWet: 12,
        delayTime: 65,
        outputGain: 100
    },
    open_air: {
        id: 'open_air',
        name: 'Offener Bahnsteig (Freiluft)',
        description: 'Trockener Direktschall mit deutlichem Echo entfernter Bahnsteiglautsprecher',
        reverbWet: 10,
        reverbDecay: 0.8,
        reverbPreDelay: 10,
        filterEnabled: true,
        filterLowCut: 250,
        filterHighCut: 7000,
        filterPeakGain: 3.0,
        delayEnabled: true,
        delayWet: 22,
        delayTime: 110,
        outputGain: 100
    },
    tunnel: {
        id: 'tunnel',
        name: 'Tiefbahnhof / Tunnel (S-Bahn)',
        description: 'Harter, kühler Raumklang mit schallharten Reflexionen von Betonwänden',
        reverbWet: 40,
        reverbDecay: 2.2,
        reverbPreDelay: 15,
        filterEnabled: true,
        filterLowCut: 280,
        filterHighCut: 5500,
        filterPeakGain: 3.5,
        delayEnabled: true,
        delayWet: 22,
        delayTime: 70,
        outputGain: 100
    },
    historic_horn: {
        id: 'historic_horn',
        name: 'Klassische Druckkammer-Lautsprecher',
        description: 'Nostalgischer ELA-Sound mit starkem Bandpass und Durchsagen-Charakter',
        reverbWet: 15,
        reverbDecay: 1.2,
        reverbPreDelay: 10,
        filterEnabled: true,
        filterLowCut: 400,
        filterHighCut: 4200,
        filterPeakGain: 5.5,
        delayEnabled: true,
        delayWet: 15,
        delayTime: 90,
        outputGain: 105
    },
    custom: {
        id: 'custom',
        name: 'Benutzerdefiniert',
        description: 'Individuell eingestellte Raumakustik und Lautsprecher-Filterung'
    }
};

const STORAGE_KEY = 'zimsim_audio_effects_config';

/**
 * Service für Audio-Effekte (Hall, Lautsprecher-Filterung, Bahnsteig-Echo)
 * zur Simulation authentischer Bahnhofs-Akustik.
 */
export class AudioEffectsService {
    // Globale Aktivierung
    enabled = $state(false);
    preset = $state('hall_medium');

    // Hall / Reverb (Convolver)
    reverbWet = $state(22);        // 0 - 100 %
    reverbDecay = $state(1.6);     // 0.4 - 5.0 s
    reverbPreDelay = $state(20);   // 0 - 100 ms

    // Lautsprecher-Filter (ELA / EQ)
    filterEnabled = $state(true);
    filterLowCut = $state(200);    // 50 - 600 Hz (Highpass)
    filterHighCut = $state(7500);  // 2500 - 12000 Hz (Lowpass)
    filterPeakGain = $state(2.0);  // 0 - 8 dB Mittenanhebung (~2 kHz)

    // Bahnsteig-Echo (Laufzeitverzögerung entfernter Lautsprecher)
    delayEnabled = $state(true);
    delayWet = $state(12);         // 0 - 40 %
    delayTime = $state(65);        // 30 - 200 ms

    // Master-Lautstärke
    outputGain = $state(100);      // 50 - 150 %

    // State für Test-Wiedergabe
    isPlayingTest = $state(false);

    /** @type {AudioContext|null} */
    _audioContext = null;
    /** @type {Map<string, AudioBuffer>} */
    _irBufferCache = new Map();
    /** @type {AudioBufferSourceNode|null} */
    _testSource = null;
    /** @type {{ inputNode: GainNode, dispose: () => void }|null} */
    _testChain = null;
    /** @type {number|null} */
    _testTimeoutId = null;

    constructor() {
        this.loadSettings();
    }

    /**
     * Lädt gespeicherte Einstellungen aus dem LocalStorage.
     * @returns {void}
     */
    loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (typeof parsed !== 'object' || parsed === null) return;

            if (typeof parsed.enabled === 'boolean') this.enabled = parsed.enabled;
            if (parsed.preset && AUDIO_EFFECT_PRESETS[parsed.preset]) this.preset = parsed.preset;

            if (typeof parsed.reverbWet === 'number') this.reverbWet = Math.max(0, Math.min(100, parsed.reverbWet));
            if (typeof parsed.reverbDecay === 'number') this.reverbDecay = Math.max(0.4, Math.min(5.0, parsed.reverbDecay));
            if (typeof parsed.reverbPreDelay === 'number') this.reverbPreDelay = Math.max(0, Math.min(100, parsed.reverbPreDelay));

            if (typeof parsed.filterEnabled === 'boolean') this.filterEnabled = parsed.filterEnabled;
            if (typeof parsed.filterLowCut === 'number') this.filterLowCut = Math.max(50, Math.min(600, parsed.filterLowCut));
            if (typeof parsed.filterHighCut === 'number') this.filterHighCut = Math.max(2000, Math.min(15000, parsed.filterHighCut));
            if (typeof parsed.filterPeakGain === 'number') this.filterPeakGain = Math.max(0, Math.min(8, parsed.filterPeakGain));

            if (typeof parsed.delayEnabled === 'boolean') this.delayEnabled = parsed.delayEnabled;
            if (typeof parsed.delayWet === 'number') this.delayWet = Math.max(0, Math.min(40, parsed.delayWet));
            if (typeof parsed.delayTime === 'number') this.delayTime = Math.max(30, Math.min(200, parsed.delayTime));

            if (typeof parsed.outputGain === 'number') this.outputGain = Math.max(50, Math.min(150, parsed.outputGain));
        } catch (e) {
            console.error('[AudioEffectsService] Fehler beim Laden der Einstellungen:', e);
        }
    }

    /**
     * Speichert die aktuellen Einstellungen im LocalStorage.
     * @returns {void}
     */
    saveSettings() {
        try {
            const config = {
                enabled: this.enabled,
                preset: this.preset,
                reverbWet: this.reverbWet,
                reverbDecay: this.reverbDecay,
                reverbPreDelay: this.reverbPreDelay,
                filterEnabled: this.filterEnabled,
                filterLowCut: this.filterLowCut,
                filterHighCut: this.filterHighCut,
                filterPeakGain: this.filterPeakGain,
                delayEnabled: this.delayEnabled,
                delayWet: this.delayWet,
                delayTime: this.delayTime,
                outputGain: this.outputGain
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {
            console.error('[AudioEffectsService] Fehler beim Speichern der Einstellungen:', e);
        }
    }

    /**
     * Aktiviert oder deaktiviert die Audio-Effekte.
     * @param {boolean} val
     * @returns {void}
     */
    setEnabled(val) {
        this.enabled = Boolean(val);
        this.saveSettings();
    }

    /**
     * Wählt ein Akustik-Preset aus und wendet dessen Parameter an.
     * @param {string} presetId
     * @returns {void}
     */
    selectPreset(presetId) {
        const pr = AUDIO_EFFECT_PRESETS[presetId];
        if (!pr) return;
        this.preset = presetId;
        if (presetId !== 'custom') {
            this.reverbWet = pr.reverbWet;
            this.reverbDecay = pr.reverbDecay;
            this.reverbPreDelay = pr.reverbPreDelay;
            this.filterEnabled = pr.filterEnabled;
            this.filterLowCut = pr.filterLowCut;
            this.filterHighCut = pr.filterHighCut;
            this.filterPeakGain = pr.filterPeakGain;
            this.delayEnabled = pr.delayEnabled;
            this.delayWet = pr.delayWet;
            this.delayTime = pr.delayTime;
            this.outputGain = pr.outputGain;
        }
        this.saveSettings();
    }

    /**
     * Setzt das Preset auf 'custom', sobald ein Einzelregler manuell verändert wird.
     * @private
     * @returns {void}
     */
    _markCustom() {
        if (this.preset !== 'custom') {
            this.preset = 'custom';
        }
        this.saveSettings();
    }

    setReverbWet(val) {
        this.reverbWet = Math.max(0, Math.min(100, Math.round(val)));
        this._markCustom();
    }

    setReverbDecay(val) {
        this.reverbDecay = Math.max(0.4, Math.min(5.0, Math.round(val * 10) / 10));
        this._markCustom();
    }

    setReverbPreDelay(val) {
        this.reverbPreDelay = Math.max(0, Math.min(100, Math.round(val)));
        this._markCustom();
    }

    setFilterEnabled(val) {
        this.filterEnabled = Boolean(val);
        this._markCustom();
    }

    setFilterLowCut(val) {
        this.filterLowCut = Math.max(50, Math.min(600, Math.round(val)));
        this._markCustom();
    }

    setFilterHighCut(val) {
        this.filterHighCut = Math.max(2000, Math.min(15000, Math.round(val)));
        this._markCustom();
    }

    setFilterPeakGain(val) {
        this.filterPeakGain = Math.max(0, Math.min(8, Math.round(val * 10) / 10));
        this._markCustom();
    }

    setDelayEnabled(val) {
        this.delayEnabled = Boolean(val);
        this._markCustom();
    }

    setDelayWet(val) {
        this.delayWet = Math.max(0, Math.min(40, Math.round(val)));
        this._markCustom();
    }

    setDelayTime(val) {
        this.delayTime = Math.max(30, Math.min(200, Math.round(val)));
        this._markCustom();
    }

    setOutputGain(val) {
        this.outputGain = Math.max(50, Math.min(150, Math.round(val)));
        this.saveSettings();
    }

    /**
     * Stellt sicher, dass ein AudioContext für Testtöne existiert.
     * @private
     * @returns {void}
     */
    _initAudioContext() {
        if (!this._audioContext) {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }
    }

    /**
     * Erzeugt eine algorithmische Impulsantwort (Impulse Response) für den ConvolverNode.
     * Verwendet frequenzgedämpftes Stereo-Rauschen mit Exponentialabfall für einen weichen Raumhall.
     *
     * @param {BaseAudioContext} audioCtx
     * @param {number} decaySeconds
     * @param {number} preDelaySeconds
     * @returns {AudioBuffer}
     */
    _getReverbBuffer(audioCtx, decaySeconds, preDelaySeconds) {
        const sampleRate = audioCtx.sampleRate;
        const cacheKey = `${decaySeconds.toFixed(1)}_${preDelaySeconds.toFixed(3)}_${sampleRate}`;

        if (this._irBufferCache.has(cacheKey)) {
            return this._irBufferCache.get(cacheKey);
        }

        const length = Math.max(1, Math.floor(sampleRate * (decaySeconds + preDelaySeconds)));
        const preDelaySamples = Math.floor(sampleRate * preDelaySeconds);
        const buffer = audioCtx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        let lastL = 0;
        let lastR = 0;
        // Dämpfung: hohe Frequenzen klingen im Raum schneller ab als Bässe
        const damping = 0.65;

        for (let i = 0; i < length; i++) {
            if (i < preDelaySamples) {
                left[i] = 0;
                right[i] = 0;
                continue;
            }
            const t = (i - preDelaySamples) / (sampleRate * decaySeconds);
            // Exponentialer Amplitudenabfall
            const decay = Math.exp(-3.5 * t);
            const noiseL = (Math.random() * 2 - 1) * decay;
            const noiseR = (Math.random() * 2 - 1) * decay;

            lastL = lastL * (1 - damping) + noiseL * damping;
            lastR = lastR * (1 - damping) + noiseR * damping;

            left[i] = lastL;
            right[i] = lastR;
        }

        // Cache-Größe begrenzen (max. 10 Puffer)
        if (this._irBufferCache.size >= 10) {
            const firstKey = this._irBufferCache.keys().next().value;
            this._irBufferCache.delete(firstKey);
        }

        this._irBufferCache.set(cacheKey, buffer);
        return buffer;
    }

    /**
     * Baut die modulare DSP-Effektkette im übergebenen AudioContext auf.
     * Funktioniert identisch für Live-Wiedergabe (`AudioContext`) und WAV-Export (`OfflineAudioContext`).
     *
     * @param {BaseAudioContext} audioCtx - Der Ziel-AudioContext
     * @param {AudioNode} destinationNode - Der Ausgangsknoten (z. B. `audioCtx.destination`)
     * @returns {{ inputNode: GainNode, dispose: () => void }}
     */
    buildEffectsChain(audioCtx, destinationNode) {
        const inputNode = audioCtx.createGain();

        // Wenn Effekte deaktiviert sind: Direkte Weiterleitung
        if (!this.enabled) {
            inputNode.connect(destinationNode);
            return {
                inputNode,
                dispose: () => {
                    try {
                        inputNode.disconnect();
                    } catch (e) {
                        // Unkritisch
                    }
                }
            };
        }

        /** @type {AudioNode[]} */
        const nodes = [inputNode];

        // 1. Lautsprecher-Filterung (ELA / Druckkammer-Simulation)
        let signalNode = inputNode;
        if (this.filterEnabled) {
            const highpass = audioCtx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = this.filterLowCut;
            highpass.Q.value = 0.707;

            const lowpass = audioCtx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = this.filterHighCut;
            lowpass.Q.value = 0.707;

            const peak = audioCtx.createBiquadFilter();
            peak.type = 'peaking';
            peak.frequency.value = 2200;
            peak.Q.value = 1.2;
            peak.gain.value = this.filterPeakGain;

            signalNode.connect(highpass);
            highpass.connect(lowpass);
            lowpass.connect(peak);
            signalNode = peak;
            nodes.push(highpass, lowpass, peak);
        }

        // 2. Summierungs-Kompressor & Master-Ausgang
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 8;
        compressor.ratio.value = 3.5;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        const masterGain = audioCtx.createGain();
        masterGain.gain.value = this.outputGain / 100;

        compressor.connect(masterGain);
        masterGain.connect(destinationNode);
        nodes.push(compressor, masterGain);

        // 3. Dry-Signal (Direktschall)
        const dryGain = audioCtx.createGain();
        const wetRatio = this.reverbWet / 100;
        // Bei steigendem Hallanteil leicht absenken für ausgewogene Gesamtlautstärke
        dryGain.gain.value = Math.max(0.2, 1.0 - wetRatio * 0.4);
        signalNode.connect(dryGain);
        dryGain.connect(compressor);
        nodes.push(dryGain);

        // 4. Hall / Reverb (Convolver)
        if (this.reverbWet > 0) {
            const convolver = audioCtx.createConvolver();
            convolver.buffer = this._getReverbBuffer(audioCtx, this.reverbDecay, this.reverbPreDelay / 1000);

            const reverbGain = audioCtx.createGain();
            reverbGain.gain.value = wetRatio * 1.25;

            signalNode.connect(convolver);
            convolver.connect(reverbGain);
            reverbGain.connect(compressor);
            nodes.push(convolver, reverbGain);
        }

        // 5. Bahnsteig-Echo (Laufzeitverzögerung entfernter Lautsprecher)
        if (this.delayEnabled && this.delayWet > 0) {
            const delayNode = audioCtx.createDelay(1.0);
            delayNode.delayTime.value = this.delayTime / 1000;

            const delayFeedback = audioCtx.createGain();
            delayFeedback.gain.value = 0.22; // Dezent wiederholendes Echo

            const delayGain = audioCtx.createGain();
            delayGain.gain.value = (this.delayWet / 100) * 0.85;

            // Frequenzdämpfung des Echos (entfernte Lautsprecher klingen dunkler)
            const delayDamp = audioCtx.createBiquadFilter();
            delayDamp.type = 'lowpass';
            delayDamp.frequency.value = 3500;

            signalNode.connect(delayNode);
            delayNode.connect(delayDamp);
            delayDamp.connect(delayGain);
            delayGain.connect(compressor);

            // Feedback-Schleife
            delayDamp.connect(delayFeedback);
            delayFeedback.connect(delayNode);

            nodes.push(delayNode, delayFeedback, delayGain, delayDamp);
        }

        return {
            inputNode,
            dispose: () => {
                nodes.forEach(n => {
                    try {
                        n.disconnect();
                    } catch (e) {
                        // Unkritisch
                    }
                });
            }
        };
    }

    /**
     * Spielt einen Test-Sound (geladener DB-Gong aus ZIP oder synthetischer DB-Gong)
     * durch die aktuelle Effektkette ab.
     * @returns {Promise<void>}
     */
    async playTestSound() {
        this._initAudioContext();
        if (this.isPlayingTest) {
            this.stopTestSound();
            return;
        }

        this.isPlayingTest = true;

        // Prüfen, ob ein Audio-ZIP geladen ist und der Standard-Gong vorliegt
        let buffer = null;
        if (ansagenStore.fileRef) {
            try {
                buffer = await audioStorageService.getAudioBuffer('gong/513/513_2', this._audioContext);
            } catch (e) {
                console.warn('[AudioEffectsService] Konnte Gong nicht aus Paket laden, nutze Synthesizer:', e);
            }
        }

        const chain = this.buildEffectsChain(this._audioContext, this._audioContext.destination);
        this._testChain = chain;

        if (buffer) {
            const source = this._audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(chain.inputNode);
            this._testSource = source;

            const extraTail = this.enabled ? this.reverbDecay + 0.3 : 0.2;
            const durationMs = (buffer.duration + extraTail) * 1000;

            source.start();

            this._testTimeoutId = setTimeout(() => {
                this.stopTestSound();
            }, durationMs);
        } else {
            // Synthetischer DB-Gong (4-Klang-Melodiegong: G4 - H4 - D5 - G5)
            const notes = [
                { freq: 392.00, time: 0.00, duration: 0.8 }, // G4
                { freq: 493.88, time: 0.22, duration: 0.8 }, // H4
                { freq: 587.33, time: 0.44, duration: 1.1 }, // D5
                { freq: 783.99, time: 0.66, duration: 1.4 }  // G5
            ];

            const now = this._audioContext.currentTime + 0.05;
            const extraTail = this.enabled ? this.reverbDecay + 0.5 : 0.3;
            const totalDurationSec = 0.66 + 1.4 + extraTail;

            notes.forEach(note => {
                const osc = this._audioContext.createOscillator();
                const gain = this._audioContext.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(note.freq, now + note.time);

                gain.gain.setValueAtTime(0.0001, now + note.time);
                gain.gain.exponentialRampToValueAtTime(0.3, now + note.time + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.duration);

                osc.connect(gain);
                gain.connect(chain.inputNode);

                osc.start(now + note.time);
                osc.stop(now + note.time + note.duration);

                // Zarter Oberton für glockenartige Brillanz
                const osc2 = this._audioContext.createOscillator();
                const gain2 = this._audioContext.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(note.freq * 2, now + note.time);
                gain2.gain.setValueAtTime(0.0001, now + note.time);
                gain2.gain.exponentialRampToValueAtTime(0.08, now + note.time + 0.015);
                gain2.gain.exponentialRampToValueAtTime(0.0001, now + note.time + (note.duration * 0.6));

                osc2.connect(gain2);
                gain2.connect(chain.inputNode);
                osc2.start(now + note.time);
                osc2.stop(now + note.time + (note.duration * 0.6));
            });

            this._testTimeoutId = setTimeout(() => {
                this.stopTestSound();
            }, totalDurationSec * 1000);
        }
    }

    /**
     * Bricht den aktuellen Test-Sound sofort ab.
     * @returns {void}
     */
    stopTestSound() {
        if (this._testTimeoutId) {
            clearTimeout(this._testTimeoutId);
            this._testTimeoutId = null;
        }
        if (this._testSource) {
            try {
                this._testSource.stop();
            } catch (e) {
                // Unkritisch
            }
            this._testSource = null;
        }
        if (this._testChain) {
            try {
                this._testChain.dispose();
            } catch (e) {
                // Unkritisch
            }
            this._testChain = null;
        }
        this.isPlayingTest = false;
    }
}

export const audioEffectsService = new AudioEffectsService();
