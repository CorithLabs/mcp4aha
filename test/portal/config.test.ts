import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { configRouter } from '../../src/portal/api/config.js';

// Mock the database service
const mockGetConfig = mock(async (key: string) => {
  if (key === 'aha_company') return 'mycompany';
  if (key === 'mcp_auth_token') return 'sometoken';
  return null;
});
const mockUpdateConfig = mock(async (_key: string, _value: string) => {});

mock.module('../../src/core/database/database.js', () => ({
  databaseService: {
    getConfig: mockGetConfig,
    updateConfig: mockUpdateConfig,
  },
}));

const app = express();
app.use(express.json());
app.use('/api/config', configRouter);

describe('GET /api/config', () => {
  it('returns company and hasToken: true when both exist', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.company).toBe('mycompany');
    expect(res.body.hasToken).toBe(true);
  });

  it('never returns raw token value', async () => {
    const res = await request(app).get('/api/config');
    expect(res.body.token).toBeUndefined();
    expect(res.body.mcp_auth_token).toBeUndefined();
  });
});

describe('POST /api/config', () => {
  it('saves sanitised subdomain and returns success', async () => {
    const res = await request(app)
      .post('/api/config')
      .send({ company: 'mycompany' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.company).toBe('mycompany');
  });

  it('strips protocol and domain suffix', async () => {
    const res = await request(app)
      .post('/api/config')
      .send({ company: 'https://mycompany.aha.io' });
    expect(res.status).toBe(200);
    expect(res.body.company).toBe('mycompany');
  });

  it('returns 400 if company is missing', async () => {
    const res = await request(app).post('/api/config').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 if company contains invalid characters', async () => {
    const res = await request(app)
      .post('/api/config')
      .send({ company: 'my company!' });
    expect(res.status).toBe(400);
  });
});
