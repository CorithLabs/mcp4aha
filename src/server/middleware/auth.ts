import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { databaseService } from '../../core/database/database.js';

/**
 * Extend Express Request to carry per-request Aha credentials.
 */
declare global {
  namespace Express {
    interface Request {
      ahaApiKey?: string;
    }
  }
}

/**
 * Load the MCP auth token from server_config, falling back to env var.
 * Returns null if neither is set (server not configured yet).
 */
async function loadMcpAuthToken(): Promise<string | null> {
  try {
    const dbToken = await databaseService.getConfig('mcp_auth_token');
    if (dbToken) return dbToken;
  } catch {
    // DB unavailable — fall through to env var
  }
  return process.env.MCP_AUTH_TOKEN || null;
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

/**
 * Bearer token authentication middleware.
 *
 * 1. Loads the MCP auth token from server_config (or MCP_AUTH_TOKEN env var).
 * 2. Returns 503 if the server has no token configured yet.
 * 3. Returns 401 if the Authorization header is missing or the token is invalid.
 * 4. On success: calls next() and attaches req.ahaApiKey from X-Aha-Api-Key header.
 */
export async function bearerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const configuredToken = await loadMcpAuthToken();

  // Server not yet configured
  if (!configuredToken) {
    res.status(503).json({
      error: 'Server not configured',
      message: 'No MCP auth token configured. Open the portal to set up the server.',
    });
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'Authorization header required',
      message: "Please provide a valid Bearer token in the Authorization header",
    });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Invalid authorization format',
      message: "Authorization header must use Bearer token format: 'Bearer <token>'",
    });
    return;
  }

  const incomingToken = authHeader.substring(7);

  if (!safeCompare(incomingToken, configuredToken)) {
    res.status(401).json({
      error: 'Invalid token',
      message: 'The provided Bearer token is invalid',
    });
    return;
  }

  // Extract per-request Aha API key from X-Aha-Api-Key header
  const ahaApiKey = req.headers['x-aha-api-key'] as string | undefined;
  if (ahaApiKey) {
    req.ahaApiKey = ahaApiKey;
  }

  next();
}

/**
 * Check if authentication is enabled (token configured).
 */
export async function isAuthEnabled(): Promise<boolean> {
  const token = await loadMcpAuthToken();
  return !!token;
}
