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

    onMount(() => {
        // Reduce Transparency vom Backend abhören
        if (typeof window !== 'undefined' && window.__TAURI__) {
            window.__TAURI__.event.listen('reduce-transparency-changed', (event) => {
                reduceTransparency = event.payload;
            });
        }
    });
</script>

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
