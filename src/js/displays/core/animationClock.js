// js/displays/core/animationClock.js
// Zeitbasierte Animationszustände des TrainDisplay: Formations-Rotation,
// Journey-/InfoText-Paging sowie Ticker und Paginierung der Abfahrtstafeln.
// Die Berechnung ist rein (keine Seiteneffekte), der Aufrufer übernimmt das
// Schreiben in Stores und das eigentliche Zeichnen.

/** Dauer eines vollständigen Formations-Durchlaufs (drei Features à 4s). */
export const FEATURE_CYCLE_MS = 12000;
/** Verweildauer eines einzelnen Formations-Features. */
export const FEATURE_PHASE_MS = 4000;
/** Ein-/Ausblenddauer zwischen zwei Formations-Features. */
export const FEATURE_FADE_MS = 1000;

/** Reihenfolge der Formations-Features innerhalb eines Durchlaufs. */
export const FEATURE_ORDER = [
    { feature: 'klasse', index: 2 },
    { feature: 'ausstattung', index: 1 },
    { feature: 'wagennummern', index: 0 },
];

/** Verweildauer einer Journey-/InfoText-Seite. */
export const PAGE_CYCLE_MS = 4800;
/** Ein-/Ausblenddauer einer Journey-/InfoText-Seite. */
export const PAGE_FADE_MS = 800;
/** Zeitpunkt, ab dem die Ausblendung einer Seite beginnt (gemessen ab Seitenstart). */
export const PAGE_HOLD_MS = 4000;

/** Verweildauer einer Störungsseite auf der Anschlusstafel. */
export const DISRUPTION_CYCLE_MS = 6000;
/** Ein-/Ausblenddauer einer Störungsseite. */
export const DISRUPTION_FADE_MS = 500;

/** Verweildauer einer Abfahrtsseite im Auto-Paging. */
export const DEPARTURE_CYCLE_MS = 10000;
/** Ein-/Ausblenddauer einer Abfahrtsseite. */
export const DEPARTURE_FADE_MS = 800;
/** Zeitpunkt, ab dem die Ausblendung einer Abfahrtsseite beginnt (gemessen ab Seitenstart). */
export const DEPARTURE_HOLD_MS = 9200;

/** Pixel pro Frame, um den der Störungs-Ticker weiterläuft. */
export const TICKER_STEP_PX = 1.8;

/**
 * Erzeugt den initialen Animationszustand des TrainDisplay.
 * @returns {object} Animationszustand
 */
export function createAnimationState() {
    return {
        activeFeature: 'wagennummern',
        featureAlpha: 1.0,
        activeFeatureIndex: 0,
        vitrineProgress: 0.0,
        activePageIndex: 0,
        pageAlpha: 1.0,
        departurePageIndex: 0,
        departurePageAlpha: 1.0,
        disruptionPageIndex: 0,
        disruptionPageAlpha: 1.0,
        tickerOffset: 0,
    };
}

/**
 * Berechnet die Alpha-Rampe einer Phase: Einblenden am Anfang, Halten in der
 * Mitte, Ausblenden am Ende.
 *
 * @param {number} elapsed - Zeit seit Beginn der Phase in ms
 * @param {number} fadeIn - Dauer des Einblendens in ms
 * @param {number} fadeOutStart - Zeitpunkt des Ausblendbeginns in ms
 * @param {number} fadeOut - Dauer des Ausblendens in ms
 * @returns {number} Alpha zwischen 0 und 1
 */
function computeFadeAlpha(elapsed, fadeIn, fadeOutStart, fadeOut) {
    if (elapsed < fadeIn) return elapsed / fadeIn;
    if (elapsed > fadeOutStart) return 1.0 - ((elapsed - fadeOutStart) / fadeOut);
    return 1.0;
}

/**
 * Schreibt den nächsten Animationszustand in `state` und meldet, ob dadurch
 * ein Neuzeichnen nötig ist.
 *
 * @param {object} state - Animationszustand (wird mutiert)
 * @param {number} now - Aktueller Zeitstempel in ms
 * @param {object} [options]
 * @param {boolean} [options.isVitrine=false] - Wagenstand-/Wagenreihungslayout (Feature-Rotation immer aktiv)
 * @param {boolean} [options.rotating=false] - Manuell aktivierte Feature-Rotation
 * @param {number} [options.pageCount=0] - Anzahl der rotierenden Journey-/InfoText-Seiten
 * @param {boolean} [options.departurePaging=false] - Layout enthält Abfahrts-/Voranzeiger-Screens
 * @param {boolean} [options.autoDeparturePage=false] - Automatischer Seitenwechsel der Abfahrtstafel
 * @param {number} [options.manualDeparturePageIndex=0] - Manuell gewählte Abfahrtsseite
 * @returns {{ needsRender: boolean, autoDeparturePageIndex: number|null }} Ergebnis;
 *   `autoDeparturePageIndex` muss vom Aufrufer in den DisplayConfigStore geschrieben werden.
 */
export function computeAnimationFrame(state, now, options = {}) {
    const {
        isVitrine = false,
        rotating = false,
        pageCount = 0,
        departurePaging = false,
        autoDeparturePage = false,
        manualDeparturePageIndex = 0,
    } = options;

    let needsRender = false;
    let autoDeparturePageIndex = null;

    // 1. Formation Feature Rotation (only if rotating or vitrine)
    if (isVitrine || rotating) {
        const cycle = now % FEATURE_CYCLE_MS;
        const phase = Math.floor(cycle / FEATURE_PHASE_MS);
        const { feature, index } = FEATURE_ORDER[phase] ?? FEATURE_ORDER[0];
        const alpha = computeFadeAlpha(
            cycle % FEATURE_PHASE_MS,
            FEATURE_FADE_MS,
            FEATURE_PHASE_MS - FEATURE_FADE_MS,
            FEATURE_FADE_MS
        );

        state.vitrineProgress = cycle / FEATURE_CYCLE_MS;
        state.activeFeatureIndex = index;
        // Nur neu zeichnen, wenn sich Feature oder Alpha tatsächlich ändern.
        // In den Haltephasen bleibt das Bild identisch (bei der Vitrine
        // läuft dagegen der Fortschrittsbalken kontinuierlich weiter).
        if (isVitrine || feature !== state.activeFeature || alpha !== state.featureAlpha) {
            needsRender = true;
        }
        state.activeFeature = feature;
        state.featureAlpha = alpha;
    } else if (state.featureAlpha !== 1.0) {
        state.featureAlpha = 1.0;
        needsRender = true;
    }

    // 2. Journey/InfoText Rotation (Always runs if we have multiple pages)
    if (pageCount > 1) {
        const totalJourneyCycle = pageCount * PAGE_CYCLE_MS;
        const cycle = now % totalJourneyCycle;
        const nextPageIndex = Math.floor(cycle / PAGE_CYCLE_MS);
        const alpha = computeFadeAlpha(
            cycle % PAGE_CYCLE_MS,
            PAGE_FADE_MS,
            PAGE_HOLD_MS,
            PAGE_CYCLE_MS - PAGE_HOLD_MS
        );

        if (nextPageIndex !== state.activePageIndex || alpha !== state.pageAlpha) {
            needsRender = true;
        }
        state.activePageIndex = nextPageIndex;
        state.pageAlpha = alpha;
    } else if (state.pageAlpha !== 1.0 || state.activePageIndex !== 0) {
        state.activePageIndex = 0;
        state.pageAlpha = 1.0;
        needsRender = true;
    }

    // 3. Voranzeiger Pagination & Ticker Loop (aktiv wenn Layout einen Abfahrts-/Voranzeiger-Screen hat)
    if (departurePaging) {
        // Ticker kontinuierlich scrollen
        state.tickerOffset += TICKER_STEP_PX;

        // Störungs-Pagination (6 Sekunden Verweildauer)
        state.disruptionPageIndex = Math.floor(now / DISRUPTION_CYCLE_MS);
        state.disruptionPageAlpha = computeFadeAlpha(
            now % DISRUPTION_CYCLE_MS,
            DISRUPTION_FADE_MS,
            DISRUPTION_CYCLE_MS - DISRUPTION_FADE_MS,
            DISRUPTION_FADE_MS
        );

        // Abfahrts-Pagination (10 Sekunden Verweildauer bei aktiviertem Auto-Paging)
        if (autoDeparturePage) {
            autoDeparturePageIndex = Math.floor(now / DEPARTURE_CYCLE_MS);
            state.departurePageIndex = autoDeparturePageIndex;
            state.departurePageAlpha = computeFadeAlpha(
                now % DEPARTURE_CYCLE_MS,
                DEPARTURE_FADE_MS,
                DEPARTURE_HOLD_MS,
                DEPARTURE_CYCLE_MS - DEPARTURE_HOLD_MS
            );
        } else {
            state.departurePageIndex = manualDeparturePageIndex;
            state.departurePageAlpha = 1.0;
        }

        needsRender = true;
    }

    return { needsRender, autoDeparturePageIndex };
}
