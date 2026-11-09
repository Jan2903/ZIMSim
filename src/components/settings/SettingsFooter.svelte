<!-- src/components/settings/SettingsFooter.svelte -->
<script>
    import { version } from '../../../package.json';
</script>

<footer class="settings-footer">
    <div class="footer-badge">BETA / PREVIEW</div>
    <div class="footer-disclaimer">
        Keine offizielle Fahrgastinformation. Nur zur privaten Nutzung.
        Keine Verbindung und kein Produkt der DB.
    </div>
    <div class="footer-links">
        <a href="https://github.com/Jan2903/ZIMSim" target="_blank" rel="noopener noreferrer">
            GitHub-Repository
        </a>
        {#if version}
            <span class="footer-separator">|</span>
            <span class="footer-version">v{version}</span>
        {/if}
    </div>
</footer>

<style>
    .settings-footer {
        margin-top: 32px;
        padding: 16px 18px;
        border-top: 1px solid var(--border, #334155);
        background: var(--bg-card, #1e293b);
        font-size: 0.72rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.5;
    }

    .footer-badge {
        display: inline-block;
        margin-bottom: 6px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--accent, #3b82f6);
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 3px;
        padding: 2px 8px;
    }

    .footer-disclaimer {
        margin-bottom: 10px;
        font-style: italic;
    }

    .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
    }

    .footer-links a {
        color: var(--accent, #3b82f6);
        text-decoration: none;
    }

    .footer-links a:hover {
        text-decoration: underline;
    }

    .footer-separator {
        opacity: 0.5;
    }

    .footer-version {
        opacity: 0.6;
    }
</style>
