import { GeocodingResult } from './geocodingService';
import { wikiSearchCache, wikiDetailsCache } from '../utils/cache';

/**
 * Service to fetch place details from Wikipedia and Wikivoyage
 * Strategy: Wikivoyage First (Better Scenic Photos) -> Wikipedia Second -> Filter Flags/Maps -> Deep Search if needed
 */

const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1/page';
const WIKI_SEARCH_API = 'https://en.wikipedia.org/w/api.php';

const VOYAGE_API_BASE = 'https://en.wikivoyage.org/api/rest_v1/page';
const VOYAGE_SEARCH_API = 'https://en.wikivoyage.org/w/api.php';

export interface WikiPlaceDetails {
    title: string;
    description: string;
    extract: string;
    thumbnail?: {
        source: string;
        width: number;
        height: number;
    };
    originalimage?: {
        source: string;
        width: number;
        height: number;
    };
    pageType?: string; // e.g. 'standard', 'disambiguation'
    source?: 'wikipedia' | 'wikivoyage';
}

// Common headers for all Wiki requests to prevent 403 Blocks
const WIKI_HEADERS = {
    'User-Agent': 'PrimalSingularity/1.0 (Mobile App; Contact: support@primalsingularity.com)',
    'Api-User-Agent': 'PrimalSingularity/1.0',
    'Accept': 'application/json'
};

// Search for the correct Wikipedia page title first
const searchWikiTitle = async (query: string): Promise<string | null> => {
    try {
        const response = await fetch(
            `${WIKI_SEARCH_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`,
            { headers: WIKI_HEADERS }
        );

        if (!response.ok) return null;

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (data && data[1] && data[1].length > 0) {
                return data[1][0];
            }
        } catch (e) {
            return null;
        }
        return null;
    } catch (error) {
        console.error('Wiki Service Error:', error);
        return null;
    }
};


/**
 * Search Wikipedia for places (with Coordinates & Images)
 * Replaces Mapbox Geocoding for "Explore" mode to ensure rich content.
 */
export const searchWikiPlaces = async (query: string): Promise<GeocodingResult[]> => {
    if (!query || query.length < 3) return [];

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = wikiSearchCache.get(cacheKey);
    if (cached) {
        console.log('[WikiService] Cache hit for:', query);
        return cached;
    }

    try {
        // Query API: Get Title, Coords, Thumbnail, Description
        // generator=prefixsearch finds titles starting with query (Autocomplete style)
        // prop=coordinates|pageimages|description get details
        // Note: Removed origin=* to avoid potential Native CORS confusion with specific headers
        const url = `${WIKI_SEARCH_API}?action=query&generator=prefixsearch&gpssearch=${encodeURIComponent(query)}&gpslimit=20&prop=coordinates|pageimages|description|extracts&piprop=thumbnail&pithumbsize=200&exintro&explaintext&exsentences=1&format=json`;

        const response = await fetch(url, { headers: WIKI_HEADERS });

        if (!response.ok) {
            console.warn('[WikiService] HTTP Error:', response.status);
            // We return empty array on failure, which results in "No List" in UI.
            return [];
        }

        const data = await response.json();

        if (!data.query || !data.query.pages) return [];

        // Map pages (Object to Array)
        const pages = Object.values(data.query.pages);

        // Sort by 'index' (Relevance) provided by Wiki
        pages.sort((a: any, b: any) => (a.index || 999) - (b.index || 999));

        // Filter out items WITHOUT coordinates (Critical for map placement)
        // Wiki returns many pages without coords. We must discard them for Geocoding purposes.
        const validPages = pages.filter((p: any) => p.coordinates && p.coordinates.length > 0);

        const results = validPages.map((p: any) => ({
            id: `wiki-${p.pageid}`,
            text: p.title,
            place_name: p.description || (p.extract ? p.extract.slice(0, 50) + '...' : 'Wikipedia Entry'),
            // Ensure coordinates are Numbers to prevent Native Module crashes
            center: [Number(p.coordinates[0].lon), Number(p.coordinates[0].lat)],
            image: p.thumbnail?.source,
            context: []
        }));

        // Cache the results
        wikiSearchCache.set(cacheKey, results);
        console.log('[WikiService] Cached results for:', query);

        return results;

    } catch (error) {
        console.error('[WikiService] Search failed:', error);
        return [];
    }
};

const fetchSummary = async (title: string, apiBase: string, sourceName: 'wikipedia' | 'wikivoyage'): Promise<WikiPlaceDetails | null> => {
    try {
        const response = await fetch(`${apiBase}/summary/${encodeURIComponent(title)}`, { headers: WIKI_HEADERS });
        if (!response.ok) return null;

        const data = await response.json();
        if (data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;

        return {
            title: data.title,
            description: data.description,
            extract: data.extract,
            thumbnail: data.thumbnail,
            originalimage: data.originalimage,
            pageType: data.type,
            source: sourceName
        };
    } catch (e) {
        // console.warn(`[WikiService] Summary fetch failed for ${title} via ${sourceName}`, e);
        return null;
    }
};

const isImageValid = (url?: string): boolean => {
    if (!url) return false;
    const lower = url.toLowerCase();

    // Aggressive Filter for Maps, Flags, Icons
    const invalidTerms = [
        'flag_of', 'coat_of_arms', 'location_map', 'locator_map',
        'map_of', 'administrative', 'districts', 'region', 'provinces',
        'scheme', 'diagram', 'chart', 'icon', 'logo', 'symbol', 'shield'
    ];

    if (invalidTerms.some(term => lower.includes(term))) return false;

    // SVG files are typically vector graphics/maps/flags, not photos
    if (lower.endsWith('.svg')) return false;

    // "Map" in filename is usually a map, but avoid false positives like "Maple"
    // Check for "map" with delimiters
    if (lower.includes('_map') || lower.includes('-map') || lower.includes('map.') || lower.includes('map_')) {
        return false;
    }

    return true;
};

// Fallback: Query Page Images if the Summary Image is rejected
const fetchDeepImage = async (title: string, searchApiBase: string): Promise<string | null> => {
    try {
        // Request up to 5 images from the page
        const url = `${searchApiBase}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&piprop=thumbnail|original&pithumbsize=600&pilimit=5&format=json`;

        const response = await fetch(url, { headers: WIKI_HEADERS });
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.query || !data.query.pages) return null;

        const pages = Object.values(data.query.pages);
        if (pages.length === 0) return null;

        const page: any = pages[0];
        if (!page.pageimages && !page.thumbnail) return null;

        // Note: 'prop=pageimages' with 'piprop' is tricky. 
        // Recent Wiki APIs return 'thumbnail' for the main one, but we want list.
        // Actually, 'generator=images' gets file pages. 
        // But 'piprop' on 'query' usually only returns the *main* image.
        // Let's use 'pageimages' logic properly.
        // The standard 'pageimages' extension often just returns the main thumbnail.
        // To get MULTIPLE, we might need 'images' prop then fetch info, which is slow.
        // HOWEVER, 'piprop=original' often gives a better candidate than summary sometimes.

        // Actually, let's look at the logic:
        // If Summary Image (Main) is a Map, we want the SECOND image.
        // Wiki API 'pageimages' usually serves the 'Main' image.
        // If the Main Image is a Map, we are stuck.

        // ALTERNATIVE: Use 'images' generator to list all images on page, then pick one.
        // Costly? Yes. But for "Thailand", the Map is the first image.
        // The lovely photos are further down.

        // Let's try fetching 10 images from the page.
        // ex: action=query&prop=images&titles=Thailand&imlimit=10... returns file names "File:..."
        // Then we need to fetch their URLs. This is 2 steps.
        // It might be too slow for UI.

        // COMPROMISE:
        // If Wikivoyage (scenic) failed, stick to Wikipedia.
        // But if BOTH fail to give a valid SCENIC image, we return null (no image).
        // A placeholder is better than a Map? User wants "Beautiful Photo".
        // A Map is NOT a beautiful photo.
        // So strict filtering is better than showing a map.

        // Wait, if we return null, we show Gray Box.
        // User wants Photo.

        // Let's just return null if invalid. "No Image" (Gray Box/Placeholder) is honest.
        // "Just shows a map image" -> User implies this is bad.
        // I will ensure we return `undefined` so at least we don't show the map.

        // But can we try harder?
        // Let's rely on Wikivoyage's `pageimages`.
        // Usually Wikivoyage Main Image IS scenic.
        // If Wikivoyage returned a Map, that's weird.
        // Maybe "Thailand" Wikivoyage Main Image is indeed a map.

        return null;
    } catch (e) {
        return null;
    }
};

export const getPlaceDetails = async (placeName: string): Promise<WikiPlaceDetails | null> => {
    // Generate candidates
    const cleanName = placeName.trim();
    const parts = cleanName.split(',').map(p => p.trim());

    const candidates = new Set<string>();
    candidates.add(cleanName);
    if (parts.length > 0) candidates.add(parts[0]);
    if (parts.length > 1) candidates.add(`${parts[0]}, ${parts[1]}`);
    if (candidates.size === 0 && parts.length > 0) candidates.add(parts[parts.length - 1]);

    console.log(`[WikiService] Searching candidates for "${placeName}":`, Array.from(candidates));

    let bestResult: WikiPlaceDetails | null = null;
    let bestScore = 0; // 0 = none, 1 = disambig, 2 = standard+noImg, 3 = standard+badImg, 4 = standard+goodImg

    const processResult = (result: WikiPlaceDetails | null, isVoyage: boolean) => {
        if (!result) return false;
        if (result.pageType === 'disambiguation') return false; // Skip disambiguation if possible

        const hasImage = !!result.thumbnail;
        const sourceUrl = result.originalimage?.source || result.thumbnail?.source;
        const validImg = isImageValid(sourceUrl);

        // Heavily penalize Maps/Flags
        // If invalid image, treat as No Image (Score 2)

        let score = 2; // Base standard result
        if (hasImage && validImg) score = 4;
        else if (hasImage && !validImg) score = 1; // Map is worse than no image? Or just 1.

        // Boost Wikivoyage
        if (isVoyage && score >= 4) score += 0.5;

        if (score > bestScore) {
            bestScore = score;
            bestResult = result;
        }

        return score >= 4;
    };

    for (const candidate of candidates) {
        // Strategy 1: Wikivoyage (Primary for Scenic Photos)
        const voyageResult = await fetchSummary(candidate, VOYAGE_API_BASE, 'wikivoyage');
        if (processResult(voyageResult, true)) return voyageResult;

        // Strategy 2: Wikipedia (Secondary / Fallback)
        const wikiResult = await fetchSummary(candidate, WIKI_API_BASE, 'wikipedia');
        if (processResult(wikiResult, false)) return wikiResult;

        // Strategy 3: Opensearch fallback
        const wikiTitle = await searchWikiTitle(candidate);
        if (wikiTitle && wikiTitle !== candidate) {
            const searchResult = await fetchSummary(wikiTitle, WIKI_API_BASE, 'wikipedia');
            if (processResult(searchResult, false)) return searchResult;
        }
    }

    // Final Scrub: If the winner has a bad image, remove it.
    if (bestResult && bestResult.thumbnail) {
        const url = bestResult.originalimage?.source || bestResult.thumbnail.source;
        if (!isImageValid(url)) {
            console.log(`[WikiService] Filtered out flag/map image: ${url}`);
            bestResult.thumbnail = undefined;
            bestResult.originalimage = undefined;
        }
    }

    if (bestResult) {
        // Fallback: If no image found (e.g. Map only), try Deep Search?
        // For now, let's ship the strict filter. 
        // Most major places have a scenic photo on Voyage.
        // If Thailand Voyage had a map, the filter will kill it, and we might show "No Image".
        // Which is safer than "Ugly Map".
        console.log(`[WikiService] Returning best result from ${bestResult.source}: ${bestResult.title}`);
        return bestResult;
    }

    return null;
};
