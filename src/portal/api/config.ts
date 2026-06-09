import { Router, Request, Response } from 'express';
import { databaseService } from '../../core/database/database.js';

export const configRouter = Router();

/**
 * GET /api/config
 * Returns the current Aha subdomain and token status.
 * Never returns the raw MCP token or Aha API key.
 */
configRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const company = await databaseService.getConfig('aha_company');
    const tokenRaw = await databaseService.getConfig('mcp_auth_token');

    return res.status(200).json({
      company: company || null,
      hasToken: !!tokenRaw,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to read config' });
  }
});

/**
 * POST /api/config
 * Saves the Aha company subdomain to server_config.
 * Sanitises input — trims whitespace, strips protocol/domain suffix.
 */
configRouter.post('/', async (req: Request, res: Response) => {
  const { company } = req.body as { company?: string };

  if (!company || typeof company !== 'string' || company.trim() === '') {
    return res.status(400).json({ error: 'company is required' });
  }

  // Sanitise: trim, strip https://, strip .aha.io suffix
  let sanitised = company.trim();
  sanitised = sanitised.replace(/^https?:\/\//i, '');
  sanitised = sanitised.replace(/\.aha\.io(\/.*)?$/i, '');
  sanitised = sanitised.split('.')[0]; // take only subdomain segment

  // Validate: alphanumeric + hyphens only
  if (!/^[a-zA-Z0-9-]+$/.test(sanitised)) {
    return res
      .status(400)
      .json({ error: 'Invalid company subdomain — use alphanumeric characters and hyphens only' });
  }

  try {
    await databaseService.updateConfig('aha_company', sanitised);
    return res.status(200).json({ success: true, company: sanitised });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save config' });
  }
});
