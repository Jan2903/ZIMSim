<script>
    import { slide } from 'svelte/transition';

    /**
     * @param {string} title - Die Überschrift der Sektion
     * @param {boolean} [isOpen=true] - Initialer Zustand
     * @param {boolean} [isFrame=true] - Steuert das Styling (true = eigenständige Karte, false = innerhalb einer bestehenden Karte)
     * @param {import('svelte').Snippet} [headerActions] - Optionale Aktions-Buttons für den Header
     * @param {import('svelte').Snippet} children - Der Inhalt der Sektion
     */
    let { 
        title, 
        isOpen = true, 
        isFrame = true,
        headerActions, 
        children 
    } = $props();

    let open = $state(isOpen);

    function toggle() {
        open = !open;
    }
</script>

<div class="collapsible-wrapper" class:is-frame={isFrame}>
    <button type="button" class="collapsible-header" onclick={toggle} aria-expanded={open}>
        <div class="collapsible-title">
            <span class="chevron" class:open>▸</span>
            <h3>{title}</h3>
        </div>
        {#if headerActions}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="collapsible-actions" onclick={(e) => e.stopPropagation()}>
                {@render headerActions()}
            </div>
        {/if}
    </button>
    
    {#if open}
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

    /* Header Button Styles */
    .collapsible-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .collapsible-wrapper.is-frame .collapsible-header {
        padding: 24px;
        border-bottom: 1px solid transparent;
    }
    .collapsible-wrapper:not(.is-frame) .collapsible-header {
        padding: 8px 0;
    }
    
    /* Hover Effekt nur für Frame-Mode (sieht bei Non-Frame ggf. unsauber aus) */
    .collapsible-wrapper.is-frame .collapsible-header:hover {
        background-color: rgba(255, 255, 255, 0.02);
    }
    
    /* Separator Line when open (only in Frame mode, to match original styling) */
    .collapsible-wrapper.is-frame .collapsible-header[aria-expanded="true"] {
        border-bottom: 1px solid var(--border);
        padding-bottom: 16px;
        margin-bottom: 16px;
    }

    /* Title & Chevron */
    .collapsible-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .collapsible-title h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--text-main);
        padding: 0;
        border: none;
    }

    .chevron {
        display: inline-block;
        transition: transform 0.2s ease;
        color: var(--accent, #e2001a);
        font-weight: bold;
        font-size: 1.2rem;
        line-height: 1;
    }
    .chevron.open {
        transform: rotate(90deg);
    }

    /* Actions Wrapper */
    .collapsible-actions {
        display: flex;
        gap: 8px;
    }

    /* Content Area */
    .collapsible-wrapper.is-frame .collapsible-content-inner {
        padding: 0 24px 24px 24px;
    }
    .collapsible-wrapper:not(.is-frame) .collapsible-content-inner {
        padding: 10px 0 20px 0;
    }
</style>
