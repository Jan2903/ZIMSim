<!-- src/components/settings/PlatformEditor.svelte -->
<script>
    import { journeyStore, trainDisplay } from '../../js/core/state/stores.js';
    import { AVAILABLE_SECTOR_LETTERS } from '../../js/features/station/platform.svelte.js';
    import ZimIcon from '../ZimIcon.svelte';

    // Reaktiver Zugriff auf die aktive Bahnsteigkonfiguration
    let activePlatformName = $derived(journeyStore.stationContext.activePlatformName || 'default');
    let platformKeys = $derived(Object.keys(journeyStore.platforms));
    let platform = $derived(
        journeyStore.stationContext.platform || 
        journeyStore.platforms[activePlatformName] || 
        journeyStore.platforms['default'] ||
        Object.values(journeyStore.platforms)[0]
    );

    // Plattform-Verwaltung (Neu & Umbenennen)
    let isCreatingNew = $state(false);
    let newPlatformName = $state('');
    let isRenaming = $state(false);
    let renamePlatformValue = $state('');

    // Nächster verfügbarer Sektor-Buchstabe (A bis K)
    let nextLetter = $derived(platform ? platform.getNextAvailableLetter() : null);

    // ZIM Standort Pin Position
    let zimTotalLen = $derived(Math.max(1, platform?.length || 400));
    let zimPct = $derived(Math.max(0, Math.min(100, (Number(platform?.currentLocation || 0) / zimTotalLen) * 100)));

    /**
     * Wählt einen anderen Bahnsteig aus der Liste.
     * @param {Event} e
     */
    function onSelectPlatform(e) {
        const selected = e.currentTarget.value;
        if (selected) {
            journeyStore.selectPlatform(selected);
            trainDisplay.updateAll();
        }
    }

    /**
     * Startet das Erstellen eines neuen Bahnsteigs.
     */
    function startCreatePlatform() {
        isCreatingNew = true;
        isRenaming = false;
        newPlatformName = '';
    }

    /**
     * Bestätigt das Anlegen eines neuen Bahnsteigs.
     */
    function confirmCreatePlatform() {
        const name = newPlatformName.trim();
        if (name) {
            journeyStore.addPlatform(name);
            trainDisplay.updateAll();
        }
        isCreatingNew = false;
        newPlatformName = '';
    }

    /**
     * Bricht die Neuerstellung ab.
     */
    function cancelCreatePlatform() {
        isCreatingNew = false;
        newPlatformName = '';
    }

    /**
     * Startet das Umbenennen des aktuellen Bahnsteigs.
     */
    function startRenamePlatform() {
        renamePlatformValue = activePlatformName;
        isRenaming = true;
        isCreatingNew = false;
    }

    /**
     * Bestätigt die Umbenennung.
     */
    function confirmRenamePlatform() {
        const newName = renamePlatformValue.trim();
        if (newName && newName !== activePlatformName) {
            journeyStore.renamePlatform(activePlatformName, newName);
            trainDisplay.updateAll();
        }
        isRenaming = false;
        renamePlatformValue = '';
    }

    /**
     * Bricht das Umbenennen ab.
     */
    function cancelRenamePlatform() {
        isRenaming = false;
        renamePlatformValue = '';
    }

    /**
     * Svelte-Action für barrierefreies Fokussieren von Eingabefeldern bei Öffnung
     */
    function autoFocus(node) {
        node.focus();
    }

    /**
     * Dupliziert den aktuellen Bahnsteig.
     */
    function duplicatePlatform() {
        journeyStore.duplicatePlatform(activePlatformName);
        trainDisplay.updateAll();
    }

    /**
     * Löscht den aktuellen Bahnsteig nach Bestätigung.
     */
    function deletePlatform() {
        const keys = Object.keys(journeyStore.platforms);
        if (keys.length <= 1) return;

        const confirmMsg = `Bahnsteig-Konfiguration "${activePlatformName}" wirklich entfernen?`;
        if (window.confirm(confirmMsg)) {
            journeyStore.removePlatform(activePlatformName);
            trainDisplay.updateAll();
        }
    }

    /**
     * Fügt einen neuen Abschnitt hinzu.
     */
    function addSection() {
        if (!platform) return;
        platform.addSection();
        trainDisplay.updateAll();
    }

    /**
     * Entfernt einen Abschnitt am angegebenen Index.
     * @param {number} idx
     */
    function removeSection(idx) {
        if (!platform || platform.sections.length <= 1) return;
        platform.removeSection(idx);
        trainDisplay.updateAll();
    }

    /**
     * Verteilt alle vorhandenen Abschnitte gleichmäßig.
     */
    function distributeEvenly() {
        if (!platform) return;
        platform.distributeEvenly();
        trainDisplay.updateAll();
    }

    /**
     * Richtet alle Abschnitte nahtlos aneinander aus.
     */
    function alignSeamlessly() {
        if (!platform) return;
        platform.alignSeamlessly();
        trainDisplay.updateAll();
    }

    /**
     * Setzt Abschnitte auf den klassischen DB-Standard A–E zurück.
     */
    function resetToDefault() {
        if (!platform) return;
        platform.resetToDefault();
        trainDisplay.updateAll();
    }

    /**
     * Aktualisiert die Würfel-Position für einen Abschnitt.
     * Wenn der Wert leer ist, wird cubePosition auf null gesetzt (Fallback auf automatische Mitte).
     * @param {object} sec
     * @param {string} val
     */
    function updateCubePosition(sec, val) {
        const trimmed = (val || '').trim();
        sec.cubePosition = trimmed === '' ? null : Number(trimmed);
        trainDisplay.updateAll();
    }
</script>

<div class="platform-editor">
    <!-- 1. Bahnsteig-Profil Auswahl & Aktionen -->
    <div class="platform-header-row">
        <label for="platform_profile_select" class="field-label">Konfiguration wählen:</label>
        <div class="platform-controls">
            <select 
                id="platform_profile_select" 
                class="form-select platform-select"
                value={activePlatformName}
                onchange={onSelectPlatform}
            >
                {#each platformKeys as pName}
                    <option value={pName}>{pName === 'default' ? 'Standard (Generisch)' : pName}</option>
                {/each}
            </select>

            <div class="btn-group-sm">
                <button 
                    type="button" 
                    class="btn-secondary btn-sm" 
                    title="Neue Konfiguration erstellen" 
                    onclick={startCreatePlatform}
                >
                    <ZimIcon name="plus" size={14} />
                    <span class="btn-label-desktop">Neu</span>
                </button>
                <button 
                    type="button" 
                    class="btn-secondary btn-sm" 
                    title="Konfiguration duplizieren" 
                    onclick={duplicatePlatform}
                >
                    <ZimIcon name="copy" size={14} />
                    <span class="btn-label-desktop">Kopieren</span>
                </button>
                <button 
                    type="button" 
                    class="btn-secondary btn-sm" 
                    title="Konfiguration umbenennen" 
                    onclick={startRenamePlatform}
                >
                    <ZimIcon name="edit" size={14} />
                    <span class="btn-label-desktop">Umbenennen</span>
                </button>
                <button 
                    type="button" 
                    class="btn-secondary btn-sm btn-danger-hover" 
                    title="Konfiguration löschen" 
                    disabled={Object.keys(journeyStore.platforms).length <= 1}
                    onclick={deletePlatform}
                >
                    <ZimIcon name="trash" size={14} />
                </button>
            </div>
        </div>
    </div>

    <!-- Inline-Dialog: Neuer Bahnsteig -->
    {#if isCreatingNew}
        <div class="inline-action-box">
            <span class="inline-box-title">Neuer Bahnsteig:</span>
            <div class="inline-box-controls">
                <input 
                    type="text" 
                    class="form-input form-input-sm" 
                    placeholder="z.B. Gleis 4 oder Bahnsteig A"
                    bind:value={newPlatformName}
                    onkeydown={(e) => { if (e.key === 'Enter') confirmCreatePlatform(); if (e.key === 'Escape') cancelCreatePlatform(); }}
                    use:autoFocus
                />
                <button type="button" class="btn-primary btn-sm" onclick={confirmCreatePlatform}>Erstellen</button>
                <button type="button" class="btn-secondary btn-sm" onclick={cancelCreatePlatform}>Abbrechen</button>
            </div>
        </div>
    {/if}

    <!-- Inline-Dialog: Umbenennen -->
    {#if isRenaming}
        <div class="inline-action-box">
            <span class="inline-box-title">Bahnsteig umbenennen:</span>
            <div class="inline-box-controls">
                <input 
                    type="text" 
                    class="form-input form-input-sm" 
                    placeholder="Neuer Name"
                    bind:value={renamePlatformValue}
                    onkeydown={(e) => { if (e.key === 'Enter') confirmRenamePlatform(); if (e.key === 'Escape') cancelRenamePlatform(); }}
                    use:autoFocus
                />
                <button type="button" class="btn-primary btn-sm" onclick={confirmRenamePlatform}>Speichern</button>
                <button type="button" class="btn-secondary btn-sm" onclick={cancelRenamePlatform}>Abbrechen</button>
            </div>
        </div>
    {/if}

    <!-- 2. Globale Bahnsteig-Dimensionen -->
    <div class="platform-metrics-grid">
        <label class="field-label">
            Länge (m):
            <input 
                type="number" 
                min="50" 
                max="1000" 
                step="10"
                class="form-input" 
                bind:value={platform.length} 
                oninput={() => trainDisplay.updateAll()}
            >
        </label>
        <label class="field-label">
            Standort ZIM (m):
            <input 
                type="number" 
                min="0" 
                max={platform.length} 
                step="1"
                class="form-input" 
                bind:value={platform.currentLocation} 
                oninput={() => trainDisplay.updateAll()}
            >
        </label>
    </div>

    <!-- 3. Visuelle Bahnsteig-Vorschau (Mini-Preview) -->
    <div class="preview-card">
        <div class="preview-header">
            <span class="preview-title">Visuelle Bahnsteig-Vorschau (0 bis {platform.length || 400}m)</span>
            <span class="preview-zim-info">📍 ZIM Standort: {platform.currentLocation || 0}m</span>
        </div>
        
        <div class="preview-track-container">
            <!-- Skalen-Markierungen (Ticks) -->
            <div class="track-scale">
                <span class="scale-tick" style="left: 0%;">0m</span>
                <span class="scale-tick" style="left: 25%;">{Math.round((platform.length || 400) * 0.25)}m</span>
                <span class="scale-tick" style="left: 50%;">{Math.round((platform.length || 400) * 0.50)}m</span>
                <span class="scale-tick" style="left: 75%;">{Math.round((platform.length || 400) * 0.75)}m</span>
                <span class="scale-tick" style="right: 0%;">{(platform.length || 400)}m</span>
            </div>

            <!-- Gleisbett & Abschnitte -->
            <div class="track-bar">
                {#each platform.sections as sec}
                    {@const totalLen = Math.max(1, platform.length || 400)}
                    {@const leftPct = Math.max(0, Math.min(100, (Number(sec.startMeter) / totalLen) * 100))}
                    {@const rightPct = Math.max(0, Math.min(100, (Number(sec.endMeter) / totalLen) * 100))}
                    {@const widthPct = Math.max(0, rightPct - leftPct)}
                    {@const cubePos = (sec.cubePosition !== undefined && sec.cubePosition !== null) ? Number(sec.cubePosition) : (Number(sec.startMeter) + Number(sec.endMeter)) / 2}
                    {@const cubePct = Math.max(0, Math.min(100, (cubePos / totalLen) * 100))}

                    <!-- Sektor-Segment -->
                    <div 
                        class="sector-segment"
                        style="left: {leftPct}%; width: {widthPct}%;"
                        title="Sektor {sec.name}: {sec.startMeter}m - {sec.endMeter}m ({Math.round(sec.endMeter - sec.startMeter)}m)"
                    >
                        <span class="sector-letter">{sec.name}</span>
                        <span class="sector-meters">{sec.startMeter}–{sec.endMeter}m</span>
                    </div>

                    <!-- Sektor-Würfel (Cube-Marker) -->
                    <div 
                        class="cube-marker"
                        style="left: {cubePct}%;"
                        title="Würfel {sec.name} bei {Math.round(cubePos)}m {sec.cubePosition === null ? '(Auto)' : '(Manuell)'}"
                    >
                        <span class="cube-badge">{sec.name}</span>
                    </div>
                {/each}

                <!-- ZIM Standort Pin -->
                <div 
                    class="zim-location-pin"
                    style="left: {zimPct}%;"
                    title="ZIM Monitor Standort: {platform.currentLocation || 0}m"
                >
                    <div class="zim-pin-badge">ZIM</div>
                    <div class="zim-pin-line"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- 4. Abschnitte verwalten & konfigurieren -->
    <div class="sections-manager">
        <div class="sections-header">
            <div class="sections-title-row">
                <span class="sections-title">Sektoren / Abschnitte ({platform.sections.length})</span>
                <span class="sections-hint">A bis K</span>
            </div>
            
            <div class="sections-actions">
                <button 
                    type="button" 
                    class="btn-secondary btn-sm" 
                    onclick={distributeEvenly}
                    title="Verteilt die Abschnitte gleichmäßig über die Gesamtlänge ({platform.length}m)"
                >
                    Gleichmäßig verteilen
                </button>
                <button 
                    type="button" 
                    class="btn-secondary btn-sm" 
                    onclick={alignSeamlessly}
                    title="Richtet alle Abschnitte nahtlos aneinander aus (Start = Ende des Vorherigen)"
                >
                    Nahtlos
                </button>
                <button 
                    type="button" 
                    class="btn-secondary btn-sm" 
                    onclick={resetToDefault}
                    title="Setzt die Abschnitte auf den klassischen DB-Standard A–E zurück"
                >
                    Standard A–E
                </button>
            </div>
        </div>

        <!-- Abschnitts-Tabelle -->
        <div class="table-responsive">
            <table class="sections-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">Sektor</th>
                        <th>Start (m)</th>
                        <th>Ende (m)</th>
                        <th>Länge</th>
                        <th>Würfel / Cube (m)</th>
                        <th style="width: 36px; text-align: center;"></th>
                    </tr>
                </thead>
                <tbody>
                    {#each platform.sections as sec, idx}
                        {@const lengthM = Number(sec.endMeter) - Number(sec.startMeter)}
                        {@const autoCube = Math.round((Number(sec.startMeter) + Number(sec.endMeter)) / 2)}
                        <tr>
                            <!-- Sektor-Buchstabe -->
                            <td>
                                <span class="sector-badge">{sec.name}</span>
                            </td>

                            <!-- Start Meter -->
                            <td>
                                <input 
                                    type="number" 
                                    class="form-input form-input-compact" 
                                    min="0"
                                    bind:value={sec.startMeter} 
                                    oninput={() => trainDisplay.updateAll()}
                                />
                            </td>

                            <!-- Ende Meter -->
                            <td>
                                <input 
                                    type="number" 
                                    class="form-input form-input-compact" 
                                    min="0"
                                    bind:value={sec.endMeter} 
                                    oninput={() => trainDisplay.updateAll()}
                                />
                            </td>

                            <!-- Länge (berechnet) -->
                            <td>
                                <span class="length-badge" class:length-invalid={lengthM <= 0}>
                                    {lengthM > 0 ? `${lengthM}m` : 'Ungültig'}
                                </span>
                            </td>

                            <!-- Würfel / Cube Position -->
                            <td>
                                <div class="cube-input-wrapper">
                                    <input 
                                        type="number" 
                                        class="form-input form-input-compact" 
                                        value={sec.cubePosition !== null && sec.cubePosition !== undefined ? sec.cubePosition : ''}
                                        placeholder={`Auto (${autoCube}m)`}
                                        oninput={(e) => updateCubePosition(sec, e.currentTarget.value)}
                                        title={sec.cubePosition !== null ? `Benutzerdefiniert: ${sec.cubePosition}m` : `Automatische Mitte: ${autoCube}m`}
                                    />
                                    {#if sec.cubePosition !== null && sec.cubePosition !== undefined}
                                        <button 
                                            type="button" 
                                            class="btn-icon-tiny" 
                                            title="Auf automatische Mitte zurücksetzen"
                                            onclick={() => updateCubePosition(sec, '')}
                                        >
                                            <ZimIcon name="close" size={12} />
                                        </button>
                                    {/if}
                                </div>
                            </td>

                            <!-- Entfernen -->
                            <td style="text-align: center;">
                                <button 
                                    type="button" 
                                    class="btn-icon btn-danger-hover" 
                                    title={`Abschnitt ${sec.name} entfernen`}
                                    disabled={platform.sections.length <= 1}
                                    onclick={() => removeSection(idx)}
                                >
                                    <ZimIcon name="trash" size={14} />
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <!-- Button zum Hinzufügen des nächsten Abschnitts (A bis K) -->
        <div class="add-section-footer">
            {#if nextLetter}
                <button 
                    type="button" 
                    class="btn-secondary btn-sm add-btn"
                    onclick={addSection}
                >
                    <ZimIcon name="plus" size={14} />
                    <span>Abschnitt ({nextLetter}) hinzufügen</span>
                </button>
            {:else}
                <span class="max-sectors-note">Maximale Anzahl an Abschnitten erreicht (A bis K).</span>
            {/if}
        </div>
    </div>
</div>

<style>
    .platform-editor {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .platform-header-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .platform-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }

    .platform-select {
        flex: 1;
        min-width: 140px;
    }

    .btn-group-sm {
        display: flex;
        gap: 4px;
        align-items: center;
    }

    .inline-action-box {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--accent, #e2001a);
        border-radius: var(--radius-sm, 4px);
    }

    .inline-box-title {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-main, #f8fafc);
    }

    .inline-box-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }

    .inline-box-controls input {
        flex: 1;
        min-width: 160px;
    }

    .platform-metrics-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    /* Visuelle Bahnsteig-Vorschau */
    .preview-card {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius-md, 8px);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
    }

    .preview-title {
        font-weight: 600;
        color: var(--text-main, #f8fafc);
    }

    .preview-zim-info {
        font-family: monospace;
        color: var(--accent, #e2001a);
        font-weight: 600;
    }

    .preview-track-container {
        position: relative;
        padding-top: 18px;
        padding-bottom: 24px;
    }

    .track-scale {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 14px;
        pointer-events: none;
    }

    .scale-tick {
        position: absolute;
        font-size: 0.65rem;
        color: var(--text-muted, #94a3b8);
        transform: translateX(-50%);
        font-family: monospace;
    }

    .scale-tick:first-child {
        transform: translateX(0);
    }

    .scale-tick:last-child {
        transform: translateX(0);
    }

    .track-bar {
        position: relative;
        height: 38px;
        background: #0f172a;
        border: 1px solid #475569;
        border-radius: 4px;
        overflow: visible;
    }

    .sector-segment {
        position: absolute;
        top: 0;
        bottom: 0;
        background: rgba(59, 130, 246, 0.12);
        border-right: 1px dashed rgba(255, 255, 255, 0.3);
        border-left: 1px dashed rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        user-select: none;
        box-sizing: border-box;
        transition: background 0.15s;
    }

    .sector-segment:hover {
        background: rgba(59, 130, 246, 0.22);
    }

    .sector-letter {
        font-size: 0.85rem;
        font-weight: 700;
        color: #93c5fd;
        line-height: 1;
    }

    .sector-meters {
        font-size: 0.6rem;
        color: var(--text-muted, #94a3b8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 90%;
    }

    /* Sektor-Würfel Pin */
    .cube-marker {
        position: absolute;
        bottom: -18px;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 2;
        pointer-events: none;
    }

    .cube-badge {
        font-size: 0.65rem;
        font-weight: bold;
        background: #1e293b;
        color: #38bdf8;
        border: 1px solid #38bdf8;
        border-radius: 2px;
        padding: 0 3px;
        line-height: 1.2;
    }

    /* ZIM Standort Pin */
    .zim-location-pin {
        position: absolute;
        top: -14px;
        bottom: -4px;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 3;
        pointer-events: none;
    }

    .zim-pin-badge {
        font-size: 0.62rem;
        font-weight: 800;
        background: var(--accent, #e2001a);
        color: #ffffff;
        border-radius: 3px;
        padding: 1px 4px;
        line-height: 1.1;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }

    .zim-pin-line {
        flex: 1;
        width: 2px;
        background: var(--accent, #e2001a);
    }

    /* Abschnitte Manager */
    .sections-manager {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .sections-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .sections-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .sections-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-main, #f8fafc);
    }

    .sections-hint {
        font-size: 0.72rem;
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-muted, #94a3b8);
        padding: 1px 6px;
        border-radius: 4px;
    }

    .sections-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    /* Responsive Tabelle */
    .table-responsive {
        width: 100%;
        overflow-x: auto;
        border: 1px solid var(--border, #334155);
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.15);
    }

    .sections-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
    }

    .sections-table th,
    .sections-table td {
        padding: 6px 8px;
        text-align: left;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        vertical-align: middle;
    }

    .sections-table th {
        color: var(--text-muted, #94a3b8);
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(0, 0, 0, 0.25);
    }

    .sector-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
        border: 1px solid rgba(59, 130, 246, 0.4);
        border-radius: 4px;
        font-weight: 700;
        font-size: 0.9rem;
    }

    .form-input-compact {
        padding: 4px 6px;
        font-size: 0.82rem;
        min-width: 60px;
        width: 100%;
        box-sizing: border-box;
    }

    .length-badge {
        font-size: 0.78rem;
        color: var(--text-muted, #94a3b8);
        font-family: monospace;
    }

    .length-invalid {
        color: #ef4444;
        font-weight: bold;
    }

    .cube-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .cube-input-wrapper input {
        padding-right: 22px;
    }

    .cube-input-wrapper .btn-icon-tiny {
        position: absolute;
        right: 4px;
    }

    .btn-danger-hover:hover:not(:disabled) {
        color: #ef4444 !important;
        background: rgba(239, 68, 68, 0.15) !important;
    }

    .add-section-footer {
        display: flex;
        justify-content: center;
        padding-top: 4px;
    }

    .add-btn {
        width: 100%;
        gap: 6px;
    }

    .max-sectors-note {
        font-size: 0.75rem;
        color: var(--text-muted, #94a3b8);
        font-style: italic;
    }

    @media (max-width: 600px) {
        .btn-label-desktop {
            display: none;
        }

        .sections-actions {
            width: 100%;
        }

        .sections-actions button {
            flex: 1;
            font-size: 0.75rem;
            padding: 4px 6px;
        }

        .platform-metrics-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
