<!-- src/components/Header.svelte -->
<script>
    import { onMount, tick } from 'svelte';
    import ZimIcon from './ZimIcon.svelte';
    import { selectTab } from '../js/core/state/uiState.svelte.js';
    import { downloadDisplayScreenshot } from '../js/core/utils/screenshot.js';
    import { watchReducedTransparency } from '../js/core/utils/systemPreferences.js';
    import { displayConfigStore } from '../js/displays/core/displayConfigStore.svelte.js';
    import { getVariantId, getVariantOrientation } from '../js/displays/core/boardTokenService.js';

    /**
     * @typedef {Object} Props
     * @property {() => void} [onScreenshot] - Callback für den Screenshot-Download
     * @property {() => void} [onToggleFullscreen] - Callback für Vollbild
     * @property {boolean} [isFullscreen] - Status ob Vollbild aktiv ist
     * @property {(screenIndex: number|string, variantId?: string|null) => void} [onOpenScreen] - Callback für Pop-Out Monitore
     */
    let { 
        onScreenshot, 
        onToggleFullscreen, 
        isFullscreen = false, 
        onOpenScreen 
    } = $props();

    // Reduce Transparency State für CSS-Fallback
    let reduceTransparency = $state(false);

    // Zustand für das Monitore-Dropdown-Menü
    let monitorMenuOpen = $state(false);
    let monitorMenuEl = $state(null);
    let monitorButtonEl = $state(null);

    // Pop-Out-Varianten: Die Auflösungsklasse (Full HD / 4K) ist wählbar,
    // die Ausrichtung (Quer-/Hochformat) folgt dem aktiven Monitor.
    const popOutOrientation = $derived(getVariantOrientation(displayConfigStore.activeVariantId));
    const fhdVariant = $derived(getVariantId(popOutOrientation, false));
    const uhdVariant = $derived(getVariantId(popOutOrientation, true));

    /**
     * Führt den Screenshot-Download aus.
     */
    function handleScreenshot() {
        if (onScreenshot) {
            onScreenshot();
        } else {
            const canvas = document.getElementById('zimCanvas');
            if (canvas) {
                const overlayCanvas = document.getElementById('zimDynamicCanvas');
                downloadDisplayScreenshot({ canvas, overlayCanvas });
            }
        }
    }

    /**
     * Schließt das Monitore-Dropdown.
     * @param {{ restoreFocus?: boolean }} [options]
     */
    function closeMonitorMenu({ restoreFocus = false } = {}) {
        monitorMenuOpen = false;
        if (restoreFocus) {
            monitorButtonEl?.focus();
        }
    }

    /**
     * Öffnet bzw. schließt das Dropdown und setzt den Fokus auf den ersten Eintrag.
     */
    async function toggleMonitorMenu() {
        if (monitorMenuOpen) {
            closeMonitorMenu();
            return;
        }

        monitorMenuOpen = true;
        await tick();
        if (monitorMenuOpen) {
            focusMenuItem(0);
        }
    }

    /**
     * @returns {HTMLElement[]} Alle Menüeinträge des offenen Dropdowns.
     */
    function getMenuItems() {
        return monitorMenuEl
            ? /** @type {HTMLElement[]} */ (Array.from(monitorMenuEl.querySelectorAll('[role="menuitem"]')))
            : [];
    }

    /**
     * Fokussiert einen Menüeintrag (mit Umlauf).
     * @param {number} index
     */
    function focusMenuItem(index) {
        const items = getMenuItems();
        if (!items.length) return;
        items[(index + items.length) % items.length].focus();
    }

    /**
     * Tastaturnavigation innerhalb des Menüs (Pfeile, Home, End, Tab).
     * @param {KeyboardEvent} e
     */
    function onMonitorMenuKeydown(e) {
        const items = getMenuItems();
        const active = document.activeElement;
        const currentIndex = active instanceof HTMLElement ? items.indexOf(active) : -1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                focusMenuItem(currentIndex === -1 ? 0 : currentIndex + 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                focusMenuItem(currentIndex === -1 ? items.length - 1 : currentIndex - 1);
                break;
            case 'Home':
                e.preventDefault();
                focusMenuItem(0);
                break;
            case 'End':
                e.preventDefault();
                focusMenuItem(items.length - 1);
                break;
            case 'Tab':
                // Fokus zurück auf den Trigger; die Standard-Tab-Navigation
                // bewegt sich anschließend vom Trigger aus weiter.
                closeMonitorMenu({ restoreFocus: true });
                break;
        }
    }

    /**
     * Öffnet einen Monitor und schließt das Menü.
     * @param {number} screenIndex
     * @param {string|null} variantId - Darstellungsvariante des Pop-Out-Fensters
     */
    function openMonitor(screenIndex, variantId) {
        closeMonitorMenu({ restoreFocus: true });
        onOpenScreen?.(screenIndex, variantId);
    }

    /**
     * Schließt Dropdowns beim Klick außerhalb.
     * @param {MouseEvent} e
     */
    function onWindowClick(e) {
        if (
            monitorMenuOpen &&
            e.target instanceof Element &&
            !e.target.closest('.header-dropdown-container')
        ) {
            closeMonitorMenu();
        }
    }

    /**
     * Schließt das Dropdown-Menü mit der Escape-Taste und gibt den Fokus zurück.
     * @param {KeyboardEvent} e
     */
    function onWindowKeydown(e) {
        if (e.key === 'Escape' && monitorMenuOpen) {
            closeMonitorMenu({ restoreFocus: true });
        }
    }

    /**
     * Öffnet die Einstellungen im Tab "Anzeige & System" und scrollt dorthin.
     * @returns {void}
     */
    function openSettings() {
        selectTab('system');
        document.querySelector('.settings-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    onMount(() => {
        // Systemeinstellung "Transparenz reduzieren" beobachten (CSS-Media-Query)
        return watchReducedTransparency((value) => {
            reduceTransparency = value;
        });
    });
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<header class="page-header app-top-bar" class:reduce-transparency={reduceTransparency}>
    <div class="header-brand">
        <h1 class="header-title">ZugInfoMonitor</h1>
        <span class="header-badge">ZIMSim</span>
        <span class="header-badge-beta">BETA</span>
    </div>
    
    <div class="header-actions">
        <!-- Screenshot Download -->
        <button 
            type="button" 
            class="header-action-btn" 
            onclick={handleScreenshot} 
            title="Screenshot des Displays herunterladen (Cmd+Shift+4)" 
            aria-label="Screenshot herunterladen"
        >
            <ZimIcon name="camera" size={16} />
            <span class="header-btn-text">Screenshot</span>
        </button>

        <!-- Vollbild-Modus -->
        {#if onToggleFullscreen}
            <button 
                type="button" 
                class="header-action-btn" 
                class:active-btn={isFullscreen}
                onclick={onToggleFullscreen} 
                title={isFullscreen ? 'Vollbildmodus beenden (Esc/F11)' : 'In den Vollbildmodus wechseln (F11)'} 
                aria-label="Vollbildmodus"
            >
                <ZimIcon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} size={16} />
                <span class="header-btn-text">{isFullscreen ? 'Beenden' : 'Vollbild'}</span>
            </button>
        {/if}

        <!-- Multi-Monitor Pop-Out Dropdown (nur Desktop) -->
        {#if onOpenScreen}
            <div class="header-dropdown-container desktop-only">
                <button 
                    type="button" 
                    class="header-action-btn"
                    bind:this={monitorButtonEl}
                    onclick={toggleMonitorMenu}
                    title="Monitore in separaten Vollbild-/Kiosk-Fenstern öffnen"
                    aria-label="Monitore"
                    aria-expanded={monitorMenuOpen}
                    aria-haspopup="menu"
                    aria-controls="monitor-menu"
                >
                    <ZimIcon name="monitors" size={16} />
                    <span class="header-btn-text">Monitore</span>
                    <ZimIcon name={monitorMenuOpen ? 'chevron_up' : 'chevron_down'} size={12} />
                </button>
                {#if monitorMenuOpen}
                    <div
                        id="monitor-menu"
                        class="header-dropdown-menu"
                        role="menu"
                        aria-label="Monitore öffnen"
                        tabindex="-1"
                        bind:this={monitorMenuEl}
                        onkeydown={onMonitorMenuKeydown}
                    >
                        <div class="dropdown-group" role="group" aria-label="Full-HD (1080p)">
                            <div class="dropdown-header" aria-hidden="true">Full-HD (1080p)</div>
                            <button type="button" role="menuitem" tabindex="-1" class="dropdown-item" onclick={() => openMonitor(1, fhdVariant)}>
                                <ZimIcon name="popout" size={14} />
                                <span>Monitor 1 (Hauptmonitor)</span>
                            </button>
                            <button type="button" role="menuitem" tabindex="-1" class="dropdown-item" onclick={() => openMonitor(2, fhdVariant)}>
                                <ZimIcon name="popout" size={14} />
                                <span>Monitor 2 (Nebenmonitore)</span>
                            </button>
                            <button type="button" role="menuitem" tabindex="-1" class="dropdown-item" onclick={() => openMonitor(3, fhdVariant)}>
                                <ZimIcon name="popout" size={14} />
                                <span>Monitor 3 (Zusatzanzeiger)</span>
                            </button>
                        </div>
                        <div class="dropdown-divider" role="separator"></div>
                        <div class="dropdown-group" role="group" aria-label="4K Ultra-HD (2160p)">
                            <div class="dropdown-header" aria-hidden="true">4K Ultra-HD (2160p)</div>
                            <button type="button" role="menuitem" tabindex="-1" class="dropdown-item" onclick={() => openMonitor(1, uhdVariant)}>
                                <ZimIcon name="popout" size={14} />
                                <span>Monitor 1 (4K)</span>
                            </button>
                            <button type="button" role="menuitem" tabindex="-1" class="dropdown-item" onclick={() => openMonitor(2, uhdVariant)}>
                                <ZimIcon name="popout" size={14} />
                                <span>Monitor 2 (4K)</span>
                            </button>
                            <button type="button" role="menuitem" tabindex="-1" class="dropdown-item" onclick={() => openMonitor(3, uhdVariant)}>
                                <ZimIcon name="popout" size={14} />
                                <span>Monitor 3 (4K)</span>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Einstellungen Shortcut -->
        <button 
            type="button" 
            class="header-action-btn"
            onclick={openSettings}
            title="Einstellungen öffnen (Cmd+,)"
            aria-label="Einstellungen"
        >
            <ZimIcon name="settings" size={16} />
            <span class="header-btn-text">Einstellungen</span>
        </button>
    </div>
</header>

<style>
    .app-top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 24px;
        background-color: var(--bg-card);
        border-bottom: 1px solid var(--border);
        box-sizing: border-box;
        margin-bottom: 0;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    .app-top-bar.reduce-transparency {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }

    .header-brand {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .header-title {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--text-main);
        letter-spacing: -0.3px;
    }

    .header-badge {
        font-size: 0.68rem;
        font-weight: 700;
        background: var(--accent);
        color: #ffffff;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }

    .header-badge-beta {
        font-size: 0.68rem;
        font-weight: 700;
        background: rgba(239, 68, 68, 0.15);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.35);
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-left: 6px;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .header-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--bg-input);
        color: var(--text-muted);
        border: 1px solid var(--border);
        padding: 8px 14px;
        border-radius: var(--radius-sm);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
        white-space: nowrap;
        min-height: 44px;
        min-width: 44px;
    }

    .header-action-btn:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .header-action-btn.active-btn {
        background: rgba(226, 0, 26, 0.15);
        border-color: var(--accent);
        color: var(--accent);
    }

    .header-action-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
    }

    .header-dropdown-container {
        position: relative;
    }

    .header-dropdown-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 6px;
        min-width: 230px;
        box-shadow: var(--shadow-card);
        z-index: var(--z-dropdown);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .dropdown-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .dropdown-header {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
        font-weight: 700;
        padding: 4px 8px;
    }

    .dropdown-divider {
        height: 1px;
        background: var(--border);
        margin: 4px 0;
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 8px;
        background: transparent;
        border: none;
        color: var(--text-main);
        padding: 6px 10px;
        min-height: 36px;
        font-size: 0.85rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: background 0.15s ease;
    }

    .dropdown-item:hover,
    .dropdown-item:focus-visible {
        background: var(--bg-panel);
        color: var(--text-primary);
    }

    /* Touch-Geräte (auch Tablets > 768 px) erhalten die vollen 44 px. */
    @media (pointer: coarse) {
        .dropdown-item {
            min-height: 44px;
        }
    }

    @media (max-width: 768px) {
        .app-top-bar {
            padding: 6px 12px;
        }
        .header-title {
            font-size: 1.05rem;
        }
        .header-btn-text {
            display: none;
        }
        .desktop-only {
            display: none;
        }
        .header-action-btn {
            min-height: 44px;
            min-width: 44px;
            padding: 8px;
            justify-content: center;
        }
    }
</style>
