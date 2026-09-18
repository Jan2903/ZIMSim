<script>
    import ZimIcon from './ZimIcon.svelte';

    /**
     * Erstellt einen PNG-Download des aktuellen Canvas-Zustands.
     * @returns {void}
     */
    function downloadScreenshot() {
        const canvas = document.getElementById('zimCanvas');
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `zim_screenshot_${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();
        }
    }
</script>

<header class="page-header">
    <h2>ZugInfoMonitor</h2>
    <div class="header-actions">
        <button id="download-btn" onclick={downloadScreenshot} style="display: inline-flex; align-items: center; gap: 8px;">
            <ZimIcon name="camera" size={18} />
            <span>Screenshot downloaden</span>
        </button>
    </div>
</header>
