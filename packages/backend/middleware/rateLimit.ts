import { NextFunction, Request, Response } from 'express';

let lastFilterStatsRequestTime = 0;
const MIN_FILTER_STATS_INTERVAL = 1000;

export const rateLimitFilterStatsMiddleware = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastFilterStatsRequestTime;

    if (timeSinceLastRequest < MIN_FILTER_STATS_INTERVAL) {
        const waitTime = MIN_FILTER_STATS_INTERVAL - timeSinceLastRequest;
        await new Promise<void>((resolve) => {
            setTimeout(resolve, waitTime);
        });
    }

    lastFilterStatsRequestTime = Date.now();
    next();
};
