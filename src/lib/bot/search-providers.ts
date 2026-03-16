/**
 * Search Providers for Concierge Service
 * 
 * Supports multiple search backends:
 * - Brave Search (recommended for local businesses)
 * - Google Places API
 * - Google Custom Search (web search)
 */

import { logger } from './logger';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SearchResult {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  hours?: string;
  website?: string;
  description?: string;
  source: 'brave' | 'google_places' | 'google_search';
  placeId?: string;  // For Google Places detail lookups
}

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  source: 'brave' | 'google';
}

// ─────────────────────────────────────────────────────────────
// Brave Search API
// ─────────────────────────────────────────────────────────────

/**
 * Search for local businesses using Brave Search API.
 * Great for finding spas, restaurants, etc. with contact info.
 * 
 * Requires BRAVE_SEARCH_API_KEY in env.
 * Get API key at: https://brave.com/search/api/
 */
export async function braveLocalSearch(
  query: string,
  location?: string,
  count: number = 5
): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    logger.warn('BRAVE_SEARCH_API_KEY not configured');
    return [];
  }

  try {
    const searchQuery = location ? `${query} in ${location}` : query;
    
    // Use Brave's Local POI search endpoint
    const url = new URL('https://api.search.brave.com/res/v1/local/search');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('count', String(count));

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      // Fall back to web search if local search fails
      logger.warn(`Brave local search failed: ${response.status}, falling back to web search`);
      return braveWebSearchForBusinesses(query, location, count);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      // Try web search as fallback
      return braveWebSearchForBusinesses(query, location, count);
    }

    return data.results.slice(0, count).map((result: any) => ({
      name: result.title || result.name,
      address: result.address?.streetAddress || result.address?.addressLocality 
        ? `${result.address.streetAddress || ''}, ${result.address.addressLocality || ''}`
        : undefined,
      phone: result.phone,
      rating: result.rating?.ratingValue,
      reviewCount: result.rating?.ratingCount,
      priceLevel: result.priceRange,
      hours: formatBraveHours(result.openingHours),
      website: result.url,
      description: result.description,
      source: 'brave' as const,
    }));
  } catch (error) {
    logger.error({ error }, 'Brave local search error');
    return [];
  }
}

/**
 * Web search with Brave, filtered for business-like results.
 */
async function braveWebSearchForBusinesses(
  query: string,
  location?: string,
  count: number = 5
): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const searchQuery = location ? `${query} in ${location}` : query;
    
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('count', String(count * 2)); // Get more to filter
    url.searchParams.set('result_filter', 'web');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Brave web search failed');
      return [];
    }

    const data = await response.json();
    
    if (!data.web?.results) return [];

    // Filter results that look like business listings
    return data.web.results
      .filter((r: any) => r.title && r.url)
      .slice(0, count)
      .map((result: any) => ({
        name: result.title,
        website: result.url,
        description: result.description,
        source: 'brave' as const,
      }));
  } catch (error) {
    logger.error({ error }, 'Brave web search error');
    return [];
  }
}

/**
 * General web search using Brave.
 */
export async function braveWebSearch(
  query: string,
  count: number = 5
): Promise<WebSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    logger.warn('BRAVE_SEARCH_API_KEY not configured');
    return [];
  }

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Brave search failed');
      return [];
    }

    const data = await response.json();
    
    if (!data.web?.results) return [];

    return data.web.results.slice(0, count).map((result: any) => ({
      title: result.title,
      url: result.url,
      description: result.description || '',
      source: 'brave' as const,
    }));
  } catch (error) {
    logger.error({ error }, 'Brave web search error');
    return [];
  }
}

function formatBraveHours(hours: any): string | undefined {
  if (!hours) return undefined;
  if (typeof hours === 'string') return hours;
  if (Array.isArray(hours)) return hours.join(', ');
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Google Places API (existing, refactored)
// ─────────────────────────────────────────────────────────────

/**
 * Search for businesses using Google Places API.
 * 
 * Requires GOOGLE_PLACES_API_KEY in env.
 */
export async function googlePlacesSearch(
  query: string,
  location?: string,
  count: number = 5
): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    logger.warn('GOOGLE_PLACES_API_KEY not configured');
    return [];
  }

  try {
    const searchQuery = location ? `${query} in ${location}` : query;
    
    const url = new URL('https://places.googleapis.com/v1/places:searchText');
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.websiteUri,places.id',
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        pageSize: count,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorText }, 'Google Places search failed');
      return [];
    }

    const data = await response.json();
    
    if (!data.places) return [];

    return data.places.map((place: any) => ({
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress,
      phone: place.nationalPhoneNumber,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      priceLevel: formatPriceLevel(place.priceLevel),
      hours: formatGoogleHours(place.regularOpeningHours),
      website: place.websiteUri,
      source: 'google_places' as const,
      placeId: place.id,
    }));
  } catch (error) {
    logger.error({ error }, 'Google Places search error');
    return [];
  }
}

/**
 * Get detailed info for a Google Place by ID.
 */
export async function googlePlaceDetails(placeId: string): Promise<SearchResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,priceLevel,regularOpeningHours,websiteUri,reviews',
      },
    });

    if (!response.ok) return null;

    const place = await response.json();

    return {
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      priceLevel: formatPriceLevel(place.priceLevel),
      hours: formatGoogleHours(place.regularOpeningHours),
      website: place.websiteUri,
      description: place.reviews?.[0]?.text?.text,
      source: 'google_places',
      placeId,
    };
  } catch (error) {
    logger.error({ error, placeId }, 'Google Place details error');
    return null;
  }
}

function formatPriceLevel(level?: string): string | undefined {
  const levels: Record<string, string> = {
    'PRICE_LEVEL_FREE': 'Free',
    'PRICE_LEVEL_INEXPENSIVE': '$',
    'PRICE_LEVEL_MODERATE': '$$',
    'PRICE_LEVEL_EXPENSIVE': '$$$',
    'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
  };
  return level ? levels[level] : undefined;
}

function formatGoogleHours(hours: any): string | undefined {
  if (!hours?.weekdayDescriptions) return undefined;
  // Return just today's hours for brevity
  const today = new Date().getDay();
  return hours.weekdayDescriptions[today] || hours.weekdayDescriptions[0];
}

// ─────────────────────────────────────────────────────────────
// Google Custom Search API (for general web search)
// ─────────────────────────────────────────────────────────────

/**
 * General web search using Google Custom Search.
 * 
 * Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID in env.
 * Setup: https://developers.google.com/custom-search/v1/introduction
 */
export async function googleWebSearch(
  query: string,
  count: number = 5
): Promise<WebSearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!apiKey || !engineId) {
    logger.warn('Google Custom Search not configured (need GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID)');
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', engineId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(Math.min(count, 10)));

    const response = await fetch(url.toString());

    if (!response.ok) {
      logger.error({ status: response.status }, 'Google search failed');
      return [];
    }

    const data = await response.json();
    
    if (!data.items) return [];

    return data.items.map((item: any) => ({
      title: item.title,
      url: item.link,
      description: item.snippet || '',
      source: 'google' as const,
    }));
  } catch (error) {
    logger.error({ error }, 'Google web search error');
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Unified Search Functions
// ─────────────────────────────────────────────────────────────

/**
 * Search for local businesses using the best available provider.
 * Priority: Brave > Google Places
 */
export async function searchBusinesses(
  query: string,
  location?: string,
  count: number = 5
): Promise<SearchResult[]> {
  // Try Brave first (better free tier)
  if (process.env.BRAVE_SEARCH_API_KEY) {
    const results = await braveLocalSearch(query, location, count);
    if (results.length > 0) return results;
  }

  // Fall back to Google Places
  if (process.env.GOOGLE_PLACES_API_KEY) {
    return googlePlacesSearch(query, location, count);
  }

  logger.warn('No search provider configured for business search');
  return [];
}

/**
 * General web search using the best available provider.
 * Priority: Brave > Google Custom Search
 */
export async function webSearch(
  query: string,
  count: number = 5
): Promise<WebSearchResult[]> {
  // Try Brave first
  if (process.env.BRAVE_SEARCH_API_KEY) {
    const results = await braveWebSearch(query, count);
    if (results.length > 0) return results;
  }

  // Fall back to Google
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    return googleWebSearch(query, count);
  }

  logger.warn('No search provider configured for web search');
  return [];
}

/**
 * Format search results for display to user.
 */
export function formatSearchResultsForChat(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  return results.map((r, i) => {
    let text = `${i + 1}. **${r.name}**`;
    if (r.rating) text += ` (${r.rating}★${r.reviewCount ? ` · ${r.reviewCount} reviews` : ''})`;
    if (r.priceLevel) text += ` · ${r.priceLevel}`;
    if (r.address) text += `\n   📍 ${r.address}`;
    if (r.phone) text += `\n   📞 ${r.phone}`;
    if (r.hours) text += `\n   🕐 ${r.hours}`;
    return text;
  }).join('\n\n');
}
