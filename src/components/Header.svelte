<script>
    import ZimIcon from './ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {() => void} [onScreenshot] - Callback für den Screenshot-Download
     */
    let { onScreenshot } = $props();

    function handleClick() {
        if (onScreenshot) {
            onScreenshot();
        } else {
            const canvas = document.getElementById('zimCanvas');
            if (canvas) {
                const link = document.createElement('a');
                link.download = `zim_screenshot_${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        }
    }
</script>

<header class="page-header">
    <h2>ZugInfoMonitor</h2>
    <div class="header-actions">
        <button id="download-btn" onclick={handleClick} title="Screenshot downloaden" aria-label="Screenshot downloaden" style="display: inline-flex; align-items: center; gap: 8px;">
            <ZimIcon name="camera" size={18} />
            <span>Screenshot downloaden</span>
        </button>
    </div>
</header>
