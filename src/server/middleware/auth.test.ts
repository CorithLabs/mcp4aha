import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Request, Response, NextFunction } from 'express';

let storedToken: string | null = 'valid-token-abc123';

mock.module('../../src/core/database/database.js', () => ({
  databaseService: {
    getConfig: mock(async (key: string) => {
      if (key === 'mcp_auth_token') return storedToken;
      return null;
    }),
  },
}));

// Import after mock
const { bearerAuth } = await import('../../src/server/middleware/auth.js');

function makeReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as any;
}

function makeRes(): { status: any; json: any; _status: number; _body: any } {
  const res: any = {};
  res.json = mock((body: any) => { res._body = body; return res; });
  res.status = mock((code: number) => { res._status = code; return res; });
  return res;
}

describe('bearerAuth', () => {
  const next: NextFunction = mock(() => {});

  beforeEach(() => {
    storedToken = 'valid-token-abc123';
    (next as any).mockReset?.();
  });

  it('returns 503 when no token is configured', async () => {
    storedToken = null;
    const req = makeReq();
    const res = makeRes();
    await bearerAuth(req as Request, res as unknown as Response, next);
    expect(res._status).toBe(503);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq();
    const res = makeRes();
    await bearerAuth(req as Request, res as unknown as Response, next);
    expect(res._status).toBe(401);
  });

  it('returns 401 when token does not match', async () => {
    const req = makeReq({ authorization: 'Bearer wrong-token' });
    const res = makeRes();
    await bearerAuth(req as Request, res as unknown as Response, next);
    expect(res._status).toBe(401);
  });

  it('calls next() when token is valid', async () => {
    const req = makeReq({ authorization: 'Bearer valid-token-abc123' });
    const res = makeRes();
    await bearerAuth(req as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('attaches ahaApiKey to req when X-Aha-Api-Key header present', async () => {
    const req = makeReq({
      authorization: 'Bearer valid-token-abc123',
      'x-aha-api-key': 'my-aha-key',
    });
    const res = makeRes();
    await bearerAuth(req as Request, res as unknown as Response, next);
    expect((req as any).ahaApiKey).toBe('my-aha-key');
  });

  it('does not log Aha API key value', async () => {
    // Verify no console.log calls contain the API key — structural check
    const consoleSpy = mock((...args: any[]) => {});
    const origLog = console.log;
    console.log = consoleSpy;

    const req = makeReq({
      authorization: 'Bearer valid-token-abc123',
      'x-aha-api-key': 'super-secret-key',
    });
    const res = makeRes();
    await bearerAuth(req as Request, res as unknown as Response, next);

    const loggedContent = consoleSpy.mock.calls.map(c => JSON.stringify(c)).join('');
    expect(loggedContent).not.toContain('super-secret-key');

    console.log = origLog;
  });
});
