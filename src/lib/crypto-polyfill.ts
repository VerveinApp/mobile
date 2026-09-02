import * as ExpoCrypto from 'expo-crypto';

// Hermes has no WebCrypto (`crypto.subtle`), which Supabase's GoTrue client
// needs for PKCE code-challenge hashing inside signInWithIdToken /
// exchangeCodeForSession — without this, those calls hang forever instead of
// throwing, with no error to debug. expo-crypto's digest() already matches
// crypto.subtle.digest()'s exact contract (BufferSource in, ArrayBuffer out,
// identical algorithm name strings like "SHA-256"), so this is a thin bridge,
// not a reimplementation. Must be imported before any Supabase client is
// created — see supabase.ts's first import.
const g = globalThis as unknown as { crypto?: Record<string, unknown> };

if (!g.crypto) {
  g.crypto = {};
}
if (typeof g.crypto.getRandomValues !== 'function') {
  g.crypto.getRandomValues = ExpoCrypto.getRandomValues;
}
if (!g.crypto.subtle) {
  g.crypto.subtle = {
    digest: (algorithm: ExpoCrypto.CryptoDigestAlgorithm, data: BufferSource) =>
      ExpoCrypto.digest(algorithm, data),
  };
}
