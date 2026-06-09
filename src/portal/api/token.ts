import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { databaseService } from '../../core/database/database.js';

export const tokenRouter = Router();

/**
 * POST /api/token/generate
 * Generates a new cryptographically secure MCP auth token and persists it
 * to the server_config table. Requires aha_company to be set first.
 * Overwrites any previously stored token.
 */
tokenRouter.post('/generate', async (_req: Request, res: Response) => {
  try {
    // Require company subdomain to be set before generating token
    const company = await databaseService.getConfig('aha_company');
    if (!company) {
      return res.status(400).json({
        error: 'Company subdomain must be configured first',
      });
    }

    // Generate cryptographically secure token
    const token = randomBytes(32).toString('hex');

    // Persist to server_config (overwrites any previous value)
    await databaseService.updateConfig('mcp_auth_token', token);

    return res.status(200).json({ token });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * GET /api/token
 * Returns masked token status — exists: true/false and a short preview.
 * Never returns the full token value.
 */
tokenRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const token = await databaseService.getConfig('mcp_auth_token');

    if (!token) {
      return res.status(200).json({ exists: false });
    }

    // Show first 4 and last 4 characters only
    const preview =
      token.length > 8
        ? `${token.slice(0, 4)}...${token.slice(-4)}`
        : '****';

    return res.status(200).json({ exists: true, preview });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to read token status' });
  }
});
