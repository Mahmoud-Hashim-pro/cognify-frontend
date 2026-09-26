import { useState, useRef, useCallback, useEffect } from 'react';
import { dispatchServerEmergencySOS, EmergencyDispatchResult } from '../lib/emergencyDispatcher';

export interface EyeClosureSOSConfig {
  requiredHoldSeconds?: number;
  uid?: string;
  studentName?: string;
  caregiverPhone?: string;
  caregiverName?: string;
  onSOSDispatched?: (result: EmergencyDispatchResult) => void;
}

export function useEyeClosureSOS(config: EyeClosureSOSConfig = {}) {
  const {
    requiredHoldSeconds = 4,
    uid,
    studentName,
    caregiverPhone,
    caregiverName,
    onSOSDispatched,
  } = config;

  const [isEyeClosed, setIsEyeClosed] = useState(false);
  const [closureProgress, setClosureProgress] = useState(0); // 0 to 1
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [lastSOSResult, setLastSOSResult] = useState<EmergencyDispatchResult | null>(null);

  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);

  const triggerSOS = useCallback(async (location?: { lat: number; lng: number }) => {
    setIsSOSActive(true);
    try {
      const res = await dispatchServerEmergencySOS({
        uid,
        studentName,
        caregiverPhone,
        caregiverName,
        source: 'eye_closure',
        location,
        text: 'Critical: 4-Second Continuous Eye Closure Emergency Triggered by ALS/Motor Patient.',
      });
      setLastSOSResult(res);
      onSOSDispatched?.(res);
      return res;
    } finally {
      setIsSOSActive(false);
    }
  }, [uid, studentName, caregiverPhone, caregiverName, onSOSDispatched]);

  const updateEyeState = useCallback((closed: boolean, location?: { lat: number; lng: number }) => {
    setIsEyeClosed(closed);

    if (closed) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progress = Math.min(1, elapsed / requiredHoldSeconds);
      setClosureProgress(progress);

      if (progress >= 1 && !isSOSActive) {
        startTimeRef.current = null;
        setClosureProgress(0);
        triggerSOS(location);
      }
    } else {
      startTimeRef.current = null;
      setClosureProgress(0);
    }
  }, [requiredHoldSeconds, isSOSActive, triggerSOS]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    isEyeClosed,
    closureProgress,
    isSOSActive,
    lastSOSResult,
    updateEyeState,
    triggerSOS,
  };
}
