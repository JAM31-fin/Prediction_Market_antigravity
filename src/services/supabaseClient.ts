/**
 * Client-Side Supabase Client (Browser / Client Code Only)
 * 
 * Uses Supabase's modern API key model:
 * - SUPABASE_PUBLISHABLE_KEY (Public browser client key)
 * - SUPABASE_URL (Public Supabase project URL)
 * 
 * SECURITY NOTICE:
 * Neither SUPABASE_SECRET_KEY nor DATABASE_URL is imported or referenced here.
 * Privileged keys must strictly remain server-side.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read public client-safe keys exposed by Vite build or runtime config
let clientSupabaseUrl: string =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  (import.meta.env.SUPABASE_URL as string) ||
  '';

let clientPublishableKey: string =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.SUPABASE_PUBLISHABLE_KEY as string) ||
  '';

let browserClient: SupabaseClient | null = null;

if (clientSupabaseUrl && clientPublishableKey) {
  try {
    browserClient = createClient(clientSupabaseUrl, clientPublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('[Supabase Browser Client] Initialization notice:', err);
  }
}

/**
 * Returns the client-side Supabase instance, or null if not yet configured.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  return browserClient;
}

/**
 * Dynamically fetch public runtime config if browser environment variables
 * were not injected during static build time.
 */
export async function initBrowserSupabase(): Promise<SupabaseClient | null> {
  if (browserClient) return browserClient;

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabasePublishableKey) {
        clientSupabaseUrl = data.supabaseUrl;
        clientPublishableKey = data.supabasePublishableKey;
        browserClient = createClient(clientSupabaseUrl, clientPublishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }

  return browserClient;
}

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(browserClient);
}
