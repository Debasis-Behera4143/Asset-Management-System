const { aiRateLimiter } = require('../rateLimiter');

describe('AI Rate Limiter Middleware Test Suite', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: { id: 'user_1' },
      ip: '127.0.0.1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should call next for requests under the limit', () => {
    // Unique user ID for this test
    req.user.id = 'user_under_limit';

    aiRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 429 when request count exceeds maxRequests', () => {
    req.user.id = 'user_over_limit';

    // Send 15 requests (allowed)
    for (let i = 0; i < 15; i++) {
      aiRateLimiter(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(15);
    expect(res.status).not.toHaveBeenCalled();

    // 16th request should fail
    aiRateLimiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 429,
        message: expect.stringContaining('Too many requests'),
      })
    );
    // next should not be called again
    expect(next).toHaveBeenCalledTimes(15);
  });

  test('should use req.ip if req.user.id is not present', () => {
    req.user = null;
    req.ip = '192.168.1.50';

    aiRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should clear old requests outside windowMs', () => {
    req.user.id = 'user_window_expiry';

    const originalDateNow = Date.now;
    let mockTime = Date.now();
    global.Date.now = jest.fn(() => mockTime);

    // Call 15 times at mockTime
    for (let i = 0; i < 15; i++) {
      aiRateLimiter(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(15);

    // Advance mock time by 61 seconds (window is 60 seconds)
    mockTime += 61 * 1000;

    // Call again, should pass because the previous 15 are expired
    aiRateLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(16);
    expect(res.status).not.toHaveBeenCalled();

    // Restore original Date.now
    global.Date.now = originalDateNow;
  });
});
