import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TAB_PATHS } from '@/lib/tabs';
import Home from '@/pages/Home';
import Social from '@/pages/Social';
import LaunchToken from '@/pages/LaunchToken';
import LaunchNft from '@/pages/LaunchNft';
import Portfolio from '@/pages/Portfolio';

const TABS = [
  { path: '/', element: <Home /> },
  { path: '/social', element: <Social /> },
  { path: '/launch', element: <LaunchToken /> },
  { path: '/launch-nft', element: <LaunchNft /> },
  { path: '/portfolio', element: <Portfolio /> },
];

// The four tab pages as a stack: a tab mounts on its first visit and then stays
// mounted (just hidden) so switching tabs or opening a detail page never throws
// away its state, and each tab gets its own scroll offset back when you return.
export default function TabStack() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const activeIndex = TAB_PATHS.indexOf(pathname);

  const [visited, setVisited] = useState(() => new Set(TAB_PATHS.includes(pathname) ? [pathname] : []));

  const offsets = useRef({});
  const lastPath = useRef(pathname);
  const lastIndex = useRef(activeIndex);
  const indexDirection = activeIndex >= 0 && lastIndex.current > activeIndex ? -1 : 1;
  const direction = navigationType === 'POP' ? -1 : indexDirection;

  useEffect(() => {
    if (TAB_PATHS.includes(pathname)) {
      setVisited((prev) => (prev.has(pathname) ? prev : new Set(prev).add(pathname)));
    }

    const from = lastPath.current;
    if (from !== pathname) {
      if (TAB_PATHS.includes(from)) offsets.current[from] = window.scrollY;
      lastPath.current = pathname;
    }
    if (!TAB_PATHS.includes(pathname)) return undefined;

    const y = offsets.current[pathname] || 0;
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (activeIndex >= 0) lastIndex.current = activeIndex;
  }, [activeIndex]);

  return (
    <>
      {TABS.filter((tab) => visited.has(tab.path)).map((tab) => {
        const active = tab.path === pathname;
        return (
          <motion.div
            key={tab.path}
            className={active ? 'block' : 'hidden'}
            initial={false}
            animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {tab.element}
          </motion.div>
        );
      })}
    </>
  );
}