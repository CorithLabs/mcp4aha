/**
 * Extensions to AhaService for text search and idea ranking.
 * These methods are mixed into the AhaService class via module augmentation.
 *
 * Implements:
 *   - searchIdeas(params)
 *   - searchEpics(params)
 *   - searchFeatures(params)
 *   - getIdeaRanking(ideaId)
 *   - updateIdeaRanking(ideaId, params)
 *
 * All methods use the Aha.io REST API directly via fetch() since
 * the @cedricziel/aha-js SDK does not expose dedicated search endpoints
 * or score_facts update methods.
 */

import { AhaService } from './aha-service.js';
import type { AhaSearchResult, AhaIdeaRanking } from '../types/aha-types.js';
import type { IdeaResponse, Epic, Feature } from '@cedricziel/aha-js';
import { log } from '../logger.js';

type SearchParams = { q: string; page?: number; per_page?: number };

/**
 * Perform a fetch against the Aha API using AhaService's internal credentials.
 * AhaService stores subdomain and apiKey as static private fields.
 * We access them via the initialized basePath pattern used in getReleaseFeatures.
 */
async function ahaFetch(path: string, options?: RequestInit): Promise<Response> {
  // Access private static fields via any cast — same pattern as getReleaseFeatures
  const subdomain = (AhaService as any).subdomain as string | null;
  const apiKey = (AhaService as any).apiKey as string | null;

  if (!subdomain || !apiKey) {
    throw new Error('AhaService is not initialized. Call AhaService.initialize() first.');
  }

  const basePath = `https://${subdomain}.aha.io/api/v1`;
  const url = `${basePath}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  return response;
}

// ─────────────────────────────────────────────
// TEXT SEARCH
// ─────────────────────────────────────────────

/**
 * Search ideas by text query using the Aha.io list endpoint with q param.
 * Falls back to listIdeas with q filter if no dedicated search endpoint exists.
 */
(AhaService as any).searchIdeas = async function (
  params: SearchParams
): Promise<AhaSearchResult<IdeaResponse>> {
  const { q, page = 1, per_page = 20 } = params;
  const qs = new URLSearchParams({
    q,
    page: String(page),
    per_page: String(Math.min(per_page, 200)),
  });

  try {
    const response = await ahaFetch(`/ideas?${qs}`);
    if (!response.ok) {
      throw new Error(`Aha API error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return {
      records: data.ideas ?? [],
      pagination: data.pagination ?? { total_records: 0, total_pages: 1, current_page: page },
    };
  } catch (error) {
    log.error('Error searching ideas', error as Error, { q });
    throw error;
  }
};

/**
 * Search epics by text query using the Aha.io list endpoint with q param.
 */
(AhaService as any).searchEpics = async function (
  params: SearchParams
): Promise<AhaSearchResult<Epic>> {
  const { q, page = 1, per_page = 20 } = params;
  const qs = new URLSearchParams({
    q,
    page: String(page),
    per_page: String(Math.min(per_page, 200)),
  });

  try {
    const response = await ahaFetch(`/epics?${qs}`);
    if (!response.ok) {
      throw new Error(`Aha API error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return {
      records: data.epics ?? [],
      pagination: data.pagination ?? { total_records: 0, total_pages: 1, current_page: page },
    };
  } catch (error) {
    log.error('Error searching epics', error as Error, { q });
    throw error;
  }
};

/**
 * Search features by text query using the Aha.io list endpoint with q param.
 */
(AhaService as any).searchFeatures = async function (
  params: SearchParams
): Promise<AhaSearchResult<Feature>> {
  const { q, page = 1, per_page = 20 } = params;
  const qs = new URLSearchParams({
    q,
    page: String(page),
    per_page: String(Math.min(per_page, 200)),
  });

  try {
    const response = await ahaFetch(`/features?${qs}`);
    if (!response.ok) {
      throw new Error(`Aha API error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return {
      records: data.features ?? [],
      pagination: data.pagination ?? { total_records: 0, total_pages: 1, current_page: page },
    };
  } catch (error) {
    log.error('Error searching features', error as Error, { q });
    throw error;
  }
};

// ─────────────────────────────────────────────
// IDEA RANKING
// ─────────────────────────────────────────────

/**
 * Fetch an idea's score, position, and score_facts (ranking breakdown).
 */
(AhaService as any).getIdeaRanking = async function (
  ideaId: string
): Promise<AhaIdeaRanking> {
  try {
    const response = await ahaFetch(`/ideas/${ideaId}?fields=id,name,score,position,score_facts`);
    if (response.status === 404) {
      throw new Error(`Idea ${ideaId} not found`);
    }
    if (!response.ok) {
      throw new Error(`Aha API error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    const idea = data.idea ?? data;
    return {
      id: idea.id,
      name: idea.name,
      score: idea.score ?? 0,
      position: idea.position ?? null,
      score_facts: idea.score_facts ?? [],
    };
  } catch (error) {
    log.error('Error getting idea ranking', error as Error, { idea_id: ideaId });
    throw error;
  }
};

/**
 * Update an idea's ranking via score_facts or position.
 * Sends a PUT to /api/v1/ideas/:id with { idea: { score_facts?, position? } }.
 */
(AhaService as any).updateIdeaRanking = async function (
  ideaId: string,
  params: { score_facts?: Array<{ name: string; value: number }>; position?: number }
): Promise<AhaIdeaRanking> {
  const body: Record<string, any> = { idea: {} };
  if (params.score_facts !== undefined) body.idea.score_facts = params.score_facts;
  if (params.position !== undefined) body.idea.position = params.position;

  try {
    const response = await ahaFetch(`/ideas/${ideaId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (response.status === 404) {
      throw new Error(`Idea ${ideaId} not found`);
    }
    if (response.status === 422) {
      const errData = await response.json() as any;
      throw new Error(`Validation failed: ${JSON.stringify(errData.errors ?? errData)}`);
    }
    if (!response.ok) {
      throw new Error(`Aha API error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    const idea = data.idea ?? data;
    return {
      id: idea.id,
      name: idea.name,
      score: idea.score ?? 0,
      position: idea.position ?? null,
      score_facts: idea.score_facts ?? [],
    };
  } catch (error) {
    log.error('Error updating idea ranking', error as Error, { idea_id: ideaId });
    throw error;
  }
};

// Re-export AhaService so consumers can import from this file
export { AhaService };
