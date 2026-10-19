// js/core/state/toastStore.svelte.js

/**
 * Leichtgewichtiges Toast-System als Ersatz für blockierende `alert()`-Aufrufe.
 * Nicht-blockierend, screenreader-freundlich (aria-live im ToastContainer) und
 * automatisch ausblendend.
 */
class ToastStore {
    /** @type {Array<{id:number, message:string, type:string}>} */
    toasts = $state([]);
    #id = 0;

    /**
     * Zeigt eine Benachrichtigung an.
     * @param {string} message
     * @param {'info'|'success'|'warning'|'error'} [type='info']
     * @param {number} [duration=4000] - Anzeigedauer in ms (0 = kein Auto-Dismiss)
     * @returns {number} Toast-ID
     */
    show(message, type = 'info', duration = 4000) {
        const id = ++this.#id;
        this.toasts.push({ id, message: String(message ?? ''), type });
        if (duration > 0) {
            setTimeout(() => this.dismiss(id), duration);
        }
        return id;
    }

    /** @param {string} message @param {number} [duration] */
    success(message, duration) { return this.show(message, 'success', duration); }

    /** @param {string} message @param {number} [duration] */
    error(message, duration = 6500) { return this.show(message, 'error', duration); }

    /** @param {string} message @param {number} [duration] */
    warning(message, duration) { return this.show(message, 'warning', duration); }

    /** @param {string} message @param {number} [duration] */
    info(message, duration) { return this.show(message, 'info', duration); }

    /**
     * Entfernt einen Toast vorzeitig.
     * @param {number} id
     * @returns {void}
     */
    dismiss(id) {
        const index = this.toasts.findIndex((t) => t.id === id);
        if (index !== -1) this.toasts.splice(index, 1);
    }
}

export const toastStore = new ToastStore();
