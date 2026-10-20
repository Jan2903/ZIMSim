<!-- src/components/settings/audio/NumericStepper.svelte -->
<script>
    import { applyNumericInput, resolveNumericBlur } from '../../../js/core/utils/numberUtils.js';
    import { HoldRepeatController } from '../../../js/core/utils/holdRepeat.js';
    import ZimIcon from '../../ZimIcon.svelte';

    /**
     * @typedef {Object} NumericStepperProps
     * @property {string} id - Eindeutige ID des Eingabefeldes (für das Label)
     * @property {string} label - Beschriftung des Parameters
     * @property {number} value - Aktueller Wert
     * @property {number} min - Untere Grenze
     * @property {number} max - Obere Grenze
     * @property {(delta: number) => void} onStep - Wird mit der Schrittweite bei Klick auf Plus/Minus aufgerufen
     * @property {(value: number) => void} onChange - Wird mit dem absoluten Wert bei manueller Eingabe aufgerufen
     */

    /** @type {NumericStepperProps} */
    let { id, label, value, min, max, onStep, onChange } = $props();

    const holdRepeat = new HoldRepeatController();

    /**
     * Verarbeitet manuelle Eingaben im Zahlenfeld. Werte außerhalb des Bereichs
     * werden verworfen und erst beim Verlassen des Feldes korrigiert.
     * @param {Event} e
     * @returns {void}
     */
    function handleInput(e) {
        const newValue = applyNumericInput(e, min, max);
        if (newValue === null) return;
        onChange(newValue);
    }

    /**
     * Stellt beim Verlassen des Feldes einen gültigen Wert sicher.
     * @param {Event} e
     * @returns {void}
     */
    function handleBlur(e) {
        onChange(resolveNumericBlur(e, min, max, value));
    }

    $effect(() => {
        return () => {
            holdRepeat.destroy();
        };
    });
</script>

<div class="setting-param-row">
    <label class="setting-param-label" for={id}>{label}</label>
    <div class="param-stepper">
        <button
            type="button"
            class="stepper-action-btn"
            disabled={value <= min}
            onpointerdown={(e) => holdRepeat.start(-1, onStep, e)}
            onpointerup={() => holdRepeat.stop()}
            onpointerleave={() => holdRepeat.stop()}
            onpointercancel={() => holdRepeat.stop()}
            aria-label="{label} verringern"
            title="Verringern (gedrückt halten für schnellen Durchlauf)"
        >
            <ZimIcon name="minus" size={14} />
        </button>
        <input
            id={id}
            type="number"
            class="param-stepper-input"
            min={min}
            max={max}
            value={value}
            oninput={handleInput}
            onblur={handleBlur}
        />
        <button
            type="button"
            class="stepper-action-btn"
            disabled={value >= max}
            onpointerdown={(e) => holdRepeat.start(1, onStep, e)}
            onpointerup={() => holdRepeat.stop()}
            onpointerleave={() => holdRepeat.stop()}
            onpointercancel={() => holdRepeat.stop()}
            aria-label="{label} erhöhen"
            title="Erhöhen (gedrückt halten für schnellen Durchlauf)"
        >
            <ZimIcon name="plus" size={14} />
        </button>
    </div>
</div>

<style>
    .setting-param-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        font-size: 0.85rem;
        color: var(--text-main, #f8fafc);
    }

    .setting-param-label {
        display: block;
        flex: 1;
        min-width: 0;
        margin: 0;
        font-size: 0.82rem;
        font-weight: 500;
        line-height: 1.3;
        color: var(--text-muted, #94a3b8);
    }

    .param-stepper {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        height: 34px;
        overflow: hidden;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .param-stepper .stepper-action-btn {
        width: 34px;
    }

    .param-stepper-input {
        width: 46px;
        height: 100%;
        padding: 0;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-main, #f8fafc);
        font-size: 0.88rem;
        font-weight: 600;
        text-align: center;
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .param-stepper-input:focus {
        background: rgba(255, 255, 255, 0.04);
    }

    .param-stepper-input::-webkit-outer-spin-button,
    .param-stepper-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    @media (max-width: 768px) {
        .setting-param-row {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
        }

        .param-stepper {
            width: 100%;
            height: 40px;
        }

        .param-stepper .stepper-action-btn {
            width: 44px;
        }

        .param-stepper-input {
            flex: 1;
            width: auto;
            font-size: 16px;
        }
    }

    /* Touch-Geräte: größere Halteflächen für Stepper */
    @media (hover: none) and (pointer: coarse) {
        .param-stepper .stepper-action-btn {
            width: 44px;
        }
    }
</style>
