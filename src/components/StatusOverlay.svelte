<script>
    import { irisPollingService, irisConfig } from '../js/core/services/irisPollingService.svelte.js';

    let isMinimized = $state(false);
    let isHidden = $state(false); // Neu: Komplett ausblenden

    $effect(() => {
        if (irisPollingService.isActive) {
            isHidden = false;
        }
    });

    function formatTime(date) {
        if (!date) return '--:--:--';
        return date.toLocaleTimeString('de-DE');
    }

    function formatCountdown(secs) {
        if (secs < 0) return '0s';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }
</script>

{#if irisPollingService.isActive && !isHidden}
    <div class="status-overlay" class:minimized={isMinimized}>
        <div class="overlay-header">
            <div class="overlay-header-left">
                <span class="dot {irisConfig.autoUpdateInterval > 0 ? 'active' : 'inactive'}"></span>
                <strong>DB IRIS Live-Status</strong>
            </div>
            <div class="overlay-actions">
                <button class="action-btn" onclick={() => isMinimized = !isMinimized} title={isMinimized ? 'Maximieren' : 'Minimieren'}>
                    {isMinimized ? '▲' : '▼'}
                </button>
                <button class="action-btn close-btn" onclick={() => isHidden = true} title="Schließen">
                    ✕
                </button>
            </div>
        </div>
        
        {#if !isMinimized}
        <div class="section">
            <div class="row">
                <span class="label">Letztes Update:</span>
                <span class="value">{formatTime(irisPollingService.lastPollTime)}</span>
            </div>
            {#if irisConfig.autoUpdateInterval > 0}
            <div class="row">
                <span class="label">Nächster Abruf in:</span>
                <span class="value">{irisPollingService.nextPollSecs}s</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {(irisPollingService.nextPollSecs / irisConfig.autoUpdateInterval) * 100}%"></div>
            </div>
            {:else}
            <div class="row">
                <span class="label">Auto-Update:</span>
                <span class="value" style="color: #ff9800;">Deaktiviert</span>
            </div>
            {/if}
        </div>

        <div class="section">
            <strong>Geplante Ansagen</strong>
            {#if irisPollingService.upcomingAnnouncements.length === 0}
                <div class="empty">Keine anstehenden Ansagen.</div>
            {:else}
                <ul class="announcement-list">
                    {#each irisPollingService.upcomingAnnouncements as ann}
                        <li>
                            <div class="train-info">
                                <span class="train-name">{ann.name}</span>
                                <span class="train-dest">({ann.type})</span>
                            </div>
                            <div class="countdown-badge">
                                in {formatCountdown(ann.countdown)}
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
            {#if !irisConfig.autoAnnouncements}
                <div class="empty warning">Autoplay in den Settings deaktiviert.</div>
            {/if}
        </div>
        {/if}
    </div>
{/if}

<style>
    .status-overlay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(20, 20, 25, 0.95);
        border: 1px solid #333;
        border-radius: 8px;
        width: 320px;
        z-index: 9998; /* just below Modals */
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        color: #eee;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        backdrop-filter: blur(10px);
        overflow: hidden;
        font-size: 0.9rem;
        transition: all 0.3s ease;
        box-sizing: border-box;
    }
    
    .status-overlay.minimized {
        width: 250px;
    }
    
    .overlay-header {
        background: rgba(0, 0, 0, 0.3);
        padding: 10px 15px;
        border-bottom: 1px solid #333;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-sizing: border-box;
    }
    
    .overlay-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .overlay-actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .action-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #ddd;
        cursor: pointer;
        font-size: 0.85em;
        padding: 3px 6px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
    }
    
    .action-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
    }
    
    .close-btn:hover {
        background: rgba(244, 67, 54, 0.3);
        color: #ffcccc;
    }
    
    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
    }
    
    .dot.active {
        background-color: #4CAF50;
        box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
    }
    
    .dot.inactive {
        background-color: #ff9800;
    }
    
    .section {
        padding: 12px 15px;
        border-bottom: 1px solid #2a2a2a;
    }
    
    .section:last-child {
        border-bottom: none;
    }
    
    .row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
    }
    
    .label {
        color: #aaa;
    }
    
    .progress-bar {
        height: 4px;
        background: #333;
        border-radius: 2px;
        margin-top: 8px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: #4dabf7;
        transition: width 1s linear;
    }
    
    .announcement-list {
        list-style: none;
        padding: 0;
        margin: 10px 0 0 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .announcement-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255,255,255,0.05);
        padding: 6px 10px;
        border-radius: 4px;
    }
    
    .train-info {
        display: flex;
        flex-direction: column;
    }
    
    .train-name {
        font-weight: 600;
        color: #fff;
    }
    
    .train-dest {
        font-size: 0.8em;
        color: #999;
    }
    
    .countdown-badge {
        background: rgba(77, 171, 247, 0.2);
        color: #4dabf7;
        padding: 3px 6px;
        border-radius: 4px;
        font-size: 0.85em;
        font-family: monospace;
    }
    
    .empty {
        color: #777;
        font-size: 0.9em;
        margin-top: 10px;
        font-style: italic;
    }
    
    .empty.warning {
        color: #ff9800;
    }
</style>
