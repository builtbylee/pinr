const fetch = require('node-fetch');

const query = "Pamir";
const WIKI_SEARCH_API = 'https://en.wikipedia.org/w/api.php';
const url = `${WIKI_SEARCH_API}?action=query&generator=prefixsearch&gpssearch=${encodeURIComponent(query)}&gpslimit=20&prop=coordinates|pageimages|description|extracts&piprop=thumbnail&pithumbsize=200&exintro&explaintext&exsentences=1&format=json&origin=*`;

const headers = {
    'Api-User-Agent': 'PrimalSingularity/1.0 (Mobile App; Contact: support@primalsingularity.com)'
};

console.log("Testing Wiki Search API...");
console.log("URL:", url);

fetch(url, { headers })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP Error: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        if (!data.query || !data.query.pages) {
            console.error("FAIL: No results found.");
            process.exit(1);
        }

        const pages = Object.values(data.query.pages);
        // Sort logic mimic
        pages.sort((a, b) => (a.index || 999) - (b.index || 999));

        const validPages = pages.filter(p => p.coordinates && p.coordinates.length > 0);

        console.log(`Found ${pages.length} total pages.`);
        console.log(`Found ${validPages.length} valid pages (with coords).`);

        if (validPages.length === 0) {
            console.error("FAIL: No valid pages with coordinates.");
            process.exit(1);
        }

        console.log("Top Result:", validPages[0].title);
        console.log("Image source:", validPages[0].thumbnail ? validPages[0].thumbnail.source : "None");

        if (!validPages[0].thumbnail) {
            console.warn("WARNING: No image for top result.");
        }

        console.log("SUCCESS: Search Verified.");
    })
    .catch(err => {
        console.error("CRASH:", err);
        process.exit(1);
    });
