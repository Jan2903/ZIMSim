<!-- src/components/settings/livedata/ProviderMoTFilter.svelte -->
<script>
    import { liveDataConfig } from '../../../js/core/state/liveDataConfig.svelte.js';

    // Verfügbare Verkehrsmittel (neutrale IDs, werden vom Provider auf API-Codes gemappt)
    const ALL_MOTS = [
        { id: 'ICE', label: 'ICE' },
        { id: 'EC_IC', label: 'EC / IC' },
        { id: 'IR', label: 'InterRegio' },
        { id: 'REGIONAL', label: 'Regional (RE/RB)' },
        { id: 'SBAHN', label: 'S-Bahn' },
        { id: 'BUS', label: 'Bus' },
        { id: 'SCHIFF', label: 'Schiff' },
        { id: 'UBAHN', label: 'U-Bahn' },
        { id: 'TRAM', label: 'Straßenbahn' },
        { id: 'ANRUFPFLICHTIG', label: 'Anrufpflichtig' }
    ];

    /**
     * Schaltet alle Verkehrsmittel an oder aus.
     * @param {string[]} list
     */
    function setMots(list) {
        liveDataConfig.board.verkehrsmittel = [...list];
    }

    /**
     * Schaltet ein einzelnes Verkehrsmittel um.
     * @param {string} motId
     */
    function toggleMot(motId) {
        const cur = liveDataConfig.board.verkehrsmittel || [];
        if (cur.includes(motId)) {
            liveDataConfig.board.verkehrsmittel = cur.filter(m => m !== motId);
        } else {
            liveDataConfig.board.verkehrsmittel = [...cur, motId];
        }
    }
</script>

<div class="sub-section" style="margin-top: 14px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="field-label" style="margin: 0;">Verkehrsmittel:</span>
        <div style="display: flex; gap: 6px;">
            <button
                type="button"
                class="btn-xs"
                onclick={() => setMots(ALL_MOTS.map(m => m.id))}
            >
                Alle
            </button>
            <button
                type="button"
                class="btn-xs"
                onclick={() => setMots(['ICE', 'EC_IC', 'IR', 'REGIONAL', 'SBAHN'])}
            >
                Nur Bahn
            </button>
            <button
                type="button"
                class="btn-xs"
                onclick={() => setMots(['ICE', 'EC_IC'])}
            >
                Fernverkehr
            </button>
        </div>
    </div>

    <div class="mots-grid">
        {#each ALL_MOTS as mot}
            <label class="mot-item" class:selected={liveDataConfig.board.verkehrsmittel?.includes(mot.id)}>
                <input
                    type="checkbox"
                    checked={liveDataConfig.board.verkehrsmittel?.includes(mot.id)}
                    onchange={() => toggleMot(mot.id)}
                >
                <span>{mot.label}</span>
            </label>
        {/each}
    </div>
</div>
