<!-- src/components/DisplayToolbar.svelte -->
<script>
    import ZimIcon from './ZimIcon.svelte';
    import { displayConfigStore } from '../js/displays/core/displayConfigStore.svelte.js';
    import { MONITOR_PROFILES, LAYOUT_TYPES } from '../js/displays/core/displayLayoutService.js';
    import { trainDisplay } from '../js/core/state/stores.js';

    /**
     * @typedef {Object} Props
     * @property {string} displayScaleMode - 'fit' oder 'scroll'
     * @property {string|null} targetScreen - Zielmonitor für Pop-Outs
     * @property {() => void} onToggleBezel - Schaltet das Gehäuse-Overlay um
     * @property {() => void} onScreenshot - Löst den Screenshot-Download aus
     * @property {() => void} onToggleScaleMode - Wechselt zwischen Fit und 1:1 Scroll
     * @property {() => void} onToggleFullscreen - Schaltet Vollbildmodus um
     * @property {(screenIndex: number|string, use4k?: boolean) => void} onOpenScreen - Öffnet einen Popout-Monitor
     */
    let {
        displayScaleMode = 'fit',
        targetScreen = null,
        onToggleBezel,
        onScreenshot,
        onToggleScaleMode,
        onToggleFullscreen,
        onOpenScreen
    } = $props();

    // Zustand für das Monitore-Dropdown-Menü
    let monitorMenuOpen = $state(false);

    // Aktiver Wagenreihungs-Modus ('rotierend' | 'wagennummern' | 'ausstattung' | 'klasse')
    let activeFeature = $state('wagennummern');

    /**
     * Behandelt den Wechsel des DB-Anzeigetyps.
     * @param {string} typeId
     * @returns {void}
     */
    function handleLayoutChange(typeId) {
        displayConfigStore.setLayoutType(typeId);
        trainDisplay.updateAll();
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * Behandelt den Wechsel des Hardware-Monitor-Profils.
     * @param {string} monitorId
     * @returns {void}
     */
    function handleMonitorChange(monitorId) {
        displayConfigStore.setMonitorId(monitorId);
        trainDisplay.updateAll();
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * Schaltet den Wagenreihungs-Anzeigemodus um.
     * @param {string} featureVal
     * @returns {void}
     */
    function handleFeatureChange(featureVal) {
        activeFeature = featureVal;
        trainDisplay.onFeatureButtonChange(featureVal);
    }

    /**
     * Schließt Dropdowns beim Klick außerhalb.
     * @param {MouseEvent} e
     */
    function onWindowClick(e) {
        if (monitorMenuOpen && !e.target.closest('.display-toolbar-dropdown-container')) {
            monitorMenuOpen = false;
        }
    }
</script>

<svelte:window onclick={onWindowClick} />

<div class="display-toolbar-wrapper">
    <div class="display-toolbar">
        <!-- Linker Bereich: Fachliche Direktsteuerung (Board, Hardware, Wagenreihung) -->
        <div class="display-toolbar-direct-controls">
            <!-- 1. DB-Board Schnellwahl -->
            <div class="toolbar-control-group" title="DB-Anzeigetyp wählen">
                <span class="toolbar-label">
                    <ZimIcon name="board" size={14} />
                    <span class="label-text">Tafel:</span>
                </span>
                <select 
                    class="toolbar-select board-select" 
                    value={displayConfigStore.layoutType}
                    onchange={(e) => handleLayoutChange(e.currentTarget.value)}
                    aria-label="DB-Anzeigetyp auswählen"
                >
                    {#each LAYOUT_TYPES as lt}
                        <option value={lt.id}>{lt.name}</option>
                    {/each}
                </select>
            </div>

            <!-- 2. Hardware-Monitor Profil -->
            <div class="toolbar-control-group" title="Monitor-Hardwareprofil wählen">
                <span class="toolbar-label">
                    <ZimIcon name="monitors" size={14} />
                    <span class="label-text">Hardware:</span>
                </span>
                <select 
                    class="toolbar-select monitor-select" 
                    value={displayConfigStore.monitorId}
                    onchange={(e) => handleMonitorChange(e.currentTarget.value)}
                    aria-label="Hardware-Monitorprofil auswählen"
                >
                    {#each MONITOR_PROFILES as prof}
                        <option value={prof.id}>{prof.name}</option>
                    {/each}
                </select>
            </div>

            <!-- 3. Wagenreihungs-Modus (auf allen Geräten umschaltbar: Desktop als Buttons, Mobil/Tablet als Dropdown) -->
            {#if displayConfigStore.layoutType === 'zuganzeiger'}
                <div class="toolbar-control-group feature-control-group" title="Wagenreihungs-Anzeige wählen">
                    <span class="toolbar-label">
                        <ZimIcon name="train_fast" size={14} />
                        <span class="label-text">WR:</span>
                    </span>
                    <div class="segment-switch-compact feature-segment-desktop">
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'wagennummern'}
                            onclick={() => handleFeatureChange('wagennummern')}
                            title="Wagennummern anzeigen"
                        >
                            Nummern
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'ausstattung'}
                            onclick={() => handleFeatureChange('ausstattung')}
                            title="Ausstattungs-Piktogramme anzeigen"
                        >
                            Icons
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'klasse'}
                            onclick={() => handleFeatureChange('klasse')}
                            title="Wagenklassen anzeigen"
                        >
                            Klasse
                        </button>
                        <button 
                            type="button" 
                            class="segment-compact-btn" 
                            class:active={activeFeature === 'rotierend'}
                            onclick={() => handleFeatureChange('rotierend')}
                            title="Automatisch rotieren"
                        >
                            Rotierend
                        </button>
                    </div>

                    <div class="feature-select-mobile">
                        <select 
                            class="toolbar-select wr-select" 
                            value={activeFeature}
                            onchange={(e) => handleFeatureChange(e.currentTarget.value)}
                            aria-label="Wagenreihungs-Modus wählen"
                        >
                            <option value="wagennummern">WR: Nummern</option>
                            <option value="ausstattung">WR: Icons</option>
                            <option value="klasse">WR: Klasse</option>
                            <option value="rotierend">WR: Rotierend</option>
                        </select>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Rechter Bereich: Display- & Fenster-Aktionen -->
        <div class="display-toolbar-actions">
            <!-- Status-Tag bei Pop-Out Monitor -->
            {#if targetScreen}
                <span class="target-screen-tag">Monitor {targetScreen}</span>
            {/if}

            <!-- Gehäuse-Toggle (Rahmen & Steg) -->
            <button 
                type="button" 
                class="display-toolbar-btn"
                class:active-btn={displayConfigStore.showBezel}
                onclick={onToggleBezel}
                title={displayConfigStore.showBezel ? 'Gehäuse-Simulation ausblenden (Reiner Canvas)' : 'Gehäuse-Simulation einblenden'}
                aria-label="Gehäuse umschalten"
            >
                <ZimIcon name="eye" size={14} />
                <span>Gehäuse: {displayConfigStore.showBezel ? 'An' : 'Aus'}</span>
            </button>

            <!-- Screenshot Download -->
            <button 
                type="button" 
                class="display-toolbar-btn"
                onclick={onScreenshot}
                title="Screenshot des Monitors herunterladen"
                aria-label="Screenshot herunterladen"
            >
                <ZimIcon name="camera" size={14} />
                <span>Screenshot</span>
            </button>

            <!-- Fit / Scroll Toggle -->
            <button 
                type="button" 
                class="display-toolbar-btn"
                onclick={onToggleScaleMode}
                title={displayScaleMode === 'fit' ? 'Zur scrollbaren Detailansicht (1:1) wechseln' : 'An Bildschirmbreite anpassen (Fit)'}
                aria-label="Display-Skalierung umschalten"
            >
                <ZimIcon name={displayScaleMode === 'fit' ? 'zoom_scroll' : 'zoom_fit'} size={14} />
                <span>{displayScaleMode === 'fit' ? 'Fit' : '1:1'}</span>
            </button>

            <!-- Vollbild-Modus -->
            <button 
                type="button" 
                class="display-toolbar-btn btn-fullscreen"
                onclick={onToggleFullscreen}
                title="In den Vollbildmodus wechseln (F11 / Esc)"
                aria-label="Vollbildmodus"
            >
                <ZimIcon name="fullscreen" size={14} />
                <span>Vollbild</span>
            </button>

            <!-- Multi-Monitor Pop-Out Dropdown (nur Desktop) -->
            <div class="display-toolbar-dropdown-container desktop-only">
                <button 
                    type="button" 
                    class="display-toolbar-btn"
                    onclick={() => monitorMenuOpen = !monitorMenuOpen}
                    title="Monitore in separaten Vollbild-/Kiosk-Fenstern öffnen"
                    aria-expanded={monitorMenuOpen}
                >
                    <ZimIcon name="monitors" size={14} />
                    <span>Monitore ▾</span>
                </button>
                {#if monitorMenuOpen}
                    <div class="display-toolbar-dropdown-menu" role="menu">
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
        </div>
    </div>
</div>

<style>
    .display-toolbar-wrapper {
        width: 100%;
        background: #11141a;
        border-bottom: 1px solid var(--border, #2d3748);
        border-top: 1px solid var(--border, #2d3748);
        box-sizing: border-box;
    }

    .display-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        max-width: 1600px;
        margin: 0 auto;
        padding: 6px 16px;
    }

    .display-toolbar-direct-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .toolbar-control-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .toolbar-label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8rem;
        color: var(--text-muted, #94a3b8);
        font-weight: 600;
        user-select: none;
    }

    .toolbar-select {
        background: var(--bg-input, #1e293b);
        color: var(--text-main, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 4px 8px;
        font-size: 0.82rem;
        cursor: pointer;
        outline: none;
        transition: border-color 0.2s ease;
        max-width: 220px;
    }

    .toolbar-select:focus,
    .toolbar-select:hover {
        border-color: var(--accent, #3b82f6);
    }

    .segment-switch-compact {
        display: inline-flex;
        background: var(--bg-input, #1e293b);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 2px;
        gap: 2px;
    }

    .segment-compact-btn {
        background: transparent;
        border: none;
        color: var(--text-muted, #94a3b8);
        padding: 3px 8px;
        font-size: 0.78rem;
        font-weight: 500;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .segment-compact-btn:hover {
        color: var(--text-main, #f8fafc);
        background: rgba(255, 255, 255, 0.05);
    }

    .segment-compact-btn.active {
        background: var(--accent, #3b82f6);
        color: #fff;
        font-weight: 600;
    }

    .display-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .display-toolbar-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--bg-input, #1e293b);
        color: var(--text-muted, #94a3b8);
        border: 1px solid var(--border, #334155);
        padding: 5px 9px;
        border-radius: var(--radius-sm, 4px);
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
        white-space: nowrap;
    }

    .display-toolbar-btn:hover {
        color: var(--text-main, #f8fafc);
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .display-toolbar-btn.active-btn {
        background: rgba(59, 130, 246, 0.15);
        border-color: var(--accent, #3b82f6);
        color: var(--accent, #3b82f6);
    }

    .target-screen-tag {
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--accent, #3b82f6);
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
        margin-right: 4px;
    }

    .display-toolbar-dropdown-container {
        position: relative;
    }

    .display-toolbar-dropdown-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        background: var(--bg-card, #1e293b);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        padding: 6px;
        min-width: 220px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .dropdown-header {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted, #94a3b8);
        font-weight: 700;
        padding: 4px 8px;
    }

    .dropdown-divider {
        height: 1px;
        background: var(--border, #334155);
        margin: 4px 0;
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 8px;
        background: transparent;
        border: none;
        color: var(--text-main, #f8fafc);
        padding: 6px 8px;
        font-size: 0.82rem;
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: background 0.15s ease;
    }

    .dropdown-item:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
    }

    .feature-select-mobile {
        display: none;
    }

    @media (max-width: 1024px) {
        .feature-segment-desktop {
            display: none !important;
        }
        .feature-select-mobile {
            display: inline-flex !important;
        }
    }

    @media (max-width: 768px) {
        .desktop-only {
            display: none !important;
        }
        .toolbar-select {
            max-width: 130px;
            font-size: 0.8rem;
            padding: 4px 6px;
        }
        .wr-select {
            max-width: 115px;
        }
        .label-text {
            display: none;
        }
        .display-toolbar-btn {
            min-height: 36px;
            min-width: 36px;
            padding: 6px 8px;
            justify-content: center;
        }
        .display-toolbar-btn span {
            display: none;
        }
    }
</style>
