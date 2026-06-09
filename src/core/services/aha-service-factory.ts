import { AhaService } from './aha-service.js';
import { databaseService } from '../database/database.js';

/**
 * Typed error for missing credentials.
 */
export class MissingCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingCredentialsError';
  }
}

/**
 * Typed error for missing server configuration.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Create a per-request AhaService instance.
 *
 * The caller must supply the Aha API key (passed by Claude Desktop per-request
 * via the X-Aha-Api-Key header). The company subdomain is resolved from the
 * server_config table automatically.
 *
 * @param apiKey - The Aha API key from the incoming request (req.ahaApiKey)
 * @returns An initialised AhaService ready to call the Aha API
 * @throws MissingCredentialsError if apiKey is blank
 * @throws ConfigurationError if subdomain is not set in server config
 */
export async function createAhaService(apiKey: string): Promise<typeof AhaService> {
  if (!apiKey || apiKey.trim() === '') {
    throw new MissingCredentialsError(
      'Aha API key is required. Add X-Aha-Api-Key: <your-key> to your Claude Desktop MCP config.',
    );
  }

  // Resolve subdomain from config
  const subdomain =
    (await databaseService.getConfig('aha_company')) ||
    process.env.AHA_COMPANY ||
    null;

  if (!subdomain) {
    throw new ConfigurationError(
      'Aha company subdomain is not configured. Open the portal and set up your subdomain first.',
    );
  }

  // Re-initialise the service with per-request credentials.
  // AhaService.initialize() is synchronous and resets all internal API clients.
  AhaService.initialize({ apiKey: apiKey.trim(), subdomain });

  return AhaService;
}
