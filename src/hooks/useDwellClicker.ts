import { useState, useRef, useCallback } from 'react';

export interface DwellClickerConfig {
  dwellTimeMs?: number;
  onDwellTrigger?: (element: HTMLElement) => void;
}

export function useDwellClicker(config: DwellClickerConfig = {}) {
  const { dwellTimeMs = 1200, onDwellTrigger } = config;

  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0); // 0 to 1

  const dwellTimerRef = useRef<any>(null);
  const dwellStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<any>(null);

  const startDwell = useCallback((element: HTMLElement) => {
    if (hoveredElement === element) return;

    setHoveredElement(element);
    dwellStartRef.current = performance.now();
    setDwellProgress(0);

    const updateProgress = () => {
      if (!dwellStartRef.current) return;
      const elapsed = performance.now() - dwellStartRef.current;
      const progress = Math.min(1, elapsed / dwellTimeMs);
      setDwellProgress(progress);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else {
        // Dwell Complete: Actuate Click
        element.click();
        onDwellTrigger?.(element);
        setDwellProgress(0);
        dwellStartRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [hoveredElement, dwellTimeMs, onDwellTrigger]);

  const cancelDwell = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellStartRef.current = null;
    setHoveredElement(null);
    setDwellProgress(0);
  }, []);

  return {
    hoveredElement,
    dwellProgress,
    startDwell,
    cancelDwell,
  };
}
