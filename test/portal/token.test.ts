import { describe, it, expect, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { tokenRouter } from '../../src/portal/api/token.js';

let mockCompany: string | null = 'mycompany';
let mockToken: string | null = null;
const mockUpdateConfig = mock(async (_key: string, value: string) => {
  mockToken = value;
});

mock.module('../../src/core/database/database.js', () => ({
  databaseService: {
    getConfig: mock(async (key: string) => {
      if (key === 'aha_company') return mockCompany;
      if (key === 'mcp_auth_token') return mockToken;
      return null;
    }),
    updateConfig: mockUpdateConfig,
  },
}));

const app = express();
app.use(express.json());
app.use('/api/token', tokenRouter);

describe('POST /api/token/generate', () => {
  it('generates a token when company is set', async () => {
    mockCompany = 'mycompany';
    const res = await request(app).post('/api/token/generate');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('returns 400 when company is not configured', async () => {
    mockCompany = null;
    const res = await request(app).post('/api/token/generate');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Company subdomain must be configured first');
  });

  it('generates a unique token each time', async () => {
    mockCompany = 'mycompany';
    const res1 = await request(app).post('/api/token/generate');
    const res2 = await request(app).post('/api/token/generate');
    expect(res1.body.token).not.toBe(res2.body.token);
  });
});

describe('GET /api/token', () => {
  it('returns exists: false when no token exists', async () => {
    mockToken = null;
    const res = await request(app).get('/api/token');
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it('returns exists: true and masked preview when token exists', async () => {
    mockToken = 'abcd1234567890efabcd1234567890efabcd1234567890efabcd1234567890ef';
    const res = await request(app).get('/api/token');
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.preview).toContain('...');
    expect(res.body.preview.startsWith('abcd')).toBe(true);
    // Must not return full token
    expect(res.body.preview).not.toBe(mockToken);
  });
});
