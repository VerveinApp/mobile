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
 * The one Supabase client for the app — real auth (email OTP, and Apple/
 * Google once those are wired), not the AsyncStorage-only mock this
 * replaces. `storage: AsyncStorage` is required on React Native (Supabase's
 * default assumes a browser's localStorage, which doesn't exist here);
 * `detectSessionInUrl: false` because there's no browser URL for a redirect
 * to land in on a native app.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
