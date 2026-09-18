<script>
    import { ansagenPlayer } from '../js/audio/ansagenPlayer.svelte.js';
    import ZimIcon from './ZimIcon.svelte';

    /**
     * Startet die Wiedergabe der aktuellen Playlist erneut.
     * @returns {void}
     */
    function handleReplay() {
        if (ansagenPlayer.playlist.length > 0) {
            ansagenPlayer.play(ansagenPlayer.playlist);
        }
    }
</script>

{#if ansagenPlayer.isPlaying || ansagenPlayer.playlist.length > 0}
    <div class="player-overlay">
        <div class="player-content">
            <div class="player-status">
                <span class="playing-icon">
                    <ZimIcon name={ansagenPlayer.isPlaying ? 'volume_high' : 'stop'} size={16} color={ansagenPlayer.isPlaying ? '#4dabf7' : '#aaa'} />
                </span>
                <span class="progress">{ansagenPlayer.progressText}</span>
                {#if ansagenPlayer.currentFile}
                <span class="filename" title={ansagenPlayer.currentFile}>
                    {ansagenPlayer.currentFile.split('/').pop()}
                </span>
                {/if}
            </div>
            
            <div class="subtitle-text">
                {ansagenPlayer.currentText || '...'}
            </div>

            <div class="player-controls">
                <button class="btn-primary btn-sm" onclick={handleReplay} title="Neu starten" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                    <ZimIcon name={ansagenPlayer.isPlaying ? 'restart' : 'play'} size={14} />
                    <span>{ansagenPlayer.isPlaying ? 'Neustart' : 'Play'}</span>
                </button>
                <button class="btn-secondary btn-sm" onclick={() => ansagenPlayer.stop()} disabled={!ansagenPlayer.isPlaying} style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                    <ZimIcon name="stop" size={14} />
                    <span>Stop</span>
                </button>
                <button class="btn-secondary btn-sm" onclick={() => ansagenPlayer.exportWav()} title="Als WAV Datei speichern" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                    <ZimIcon name="save" size={14} />
                    <span>WAV Export</span>
                </button>
                <button class="btn-secondary btn-sm" onclick={() => { ansagenPlayer.stop(); ansagenPlayer.playlist = []; }} title="Player schließen" style="display: inline-flex; align-items: center; justify-content: center; width: 34px; padding: 0;">
                    <ZimIcon name="close" size={14} />
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .player-overlay {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 15, 15, 0.95);
        border: 1px solid #444;
        border-radius: 8px;
        padding: 15px 25px;
        z-index: 9999;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        color: white;
        width: calc(100% - 32px);
        max-width: 520px;
        box-sizing: border-box;
        text-align: center;
        backdrop-filter: blur(10px);
    }
    
    .player-status {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 15px;
        font-size: 0.85em;
        opacity: 0.7;
        margin-bottom: 8px;
    }
    
    .playing-icon {
        display: flex;
        align-items: center;
    }
    
    .filename {
        font-family: monospace;
        background: rgba(255,255,255,0.1);
        padding: 2px 6px;
        border-radius: 4px;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .subtitle-text {
        font-size: 1.3em;
        font-weight: bold;
        margin-bottom: 15px;
        min-height: 1.5em;
        color: #fff;
    }
    
    .player-controls {
        display: flex;
        justify-content: center;
        gap: 8px;
    }

    @media (max-width: 600px) {
        .player-overlay {
            bottom: 10px;
            padding: 12px 14px;
        }
        .subtitle-text {
            font-size: 1.1em;
            margin-bottom: 10px;
        }
        .player-controls {
            flex-wrap: wrap;
            gap: 6px;
        }
        .player-controls button {
            flex: 1 1 calc(50% - 6px);
            min-height: 40px;
        }
        .player-controls button:last-child {
            flex: 0 0 36px;
        }
    }
</style>
