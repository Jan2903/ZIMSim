// js/utils/config.js
export const config = {
    performance_mode: localStorage.getItem('zimsim_performance_mode') === 'true'
};

/**
 * Setzt den Performance-Modus (30-FPS-Begrenzung) und persistiert die Einstellung.
 * @param {boolean} enabled
 * @returns {void}
 */
export function setPerformanceMode(enabled) {
    config.performance_mode = Boolean(enabled);
    try {
        localStorage.setItem('zimsim_performance_mode', String(config.performance_mode));
    } catch (e) {
        console.warn('[Config] Performance-Modus konnte nicht gespeichert werden:', e);
    }
}

export const timeConfig = {
    isRunning: true,
    baseRealTime: Date.now(),
    baseSimTime: Date.now()
};



export function getSimulatedTime() {
    if (timeConfig.isRunning) {
        return new Date(timeConfig.baseSimTime + (Date.now() - timeConfig.baseRealTime));
    } else {
        return new Date(timeConfig.baseSimTime);
    }
}

export function setSimulatedTime(date, isRunning = timeConfig.isRunning) {
    timeConfig.baseRealTime = Date.now();
    timeConfig.baseSimTime = date.getTime();
    timeConfig.isRunning = isRunning;
}