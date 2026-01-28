import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    const doScroll = () => {
      try {
        window.scrollTo(0, 0);
      } catch {}
      const main = document.querySelector('.app-main');
      if (main && 'scrollTo' in main) {
        try {
          (main as HTMLElement).scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch {}
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(doScroll));
  }, [location.pathname, location.search, location.hash]);

  return null;
};

export default ScrollToTop;

