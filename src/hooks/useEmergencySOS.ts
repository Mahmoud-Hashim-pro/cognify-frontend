import { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '../types';
import { loadContacts, makePhoneCall } from '../lib/contacts';
import { dispatchServerEmergencySOS } from '../lib/emergencyDispatcher';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import { toast } from '../components/Toast';

export interface UseEmergencySOSProps {
  profile?: Partial<UserProfile> | null;
  motorLang: 'ar' | 'en' | 'fr';
  isArabic: boolean;
  speakSafe: (text: string, overrideLang?: string) => void;
}

export type SOSDispatchStatus = 'idle' | 'sending' | 'confirmed' | 'failed';

export function useEmergencySOS({
  profile,
  motorLang,
  isArabic,
  speakSafe,
}: UseEmergencySOSProps) {
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyCountdown, setEmergencyCountdown] = useState<number | null>(null);
  const [emergencyGeoCoords, setEmergencyGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sosDispatchStatus, setSosDispatchStatus] = useState<SOSDispatchStatus>('idle');
  const [sosIncidentId, setSosIncidentId] = useState<string>('');
  const [sosDispatchedChannels, setSosDispatchedChannels] = useState<string[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cancelEmergencySOS = useCallback(() => {
    setShowEmergencyModal(false);
    setEmergencyCountdown(null);
    setSosDispatchStatus('idle');
  }, []);

  const triggerEmergencySOS = useCallback(
    (_source: 'eye_closure' | 'button' | 'vocal') => {
      triggerHapticAlert('danger');
      setShowEmergencyModal(true);
      setEmergencyCountdown(5);
      setSosDispatchStatus('idle');
      setSosIncidentId('');
      setSosDispatchedChannels([]);

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (isMountedRef.current) {
              setEmergencyGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          },
          (err) => {
            console.warn('[useEmergencySOS] Geolocation error:', err);
          },
          { timeout: 5000, enableHighAccuracy: true }
        );
      }

      const msg = isArabic
        ? 'نداء استغاثة عاجل! تم إطلاق حالة الطوارئ!'
        : motorLang === 'fr'
        ? "Alerte d'urgence ! SOS déclenché !"
        : 'Emergency SOS alert triggered!';
      speakSafe(msg);
    },
    [isArabic, motorLang, speakSafe]
  );

  useEffect(() => {
    if (emergencyCountdown === null) return;
    if (emergencyCountdown <= 0) {
      setSosDispatchStatus('sending');
      const currentContacts = loadContacts();
      const lat = emergencyGeoCoords?.lat;
      const lng = emergencyGeoCoords?.lng;
      const mapUrl = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : '';
      const primary = currentContacts.find((c) => c.isPrimaryEmergency) || currentContacts[0];
      const caregiverPhone = primary?.phone || '';
      const caregiverName = isArabic ? (primary?.nameAr || primary?.nameEn) : (primary?.nameEn || primary?.nameAr);

      const sosText = isArabic
        ? `🚨 نداء استغاثة عاجل (Emergency SOS) من مستخدم Cognify: أحتاج إلى مساعدة طبية فورية! ${mapUrl ? `موقعي الحالي على الخريطة: ${mapUrl}` : ''}`
        : `🚨 Emergency SOS from Cognify user: I need immediate medical assistance! ${mapUrl ? `Location: ${mapUrl}` : ''}`;

      dispatchServerEmergencySOS({
        uid: profile?.uid,
        studentName: profile?.name || (isArabic ? 'طالب كوجنيفاي' : 'Cognify Student'),
        caregiverPhone,
        caregiverName,
        location: emergencyGeoCoords || undefined,
        source: 'eye_closure',
        text: sosText,
      }).then((res) => {
        if (!isMountedRef.current) return;
        if (res.success) {
          setSosDispatchStatus('confirmed');
          setSosIncidentId(res.incidentId || '');
          setSosDispatchedChannels(res.channels || ['server_event_bus']);
          toast.success(
            isArabic
              ? `تم استلام وتوثيق الاستغاثة بالخادم (${res.incidentId})`
              : `SOS confirmed by server (${res.incidentId})`
          );
          speakSafe(
            isArabic
              ? 'تم تأكيد وصول نداء الاستغاثة بنجاح إلى الخادم والمرافقين'
              : 'Emergency SOS confirmed and dispatched by server'
          );
        } else {
          setSosDispatchStatus('failed');
          toast.error(
            isArabic
              ? 'تعذر الإرسال التلقائي عبر الخادم، يرجى الاتصال المباشر!'
              : 'Server dispatch failed, please call directly'
          );
          speakSafe(
            isArabic
              ? 'تنبيه: تعذر الإرسال التلقائي، جاري التحويل للاتصال المباشر'
              : 'Warning: Automated dispatch failed'
          );
          if (caregiverPhone) {
            makePhoneCall(caregiverPhone);
          }
        }
      });
      return;
    }

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setEmergencyCountdown((c) => (c !== null ? c - 1 : null));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [emergencyCountdown, emergencyGeoCoords, isArabic, profile?.name, profile?.uid, speakSafe]);

  return {
    showEmergencyModal,
    setShowEmergencyModal,
    emergencyCountdown,
    setEmergencyCountdown,
    emergencyGeoCoords,
    sosDispatchStatus,
    sosIncidentId,
    sosDispatchedChannels,
    triggerEmergencySOS,
    cancelEmergencySOS,
  };
}
