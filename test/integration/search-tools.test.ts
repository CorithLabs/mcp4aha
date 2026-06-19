/**
 * Integration tests for aha_search_ideas, aha_search_epics, aha_search_features MCP tools.
 * Uses MockAhaService — no real Aha API calls.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSearchTools } from '../../src/core/tools/search-tools.js';
import { setAhaService } from '../../src/core/services/index.js';
import { MockAhaService } from '../../src/core/services/aha-service.mock.js';

let server: McpServer;

beforeAll(() => {
  setAhaService(new MockAhaService());
  server = new McpServer({ name: 'test', version: '0.0.1' });
  registerSearchTools(server);
});

afterAll(() => {
  setAhaService(new MockAhaService());
});

async function callTool(name: string, args: Record<string, unknown>) {
  const handler = (server as any)._registeredTools?.[name]?.callback
    ?? (server as any)._tools?.[name];
  if (!handler) throw new Error(`Tool "${name}" not registered`);
  return handler(args, {});
}

// ─────────────────────────────────────────────
// aha_search_ideas
// ─────────────────────────────────────────────
describe('aha_search_ideas', () => {
  it('returns matching ideas for query containing "test"', async () => {
    const result = await callTool('aha_search_ideas', { q: 'test query' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed.records)).toBe(true);
    expect(parsed.records.length).toBe(2);
    expect(parsed.pagination).toBeDefined();
  });

  it('returns empty array for non-matching query', async () => {
    const result = await callTool('aha_search_ideas', { q: 'xyznonexistent' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.records).toEqual([]);
    expect(parsed.pagination.total_records).toBe(0);
  });

  it('rejects empty q string (Zod validation)', async () => {
    await expect(callTool('aha_search_ideas', { q: '' })).rejects.toThrow();
  });

  it('passes page and per_page through to service', async () => {
    const result = await callTool('aha_search_ideas', { q: 'test', page: 2, per_page: 10 });
    expect(result.isError).toBeFalsy();
    // Mock ignores pagination params but tool should not error
  });

  it('returns isError on service failure', async () => {
    const mock = new MockAhaService();
    mock.searchIdeas = async () => { throw new Error('API unavailable'); };
    setAhaService(mock);

    const result = await callTool('aha_search_ideas', { q: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error searching ideas');

    setAhaService(new MockAhaService());
  });
});

// ─────────────────────────────────────────────
// aha_search_epics
// ─────────────────────────────────────────────
describe('aha_search_epics', () => {
  it('returns matching epics for query containing "test"', async () => {
    const result = await callTool('aha_search_epics', { q: 'test' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed.records)).toBe(true);
    expect(parsed.records.length).toBe(1);
  });

  it('returns empty array for non-matching query', async () => {
    const result = await callTool('aha_search_epics', { q: 'xyznonexistent' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.records).toEqual([]);
  });

  it('rejects empty q (Zod)', async () => {
    await expect(callTool('aha_search_epics', { q: '' })).rejects.toThrow();
  });

  it('returns isError on service failure', async () => {
    const mock = new MockAhaService();
    mock.searchEpics = async () => { throw new Error('API unavailable'); };
    setAhaService(mock);

    const result = await callTool('aha_search_epics', { q: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error searching epics');

    setAhaService(new MockAhaService());
  });
});

// ─────────────────────────────────────────────
// aha_search_features
// ─────────────────────────────────────────────
describe('aha_search_features', () => {
  it('returns matching features for query containing "test"', async () => {
    const result = await callTool('aha_search_features', { q: 'test feature' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed.records)).toBe(true);
    expect(parsed.records.length).toBe(2);
  });

  it('returns empty array for non-matching query', async () => {
    const result = await callTool('aha_search_features', { q: 'xyznonexistent' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.records).toEqual([]);
  });

  it('rejects empty q (Zod)', async () => {
    await expect(callTool('aha_search_features', { q: '' })).rejects.toThrow();
  });

  it('returns isError on service failure', async () => {
    const mock = new MockAhaService();
    mock.searchFeatures = async () => { throw new Error('API unavailable'); };
    setAhaService(mock);

    const result = await callTool('aha_search_features', { q: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error searching features');

    setAhaService(new MockAhaService());
  });
});
