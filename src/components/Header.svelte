<!-- src/components/Header.svelte -->
<script>
    import { onMount } from 'svelte';
    import ZimIcon from './ZimIcon.svelte';
    import { downloadDisplayScreenshot } from '../js/core/utils/screenshot.js';

    /**
     * @typedef {Object} Props
     * @property {() => void} [onScreenshot] - Callback für den Screenshot-Download
     * @property {() => void} [onToggleFullscreen] - Callback für Vollbild
     * @property {boolean} [isFullscreen] - Status ob Vollbild aktiv ist
     * @property {(screenIndex: number|string, use4k?: boolean) => void} [onOpenScreen] - Callback für Pop-Out Monitore
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
     * Schließt Dropdowns beim Klick außerhalb.
     * @param {MouseEvent} e
     */
    function onWindowClick(e) {
        if (monitorMenuOpen && !e.target.closest('.header-dropdown-container')) {
            monitorMenuOpen = false;
        }
    }

    /**
     * Schließt das Dropdown-Menü mit der Escape-Taste.
     * @param {KeyboardEvent} e
     */
    function onWindowKeydown(e) {
        if (e.key === 'Escape' && monitorMenuOpen) {
            monitorMenuOpen = false;
        }
    }

    onMount(() => {
        // Reduce Transparency vom Backend abhören
        if (typeof window !== 'undefined' && window.__TAURI__) {
            window.__TAURI__.event.listen('reduce-transparency-changed', (event) => {
                reduceTransparency = event.payload;
            });
        }
    });
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<header class="page-header app-top-bar" class:reduce-transparency={reduceTransparency}>
    <div class="header-brand">
        <h1 class="header-title">ZugInfoMonitor</h1>
        <span class="header-badge">ZIMSim</span>
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
                    onclick={() => monitorMenuOpen = !monitorMenuOpen}
                    title="Monitore in separaten Vollbild-/Kiosk-Fenstern öffnen"
                    aria-expanded={monitorMenuOpen}
                    aria-haspopup="true"
                    aria-controls="monitor-menu"
                >
                    <ZimIcon name="monitors" size={16} />
                    <span class="header-btn-text">Monitore ▾</span>
                </button>
                {#if monitorMenuOpen}
                    <div id="monitor-menu" class="header-dropdown-menu" role="group" aria-label="Monitore öffnen">
                        <div class="dropdown-header">Full-HD (1080p)</div>
                        <button type="button" class="dropdown-item" onclick={() => { monitorMenuOpen = false; onOpenScreen(1, false); }}>
                            <ZimIcon name="popout" size={14} />
                            <span>Monitor 1 (Hauptmonitor)</span>
                        </button>
                        <button type="button" class="dropdown-item" onclick={() => { monitorMenuOpen = false; onOpenScreen(2, false); }}>
                            <ZimIcon name="popout" size={14} />
                            <span>Monitor 2 (Nebenmonitore)</span>
                        </button>
                        <button type="button" class="dropdown-item" onclick={() => { monitorMenuOpen = false; onOpenScreen(3, false); }}>
                            <ZimIcon name="popout" size={14} />
                            <span>Monitor 3 (Zusatzanzeiger)</span>
                        </button>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-header">4K Ultra-HD (2160p)</div>
                        <button type="button" class="dropdown-item" onclick={() => { monitorMenuOpen = false; onOpenScreen(1, true); }}>
                            <ZimIcon name="popout" size={14} />
                            <span>Monitor 1 (4K)</span>
                        </button>
                        <button type="button" class="dropdown-item" onclick={() => { monitorMenuOpen = false; onOpenScreen(2, true); }}>
                            <ZimIcon name="popout" size={14} />
                            <span>Monitor 2 (4K)</span>
                        </button>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Einstellungen Shortcut -->
        <button 
            type="button" 
            class="header-action-btn"
            onclick={() => window.dispatchEvent(new CustomEvent('menu-open-settings'))}
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
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .dropdown-header {
        font-size: 0.7rem;
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
        padding: 6px 8px;
        font-size: 0.82rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: background 0.15s ease;
    }

    .dropdown-item:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
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
        .header-action-btn {
            min-height: 44px;
            min-width: 44px;
            padding: 8px;
            justify-content: center;
        }
    }
</style>
