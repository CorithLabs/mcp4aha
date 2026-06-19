import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { createAhaService, MissingCredentialsError, ConfigurationError } from "../services/aha-service-factory.js";
import { log } from "../logger.js";

/**
 * Resolve AhaService for the current request using per-request credentials.
 */
async function getAhaService(meta?: { ahaApiKey?: string }) {
  const apiKey = meta?.ahaApiKey || process.env.AHA_TOKEN || '';
  return createAhaService(apiKey);
}

/**
 * Wrap a tool handler so credential errors produce structured MCP error responses.
 */
function withCredentials<T>(
  meta: { ahaApiKey?: string } | undefined,
  fn: (service: Awaited<ReturnType<typeof createAhaService>>) => Promise<T>,
): Promise<T | { content: Array<{ type: 'text'; text: string }>; isError: true }> {
  return getAhaService(meta)
    .then(fn)
    .catch((err: Error) => {
      if (err instanceof MissingCredentialsError || err instanceof ConfigurationError) {
        return {
          content: [{ type: 'text' as const, text: err.message }],
          isError: true as const,
        };
      }
      throw err;
    });
}

/**
 * Clamp per_page to the Aha.io API maximum of 200.
 */
function clampPerPage(n: number | undefined): number | undefined {
  if (n === undefined) return undefined;
  return Math.min(n, 200);
}

/**
 * Register search tools: aha_search_ideas, aha_search_epics, aha_search_features
 */
export function registerSearchTools(server: McpServer) {

  // -------------------------
  // aha_search_ideas
  // -------------------------
  server.tool(
    "aha_search_ideas",
    "Full-text search across ideas in Aha.io. Returns matching ideas with pagination metadata.",
    {
      q: z.string().min(1).describe("Search query string (must be non-empty)"),
      page: z.number().int().positive().optional().describe("Page number (default: 1)"),
      per_page: z.number().int().positive().max(200).optional().describe("Results per page (default: 20, max: 200)"),
    },
    async (params: { q: string; page?: number; per_page?: number }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const result = await service.searchIdeas({
            q: params.q,
            page: params.page,
            per_page: clampPerPage(params.per_page),
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error('aha_search_ideas failed', error as Error, { q: params.q });
          return {
            content: [{ type: "text" as const, text: `Error searching ideas: ${msg}` }],
            isError: true as const,
          };
        }
      });
    }
  );

  // -------------------------
  // aha_search_epics
  // -------------------------
  server.tool(
    "aha_search_epics",
    "Full-text search across epics in Aha.io. Returns matching epics with pagination metadata.",
    {
      q: z.string().min(1).describe("Search query string (must be non-empty)"),
      page: z.number().int().positive().optional().describe("Page number (default: 1)"),
      per_page: z.number().int().positive().max(200).optional().describe("Results per page (default: 20, max: 200)"),
    },
    async (params: { q: string; page?: number; per_page?: number }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const result = await service.searchEpics({
            q: params.q,
            page: params.page,
            per_page: clampPerPage(params.per_page),
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error('aha_search_epics failed', error as Error, { q: params.q });
          return {
            content: [{ type: "text" as const, text: `Error searching epics: ${msg}` }],
            isError: true as const,
          };
        }
      });
    }
  );

  // -------------------------
  // aha_search_features
  // -------------------------
  server.tool(
    "aha_search_features",
    "Full-text search across features in Aha.io. Returns matching features with pagination metadata.",
    {
      q: z.string().min(1).describe("Search query string (must be non-empty)"),
      page: z.number().int().positive().optional().describe("Page number (default: 1)"),
      per_page: z.number().int().positive().max(200).optional().describe("Results per page (default: 20, max: 200)"),
    },
    async (params: { q: string; page?: number; per_page?: number }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const result = await service.searchFeatures({
            q: params.q,
            page: params.page,
            per_page: clampPerPage(params.per_page),
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error('aha_search_features failed', error as Error, { q: params.q });
          return {
            content: [{ type: "text" as const, text: `Error searching features: ${msg}` }],
            isError: true as const,
          };
        }
      });
    }
  );
}
