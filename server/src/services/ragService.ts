/**
 * RAG Service - Connects to the Python RAG API for textbook queries
 */

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:3006';

interface SearchResult {
  chunk_id: string;
  text: string;
  score: number;
  meta?: Record<string, unknown>;
}

interface DomainSearchResult {
  domain: string;
  query_type: string;
  results: SearchResult[];
}

interface DiseaseInfo {
  disease: string;
  info: {
    overview: string[];
    symptoms?: string[];
    differentials?: string[];
    findings?: string[];
  };
}

interface CaseContext {
  context: SearchResult[];
}

/**
 * Check if RAG API is available
 */
export async function isRagAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${RAG_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * General search of the textbook
 */
export async function searchTextbook(query: string, topK: number = 10): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${RAG_API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK })
    });

    if (!response.ok) {
      console.error('RAG search failed:', response.statusText);
      return [];
    }

    const data = await response.json() as { results?: SearchResult[] };
    return data.results || [];
  } catch (error) {
    console.error('RAG search error:', error);
    return [];
  }
}

/**
 * Search for diseases/conditions in a specific medical domain
 */
export async function searchDomain(
  domain: string,
  queryType: 'diseases' | 'symptoms' | 'findings' = 'diseases',
  topK: number = 15
): Promise<DomainSearchResult | null> {
  try {
    const response = await fetch(`${RAG_API_URL}/domain-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, query_type: queryType, top_k: topK })
    });

    if (!response.ok) {
      console.error('RAG domain search failed:', response.statusText);
      return null;
    }

    return await response.json() as DomainSearchResult;
  } catch (error) {
    console.error('RAG domain search error:', error);
    return null;
  }
}

/**
 * Get comprehensive information about a specific disease
 */
export async function getDiseaseInfo(
  diseaseName: string,
  options: {
    includeSymptoms?: boolean;
    includeDifferentials?: boolean;
    includeFindings?: boolean;
  } = {}
): Promise<DiseaseInfo | null> {
  try {
    const response = await fetch(`${RAG_API_URL}/disease-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disease_name: diseaseName,
        include_symptoms: options.includeSymptoms ?? true,
        include_differentials: options.includeDifferentials ?? true,
        include_findings: options.includeFindings ?? true
      })
    });

    if (!response.ok) {
      console.error('RAG disease info failed:', response.statusText);
      return null;
    }

    return await response.json() as DiseaseInfo;
  } catch (error) {
    console.error('RAG disease info error:', error);
    return null;
  }
}

/**
 * Get context for answering a patient question
 */
export async function getCaseContext(
  disease: string,
  symptoms: string,
  question: string
): Promise<CaseContext | null> {
  try {
    const response = await fetch(`${RAG_API_URL}/case-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disease, symptoms, question })
    });

    if (!response.ok) {
      console.error('RAG case context failed:', response.statusText);
      return null;
    }

    return await response.json() as CaseContext;
  } catch (error) {
    console.error('RAG case context error:', error);
    return null;
  }
}

/**
 * Extract disease names from RAG search results
 * Parses the textbook chunks to find mentioned diseases
 */
export function extractDiseasesFromResults(results: SearchResult[]): string[] {
  const diseases = new Set<string>();

  // Common disease patterns in medical texts
  const patterns = [
    /(?:diagnosis|condition|disease):\s*([A-Z][a-z]+(?:\s+[A-Za-z]+)*)/gi,
    /(?:is|are|called)\s+([A-Z][a-z]+(?:\s+[A-Za-z]+)*(?:\s+syndrome|\s+disease)?)/gi,
    /^([A-Z][a-z]+(?:\s+[A-Za-z]+)*(?:\s+syndrome|\s+disease)?)/gm,
  ];

  for (const result of results) {
    for (const pattern of patterns) {
      const matches = result.text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 3) {
          diseases.add(match[1].trim());
        }
      }
    }
  }

  return Array.from(diseases).slice(0, 20); // Return top 20 unique diseases
}

/**
 * Format RAG results into context string for Claude prompts
 */
export function formatRagContext(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return '';
  }

  const contextParts = results.map((r, i) =>
    `[Source ${i + 1}]\n${r.text}`
  );

  return contextParts.join('\n\n---\n\n');
}

// Types for ideal pathway context
interface IdealPathwayContext {
  disease: string;
  domain: string;
  textbook_context: {
    symptoms: Array<{ text: string; score: number }>;
    examination: Array<{ text: string; score: number }>;
    investigations: Array<{ text: string; score: number }>;
    differentials: Array<{ text: string; score: number }>;
    diagnostic_approach: Array<{ text: string; score: number }>;
  };
}

/**
 * Get comprehensive textbook context for generating ideal diagnostic pathway
 * Queries multiple aspects: symptoms, exams, tests, differentials, approach
 */
export async function getIdealPathwayContext(
  diseaseName: string,
  domain: string,
  topK: number = 15
): Promise<IdealPathwayContext | null> {
  try {
    const response = await fetch(`${RAG_API_URL}/ideal-pathway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disease_name: diseaseName,
        domain,
        top_k: topK
      })
    });

    if (!response.ok) {
      console.error('RAG ideal pathway failed:', response.statusText);
      return null;
    }

    return await response.json() as IdealPathwayContext;
  } catch (error) {
    console.error('RAG ideal pathway error:', error);
    return null;
  }
}

/**
 * Format ideal pathway context into structured sections for Claude
 */
export function formatIdealPathwayContext(context: IdealPathwayContext): string {
  const sections: string[] = [];

  if (context.textbook_context.symptoms?.length > 0) {
    sections.push('=== SYMPTOMS & CLINICAL PRESENTATION ===');
    sections.push(context.textbook_context.symptoms.slice(0, 10).map(s => s.text).join('\n\n'));
  }

  if (context.textbook_context.examination?.length > 0) {
    sections.push('\n=== PHYSICAL EXAMINATION ===');
    sections.push(context.textbook_context.examination.slice(0, 10).map(s => s.text).join('\n\n'));
  }

  if (context.textbook_context.investigations?.length > 0) {
    sections.push('\n=== INVESTIGATIONS & TESTS ===');
    sections.push(context.textbook_context.investigations.slice(0, 10).map(s => s.text).join('\n\n'));
  }

  if (context.textbook_context.differentials?.length > 0) {
    sections.push('\n=== DIFFERENTIAL DIAGNOSIS ===');
    sections.push(context.textbook_context.differentials.slice(0, 10).map(s => s.text).join('\n\n'));
  }

  if (context.textbook_context.diagnostic_approach?.length > 0) {
    sections.push('\n=== DIAGNOSTIC APPROACH ===');
    sections.push(context.textbook_context.diagnostic_approach.slice(0, 10).map(s => s.text).join('\n\n'));
  }

  return sections.join('\n');
}
