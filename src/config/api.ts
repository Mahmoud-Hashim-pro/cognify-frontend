/**
 * Cognify Centralized API Base Configuration
 *
 * Allows seamless communication between the independent Cognify Frontend
 * and Cognify Backend deployments.
 *
 * In production on Vercel:
 * Set VITE_API_BASE_URL=https://cognify-backend.vercel.app (or custom API domain)
 * In local development:
 * If VITE_API_BASE_URL is not set, defaults to empty string so requests to /api/*
 * are transparently handled by the Vite dev server proxy.
 */

export const API_BASE_URL = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '').replace(/\/$/, '');

/**
 * Returns the fully-qualified API URL for a given endpoint.
 *
 * Examples:
 *   getApiUrl('/api/gemini/generateAdaptiveResponse')
 *   -> 'https://cognify-backend.vercel.app/api/gemini/generateAdaptiveResponse' (in production)
 *   -> '/api/gemini/generateAdaptiveResponse' (in local dev with proxy)
 */
export function getApiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!API_BASE_URL) {
    return clean;
  }
  return `${API_BASE_URL}${clean}`;
}
