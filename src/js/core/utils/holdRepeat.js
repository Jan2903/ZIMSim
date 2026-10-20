// src/js/core/utils/holdRepeat.js

/**
 * Steuert das Hold-to-Repeat-Verhalten eines Stepper-Buttons.
 *
 * Der erste PointerDown setzt den Wert sofort. Wird der Knopf gehalten, wird
 * nach 350 ms mit 60 ms Takt wiederholt und nach 1,5 s kontinuierlichem Halten
 * in 5-facher Schrittweite beschleunigt.
 */
export class HoldRepeatController {
    constructor() {
        /** @type {any} Timer für die Verzögerung bis zur ersten Wiederholung */
        this._timer = null;
        /** @type {any} Intervall für die laufenden Wiederholungen */
        this._interval = null;
        /** @type {number} Zeitpunkt des PointerDown (für die Beschleunigung) */
        this._startTime = 0;
        /** Gebundener Listener, damit er sauber wieder entfernt werden kann */
        this._onRelease = () => this.stop();
    }

    /**
     * Startet den Hold-to-Repeat-Modus bei PointerDown (unterstützt Maus & Mobile-Touch).
     *
     * @param {number} delta - Schrittweite pro Wiederholung
     * @param {(delta: number) => void} stepFn - Funktion, die den neuen Wert anwendet
     * @param {PointerEvent} [e=null] - Ursprungsereignis für das Pointer-Capture
     * @returns {void}
     */
    start(delta, stepFn, e = null) {
        if (e && e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch (err) {
                console.warn('[HoldRepeat] Pointer-Capture konnte nicht gesetzt werden:', err);
            }
        }
        this.stop();
        stepFn(delta);
        this._startTime = Date.now();

        // Globale Freigabe-Listener: beenden das Wiederholen auch, wenn der Button
        // während des Haltens deaktiviert wird oder der Zeiger das Element verlässt.
        window.addEventListener('pointerup', this._onRelease);
        window.addEventListener('pointercancel', this._onRelease);
        window.addEventListener('blur', this._onRelease);

        this._timer = setTimeout(() => {
            this._interval = setInterval(() => {
                const elapsed = Date.now() - this._startTime;
                // Nach 1,5s kontinuierlichem Halten Sprünge in 5er-Schritten (Beschleunigung)
                const stepDelta = elapsed > 1500 ? delta * 5 : delta;
                stepFn(stepDelta);
            }, 60);
        }, 350);
    }

    /**
     * Beendet den Hold-to-Repeat-Timer sicher.
     * @returns {void}
     */
    stop() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        window.removeEventListener('pointerup', this._onRelease);
        window.removeEventListener('pointercancel', this._onRelease);
        window.removeEventListener('blur', this._onRelease);
    }

    /**
     * Beendet das Hold-to-Repeat und entfernt alle Listener (z.B. beim Unmount).
     * @returns {void}
     */
    destroy() {
        this.stop();
    }
}
