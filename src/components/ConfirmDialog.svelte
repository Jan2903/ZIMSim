<!-- src/components/ConfirmDialog.svelte -->
<script>
    import Modal from './Modal.svelte';
    import { confirmStore } from '../js/core/state/confirmStore.svelte.js';
</script>

<Modal
    bind:isOpen={confirmStore.isOpen}
    title={confirmStore.title}
    size="sm"
    onClose={() => confirmStore.cancel()}
>
    <p class="confirm-message">{confirmStore.message}</p>

    {#snippet footer()}
        <button class="btn-secondary" onclick={() => confirmStore.cancel()}>{confirmStore.cancelLabel}</button>
        <button class={confirmStore.danger ? 'btn-danger' : 'btn-primary'} onclick={() => confirmStore.accept()}>
            {confirmStore.confirmLabel}
        </button>
    {/snippet}
</Modal>

<style>
    .confirm-message {
        margin: 0;
        line-height: 1.5;
        color: var(--text-main);
    }
</style>
