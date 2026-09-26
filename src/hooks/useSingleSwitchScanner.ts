import { useState, useRef, useCallback, useEffect } from 'react';

export interface SingleSwitchScannerConfig {
  itemCount: number;
  scanIntervalMs?: number;
  maxPasses?: number;
  isActive?: boolean;
  onSelect?: (index: number) => void;
}

export function useSingleSwitchScanner(config: SingleSwitchScannerConfig) {
  const {
    itemCount,
    scanIntervalMs = 1500,
    maxPasses = 3,
    isActive = false,
    onSelect,
  } = config;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPass, setCurrentPass] = useState(1);
  const [isScanning, setIsScanning] = useState(isActive);

  const scanTimerRef = useRef<any>(null);

  const triggerSwitch = useCallback(() => {
    if (!isScanning || itemCount === 0) return;
    onSelect?.(currentIndex);
  }, [isScanning, itemCount, currentIndex, onSelect]);

  useEffect(() => {
    if (!isActive || itemCount === 0) {
      setIsScanning(false);
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      return;
    }

    setIsScanning(true);
    setCurrentIndex(0);
    setCurrentPass(1);

    scanTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= itemCount) {
          setCurrentPass((p) => {
            if (p >= maxPasses) {
              setIsScanning(false);
              clearInterval(scanTimerRef.current);
              return 1;
            }
            return p + 1;
          });
          return 0;
        }
        return next;
      });
    }, scanIntervalMs);

    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [isActive, itemCount, scanIntervalMs, maxPasses]);

  return {
    currentIndex,
    currentPass,
    isScanning,
    triggerSwitch,
    setIsScanning,
  };
}
