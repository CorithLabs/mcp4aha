import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { databaseService } from './database/database.js';
import { registerSyncTools } from "./tools/sync-tools.js";
import { registerEmbeddingTools } from "./tools/embedding-tools.js";
import { log } from "./logger.js";
import { createAhaService, MissingCredentialsError, ConfigurationError } from "./services/aha-service-factory.js";

/**
 * Helper: resolve AhaService for the current request.
 * Reads the Aha API key from the MCP request context (meta.ahaApiKey).
 * Returns a structured MCP error content block if credentials are missing.
 */
async function getAhaService(meta?: { ahaApiKey?: string }) {
  const apiKey = meta?.ahaApiKey || process.env.AHA_TOKEN || '';
  return createAhaService(apiKey);
}

/**
 * Wrap a tool handler so credential errors produce structured MCP error responses
 * instead of crashing the server.
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
 * Register all tools with the MCP server.
 * Each handler calls createAhaService() to get a per-request AhaService
 * instance with the credentials passed by Claude Desktop.
 */
export function registerTools(server: McpServer) {

  // Create feature comment tool
  server.tool(
    "aha_create_feature_comment",
    "Create a comment on a feature in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      body: z.string().describe("Comment body")
    },
    async (params: { featureId: string; body: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const comment = await service.createFeatureComment(params.featureId, params.body);
          return { content: [{ type: "text" as const, text: `Comment created successfully:\n\n${JSON.stringify(comment, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error creating comment: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Associate feature with epic
  server.tool(
    "aha_associate_feature_with_epic",
    "Associate a feature with an epic in Aha.io",
    { featureId: z.string().describe("ID of the feature"), epicId: z.string().describe("ID or name of the epic") },
    async (params: { featureId: string; epicId: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.associateFeatureWithEpic(params.featureId, params.epicId);
          return { content: [{ type: "text" as const, text: `Feature associated with epic:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Move feature to release
  server.tool(
    "aha_move_feature_to_release",
    "Move a feature to a different release in Aha.io",
    { featureId: z.string().describe("ID of the feature"), releaseId: z.string().describe("ID or key of the target release") },
    async (params: { featureId: string; releaseId: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.moveFeatureToRelease(params.featureId, params.releaseId);
          return { content: [{ type: "text" as const, text: `Feature moved to release:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Associate feature with goals
  server.tool(
    "aha_associate_feature_with_goals",
    "Associate a feature with multiple goals in Aha.io",
    { featureId: z.string().describe("ID of the feature"), goalIds: z.array(z.number()).describe("Array of goal IDs") },
    async (params: { featureId: string; goalIds: number[] }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.associateFeatureWithGoals(params.featureId, params.goalIds);
          return { content: [{ type: "text" as const, text: `Feature associated with goals:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Update feature tags
  server.tool(
    "aha_update_feature_tags",
    "Update tags for a feature in Aha.io",
    { featureId: z.string().describe("ID of the feature"), tags: z.array(z.string()).describe("Array of tag strings") },
    async (params: { featureId: string; tags: string[] }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.updateFeatureTags(params.featureId, params.tags);
          return { content: [{ type: "text" as const, text: `Tags updated:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create epic in product
  server.tool(
    "aha_create_epic_in_product",
    "Create an epic within a specific product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      epicData: z.object({ epic: z.object({ name: z.string(), description: z.string().optional() }) })
    },
    async (params: { productId: string; epicData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const epic = await service.createEpicInProduct(params.productId, params.epicData);
          return { content: [{ type: "text" as const, text: `Epic created:\n\n${JSON.stringify(epic, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create epic in release
  server.tool(
    "aha_create_epic_in_release",
    "Create an epic within a specific release in Aha.io",
    {
      releaseId: z.string().describe("ID of the release"),
      epicData: z.object({ epic: z.object({ name: z.string(), description: z.string().optional() }) })
    },
    async (params: { releaseId: string; epicData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const epic = await service.createEpicInRelease(params.releaseId, params.epicData);
          return { content: [{ type: "text" as const, text: `Epic created:\n\n${JSON.stringify(epic, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create initiative in product
  server.tool(
    "aha_create_initiative_in_product",
    "Create an initiative within a specific product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      initiativeData: z.object({ initiative: z.object({ name: z.string(), description: z.string().optional() }) })
    },
    async (params: { productId: string; initiativeData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const initiative = await service.createInitiativeInProduct(params.productId, params.initiativeData);
          return { content: [{ type: "text" as const, text: `Initiative created:\n\n${JSON.stringify(initiative, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create feature
  server.tool(
    "aha_create_feature",
    "Create a feature within a specific release in Aha.io",
    {
      releaseId: z.string().describe("ID of the release"),
      featureData: z.object({ feature: z.object({ name: z.string(), description: z.string().optional() }) })
    },
    async (params: { releaseId: string; featureData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.createFeature(params.releaseId, params.featureData);
          return { content: [{ type: "text" as const, text: `Feature created:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Update feature
  server.tool(
    "aha_update_feature",
    "Update a feature in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      featureData: z.object({ feature: z.object({ name: z.string().optional(), description: z.string().optional() }) })
    },
    async (params: { featureId: string; featureData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.updateFeature(params.featureId, params.featureData);
          return { content: [{ type: "text" as const, text: `Feature updated:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Delete feature
  server.tool(
    "aha_delete_feature",
    "Delete a feature in Aha.io",
    { featureId: z.string().describe("ID of the feature") },
    async (params: { featureId: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          await service.deleteFeature(params.featureId);
          return { content: [{ type: "text" as const, text: `Feature ${params.featureId} deleted` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Update feature progress
  server.tool(
    "aha_update_feature_progress",
    "Update a feature's progress in Aha.io",
    { featureId: z.string(), progress: z.number().min(0).max(100) },
    async (params: { featureId: string; progress: number }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.updateFeatureProgress(params.featureId, params.progress);
          return { content: [{ type: "text" as const, text: `Progress updated:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Update feature score
  server.tool(
    "aha_update_feature_score",
    "Update a feature's score in Aha.io",
    { featureId: z.string(), score: z.number() },
    async (params: { featureId: string; score: number }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const feature = await service.updateFeatureScore(params.featureId, params.score);
          return { content: [{ type: "text" as const, text: `Score updated:\n\n${JSON.stringify(feature, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Update feature custom fields
  server.tool(
    "aha_update_feature_custom_fields",
    "Update a feature's custom fields in Aha.io",
    { featureId: z.string(), customFields: z.object({}) },
    async (params: { featureId: string; customFields: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          await service.updateFeatureCustomFields(params.featureId, params.customFields);
          return { content: [{ type: "text" as const, text: `Custom fields updated for feature ${params.featureId}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Update epic
  server.tool(
    "aha_update_epic",
    "Update an epic in Aha.io",
    {
      epicId: z.string(),
      epicData: z.object({ epic: z.object({ name: z.string().optional(), description: z.string().optional() }) })
    },
    async (params: { epicId: string; epicData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const epic = await service.updateEpic(params.epicId, params.epicData);
          return { content: [{ type: "text" as const, text: `Epic updated:\n\n${JSON.stringify(epic, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Delete epic
  server.tool(
    "aha_delete_epic",
    "Delete an epic in Aha.io",
    { epicId: z.string() },
    async (params: { epicId: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          await service.deleteEpic(params.epicId);
          return { content: [{ type: "text" as const, text: `Epic ${params.epicId} deleted` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create idea
  server.tool(
    "aha_create_idea",
    "Create an idea in a product in Aha.io",
    {
      productId: z.string(),
      ideaData: z.object({ idea: z.object({ name: z.string(), description: z.string().optional(), skip_portal: z.boolean().optional() }) })
    },
    async (params: { productId: string; ideaData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const idea = await service.createIdea(params.productId, params.ideaData);
          return { content: [{ type: "text" as const, text: `Idea created:\n\n${JSON.stringify(idea, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create idea with category
  server.tool(
    "aha_create_idea_with_category",
    "Create an idea with a category in a product in Aha.io",
    {
      productId: z.string(),
      ideaData: z.object({ idea: z.object({ name: z.string(), description: z.string().optional(), category: z.string(), skip_portal: z.boolean().optional() }) })
    },
    async (params: { productId: string; ideaData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const idea = await service.createIdeaWithCategory(params.productId, params.ideaData);
          return { content: [{ type: "text" as const, text: `Idea created:\n\n${JSON.stringify(idea, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create idea with score
  server.tool(
    "aha_create_idea_with_score",
    "Create an idea with a score in a product in Aha.io",
    {
      productId: z.string(),
      ideaData: z.object({ idea: z.object({ name: z.string(), description: z.string().optional(), score: z.number(), skip_portal: z.boolean().optional() }) })
    },
    async (params: { productId: string; ideaData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const idea = await service.createIdeaWithScore(params.productId, params.ideaData);
          return { content: [{ type: "text" as const, text: `Idea created:\n\n${JSON.stringify(idea, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Delete idea
  server.tool(
    "aha_delete_idea",
    "Delete an idea in Aha.io",
    { ideaId: z.string() },
    async (params: { ideaId: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          await service.deleteIdea(params.ideaId);
          return { content: [{ type: "text" as const, text: `Idea ${params.ideaId} deleted` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create competitor
  server.tool(
    "aha_create_competitor",
    "Create a competitor in a product in Aha.io",
    {
      productId: z.string(),
      competitorData: z.object({ competitor: z.object({ name: z.string(), description: z.string().optional(), website: z.string().optional() }) })
    },
    async (params: { productId: string; competitorData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const competitor = await service.createCompetitor(params.productId, params.competitorData);
          return { content: [{ type: "text" as const, text: `Competitor created:\n\n${JSON.stringify(competitor, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Update competitor
  server.tool(
    "aha_update_competitor",
    "Update a competitor in Aha.io",
    {
      competitorId: z.string(),
      competitorData: z.object({ competitor: z.object({ name: z.string().optional(), description: z.string().optional(), website: z.string().optional() }) })
    },
    async (params: { competitorId: string; competitorData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const competitor = await service.updateCompetitor(params.competitorId, params.competitorData);
          return { content: [{ type: "text" as const, text: `Competitor updated:\n\n${JSON.stringify(competitor, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Delete competitor
  server.tool(
    "aha_delete_competitor",
    "Delete a competitor in Aha.io",
    { competitorId: z.string() },
    async (params: { competitorId: string }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          await service.deleteCompetitor(params.competitorId);
          return { content: [{ type: "text" as const, text: `Competitor ${params.competitorId} deleted` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create idea by portal user
  server.tool(
    "aha_create_idea_by_portal_user",
    "Create an idea by a portal user in Aha.io",
    {
      productId: z.string(),
      ideaData: z.object({
        idea: z.object({
          name: z.string(),
          description: z.string().optional(),
          submitted_idea_portal_id: z.string().optional(),
          skip_portal: z.boolean().optional(),
          created_by_portal_user: z.object({ id: z.number(), name: z.string() })
        })
      })
    },
    async (params: { productId: string; ideaData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const idea = await service.createIdeaByPortalUser(params.productId, params.ideaData);
          return { content: [{ type: "text" as const, text: `Idea created:\n\n${JSON.stringify(idea, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Create idea with portal settings
  server.tool(
    "aha_create_idea_with_portal_settings",
    "Create an idea with enhanced portal settings in Aha.io",
    {
      productId: z.string(),
      ideaData: z.object({
        idea: z.object({
          name: z.string(),
          description: z.string().optional(),
          submitted_idea_portal_id: z.string().optional(),
          skip_portal: z.boolean().optional(),
          category: z.string().optional(),
          score: z.number().optional()
        })
      })
    },
    async (params: { productId: string; ideaData: any }, { meta }: any = {}) => {
      return withCredentials(meta, async (service) => {
        try {
          const idea = await service.createIdeaWithPortalSettings(params.productId, params.ideaData);
          return { content: [{ type: "text" as const, text: `Idea created:\n\n${JSON.stringify(idea, null, 2)}` }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      });
    }
  );

  // Register sync and embedding tools
  registerSyncTools(server);
  registerEmbeddingTools(server);
}
