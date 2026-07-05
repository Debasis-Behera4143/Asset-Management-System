const {
  encrypt,
  decrypt,
  encryptField,
  decryptField,
  encryptPayload,
  decryptPayload,
  hashValue,
} = require('../encryptionUtils');

describe('encryptionUtils Test Suite', () => {
  const plaintext = 'Secret Message 123';

  test('should encrypt and decrypt a plaintext string correctly', () => {
    const encrypted = encrypt(plaintext);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(plaintext);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  test('should return null if encrypting null or undefined', () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeNull();
    expect(decrypt(null)).toBeNull();
    expect(decrypt(undefined)).toBeNull();
  });

  test('should encrypt and decrypt db fields', () => {
    const emptyField = '';
    expect(encryptField(emptyField)).toEqual(emptyField);
    expect(decryptField(emptyField)).toEqual(emptyField);

    const val = 'PII_DATA';
    const encrypted = encryptField(val);
    expect(encrypted).not.toEqual(val);
    expect(decryptField(encrypted)).toEqual(val);
  });

  test('should decrypt fallback value on tamper/malformed data', () => {
    const plaintextField = 'Some Plaintext Field';
    expect(decryptField(plaintextField)).toEqual(plaintextField);
  });

  test('should encrypt and decrypt request/response payload objects', () => {
    const payload = { data: 'my-sensitive-data', list: [1, 2, 3] };
    const result = encryptPayload(payload);
    expect(result.encrypted).toBeDefined();

    const decrypted = decryptPayload(result);
    expect(decrypted).toEqual(payload);
  });

  test('should return same object if payload is not encrypted', () => {
    const payload = { data: 'plaintext' };
    expect(decryptPayload(payload)).toEqual(payload);
    expect(decryptPayload(null)).toBeNull();
  });

  test('should generate SHA-256 hash of values correctly', () => {
    const value = 'token-to-hash';
    const hash = hashValue(value);
    expect(hash).toHaveLength(64); // SHA-256 is 64 hex characters
    expect(hash).not.toEqual(value);

    // Verify hash is deterministic
    expect(hashValue(value)).toEqual(hash);
  });

  test('should fail decryption when authentication tag or ciphertext is tampered', () => {
    const encrypted = encrypt(plaintext);
    // Tamper the encrypted string
    const tampered = encrypted.substring(0, encrypted.length - 5) + 'AAAAA';
    expect(() => decrypt(tampered)).toThrow();
  });
});
