import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

/**
 * Real Apple/Google sign-in — replaces create-account.tsx's old honest
 * placeholder (see that file's own "DISCLOSED FIX" comment on
 * handleAppleAuth/handleGoogleAuth). Both providers verify identity
 * themselves (Apple's own sheet, Google's OAuth consent screen), so neither
 * path goes through this app's email-OTP verification screen — a real
 * identity proof already happened before this function ever returns
 * 'success', not a shortcut around verification.
 *
 * `email` is always the real, provider-verified address (or Apple's private
 * relay address if the user chose to hide their real one — still a real,
 * usable email Supabase and this app treat the same as any other).
 */
export type SocialAuthResult =
  | { kind: 'success'; email: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * `expo-apple-authentication` → `supabase.auth.signInWithIdToken()`. The raw
 * nonce goes to Supabase, the SHA-256 hash of it goes to Apple — Apple signs
 * the hash into the identity token, Supabase verifies it hashes back to the
 * raw value it was given, which is what actually proves this exact request
 * produced this exact token (replay protection, per Apple/Supabase's own
 * documented pairing — sending the same value to both would defeat the
 * point).
 *
 * Requires the real external setup this file can't do for you: the "Sign In
 * with Apple" capability enabled on this app's Apple Developer identifier
 * (app.json's expo-apple-authentication plugin only writes the entitlement
 * into the native project on the next prebuild/EAS build — the Developer
 * portal capability itself is a separate, manual step), and the Apple
 * provider enabled in the Supabase dashboard (Authentication → Providers →
 * Apple) with this app's bundle ID (app.vervein) added to its Authorized
 * Client IDs — the native identity-token flow used here doesn't need a full
 * Services ID / private key the way Apple's web OAuth redirect flow would.
 * Without that Supabase-side config, this will reach Apple's real sheet and
 * then fail at the signInWithIdToken step with a real, honest error — never
 * a fake success.
 */
export async function signInWithApple(): Promise<SocialAuthResult> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      return { kind: 'error', message: "Apple didn't return a real identity token. Please try again." };
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { kind: 'error', message: error.message };
    // Apple only ever returns credential.email on the FIRST authorization
    // ever for this app — data.user.email (Supabase's own record of the
    // verified identity) is the reliable read on every later sign-in.
    const email = data.user?.email ?? credential.email;
    if (!email) return { kind: 'error', message: "Apple didn't share an email for this account." };
    return { kind: 'success', email };
  } catch (err) {
    // ERR_REQUEST_CANCELED — the user backed out of Apple's own sheet, the
    // most common non-success outcome by far. No error, nothing to say,
    // same as paywall.tsx's own cancelled-purchase handling.
    if (isCancelledError(err)) return { kind: 'cancelled' };
    return { kind: 'error', message: 'Apple sign-in failed. Please try again.' };
  }
}

/**
 * Native `@react-native-google-signin/google-signin` → `supabase.auth.
 * signInWithIdToken()` — same shape as signInWithApple above (a real
 * identity token, verified by Supabase, never a browser redirect). Replaces
 * an earlier `signInWithOAuth` + `expo-web-browser` implementation that
 * showed Supabase's own domain in a system browser sheet instead of
 * Google's native account picker — this is the in-app, native experience
 * that was the whole point.
 *
 * `configure()` is called on every invocation rather than once at app
 * startup: it's a synchronous, in-memory, side-effect-free call (no network
 * request), so there's no real cost to keeping this function self-contained
 * the same way signInWithApple needs no separate init step either.
 *
 * Requires the real external setup this file can't do for you: a Google
 * Cloud Console project with an OAuth consent screen, a Web application
 * client ID (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) and an iOS client ID
 * (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) under it, the iOS client's URL scheme
 * registered via app.json's google-signin plugin config, and the Google
 * provider enabled in the Supabase dashboard with both client IDs listed in
 * its "Client IDs" field (no secret needed for this ID-token flow, same as
 * Apple's). Without that, this will reach Google's real native picker and
 * then fail at the signInWithIdToken step with a real, honest error — never
 * a fake success.
 */
export async function signInWithGoogle(): Promise<SocialAuthResult> {
  try {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { kind: 'cancelled' };
    const idToken = response.data.idToken;
    if (!idToken) return { kind: 'error', message: "Google didn't return a real identity token. Please try again." };

    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) return { kind: 'error', message: error.message };
    const email = data.user?.email ?? response.data.user.email;
    if (!email) return { kind: 'error', message: "Google didn't share an email for this account." };
    return { kind: 'success', email };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return { kind: 'cancelled' };
    return { kind: 'error', message: 'Google sign-in failed. Please try again.' };
  }
}

function isCancelledError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'ERR_REQUEST_CANCELED';
}
