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
 * Register fetch-by-id tools: aha_get_idea, aha_get_epic, aha_get_feature
 */
export function registerFetchTools(server: McpServer) {

  // -------------------------
  // aha_get_idea
  // -------------------------
  server.tool(
    "aha_get_idea",
    "Fetch a single idea from Aha.io by its numeric ID or reference key (e.g. APP-I-123)",
    {
      id: z.string().min(1).describe("Aha idea ID or reference key (e.g. '123456789' or 'APP-I-123')"),
    },
    async (params: { id: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const idea = await service.getIdea(params.id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(idea, null, 2),
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error('aha_get_idea failed', error as Error, { id: params.id });
          return {
            content: [{ type: "text" as const, text: `Error fetching idea: ${msg}` }],
            isError: true as const,
          };
        }
      });
    }
  );

  // -------------------------
  // aha_get_epic
  // -------------------------
  server.tool(
    "aha_get_epic",
    "Fetch a single epic from Aha.io by its numeric ID or reference key (e.g. APP-E-42)",
    {
      id: z.string().min(1).describe("Aha epic ID or reference key (e.g. '123456789' or 'APP-E-42')"),
    },
    async (params: { id: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const epic = await service.getEpic(params.id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(epic, null, 2),
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error('aha_get_epic failed', error as Error, { id: params.id });
          return {
            content: [{ type: "text" as const, text: `Error fetching epic: ${msg}` }],
            isError: true as const,
          };
        }
      });
    }
  );

  // -------------------------
  // aha_get_feature
  // -------------------------
  server.tool(
    "aha_get_feature",
    "Fetch a single feature from Aha.io by its numeric ID or reference key (e.g. APP-F-7)",
    {
      id: z.string().min(1).describe("Aha feature ID or reference key (e.g. '123456789' or 'APP-F-7')"),
    },
    async (params: { id: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.getFeature(params.id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(feature, null, 2),
            }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          log.error('aha_get_feature failed', error as Error, { id: params.id });
          return {
            content: [{ type: "text" as const, text: `Error fetching feature: ${msg}` }],
            isError: true as const,
          };
        }
      });
    }
  );
}
