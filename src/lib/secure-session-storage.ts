import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { requireOptionalNativeModule } from 'expo';

// BUG FIX: expo-secure-store's own package calls requireNativeModule (the
// throwing variant, not the optional one) unconditionally at its module's
// top level — `import * as SecureStore from 'expo-secure-store'` used to
// sit here directly, which crashed the ENTIRE app at root-layout import
// time on any build that hasn't been natively rebuilt since this
// dependency was added (expo-secure-store is a native module; adding it
// via npm/expo install alone doesn't make it available in an
// already-built dev client — a real rebuild does). A brand-new dependency
// should degrade this store to its previous plain-AsyncStorage behavior,
// never take the whole app down with it. requireOptionalNativeModule (re-exported
// by `expo` from expo-modules-core, always safe to call) checks for the native module
// WITHOUT throwing; only if it's actually there do we `require()`
// expo-secure-store itself, so that package's own throwing check never
// executes on a build where the native side isn't linked yet.
const isSecureStoreLinked = requireOptionalNativeModule('ExpoSecureStore') !== null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = isSecureStoreLinked ? (require('expo-secure-store') as typeof import('expo-secure-store')) : null;

/**
 * Supabase's own documented storage adapter for React Native — see their
 * "Building a React Native app" guide. Plain AsyncStorage (this app's
 * previous choice) isn't hardware-encrypted, so a session's raw access/
 * refresh tokens sat in the same on-disk store as everything else,
 * recoverable via a jailbreak or a backup extraction (found in a later
 * full-app audit as a real, if bounded — no remote exploit path —
 * defense-in-depth gap).
 *
 * SecureStore alone can't hold the session directly: it's Keychain-backed
 * (real hardware encryption) but capped at ~2KB per item, which a
 * Supabase session (access token + refresh token + user metadata as JSON)
 * can exceed. The hybrid used here sidesteps that instead of risking a
 * silent failure once a session happens to grow past the limit: only a
 * fixed-size, single-use-per-key AES encryption key ever goes into
 * SecureStore (always small, always fits); the actual session — of
 * whatever size — goes into AsyncStorage, but AES-encrypted, so a copy of
 * it on disk is useless without the Keychain-protected key.
 *
 * Falls back to plain, unencrypted AsyncStorage (this store's own previous
 * behavior, and still an entirely functional session store — the fallback
 * is a security regression only, never a functional one) whenever the
 * native module isn't linked yet — see isSecureStoreLinked above.
 *
 * crypto.getRandomValues comes from crypto-polyfill.ts, already imported
 * before this module ever runs (see supabase.ts's own import order) — no
 * separate random-values polyfill needed.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore!.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore!.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    if (!SecureStore) return AsyncStorage.getItem(key);
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await this.decrypt(key, encrypted);
    } catch {
      // The encrypted blob and its SecureStore key can only ever go out of
      // sync if one half was cleared independently of the other (e.g. an
      // OS-level Keychain reset that AsyncStorage doesn't share) — treated
      // as "no session," the same honest state a first sign-in starts
      // from, not a crash.
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!SecureStore) return AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!SecureStore) return AsyncStorage.setItem(key, value);
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

export const secureSessionStorage = new LargeSecureStore();
