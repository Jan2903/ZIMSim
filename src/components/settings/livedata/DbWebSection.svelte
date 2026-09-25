<!-- src/components/settings/livedata/DbWebSection.svelte -->
<script>
    import ZimIcon from '../../ZimIcon.svelte';
</script>

<div class="form-row column-layout">
    <div class="info-card">
        <div class="info-header">
            <span class="badge-status">In Vorbereitung</span>
            <h4>DBweb (bahn.de Web API)</h4>
        </div>
        <p class="info-desc">
            Die <strong>DBweb-Schnittstelle</strong> wird als künftiger nativer Datenprovider für ZIMSim angebunden. Sie nutzt die moderne Web-API der bahn.de Reiseauskunft.
        </p>
    </div>

    <div class="features-list">
        <div class="field-label">Geplante Funktionen:</div>
        <div class="feature-item">
            <ZimIcon name="train" size={16} />
            <div>
                <strong>Echtzeit-Fahrplandaten & Reiseauskunft</strong>
                <p>Abfahrts- und Ankunftstafeln direkt über die Web-Endpunkte von bahn.de.</p>
            </div>
        </div>
        <div class="feature-item">
            <ZimIcon name="train_fast" size={16} />
            <div>
                <strong>Wagenreihungen & Formationen</strong>
                <p>Abruf von Zugformationen und Wagenständen für Fern- und Regionalzüge.</p>
            </div>
        </div>
        <div class="feature-item">
            <ZimIcon name="api" size={16} />
            <div>
                <strong>Browser-optimierte Abfragen</strong>
                <p>Alternative zu DB Navigator Vendo mit optimiertem Zugriff im Web-Modus.</p>
            </div>
        </div>
    </div>

    <div class="notice-box">
        <ZimIcon name="info" size={16} />
        <span>Aktuell stehen für den Produktivbetrieb <strong>DB IRIS</strong> (Fahrplan) und <strong>DB Navigator</strong> (Wagenreihung) zur Verfügung.</span>
    </div>
</div>

<style>
    .info-card {
        padding: 14px;
        background: rgba(59, 130, 246, 0.08);
        border: 1px solid rgba(59, 130, 246, 0.25);
        border-radius: 6px;
        margin-bottom: 14px;
    }

    .info-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
    }

    .info-header h4 {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-main, #f8fafc);
    }

    .badge-status {
        font-size: 0.72rem;
        background: rgba(245, 158, 11, 0.18);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.35);
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .info-desc {
        margin: 0;
        font-size: 0.82rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.45;
    }

    .features-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 14px;
    }

    .field-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
    }

    .feature-item {
        display: flex;
        gap: 10px;
        padding: 10px 12px;
        background: var(--bg-input, #0f172a);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        align-items: flex-start;
    }

    .feature-item strong {
        display: block;
        font-size: 0.84rem;
        color: var(--text-main, #f8fafc);
        margin-bottom: 2px;
    }

    .feature-item p {
        margin: 0;
        font-size: 0.76rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.35;
    }

    .notice-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        line-height: 1.4;
    }
</style>
