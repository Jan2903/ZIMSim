<!-- src/components/Modal.svelte -->
<script>
    import ZimIcon from './ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {boolean} [isOpen] - Steuert die Sichtbarkeit (bindbar)
     * @property {string} [title] - Titel für den Standard-Header
     * @property {'sm'|'md'|'lg'|'xl'} [size='md'] - Breite des Dialogs
     * @property {boolean} [closeOnOverlay=true] - Schließen bei Klick auf den Hintergrund
     * @property {boolean} [closeOnEscape=true] - Schließen mit Escape
     * @property {() => void} [onClose] - Callback nach dem Schließen
     * @property {import('svelte').Snippet} [header] - Optionaler eigener Header (erhält close-Callback)
     * @property {import('svelte').Snippet} [footer] - Optionaler Footer
     * @property {import('svelte').Snippet} children - Inhalt
     */
    let {
        isOpen = $bindable(false),
        title = '',
        size = 'md',
        closeOnOverlay = true,
        closeOnEscape = true,
        onClose,
        header,
        footer,
        children
    } = $props();

    const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

    let dialogEl = $state();
    let lastFocused = null;

    /**
     * Schließt den Dialog und benachrichtigt den Aufrufer.
     * @returns {void}
     */
    function close() {
        if (!isOpen) return;
        isOpen = false;
        onClose?.();
    }

    /**
     * Sammelt alle fokussierbaren Elemente im Dialog.
     * @returns {HTMLElement[]}
     */
    function getFocusable() {
        if (!dialogEl) return [];
        const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return Array.from(dialogEl.querySelectorAll(selector))
            .filter((el) => el.offsetParent !== null || el === document.activeElement);
    }

    /**
     * Hält den Fokus im Dialog (Focus-Trap) und schließt per Escape.
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    function onKeydown(e) {
        if (!isOpen) return;

        if (e.key === 'Escape' && closeOnEscape) {
            e.preventDefault();
            close();
            return;
        }

        if (e.key !== 'Tab') return;

        const focusable = getFocusable();
        if (focusable.length === 0) {
            e.preventDefault();
            dialogEl?.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey && (active === first || active === dialogEl)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // Fokus-Verwaltung, Scroll-Sperre und Fokus-Wiederherstellung
    $effect(() => {
        if (isOpen) {
            lastFocused = document.activeElement;
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                const focusable = getFocusable();
                if (focusable.length > 0) focusable[0].focus();
                else dialogEl?.focus();
            });
        } else {
            document.body.style.overflow = '';
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
                lastFocused = null;
            }
        }

        return () => {
            document.body.style.overflow = '';
        };
    });
</script>

<svelte:window onkeydown={onKeydown} />

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="modal-overlay"
        role="presentation"
        onclick={(e) => { if (closeOnOverlay && e.target === e.currentTarget) close(); }}
    >
        <div
            class="modal-content modal-{size}"
            role="dialog"
            aria-modal="true"
            aria-labelledby={header ? undefined : titleId}
            aria-label={header ? title : undefined}
            tabindex="-1"
            bind:this={dialogEl}
        >
            {#if header}
                {@render header(close)}
            {:else}
                <div class="modal-header">
                    <h3 id={titleId}>{title}</h3>
                    <button type="button" class="modal-close" onclick={close} title="Schließen" aria-label="Dialog schließen">
                        <ZimIcon name="close" size={18} />
                    </button>
                </div>
            {/if}

            <div class="modal-body">
                {@render children()}
            </div>

            {#if footer}
                <div class="modal-footer">
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: var(--z-modal, 9000);
        padding: 16px;
        box-sizing: border-box;
    }

    .modal-content {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 0;
        max-height: 85vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        width: 100%;
        box-sizing: border-box;
        box-shadow: var(--shadow-card);
    }

    .modal-sm { max-width: 480px; }
    .modal-md { max-width: 700px; }
    .modal-lg { max-width: 950px; }
    .modal-xl { max-width: 1080px; }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        gap: 12px;
    }
    .modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
    }

    .modal-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .modal-close:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.08);
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
    }

    @media (max-width: 600px) {
        .modal-overlay { padding: 8px; }
        .modal-header { padding: 12px 16px; }
        .modal-body { padding: 14px 16px; }
        .modal-footer { padding: 10px 16px; flex-direction: column-reverse; }
        .modal-footer :global(button) { width: 100%; min-height: 44px; }
    }
</style>
