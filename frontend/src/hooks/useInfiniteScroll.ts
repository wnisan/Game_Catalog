import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
    threshold?: number; // видимость элемента
    enabled?: boolean; // Включен ли infinite scroll
    rootMargin?: string; // Отступ для Intersection Observer
}

interface UseInfiniteScrollReturn {
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    reset: () => void;
    sentinelRef: React.RefObject<HTMLDivElement | null>; // Невидимый элемент за которым наблюдаем
}

export const useInfiniteScroll = (
    fetchCallback: (page: number) => Promise<any[]>,
    options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn => {
    const { enabled = true, rootMargin = '100px' } = options;
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const pageRef = useRef(0); // текущая страница
    const observerRef = useRef<IntersectionObserver | null>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const fetchCallbackRef = useRef(fetchCallback);
    const isLoadingRef = useRef(false);
    const hasMoreRef = useRef(true);

    // Обновляем при изменении состояния
    useEffect(() => {
        isLoadingRef.current = isLoading;
        hasMoreRef.current = hasMore;
    }, [isLoading, hasMore]);

    useEffect(() => {
        fetchCallbackRef.current = fetchCallback;
    }, [fetchCallback]);

    // загрузка данных
    const loadMore = useCallback(async () => {
        if (isLoadingRef.current || !hasMoreRef.current) {
            return;
        }

        setIsLoading(true);
        isLoadingRef.current = true;

        try {
            const currentPage = pageRef.current;
            const newItems = await fetchCallbackRef.current(currentPage);

            if (newItems.length === 0) {
                setHasMore(false);
                hasMoreRef.current = false;
            } else {
                pageRef.current = currentPage + 1;
                if (newItems.length < 20) {
                    setHasMore(false);
                    hasMoreRef.current = false;
                }
            }
        } catch (error) {
            console.error('Error loading more items:', error);
            setHasMore(false);
            hasMoreRef.current = false;
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
        }
    }, []); // так как используем refs

    // сброс состояния
    const reset = useCallback(() => {
        pageRef.current = 0;
        setHasMore(true);
        hasMoreRef.current = true;
        setIsLoading(false);
        isLoadingRef.current = false;
    }, []);

    useEffect(() => {
        if (!enabled) {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            return;
        }

        // Небольшая задержка, чтобы убедиться, что элемент за которым наблюдаем отрендерился
        const timeoutId = setTimeout(() => {
            const sentinelElement = sentinelRef.current;
            if (!sentinelElement) {
                return;
            }

            if (observerRef.current) {
                observerRef.current.disconnect();
            }

            const currentObserver = new IntersectionObserver(
                (entries) => {
                    const [entry] = entries;

                    if (entry.isIntersecting && !isLoadingRef.current && hasMoreRef.current) {
                        loadMore();
                    }
                },
                {
                    root: null,
                    rootMargin: `0px 0px ${rootMargin} 0px`,
                    threshold: [0, 0.1, 0.5, 1.0]
                }
            );

            observerRef.current = currentObserver;
            currentObserver.observe(sentinelElement);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, [enabled, rootMargin, loadMore]);

    return {
        isLoading,
        hasMore,
        loadMore,
        reset,
        sentinelRef
    };
}