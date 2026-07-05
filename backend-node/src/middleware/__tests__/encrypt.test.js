const { decryptRequest, encryptResponse, e2eEncryption } = require('../encrypt');
const { encryptPayload } = require('../../utils/encryptionUtils');

describe('E2E Encryption Middleware Test Suite', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  describe('decryptRequest', () => {
    test('should skip decryption if x-encrypted header is not true', () => {
      req.headers['x-encrypted'] = 'false';
      req.body = { encrypted: 'some-data' };

      decryptRequest(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ encrypted: 'some-data' });
    });

    test('should decrypt body if x-encrypted header is true and body contains encrypted data', () => {
      req.headers['x-encrypted'] = 'true';
      const originalPayload = { message: 'hello world' };
      const encryptedObj = encryptPayload(originalPayload);
      req.body = encryptedObj;

      decryptRequest(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual(originalPayload);
    });

    test('should return 400 bad request if decryption fails', () => {
      req.headers['x-encrypted'] = 'true';
      req.body = { encrypted: 'tampered-or-invalid-base64url' };

      decryptRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          status: 400,
          message: 'Invalid encrypted payload — decryption failed',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('encryptResponse', () => {
    test('should skip intercepting res.json if x-encrypted header is not true', () => {
      req.headers['x-encrypted'] = 'false';
      const originalJson = res.json;

      encryptResponse(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.json).toBe(originalJson);
    });

    test('should encrypt res.json output if x-encrypted header is true', () => {
      req.headers['x-encrypted'] = 'true';
      const originalMockJson = res.json;

      encryptResponse(req, res, next);

      expect(next).toHaveBeenCalled();

      const testPayload = { secret: 'data' };
      res.json(testPayload);

      expect(res.setHeader).toHaveBeenCalledWith('x-encrypted', 'true');
      expect(originalMockJson).not.toHaveBeenCalledWith(testPayload);
      expect(originalMockJson).toHaveBeenCalledWith(
        expect.objectContaining({ encrypted: expect.any(String) })
      );
    });
  });

  describe('e2eEncryption integration', () => {
    test('should apply both decryptRequest and encryptResponse in sequence', () => {
      req.headers['x-encrypted'] = 'true';
      const payload = { hello: 'world' };
      req.body = encryptPayload(payload);

      e2eEncryption(req, res, next);

      expect(req.body).toEqual(payload);
      expect(next).toHaveBeenCalled();
    });
  });
});
