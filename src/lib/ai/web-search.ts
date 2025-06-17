import logger from '@/lib/logger';

/**
 * Web search functionality using Perplexity's sonar-pro model
 * Conducts real research for the Data Requirements & Research Agent
 */
export async function perplexity_web_search(params: {
  search_term: string;
  explanation: string;
  domain?: string;
  location?: {
    state?: string;
    country?: string;
    zipCode?: string;
  };
}): Promise<string> {
  const { search_term, explanation, domain, location } = params;
  
  try {
    logger.info({ search_term, explanation, domain, location }, '🔍 WebSearch: Conducting Perplexity research');

    // Get Perplexity API key from environment
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      logger.error('🔍 WebSearch: PERPLEXITY_API_KEY not found in environment variables');
      throw new Error('Perplexity API key not configured');
    }

    // Enhance search query with location context if provided
    let enhancedQuery = search_term;
    if (location?.state || location?.country) {
      const locationParts = [location.state, location.country].filter(Boolean);
      enhancedQuery = `${search_term} in ${locationParts.join(', ')}`;
    }

    // Create domain-specific search context
    const searchContext = createSearchContext(domain, enhancedQuery, explanation);

    // Call Perplexity API
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a research assistant conducting data research for tool development. Focus on providing accurate, current, and actionable data that can be used for calculations and business logic.

RESEARCH GUIDELINES:
- Prioritize official sources (government, regulatory bodies, industry associations)
- Include specific numbers, rates, and data points
- Mention data sources and publication dates when available
- Focus on information relevant to ${domain || 'general'} domain
- Structure data in a clear, usable format
- Include location-specific variations when relevant

RESPONSE FORMAT:
- Start with key findings summary
- Provide specific data points with sources
- Include any important caveats or limitations
- End with data reliability assessment`
          },
          {
            role: 'user',
            content: searchContext
          }
        ],
        search_mode: 'web',
        temperature: 0.2,
        max_tokens: 2000,
        return_related_questions: false,
        return_images: false,
        search_recency_filter: 'year', // Prefer recent data
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ 
        status: response.status, 
        statusText: response.statusText, 
        errorText,
        search_term 
      }, '🔍 WebSearch: Perplexity API error');
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const searchResult = data.choices?.[0]?.message?.content;

    if (!searchResult) {
      logger.error({ data }, '🔍 WebSearch: No content in Perplexity response');
      throw new Error('No search results returned from Perplexity');
    }

    logger.info({ 
      search_term, 
      resultLength: searchResult.length,
      tokensUsed: data.usage?.total_tokens || 'unknown'
    }, '🔍 WebSearch: Research completed successfully');

    return searchResult;
    
  } catch (error) {
    logger.error({ 
      search_term, 
      error: error instanceof Error ? error.message : String(error) 
    }, '🔍 WebSearch: Research failed');
    
    // Return error information instead of throwing - let the agent handle it
    return `Research failed for query: "${search_term}". Error: ${error instanceof Error ? error.message : String(error)}. Please try a different search approach or check the query parameters.`;
  }
}

/**
 * Create domain-specific search context for better research results
 */
function createSearchContext(domain: string | undefined, query: string, explanation: string): string {
  const baseContext = `Research Query: ${query}\nContext: ${explanation}`;
  
  if (!domain) {
    return baseContext;
  }

  // Domain-specific research guidance
  const domainGuidance: Record<string, string> = {
    'solar': `
Focus on: Solar installation costs, federal/state tax incentives, utility rates, net metering policies, equipment pricing, installation requirements, and regulatory information.
Prioritize: DSIRE database, SEIA reports, utility company data, state energy offices.`,
    
    'finance': `
Focus on: Interest rates, loan terms, market benchmarks, financial regulations, tax implications, investment returns, and economic indicators.
Prioritize: Federal Reserve data, SEC filings, financial institution rates, government economic reports.`,
    
    'tax': `
Focus on: Current tax rates, deductions, credits, filing requirements, state variations, and recent tax law changes.
Prioritize: IRS publications, state revenue departments, tax preparation services, accounting firms.`,
    
    'real_estate': `
Focus on: Property values, market trends, mortgage rates, property taxes, zoning regulations, and local market conditions.
Prioritize: MLS data, real estate associations, local assessor offices, mortgage lenders.`,
    
    'healthcare': `
Focus on: Medical costs, insurance coverage, provider networks, regulatory requirements, and healthcare market data.
Prioritize: CMS data, insurance company information, medical associations, healthcare cost databases.`,
    
    'business': `
Focus on: Industry benchmarks, regulatory requirements, market analysis, operational costs, and business metrics.
Prioritize: Industry associations, government business data, market research firms, regulatory bodies.`
  };

  const guidance = domainGuidance[domain] || '';
  
  return `${baseContext}

DOMAIN-SPECIFIC RESEARCH GUIDANCE:${guidance}

Please conduct thorough research and provide specific, actionable data that can be used for calculations and business logic in a ${domain} tool.`;
}
