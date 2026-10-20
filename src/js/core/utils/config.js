// js/utils/config.js
export const config = {
    performance_mode: localStorage.getItem('zimsim_performance_mode') === 'true'
};

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