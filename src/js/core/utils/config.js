// js/utils/config.js
export const config = {
    performance_mode: localStorage.getItem('zimsim_performance_mode') === 'true',
    departureAlarmEnabled: localStorage.getItem('zimsim_departure_alarm_enabled') !== 'false',
    departureAlarmLeadMinutes: parseInt(localStorage.getItem('zimsim_departure_alarm_lead_minutes'), 10) || 6,
    departureAlarmBlinkMinutes: parseInt(localStorage.getItem('zimsim_departure_alarm_blink_minutes'), 10) || 3,
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

/**
 * Setzt die Abfahrtsalarm-Einstellungen und persistiert sie.
 * @param {object} updates
 */
export function setDepartureAlarm(updates) {
    Object.assign(config, updates);
    try {
        if (updates.departureAlarmEnabled !== undefined)
            localStorage.setItem('zimsim_departure_alarm_enabled', String(config.departureAlarmEnabled));
        if (updates.departureAlarmLeadMinutes !== undefined)
            localStorage.setItem('zimsim_departure_alarm_lead_minutes', String(config.departureAlarmLeadMinutes));
        if (updates.departureAlarmBlinkMinutes !== undefined)
            localStorage.setItem('zimsim_departure_alarm_blink_minutes', String(config.departureAlarmBlinkMinutes));
    } catch (e) {
        console.warn('[Config] Abfahrtsalarm-Einstellungen konnten nicht gespeichert werden:', e);
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