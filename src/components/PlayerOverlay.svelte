<script>
    import { ansagenPlayer } from '../js/utils/ansagenPlayer.svelte.js';

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
                {#if ansagenPlayer.isPlaying}
                    <span class="playing-icon">🔊</span>
                {:else}
                    <span class="playing-icon">⏹</span>
                {/if}
                <span class="progress">{ansagenPlayer.progressText}</span>
                <span class="filename" title={ansagenPlayer.currentFile}>
                    {ansagenPlayer.currentFile ? ansagenPlayer.currentFile.split('/').pop() : ''}
                </span>
            </div>
            
            <div class="subtitle-text">
                {ansagenPlayer.currentText || '...'}
            </div>

            <div class="player-controls">
                <button class="btn-primary btn-sm" onclick={handleReplay} title="Neu starten">
                    {ansagenPlayer.isPlaying ? '↻ Neustart' : '▶ Play'}
                </button>
                <button class="btn-secondary btn-sm" onclick={() => ansagenPlayer.stop()} disabled={!ansagenPlayer.isPlaying}>
                    ⏹ Stop
                </button>
                <button class="btn-secondary btn-sm" onclick={() => ansagenPlayer.exportWav()} title="Als WAV Datei speichern">
                    💾 WAV Export
                </button>
                <button class="btn-secondary btn-sm" onclick={() => { ansagenPlayer.stop(); ansagenPlayer.playlist = []; }} title="Player schließen">
                    ✕
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
        min-width: 400px;
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
        color: #4dabf7;
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
        font-size: 1.4em;
        font-weight: bold;
        margin-bottom: 15px;
        min-height: 1.5em;
        color: #fff;
    }
    
    .player-controls {
        display: flex;
        justify-content: center;
        gap: 10px;
    }
</style>
