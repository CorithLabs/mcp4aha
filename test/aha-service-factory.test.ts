import { describe, it, expect, mock } from 'bun:test';

let mockCompany: string | null = 'mycompany';

mock.module('../src/core/database/database.js', () => ({
  databaseService: {
    getConfig: mock(async (key: string) => {
      if (key === 'aha_company') return mockCompany;
      return null;
    }),
  },
}));

mock.module('../src/core/services/aha-service.js', () => ({
  AhaService: {
    initialize: mock(() => {}),
    isInitialized: mock(() => true),
  },
}));

const { createAhaService, MissingCredentialsError, ConfigurationError } =
  await import('../src/core/services/aha-service-factory.js');

describe('createAhaService', () => {
  it('throws MissingCredentialsError when apiKey is empty', async () => {
    expect(createAhaService('')).rejects.toBeInstanceOf(MissingCredentialsError);
  });

  it('throws MissingCredentialsError when apiKey is blank whitespace', async () => {
    expect(createAhaService('   ')).rejects.toBeInstanceOf(MissingCredentialsError);
  });

  it('throws ConfigurationError when subdomain is not set', async () => {
    mockCompany = null;
    delete process.env.AHA_COMPANY;
    expect(createAhaService('valid-key')).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('returns AhaService when credentials are valid', async () => {
    mockCompany = 'mycompany';
    const service = await createAhaService('valid-api-key');
    expect(service).toBeDefined();
    expect(typeof service.listFeatures).toBe('function');
  });

  it('initializes with the provided api key and resolved subdomain', async () => {
    mockCompany = 'acme';
    const { AhaService } = await import('../src/core/services/aha-service.js');
    await createAhaService('my-api-key');
    expect(AhaService.initialize).toHaveBeenCalledWith({ apiKey: 'my-api-key', subdomain: 'acme' });
  });
});
