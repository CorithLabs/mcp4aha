/**
 * Integration tests for aha_get_idea, aha_get_epic, aha_get_feature MCP tools.
 * Uses MockAhaService via NODE_ENV=test + AHA_TOKEN=test-token.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFetchTools } from '../../src/core/tools/fetch-tools.js';
import { setAhaService } from '../../src/core/services/index.js';
import { MockAhaService } from '../../src/core/services/aha-service.mock.js';

let server: McpServer;

beforeAll(() => {
  // Inject mock service so no real Aha API calls are made
  setAhaService(new MockAhaService());
  server = new McpServer({ name: 'test', version: '0.0.1' });
  registerFetchTools(server);
});

// Helper: call a tool by name on the server
async function callTool(name: string, args: Record<string, unknown>) {
  // Access registered tools via the internal handler registry
  const handler = (server as any)._registeredTools?.[name]?.callback
    ?? (server as any)._tools?.[name];
  if (!handler) throw new Error(`Tool "${name}" not registered`);
  return handler(args, {});
}

// ─────────────────────────────────────────────
// aha_get_idea
// ─────────────────────────────────────────────
describe('aha_get_idea', () => {
  it('returns idea JSON for a valid id', async () => {
    const result = await callTool('aha_get_idea', { id: 'IDEA-1' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    // MockAhaService.getIdea returns generateMockIdea(1) wrapped as IdeaResponse
    expect(parsed).toBeDefined();
  });

  it('rejects an empty id (Zod validation)', async () => {
    await expect(callTool('aha_get_idea', { id: '' })).rejects.toThrow();
  });

  it('returns isError on service error', async () => {
    // Override getIdea to simulate a not-found error
    const mock = new MockAhaService();
    mock.getIdea = async () => { throw new Error('Idea not found'); };
    setAhaService(mock);

    const result = await callTool('aha_get_idea', { id: 'MISSING-999' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error fetching idea');

    // Restore default mock
    setAhaService(new MockAhaService());
  });
});

// ─────────────────────────────────────────────
// aha_get_epic
// ─────────────────────────────────────────────
describe('aha_get_epic', () => {
  it('returns epic JSON for a valid id', async () => {
    const result = await callTool('aha_get_epic', { id: 'EPIC-1' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toBeDefined();
  });

  it('rejects an empty id (Zod validation)', async () => {
    await expect(callTool('aha_get_epic', { id: '' })).rejects.toThrow();
  });

  it('returns isError on service error', async () => {
    const mock = new MockAhaService();
    mock.getEpic = async () => { throw new Error('Epic not found'); };
    setAhaService(mock);

    const result = await callTool('aha_get_epic', { id: 'MISSING-999' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error fetching epic');

    setAhaService(new MockAhaService());
  });
});

// ─────────────────────────────────────────────
// aha_get_feature
// ─────────────────────────────────────────────
describe('aha_get_feature', () => {
  it('returns feature JSON for a valid id', async () => {
    const result = await callTool('aha_get_feature', { id: 'FEAT-1' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toBeDefined();
  });

  it('rejects an empty id (Zod validation)', async () => {
    await expect(callTool('aha_get_feature', { id: '' })).rejects.toThrow();
  });

  it('returns isError on service error', async () => {
    const mock = new MockAhaService();
    mock.getFeature = async () => { throw new Error('Feature not found'); };
    setAhaService(mock);

    const result = await callTool('aha_get_feature', { id: 'MISSING-999' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error fetching feature');

    setAhaService(new MockAhaService());
  });
});
