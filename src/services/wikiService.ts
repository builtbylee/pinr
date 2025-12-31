/**
 * Service to fetch place details from Wikipedia and Wikivoyage
 * Strategy: Wikivoyage First (Better Scenic Photos) -> Wikipedia Second -> Filter Flags/Maps
 */

const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1/page';
const WIKI_SEARCH_API = 'https://en.wikipedia.org/w/api.php';
const VOYAGE_API_BASE = 'https://en.wikivoyage.org/api/rest_v1/page';

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

// Search for the correct Wikipedia page title first
const searchWikiTitle = async (query: string): Promise<string | null> => {
    try {
        const headers = {
            'User-Agent': 'PrimalSingularity/1.0 (contact@primalsingularity.app)',
            'Accept': 'application/json'
        };

        const response = await fetch(
            `${WIKI_SEARCH_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`,
            { headers }
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
        console.error('[WikiService] Title search failed:', error);
        return null;
    }
}

const fetchSummary = async (title: string, apiBase: string, sourceName: 'wikipedia' | 'wikivoyage'): Promise<WikiPlaceDetails | null> => {
    try {
        const headers = {
            'User-Agent': 'PrimalSingularity/1.0 (contact@primalsingularity.app)',
            'Accept': 'application/json'
        };
        const response = await fetch(`${apiBase}/summary/${encodeURIComponent(title)}`, { headers });
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
    // Filter out flags, maps, coats of arms, and SVGs (which are usually vector flags)
    if (lower.includes('flag_of')) return false;
    if (lower.includes('coat_of_arms')) return false;
    if (lower.includes('location_map')) return false;
    if (lower.includes('locator_map')) return false;
    if (lower.endsWith('.svg')) return false;
    return true;
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
        const goodImage = hasImage && isImageValid(result.originalimage?.source || result.thumbnail?.source);

        let score = 2; // Base standard result
        if (hasImage) score = 3;
        if (goodImage) score = 4;

        // Boost Wikivoyage results slightly if they have a decent image, 
        // effectively making Voyage+GoodImg (4.5) > Wiki+GoodImg (4)
        if (isVoyage && goodImage) score += 0.5;

        // Wikipedia with Bad Image (Score 3) vs Wikivoyage with No Image (Score 2) -> Wiki Wins
        // But we want to filter the bad image later.

        if (score > bestScore) {
            bestScore = score;
            bestResult = result;
        }

        // Stop if we found a perfect result (Good Image)
        return score >= 4;
    };

    for (const candidate of candidates) {
        // Strategy 1: Wikivoyage (Primary for Scenic Photos)
        // Try exact candidate
        const voyageResult = await fetchSummary(candidate, VOYAGE_API_BASE, 'wikivoyage');
        if (processResult(voyageResult, true)) return voyageResult;

        // Strategy 2: Wikipedia (Secondary / Fallback)
        const wikiResult = await fetchSummary(candidate, WIKI_API_BASE, 'wikipedia');
        if (processResult(wikiResult, false)) return wikiResult;

        // Strategy 3: Opensearch fallback (Wikipedia only, Voyage opensearch is shaky)
        const wikiTitle = await searchWikiTitle(candidate);
        if (wikiTitle && wikiTitle !== candidate) {
            const searchResult = await fetchSummary(wikiTitle, WIKI_API_BASE, 'wikipedia');
            if (processResult(searchResult, false)) return searchResult;
        }
    }

    // If we have a result but the image was filtered (score 3), we remove the image url to force placeholder
    if (bestResult && bestResult.thumbnail) {
        const url = bestResult.originalimage?.source || bestResult.thumbnail.source;
        if (!isImageValid(url)) {
            console.log(`[WikiService] Filtered out flag/map image: ${url}`);
            bestResult.thumbnail = undefined;
            bestResult.originalimage = undefined;
        }
    }

    if (bestResult) {
        console.log(`[WikiService] Returning best result from ${bestResult.source}: ${bestResult.title}`);
        return bestResult;
    }

    return null;
};
