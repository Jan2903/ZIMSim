// js/core/state/confirmStore.svelte.js

/**
 * Promise-basierter Ersatz für blockierende `confirm()`-Aufrufe.
 * Wird über `<ConfirmDialog />` (siehe App.svelte) gerendert.
 *
 * Verwendung:
 *   if (await confirmDialog('Wirklich löschen?', { danger: true })) { ... }
 */
class ConfirmStore {
    isOpen = $state(false);
    title = $state('Bestätigen');
    message = $state('');
    confirmLabel = $state('OK');
    cancelLabel = $state('Abbrechen');
    danger = $state(false);

    /** @type {((value: boolean) => void) | null} */
    #resolve = null;

    /**
     * Öffnet den Bestätigungsdialog.
     * @param {string} message
     * @param {{title?:string, confirmLabel?:string, cancelLabel?:string, danger?:boolean}} [options]
     * @returns {Promise<boolean>}
     */
    ask(message, options = {}) {
        this.message = message;
        this.title = options.title ?? 'Bestätigen';
        this.confirmLabel = options.confirmLabel ?? 'OK';
        this.cancelLabel = options.cancelLabel ?? 'Abbrechen';
        this.danger = options.danger ?? false;
        this.isOpen = true;
        return new Promise((resolve) => {
            this.#resolve = resolve;
        });
    }

    /**
     * @param {boolean} value
     * @returns {void}
     */
    #settle(value) {
        this.isOpen = false;
        const resolve = this.#resolve;
        this.#resolve = null;
        resolve?.(value);
    }

    /** @returns {void} */
    accept() { this.#settle(true); }

    /** @returns {void} */
    cancel() { this.#settle(false); }
}

export const confirmStore = new ConfirmStore();

/**
 * Öffnet einen Bestätigungsdialog und liefert das Ergebnis asynchron.
 * @param {string} message
 * @param {{title?:string, confirmLabel?:string, cancelLabel?:string, danger?:boolean}} [options]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, options) {
    return confirmStore.ask(message, options);
}
