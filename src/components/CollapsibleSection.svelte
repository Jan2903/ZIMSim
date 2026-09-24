<script>
    import { slide } from 'svelte/transition';
    import ZimIcon from './ZimIcon.svelte';

    /**
     * @param {string} title - Die Überschrift der Sektion
     * @param {boolean} [isOpen=true] - Initialer Zustand
     * @param {boolean} [isFrame=true] - Steuert das Styling (true = eigenständige Karte, false = innerhalb einer bestehenden Karte)
     * @param {import('svelte').Snippet} [headerActions] - Optionale Aktions-Buttons für den Header
     * @param {import('svelte').Snippet} children - Der Inhalt der Sektion
     */
    let { 
        title, 
        isOpen = $bindable(true), 
        isFrame = true,
        headerActions, 
        children 
    } = $props();

    function toggle() {
        isOpen = !isOpen;
    }
</script>

<div class="collapsible-wrapper" class:is-frame={isFrame}>
    <div class="collapsible-header" class:is-open={isOpen}>
        <button type="button" class="collapsible-trigger" onclick={toggle} aria-expanded={isOpen}>
            <span class="chevron" class:open={isOpen}><ZimIcon name="chevron_right" size={16} /></span>
            <h3>{title}</h3>
        </button>
        {#if headerActions}
            <div class="collapsible-actions">
                {@render headerActions()}
            </div>
        {/if}
    </div>
    
    {#if isOpen}
        <div class="collapsible-content" transition:slide={{ duration: 250 }}>
            <div class="collapsible-content-inner">
                {@render children()}
            </div>
        </div>
    {/if}
</div>

<style>
    /* Wrapper Styles */
    .collapsible-wrapper {
        margin-bottom: 20px;
    }
    .collapsible-wrapper:last-child {
        margin-bottom: 0;
    }
    
    /* Frame Mode (Eigenständige Karte wie .settings-frame) */
    .collapsible-wrapper.is-frame {
        background-color: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow-card);
        overflow: hidden;
    }
    
    /* Non-Frame Mode (Als Unterpunkt innerhalb eines .settings-frame) */
    .collapsible-wrapper:not(.is-frame) {
        border-bottom: 1px solid var(--border);
        margin-bottom: 16px;
    }
    .collapsible-wrapper:not(.is-frame):last-child {
        border-bottom: none;
        margin-bottom: 0;
    }

    /* Header Container Styles */
    .collapsible-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        flex-wrap: wrap;
        gap: 10px;
        transition: background-color 0.2s;
    }
    
    .collapsible-wrapper.is-frame .collapsible-header {
        padding: 20px 24px;
        border-bottom: 1px solid transparent;
    }
    .collapsible-wrapper:not(.is-frame) .collapsible-header {
        padding: 8px 0;
    }
    
    /* Hover Effekt nur für Frame-Mode */
    .collapsible-wrapper.is-frame .collapsible-header:hover {
        background-color: rgba(255, 255, 255, 0.02);
    }
    
    /* Separator Line when open */
    .collapsible-wrapper.is-frame .collapsible-header.is-open {
        border-bottom: 1px solid var(--border);
        padding-bottom: 16px;
        margin-bottom: 16px;
    }

    /* Title & Chevron Trigger Button */
    .collapsible-trigger {
        display: flex;
        align-items: center;
        gap: 10px;
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0;
        text-align: left;
        flex: 1;
        min-width: 140px;
    }
    .collapsible-trigger h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--text-main);
        padding: 0;
        border: none;
    }

    .chevron {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        color: var(--accent, #e2001a);
        line-height: 1;
    }
    .chevron.open {
        transform: rotate(90deg);
    }

    /* Actions Wrapper */
    .collapsible-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    /* Content Area */
    .collapsible-wrapper.is-frame .collapsible-content-inner {
        padding: 0 24px 24px 24px;
    }
    .collapsible-wrapper:not(.is-frame) .collapsible-content-inner {
        padding: 10px 0 20px 0;
    }

    @media (max-width: 600px) {
        .collapsible-wrapper.is-frame .collapsible-header {
            padding: 14px 16px;
        }
        .collapsible-actions {
            width: 100%;
            justify-content: flex-start;
        }
    }
</style>
