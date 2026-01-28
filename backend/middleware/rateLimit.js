let lastFilterStatsRequestTime = 0;
const MIN_FILTER_STATS_INTERVAL = 1000;

export const rateLimitFilterStatsMiddleware = async (req, res, next) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastFilterStatsRequestTime;

    if (timeSinceLastRequest < MIN_FILTER_STATS_INTERVAL) {
        const waitTime = MIN_FILTER_STATS_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastFilterStatsRequestTime = Date.now();
    next();
};
