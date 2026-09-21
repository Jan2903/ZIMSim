<script>
    import { irisPollingService, irisConfig } from '../js/core/services/irisPollingService.svelte.js';
    import { announcementQueueService } from '../js/audio/announcementQueueService.svelte.js';
    import ZimIcon from './ZimIcon.svelte';

    let isMinimized = $state(false);
    let isHidden = $state(false);
    let activeTab = $state('live'); // 'live' | 'history'

    $effect(() => {
        if (irisPollingService.isActive) {
            isHidden = false;
        }
    });

    function formatTime(date) {
        if (!date) return '--:--:--';
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleTimeString('de-DE');
    }

    function formatCountdown(secs) {
        if (secs < 0) return '0s';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function getPriorityColor(prio) {
        if (prio >= 100) return '#4caf50'; // Grün: Einfahrt
        if (prio >= 90) return '#f44336';  // Rot: Ausfall
        if (prio >= 75) return '#ff9800';  // Orange: Gleiswechsel
        if (prio >= 70) return '#ffb74d';  // Gelb-Orange: Haltänderung
        if (prio >= 50) return '#e0a800';  // Gelb: Verspätung
        return '#64b5f6';                  // Blau: Reminder
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
                    <ZimIcon name={isMinimized ? 'chevron_up' : 'chevron_down'} size={14} />
                </button>
                <button class="action-btn close-btn" onclick={() => isHidden = true} title="Schließen">
                    <ZimIcon name="close" size={14} />
                </button>
            </div>
        </div>
        
        {#if !isMinimized}
        <!-- Tab Navigation -->
        <div class="tab-bar">
            <button class="tab-btn" class:active={activeTab === 'live'} onclick={() => activeTab = 'live'}>
                Live & Queue
                {#if announcementQueueService.queue.length > 0}
                    <span class="tab-badge">{announcementQueueService.queue.length}</span>
                {/if}
            </button>
            <button class="tab-btn" class:active={activeTab === 'history'} onclick={() => activeTab = 'history'}>
                Verlauf
                {#if announcementQueueService.history.length > 0}
                    <span class="tab-badge secondary">{announcementQueueService.history.length}</span>
                {/if}
            </button>
        </div>

        <div class="status-overlay-body">
            {#if activeTab === 'live'}
                <!-- Polling Status -->
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

                <!-- Warteschlange -->
                <div class="section">
                    <div class="section-title-row">
                        <strong>Warteschlange (Priorisiert)</strong>
                        <span class="count-badge">{announcementQueueService.queue.length}</span>
                    </div>
                    {#if announcementQueueService.queue.length === 0}
                        <div class="empty">Keine wartenden Ansagen.</div>
                    {:else}
                        <ul class="queue-list">
                            {#each announcementQueueService.queue as qItem}
                                <li class="queue-item">
                                    <div class="queue-header">
                                        <span class="prio-tag" style="background: {getPriorityColor(qItem.priority)}22; color: {getPriorityColor(qItem.priority)}; border: 1px solid {getPriorityColor(qItem.priority)}55;">
                                            P{qItem.priority}
                                        </span>
                                        <span class="train-name">{qItem.trainName || qItem.journeyId}</span>
                                        <span class="item-type">{qItem.label || qItem.type}</span>
                                    </div>
                                    {#if qItem.textSummary}
                                        <div class="queue-preview">{qItem.textSummary}</div>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>

                <!-- Geplante Einfahrten -->
                <div class="section">
                    <strong>Nächste Einfahrten</strong>
                    {#if irisPollingService.upcomingAnnouncements.length === 0}
                        <div class="empty">Keine anstehenden Einfahrten.</div>
                    {:else}
                        <ul class="announcement-list">
                            {#each irisPollingService.upcomingAnnouncements as ann}
                                <li>
                                    <div class="train-info">
                                        <span class="train-name">{ann.name}</span>
                                        <span class="train-dest">{ann.dest}</span>
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

            {:else if activeTab === 'history'}
                <!-- Verlauf (Historie) -->
                <div class="section">
                    <div class="section-title-row">
                        <strong>Abgespielte Ansagen</strong>
                        {#if announcementQueueService.history.length > 0}
                            <button class="clear-btn" onclick={() => announcementQueueService.clearHistory()} title="Verlauf leeren">
                                Leeren
                            </button>
                        {/if}
                    </div>
                    {#if announcementQueueService.history.length === 0}
                        <div class="empty">Bisher keine Ansagen im Verlauf.</div>
                    {:else}
                        <ul class="history-list">
                            {#each announcementQueueService.history as hItem}
                                <li class="history-item">
                                    <div class="history-meta">
                                        <span class="history-time">{formatTime(hItem.playedAt)}</span>
                                        <span class="train-name">{hItem.trainName}</span>
                                        <span class="history-tag">{hItem.label || hItem.type}</span>
                                        <button class="replay-btn" onclick={() => announcementQueueService.replay(hItem)} title="Erneut abspielen">
                                            <ZimIcon name="play" size={11} />
                                        </button>
                                    </div>
                                    {#if hItem.textSummary}
                                        <div class="history-text">{hItem.textSummary}</div>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
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
        background: rgba(20, 20, 25, 0.96);
        border: 1px solid #383838;
        border-radius: 8px;
        width: 340px;
        max-height: calc(100vh - 100px);
        z-index: 9998;
        box-shadow: 0 10px 30px rgba(0,0,0,0.7);
        color: #eee;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        backdrop-filter: blur(12px);
        overflow: hidden;
        font-size: 0.88rem;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
    }
    
    .status-overlay.minimized {
        width: 250px;
    }

    .status-overlay-body {
        overflow-y: auto;
        flex: 1;
        max-height: calc(100vh - 175px);
    }
    
    .overlay-header {
        background: rgba(0, 0, 0, 0.4);
        padding: 9px 14px;
        border-bottom: 1px solid #333;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-sizing: border-box;
        flex-shrink: 0;
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
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
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
        background: rgba(255, 255, 255, 0.16);
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

    .tab-bar {
        display: flex;
        background: rgba(0, 0, 0, 0.25);
        border-bottom: 1px solid #2e2e2e;
        flex-shrink: 0;
    }

    .tab-btn {
        flex: 1;
        padding: 7px 10px;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: #888;
        cursor: pointer;
        font-size: 0.82rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
    }

    .tab-btn:hover {
        color: #ddd;
        background: rgba(255, 255, 255, 0.03);
    }

    .tab-btn.active {
        color: #4dabf7;
        border-bottom-color: #4dabf7;
        background: rgba(77, 171, 247, 0.08);
        font-weight: 600;
    }

    .tab-badge {
        background: #4dabf7;
        color: #000;
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 0.75em;
        font-weight: bold;
    }

    .tab-badge.secondary {
        background: #555;
        color: #eee;
    }
    
    .section {
        padding: 10px 14px;
        border-bottom: 1px solid #272727;
    }
    
    .section:last-child {
        border-bottom: none;
    }

    .section-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
    }
    
    .row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
    }
    
    .label {
        color: #aaa;
    }

    .count-badge {
        font-size: 0.78em;
        background: rgba(255, 255, 255, 0.1);
        padding: 1px 6px;
        border-radius: 4px;
        color: #bbb;
    }

    .clear-btn {
        background: transparent;
        border: 1px solid #444;
        color: #999;
        font-size: 0.75em;
        padding: 2px 7px;
        border-radius: 4px;
        cursor: pointer;
    }

    .clear-btn:hover {
        background: rgba(244, 67, 54, 0.2);
        color: #ff8888;
        border-color: #f44336;
    }
    
    .progress-bar {
        height: 4px;
        background: #333;
        border-radius: 2px;
        margin-top: 6px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: #4dabf7;
        transition: width 1s linear;
    }

    .queue-list, .history-list {
        list-style: none;
        padding: 0;
        margin: 6px 0 0 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .queue-item, .history-item {
        background: rgba(255, 255, 255, 0.04);
        padding: 6px 9px;
        border-radius: 4px;
        border-left: 2px solid #4dabf7;
    }

    .queue-header, .history-meta {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .prio-tag {
        font-size: 0.72em;
        font-weight: 700;
        padding: 1px 4px;
        border-radius: 3px;
    }

    .queue-preview, .history-text {
        font-size: 0.78em;
        color: #aaa;
        margin-top: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .history-time {
        font-size: 0.76em;
        color: #888;
        font-family: monospace;
    }

    .history-tag {
        font-size: 0.75em;
        color: #ffb74d;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .replay-btn {
        background: rgba(77, 171, 247, 0.15);
        border: 1px solid rgba(77, 171, 247, 0.3);
        color: #4dabf7;
        border-radius: 3px;
        padding: 2px 5px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: auto;
    }

    .replay-btn:hover {
        background: #4dabf7;
        color: #000;
    }
    
    .announcement-list {
        list-style: none;
        padding: 0;
        margin: 8px 0 0 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    
    .announcement-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.04);
        padding: 5px 9px;
        border-radius: 4px;
    }
    
    .train-info {
        display: flex;
        flex-direction: column;
    }
    
    .train-name {
        font-weight: 600;
        color: #fff;
        font-size: 0.9em;
    }
    
    .train-dest, .item-type {
        font-size: 0.78em;
        color: #aaa;
    }
    
    .countdown-badge {
        background: rgba(77, 171, 247, 0.18);
        color: #4dabf7;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.8em;
        font-family: monospace;
    }
    
    .empty {
        color: #777;
        font-size: 0.85em;
        margin-top: 6px;
        font-style: italic;
    }
    
    .empty.warning {
        color: #ff9800;
    }

    @media (max-width: 600px) {
        .status-overlay {
            right: 12px;
            left: 12px;
            width: auto;
            bottom: 12px;
        }
        .status-overlay.minimized {
            left: auto;
            right: 12px;
            width: 220px;
        }
    }
</style>
