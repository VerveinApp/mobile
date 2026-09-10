import AsyncStorage from '@react-native-async-storage/async-storage';

import { secureSessionStorage } from '@/lib/secure-session-storage';

describe('secureSessionStorage', () => {
  it('round-trips a value through encrypt/decrypt', async () => {
    await secureSessionStorage.setItem('test-key', 'hello world');
    expect(await secureSessionStorage.getItem('test-key')).toBe('hello world');
  });

  it('round-trips a large, session-shaped JSON value', async () => {
    const session = JSON.stringify({
      access_token: 'a'.repeat(800),
      refresh_token: 'b'.repeat(400),
      user: { id: 'user-1', email: 'test@example.com', user_metadata: { name: 'Test' } },
    });
    await secureSessionStorage.setItem('session-key', session);
    expect(await secureSessionStorage.getItem('session-key')).toBe(session);
  });

  it('returns null for a key that was never set', async () => {
    expect(await secureSessionStorage.getItem('never-set')).toBeNull();
  });

  it('removeItem clears both the encrypted blob and its key', async () => {
    await secureSessionStorage.setItem('to-remove', 'value');
    await secureSessionStorage.removeItem('to-remove');
    expect(await secureSessionStorage.getItem('to-remove')).toBeNull();
  });

  it('uses a fresh encryption key each write, so two writes never produce the same ciphertext', async () => {
    await secureSessionStorage.setItem('rekey-test', 'same value');
    const first = await AsyncStorage.getItem('rekey-test');
    await secureSessionStorage.setItem('rekey-test', 'same value');
    const second = await AsyncStorage.getItem('rekey-test');
    expect(first).not.toBe(second);
    expect(await secureSessionStorage.getItem('rekey-test')).toBe('same value');
  });
});
