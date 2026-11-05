import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSchema } from './db.ts';

// Embedded fallback credentials (ensures Vercel serverless works even if dashboard env vars are not set)
const DEFAULT_SUPABASE_URL = 'https://joazhbnpxljhhiolxdnn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvYXpoYm5weGxqaGhpb2x4ZG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4Njk1OTUsImV4cCI6MjEwOTQ0NTU5NX0.oa3s_fbRyqUe2rVbL2EA8uc78wXS7rYHuJM1j249Uto';

// Configurable via process.env, runtime admin settings, or fallback defaults
let runtimeSupabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
let runtimeSupabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

let cachedClient: SupabaseClient | null = null;
let lastSyncedAt: string | null = null;

export function configureSupabase(url: string, key: string): void {
  runtimeSupabaseUrl = url.trim();
  runtimeSupabaseKey = key.trim();
  cachedClient = null;
}

export function getSupabaseConfig(): { url: string; key: string; isConfigured: boolean } {
  return {
    url: runtimeSupabaseUrl,
    key: runtimeSupabaseKey ? `${runtimeSupabaseKey.slice(0, 6)}...${runtimeSupabaseKey.slice(-4)}` : '',
    isConfigured: !!(runtimeSupabaseUrl && runtimeSupabaseKey),
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  if (!runtimeSupabaseUrl || !runtimeSupabaseKey) {
    return null;
  }
  try {
    cachedClient = createClient(runtimeSupabaseUrl, runtimeSupabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err);
    return null;
  }
}

export function isSupabaseConnected(): boolean {
  return !!(runtimeSupabaseUrl && runtimeSupabaseKey);
}

export function getLastSyncedAt(): string | null {
  return lastSyncedAt;
}

/**
 * Lightweight check of the remote updated_at timestamp (~20ms query)
 */
export async function getSupabaseUpdatedAt(timeoutMs = 1500): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  try {
    const fetchPromise = sb
      .from('lms_state')
      .select('updated_at')
      .eq('id', 'primary')
      .maybeSingle();

    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<{ data: null }>((resolve) => {
      timer = setTimeout(() => resolve({ data: null }), timeoutMs);
    });

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timer!);

    const { data } = res as any;
    return data?.updated_at || null;
  } catch {
    return null;
  }
}

/**
 * Fetch full database schema state from Supabase lms_state table with timeout protection
 */
export async function fetchFromSupabase(timeoutMs = 3000): Promise<DatabaseSchema | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  try {
    const fetchPromise = sb
      .from('lms_state')
      .select('data, updated_at')
      .eq('id', 'primary')
      .maybeSingle();

    let timeoutTimer: NodeJS.Timeout;
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      timeoutTimer = setTimeout(() => {
        resolve({ data: null, error: { message: `Supabase fetch timed out after ${timeoutMs}ms` } });
      }, timeoutMs);
    });

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutTimer!);

    const { data, error } = res as any;

    if (error) {
      console.warn('[Supabase] Could not fetch state from lms_state table:', error.message);
      return null;
    }

    if (data && data.data) {
      lastSyncedAt = data.updated_at || new Date().toISOString();
      return data.data as DatabaseSchema;
    }
  } catch (err) {
    console.error('[Supabase] Error fetching database:', err);
  }
  return null;
}

/**
 * Persist full database schema state to Supabase lms_state table
 */
export async function saveToSupabase(dbData: DatabaseSchema): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    const now = new Date().toISOString();
    const { error } = await sb.from('lms_state').upsert(
      {
        id: 'primary',
        data: dbData,
        updated_at: now,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('[Supabase] Failed to upsert to lms_state table:', error.message);
      return false;
    }

    lastSyncedAt = now;
    return true;
  } catch (err) {
    console.error('[Supabase] Error saving to Supabase:', err);
    return false;
  }
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ ok: boolean; message: string }> {
  const testUrl = (url || runtimeSupabaseUrl).trim();
  const testKey = (key || runtimeSupabaseKey).trim();

  if (!testUrl || !testKey) {
    return { ok: false, message: 'Supabase URL and API Key are required.' };
  }

  try {
    const testClient = createClient(testUrl, testKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check if lms_state table exists or attempt to query it
    const { error } = await testClient.from('lms_state').select('id').limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation "lms_state" does not exist') || error.message.includes('not found')) {
        return {
          ok: false,
          message: 'Connected to Supabase project, but "lms_state" table is missing. Run the provided SQL migration script in your Supabase SQL Editor.',
        };
      }
      return { ok: false, message: `Supabase error: ${error.message}` };
    }

    return { ok: true, message: 'Successfully connected to Supabase and verified lms_state table!' };
  } catch (err: any) {
    return { ok: false, message: `Connection failed: ${err.message || String(err)}` };
  }
}

