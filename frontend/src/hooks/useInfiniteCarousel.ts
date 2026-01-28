import { useEffect, useRef, useState } from 'react';

export const useInfiniteCarousel = (length: number, visibleCards: number = 5) => {
    const [index, setIndex] = useState(visibleCards);
    const [withTransition, setWithTransition] = useState(true);
    const trackRef = useRef<HTMLDivElement | null>(null);

    const next = () => {
        setWithTransition(true);
        setIndex((i) => i + 1);
    };

    const prev = () => {
        setWithTransition(true);
        setIndex((i) => i - 1);
    };

    useEffect(() => {
        if (!trackRef.current) return;

        if (index === length + visibleCards) {
            setTimeout(() => {
                setWithTransition(false);
                setIndex(visibleCards);
            }, 400);
        }

        if (index === 0) {
            setTimeout(() => {
                setWithTransition(false);
                setIndex(length);
            }, 400);
        }
    }, [index, length, visibleCards]);

    return { index, next, prev, trackRef, withTransition };
};