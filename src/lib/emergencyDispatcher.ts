/**
 * Emergency SOS Dispatcher Client Service
 *
 * Provides a reliable, non-interactive emergency dispatch pathway for quadriplegic
 * and ALS patients. Unlike window.open('wa.me'), this dispatches a server-side
 * background event without requiring user manual clicks or being blocked by popup guards.
 */

import { auth } from './firebase';
import { getApiUrl } from '../config/api';

export interface EmergencyDispatchResult {
  success: boolean;
  incidentId?: string;
  dispatchedAt?: string;
  channels?: string[];
  message: string;
  fallbackDirectCall?: boolean;
}

export async function dispatchServerEmergencySOS(params: {
  uid?: string;
  studentName?: string;
  caregiverPhone?: string;
  caregiverName?: string;
  location?: { lat: number; lng: number };
  source?: 'eye_closure' | 'button' | 'vocal' | 'sensory_meltdown' | 'fall_detected';
  severity?: 'critical' | 'moderate' | 'warning';
  incidentType?: 'emergency_sos' | 'sensory_meltdown' | 'fall_detected';
  trigger?: string;
  text?: string;
}): Promise<EmergencyDispatchResult> {
  const timestamp = new Date().toISOString();

  try {
    const token = auth?.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const endpoint = getApiUrl('/api/emergency/dispatch');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...params,
        timestamp,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        incidentId: data.incidentId,
        dispatchedAt: data.dispatchedAt || timestamp,
        channels: data.channels || ['server_event_bus'],
        message: data.message || 'Emergency signal confirmed by server.',
      };
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      message: errData.error || `Server responded with status ${res.status}`,
      fallbackDirectCall: true,
    };
  } catch (err: any) {
    console.error('[Emergency Dispatch Failed]:', err);
    return {
      success: false,
      message: err.message || 'Network error while contacting emergency dispatch.',
      fallbackDirectCall: true,
    };
  }
}
