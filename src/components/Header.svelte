<script>
    import { onMount } from 'svelte';
    
    // Screenshot functionality was previously in events.js
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
        <button id="download-btn" onclick={downloadScreenshot}>Screenshot downloaden</button>
    </div>
</header>
