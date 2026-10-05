import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Pops the navigation stack instead of pushing a fixed route. When the page was
// opened directly (deep link, no history to pop) it falls back to `fallback`.
export default function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key === 'default') navigate(fallback, { replace: true });
    else navigate(-1);
  }, [navigate, fallback, location.key]);
}