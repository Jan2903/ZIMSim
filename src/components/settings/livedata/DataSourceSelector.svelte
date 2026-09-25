<!-- src/components/settings/livedata/DataSourceSelector.svelte -->
<script>
    import { isTauri, isGitHubPages, proxyConfig, checkProxyHealth } from '../../../js/core/services/apiClient.js';
    import { liveDataConfig } from '../../../js/core/state/liveDataConfig.svelte.js';
    import ZimIcon from '../../ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {string} selectedDataSource - Aktive Datenquelle ('iris' | 'db_navigator' | 'dbweb')
     * @property {(source: string) => void} [onSelectSource] - Optionaler Callback bei Wechsel der Datenquelle
     */
    let { selectedDataSource = $bindable('iris'), onSelectSource } = $props();

    // Status und Konfiguration fuer lokalen Python-Proxy (ZIMSim Bridge) - strikt Opt-In
    let proxyEnabled = $state(proxyConfig.enabled);
    let proxyUrl = $state(proxyConfig.url);
    let isCheckingProxy = $state(false);
    let proxyStatus = $state(null);

    /**
     * Prüft die Verbindung zum lokalen Python-Proxy (ZIMSim Bridge) explizit auf Nutzeraktion.
     * @returns {Promise<void>}
     */
    async function checkProxy() {
        isCheckingProxy = true;
        try {
            const res = await checkProxyHealth(proxyUrl);
            proxyStatus = res;
            if (res.connected) {
                proxyConfig.enabled = true;
                proxyEnabled = true;
            }
        } finally {
            isCheckingProxy = false;
        }
    }

    /**
     * Schaltet den lokalen Python-Proxy explizit ein oder aus (Opt-In).
     * @returns {Promise<void>}
     */
    async function handleProxyToggle() {
        proxyConfig.enabled = proxyEnabled;
        if (proxyEnabled) {
            await checkProxy();
        } else {
            proxyStatus = null;
        }
    }

    /**
     * Setzt die aktive Schnittstelle und informiert übergeordnete Listener.
     * @param {string} source
     */
    function handleSelect(source) {
        selectedDataSource = source;
        liveDataConfig.timetableSource = source;
        onSelectSource?.(source);
    }
</script>

<div class="settings-card">
    <div class="card-header">
        <ZimIcon name="api" size={18} />
        <h3>Datenquelle & Schnittstelle</h3>
    </div>
    <div class="card-body">
        <!-- Datenquellen-Segment -->
        <div class="field-label">Aktive Schnittstelle / Profil:</div>
        <div class="source-selector">
            <label class="source-card" class:active={selectedDataSource === 'iris'}>
                <input type="radio" name="data_source" value="iris" bind:group={selectedDataSource} onchange={() => handleSelect('iris')}>
                <div class="source-title">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <ZimIcon name="train" size={16} />
                        <strong>DB IRIS (Timetable API)</strong>
                    </div>
                    <span class="source-badge badge-rec">Standard / Empfohlen</span>
                </div>
                <div class="source-desc">
                    Offizielle Echtzeit-Fahrplandaten für DB Fern- und Regionalverkehr. Direkt im Browser und Desktop verfügbar.
                </div>
            </label>

            <label class="source-card" class:active={selectedDataSource === 'db_navigator'}>
                <input type="radio" name="data_source" value="db_navigator" bind:group={selectedDataSource} onchange={() => handleSelect('db_navigator')}>
                <div class="source-title">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <ZimIcon name="train_fast" size={16} />
                        <strong>DB Navigator (Vendo API)</strong>
                    </div>
                    <span class="source-badge badge-nav">Wagenreihung & ÖPNV</span>
                </div>
                <div class="source-desc">
                    Erweiterte Fahrplandetails, Zwischenhalte, Ankunft & Abfahrt kombiniert sowie Wagenreihungen (Formationen).
                </div>
            </label>

            <label class="source-card" class:active={selectedDataSource === 'dbweb'}>
                <input type="radio" name="data_source" value="dbweb" bind:group={selectedDataSource} onchange={() => handleSelect('dbweb')}>
                <div class="source-title">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <ZimIcon name="api" size={16} />
                        <strong>DBweb (bahn.de Web)</strong>
                    </div>
                    <span class="source-badge badge-web">Live-Fahrplan & Wagenreihung</span>
                </div>
                <div class="source-desc">
                    Moderne bahn.de Reiselösungs-API für Echtzeit-Abfahrten, Zwischenhalte und detaillierte Wagenreihungen.
                </div>
            </label>
        </div>

        <!-- Plattform- und CORS-Status-Banner -->
        <div class="platform-status-box" class:tauri-mode={isTauri} class:web-mode={!isTauri}>
            <div class="status-indicator">
                <span class="status-dot"></span>
                <strong>{isTauri ? 'Tauri Desktop-App aktiv' : 'Web-Browser Modus'}</strong>
            </div>
            <div class="status-details">
                {#if isTauri}
                    Native HTTP-Sockets aktiv. Keine CORS-Einschränkungen für externe APIs (IRIS und DB Navigator direkt nutzbar).
                {:else if isGitHubPages}
                    Gehostet auf GitHub Pages. IRIS-API ist direkt verfügbar. DB Navigator erfordert die lokale Python-Bridge oder Tauri.
                {:else}
                    Lokale Browser-Umgebung. IRIS ist direkt aktiv. DB Navigator erfordert die lokale Python-Bridge oder Tauri.
                {/if}
            </div>
        </div>

        {#if !isTauri}
            <!-- Lokaler Python-Proxy (ZIMSim Bridge) -->
            <div class="proxy-config-card" style="margin-top: 14px; padding: 12px; border-radius: 6px; border: 1px solid var(--border); background: rgba(0, 0, 0, 0.25);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <ZimIcon name="api" size={16} />
                        <strong style="font-size: 0.9rem;">Python-Proxy (ZIMSim Bridge)</strong>
                    </div>
                    {#if !proxyEnabled}
                        <span class="badge" style="background: rgba(148, 163, 184, 0.12); color: var(--text-muted); border: 1px solid var(--border); font-size: 0.72rem;">
                            Deaktiviert
                        </span>
                    {:else if proxyStatus?.connected}
                        <span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); font-size: 0.72rem;">
                            Verbunden ({proxyStatus.info?.version || 'v1.0'})
                        </span>
                    {:else}
                        <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.72rem;">
                            Nicht erreichbar
                        </span>
                    {/if}
                </div>

                <div class="checkbox-group" style="margin-bottom: 8px;">
                    <label class="checkbox-label">
                        <input 
                            type="checkbox" 
                            bind:checked={proxyEnabled}
                            onchange={handleProxyToggle}
                        >
                        <span>Lokalen Proxy im Browser aktivieren (Opt-In)</span>
                    </label>
                </div>

                <div style="display: flex; gap: 6px; align-items: center;">
                    <input 
                    type="text" 
                    class="form-input" 
                    style="font-size: 0.8rem; padding: 6px 10px;"
                    bind:value={proxyUrl} 
                    onchange={() => { proxyConfig.url = proxyUrl; }}
                    placeholder="http://127.0.0.1:8765"
                    >
                    <button 
                        type="button" 
                        class="btn-secondary btn-sm" 
                        onclick={checkProxy} 
                        disabled={isCheckingProxy}
                        style="white-space: nowrap;"
                    >
                        {isCheckingProxy ? 'Prüfe...' : 'Testen'}
                    </button>
                </div>

                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; line-height: 1.4;">
                    Start per Doppelklick auf <code style="color: var(--accent); background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px;">scripts/start_bridge.bat</code> auf Windows.
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .settings-card {
        background: var(--bg-card, #1e293b);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-md, 8px);
        overflow: hidden;
        box-shadow: var(--shadow-card, 0 4px 12px rgba(0, 0, 0, 0.2));
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid var(--border, #334155);
    }

    .card-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-main, #f8fafc);
    }

    .card-body {
        padding: 18px;
    }

    .field-label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
        margin-bottom: 6px;
    }

    .source-selector {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
    }

    .source-card {
        display: flex;
        flex-direction: column;
        padding: 12px 14px;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .source-card:hover {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .source-card.active {
        border-color: var(--accent, #3b82f6);
        background: rgba(59, 130, 246, 0.08);
    }

    .source-card input {
        display: none;
    }

    .source-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 0.88rem;
        color: var(--text-main, #f8fafc);
        margin-bottom: 4px;
    }

    .source-desc {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.4;
    }

    .source-badge {
        font-size: 0.68rem;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
        white-space: nowrap;
    }

    .badge-rec {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(52, 211, 153, 0.25);
    }

    .badge-nav {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        border: 1px solid rgba(96, 165, 250, 0.25);
    }

    .badge-web {
        background: rgba(168, 85, 247, 0.15);
        color: #c084fc;
        border: 1px solid rgba(192, 132, 252, 0.25);
    }

    .badge-prep {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.25);
    }

    .badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
    }

    .platform-status-box {
        border-radius: 6px;
        padding: 12px;
        border: 1px solid var(--border, #334155);
        background: rgba(0, 0, 0, 0.25);
    }

    .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.84rem;
        color: var(--text-main, #f8fafc);
        margin-bottom: 6px;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
    }

    .web-mode .status-dot {
        background: #f59e0b;
    }

    .status-details {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.45;
    }

    .form-input {
        width: 100%;
        background: var(--bg-input, #0f172a);
        color: var(--text-main, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-sm, 4px);
        padding: 8px 12px;
        font-size: 0.85rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s ease;
    }

    .form-input:focus {
        border-color: var(--accent, #3b82f6);
    }
</style>
