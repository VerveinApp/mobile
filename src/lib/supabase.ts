import './crypto-polyfill';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// EXPO_PUBLIC_* vars are inlined at build time and shipped inside the app
// binary — both of these are meant to be public/client-embeddable (the
// anon/publishable key relies on Row Level Security for real protection,
// not secrecy). Real values live in .env.local (gitignored, not because
// the values are secret, but so machine-specific project config doesn't
// get committed) — see .env.example for the required shape.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill in real values from the Supabase dashboard (Settings > API).'
  );
}

/**
 * The one Supabase client for the app — real auth (email OTP, Apple, and
 * Google), not the AsyncStorage-only mock this replaces. `storage:
 * AsyncStorage` is required on React Native (Supabase's default assumes a
 * browser's localStorage, which doesn't exist here); `detectSessionInUrl:
 * false` because there's no browser URL for a redirect to land in on a
 * native app.
 *
 * BUG FIX: `flowType: 'pkce'` is required for social-auth.ts's Google
 * sign-in to work at all — `@supabase/auth-js` defaults to the IMPLICIT
 * flow, which returns the session as a URL FRAGMENT
 * (`#access_token=...&refresh_token=...`) after the OAuth redirect, never a
 * `?code=` query param. social-auth.ts's Google flow reads
 * `new URL(result.url).searchParams.get('code')` (matching
 * exchangeCodeForSession's PKCE-flow contract) — under the implicit-flow
 * default that's always null, so Google sign-in failed with "didn't return
 * a real authorization code" on every attempt regardless of how correctly
 * Google Cloud/Supabase's dashboard were configured. PKCE is also
 * Supabase's own documented recommendation for native/mobile clients
 * generally, not just a fix for this one symptom.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
