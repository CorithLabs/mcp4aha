/**
 * MULTI-USER NOTE:
 * Sync tools use the BackgroundSyncService which maintains its own connection to
 * the Aha API using the server-level AHA_COMPANY config. Background sync jobs do NOT
 * use per-request Aha API keys — they are not supported in multi-user mode.
 *
 * When a user triggers aha_sync_start, the sync job will run using whatever credentials
 * were last set via AhaService.initialize(). This is a known limitation of v1.
 *
 * Future work: capture the Aha API key at job creation time and store it securely
 * for the duration of the background job.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { backgroundSyncService, BackgroundSyncService } from "../services/sync-service.js";
import { databaseService, DatabaseService } from "../database/database.js";

/**
 * Register sync observability and control tools with the MCP server.
 * These tools allow LLMs to monitor and control background sync operations.
 *
 * NOTE: Background sync operations use server-level Aha credentials, not
 * per-request credentials. In multi-user mode, sync results are shared
 * across all users.
 */
export function registerSyncTools(
  server: McpServer,
  syncService: BackgroundSyncService = backgroundSyncService,
  database: DatabaseService = databaseService
) {

  // Get current sync status
  server.tool(
    "aha_sync_status",
    "Get current status of all sync operations including progress, active jobs, and recent history",
    {
      jobId: z.string().optional().describe("Specific job ID to get status for (optional)")
    },
    async (params: { jobId?: string }) => {
      try {
        if (params.jobId) {
          const progress = await syncService.getSyncProgress(params.jobId);
          if (!progress) {
            return { content: [{ type: "text" as const, text: `Sync job '${params.jobId}' not found` }], isError: true };
          }
          const history = await syncService.getSyncHistory(params.jobId);
          return { content: [{ type: "text" as const, text: JSON.stringify({ job: progress, recent_history: history.slice(0, 10) }, null, 2) }] };
        } else {
          const activeSyncs = await syncService.getActiveSyncs();
          const healthStatus = await syncService.getHealthStatus();
          const syncSummary = await database.getSyncStatusSummary();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                active_syncs: activeSyncs,
                health: healthStatus,
                entity_sync_status: syncSummary,
                multi_user_note: "Background sync uses server-level credentials — not per-user API keys",
                summary: {
                  total_active_jobs: activeSyncs.length,
                  running_jobs: activeSyncs.filter(s => s.status === 'running').length,
                  paused_jobs: activeSyncs.filter(s => s.status === 'paused').length,
                  total_errors: activeSyncs.reduce((sum, s) => sum + s.errorCount, 0)
                }
              }, null, 2)
            }]
          };
        }
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error getting sync status: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Start a background sync
  server.tool(
    "aha_sync_start",
    "Start a background synchronization for specified Aha entity types. NOTE: Uses server-level credentials, not your personal API key.",
    {
      entities: z.array(z.enum(['products', 'features', 'ideas', 'epics', 'initiatives', 'users', 'releases', 'goals'])).describe("Entity types to sync"),
      batchSize: z.number().min(1).max(200).optional(),
      updatedSince: z.string().optional(),
      force: z.boolean().optional()
    },
    async (params: { entities: string[]; batchSize?: number; updatedSince?: string; force?: boolean }) => {
      try {
        if (!params.force) {
          const activeSyncs = await syncService.getActiveSyncs();
          const runningSyncs = activeSyncs.filter(s => s.status === 'running');
          if (runningSyncs.length > 0) {
            return { content: [{ type: "text" as const, text: `Cannot start sync: ${runningSyncs.length} sync(s) already running. Use force=true to override.` }], isError: true };
          }
        }
        const jobId = await syncService.startSync(params.entities, { batchSize: params.batchSize, updatedSince: params.updatedSince });
        return { content: [{ type: "text" as const, text: JSON.stringify({ message: "Sync started", job_id: jobId, entities: params.entities }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error starting sync: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Pause a sync
  server.tool(
    "aha_sync_pause",
    "Pause a running background sync operation",
    { jobId: z.string() },
    async (params: { jobId: string }) => {
      try {
        await syncService.pauseSync(params.jobId);
        return { content: [{ type: "text" as const, text: JSON.stringify({ message: "Sync paused", job_id: params.jobId }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Stop a sync
  server.tool(
    "aha_sync_stop",
    "Stop a background sync operation completely",
    { jobId: z.string() },
    async (params: { jobId: string }) => {
      try {
        await syncService.stopSync(params.jobId);
        return { content: [{ type: "text" as const, text: JSON.stringify({ message: "Sync stopped", job_id: params.jobId }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Get sync history
  server.tool(
    "aha_sync_history",
    "Get detailed history and logs for a specific sync job or recent sync activities",
    { jobId: z.string().optional(), limit: z.number().min(1).max(500).optional() },
    async (params: { jobId?: string; limit?: number }) => {
      try {
        const limit = params.limit || 50;
        if (params.jobId) {
          const history = await syncService.getSyncHistory(params.jobId);
          const progress = await syncService.getSyncProgress(params.jobId);
          return { content: [{ type: "text" as const, text: JSON.stringify({ job_id: params.jobId, current_status: progress, history: history.slice(0, limit) }, null, 2) }] };
        } else {
          const activeSyncs = await syncService.getActiveSyncs();
          return { content: [{ type: "text" as const, text: JSON.stringify({ active_jobs: activeSyncs }, null, 2) }] };
        }
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Sync health
  server.tool(
    "aha_sync_health",
    "Get comprehensive health status of the sync system, database, and cached data",
    {},
    async () => {
      try {
        const syncHealth = await syncService.getHealthStatus();
        const dbHealth = await database.getHealthStatus();
        const config = await database.getConfig();
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              sync_service: syncHealth,
              database: { connected: dbHealth.connected, size_mb: Math.round(dbHealth.dbSize / (1024 * 1024) * 100) / 100, total_tables: dbHealth.totalTables },
              configuration: config,
              system_status: dbHealth.connected && syncHealth.errors.length === 0 ? 'healthy' : 'degraded'
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Config management
  server.tool(
    "aha_sync_config",
    "View or update sync configuration settings",
    { action: z.enum(['get', 'set']), key: z.string().optional(), value: z.string().optional() },
    async (params: { action: 'get' | 'set'; key?: string; value?: string }) => {
      try {
        if (params.action === 'get') {
          const config = params.key ? { [params.key]: await database.getConfig(params.key) } : await database.getConfig();
          return { content: [{ type: "text" as const, text: JSON.stringify({ configuration: config }, null, 2) }] };
        } else {
          if (!params.key || params.value === undefined) {
            return { content: [{ type: "text" as const, text: "For 'set' action, both 'key' and 'value' are required" }], isError: true };
          }
          await database.updateConfig(params.key, params.value);
          return { content: [{ type: "text" as const, text: JSON.stringify({ message: "Config updated", key: params.key }, null, 2) }] };
        }
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Cleanup old sync jobs
  server.tool(
    "aha_sync_cleanup",
    "Clean up old completed/failed sync jobs and optimize database",
    { olderThanDays: z.number().min(1).max(365).optional() },
    async (params: { olderThanDays?: number }) => {
      try {
        const days = params.olderThanDays || 7;
        const deletedCount = await syncService.cleanupOldSyncJobs(days);
        return { content: [{ type: "text" as const, text: JSON.stringify({ message: "Cleanup completed", deleted_jobs: deletedCount }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // Quick sync entity
  server.tool(
    "aha_sync_entity",
    "Quickly sync a specific entity by ID (bypasses background queue)",
    {
      entityType: z.enum(['product', 'feature', 'idea', 'epic', 'initiative', 'user', 'release', 'goal']),
      entityId: z.string()
    },
    async (params: { entityType: string; entityId: string }) => {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: "Quick entity sync not yet implemented",
            entity_type: params.entityType,
            entity_id: params.entityId,
            note: "Use aha_sync_start for full sync"
          }, null, 2)
        }]
      };
    }
  );
}
