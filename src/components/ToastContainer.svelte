<!-- src/components/ToastContainer.svelte -->
<script>
    import { toastStore } from '../js/core/state/toastStore.svelte.js';
    import ZimIcon from './ZimIcon.svelte';

    const ICONS = {
        success: 'check',
        error: 'cancelled',
        warning: 'warning',
        info: 'bolt'
    };
</script>

<div class="toast-container" role="region" aria-label="Benachrichtigungen" aria-live="polite" aria-atomic="false">
    {#each toastStore.toasts as toast (toast.id)}
        <div class="toast toast-{toast.type}" role="status">
            <span class="toast-icon"><ZimIcon name={ICONS[toast.type] || 'bolt'} size={16} /></span>
            <span class="toast-message">{toast.message}</span>
            <button
                type="button"
                class="toast-close"
                onclick={() => toastStore.dismiss(toast.id)}
                title="Schließen"
                aria-label="Benachrichtigung schließen"
            >
                <ZimIcon name="close" size={14} />
            </button>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: var(--z-toast, 100000);
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: min(420px, calc(100vw - 32px));
        pointer-events: none;
    }

    .toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        background: var(--bg-panel, #2b2b2b);
        border: 1px solid var(--border);
        border-left: 4px solid var(--text-muted);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-card);
        color: var(--text-main);
        font-size: 0.9rem;
        pointer-events: auto;
        animation: toast-in 0.18s ease-out;
    }

    .toast-icon {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        margin-top: 1px;
    }

    .toast-message {
        flex: 1;
        line-height: 1.35;
        word-break: break-word;
    }

    .toast-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 2px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    .toast-close:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.08);
    }

    .toast-success { border-left-color: #22c55e; }
    .toast-success .toast-icon { color: #22c55e; }

    .toast-error { border-left-color: var(--accent); }
    .toast-error .toast-icon { color: var(--accent); }

    .toast-warning { border-left-color: #f59e0b; }
    .toast-warning .toast-icon { color: #f59e0b; }

    .toast-info { border-left-color: #60a5fa; }
    .toast-info .toast-icon { color: #60a5fa; }

    @keyframes toast-in {
        from { opacity: 0; transform: translateX(16px); }
        to { opacity: 1; transform: translateX(0); }
    }

    @media (max-width: 600px) {
        .toast-container {
            top: 8px;
            right: 8px;
            left: 8px;
            max-width: none;
        }
    }
</style>
