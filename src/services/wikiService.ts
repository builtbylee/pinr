/**
 * Service to fetch place details from Wikipedia
 */

const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1/page';
const WIKI_SEARCH_API = 'https://en.wikipedia.org/w/api.php';

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
}

// Search for the correct Wikipedia page title first
const searchWikiTitle = async (query: string): Promise<string | null> => {
    try {
        // Wikipedia requires a User-Agent to avoid blocking
        const headers = {
            'User-Agent': 'PrimalSingularity/1.0 (contact@primalsingularity.app)',
            'Accept': 'application/json'
        };

        const response = await fetch(
            `${WIKI_SEARCH_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`,
            { headers }
        );

        if (!response.ok) {
            console.warn(`[WikiService] Opensearch failed: ${response.status}`);
            return null;
        }

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            // Response format: [query, [titles], [descriptions], [urls]]
            if (data && data[1] && data[1].length > 0) {
                return data[1][0];
            }
        } catch (e) {
            console.error('[WikiService] JSON Parse Error. Response text start:', text.substring(0, 100));
            return null;
        }

        return null;
    } catch (error) {
        console.error('[WikiService] Title search failed:', error);
        return null;
    }
}

const fetchWikiSummary = async (title: string): Promise<WikiPlaceDetails | null> => {
    try {
        // Wikipedia requires a User-Agent
        const headers = {
            'User-Agent': 'PrimalSingularity/1.0 (contact@primalsingularity.app)',
            'Accept': 'application/json'
        };
        const response = await fetch(`${WIKI_API_BASE}/summary/${encodeURIComponent(title)}`, { headers });
        if (!response.ok) return null;

        const data = await response.json();
        if (data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;

        return {
            title: data.title,
            description: data.description,
            extract: data.extract,
            thumbnail: data.thumbnail,
            originalimage: data.originalimage,
            pageType: data.type, // 'standard' or 'disambiguation'
        };
    } catch (e) {
        console.warn(`[WikiService] Summary fetch failed for ${title}`, e);
        return null;
    }
};

export const getPlaceDetails = async (placeName: string): Promise<WikiPlaceDetails | null> => {
    // Generate candidates: 
    // 1. "Takoradi" (if passed directly)
    // 2. "Takoradi" (from "Takoradi, Western, Ghana")
    // 3. "Takoradi, Western"
    // 4. "Ghana"

    // Clean input
    const cleanName = placeName.trim();
    const parts = cleanName.split(',').map(p => p.trim());

    const candidates = new Set<string>();
    candidates.add(cleanName); // "Takoradi, Western, Ghana" or "Takoradi"
    if (parts.length > 0) candidates.add(parts[0]); // "Takoradi"
    if (parts.length > 1) candidates.add(`${parts[0]}, ${parts[1]}`); // "Takoradi, Western"
    // Remove "country only" fallback if specific parts exist, as it's often too broad
    if (candidates.size === 0 && parts.length > 0) candidates.add(parts[parts.length - 1]);

    console.log(`[WikiService] Searching candidates for "${placeName}":`, Array.from(candidates));

    let bestResult: WikiPlaceDetails | null = null;
    let bestScore = 0; // 0 = none, 1 = disambig, 2 = standard+noImg, 3 = standard+img

    const processResult = (result: WikiPlaceDetails | null) => {
        if (!result) return false;

        const hasImage = !!result.thumbnail;
        const isStandard = result.pageType === 'standard';
        let score = 1;

        if (isStandard) {
            score = hasImage ? 3 : 2;
        } else if (result.pageType === 'disambiguation') {
            score = 1;
        }

        if (score > bestScore) {
            bestScore = score;
            bestResult = result;
        }

        // Stop immediately if we found gold
        return score === 3;
    };

    for (const candidate of candidates) {
        // Strategy A: Direct Summary (Best for "Takoradi")
        const directResult = await fetchWikiSummary(candidate);
        if (processResult(directResult)) return directResult;

        // Strategy B: Opensearch -> Summary (Best for fuzzy matches)
        const wikiTitle = await searchWikiTitle(candidate);
        if (wikiTitle && wikiTitle !== candidate) { // Avoid re-fetching same title
            const searchResult = await fetchWikiSummary(wikiTitle);
            if (processResult(searchResult)) return searchResult;
        }
    }

    if (bestResult) {
        console.log(`[WikiService] Returning best result (score ${bestScore}): ${bestResult.title}`);
        return bestResult;
    }

    console.warn(`[WikiService] No details found for "${placeName}" after trying candidates.`);
    return null;
};
