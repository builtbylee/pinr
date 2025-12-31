/**
 * 4-Phase Verification Script: Unsplash Integration for Explore Mode
 * 
 * Phase 1: Code Review (Manual - verified imports, types, error handling)
 * Phase 2: Static Analysis (TypeScript compilation check)
 * Phase 3: API Integration Test (This script)
 * Phase 4: End-to-End Flow Verification (This script + Manual UI check)
 */

const UNSPLASH_ACCESS_KEY = 'rFNlqCHJdsSGfm7qdipGVhQBc63hnawiBPazQUbH2qo';
const UNSPLASH_BASE_URL = 'https://api.unsplash.com';

// Wikipedia API for comparison
const WIKI_SEARCH_API = 'https://en.wikipedia.org/w/api.php';

const WIKI_HEADERS = {
    'User-Agent': 'PrimalSingularity/1.0 (Mobile App; Contact: support@primalsingularity.com)',
    'Api-User-Agent': 'PrimalSingularity/1.0',
    'Accept': 'application/json'
};

// Test locations covering various types
const TEST_LOCATIONS = [
    'Thailand',      // Country - Previously showed map
    'Phuket',        // Province - Previously worked
    'Eiffel Tower',  // Landmark
    'Grand Canyon',  // Natural landmark
    'Tokyo',         // City
];

async function testUnsplashAPI(query) {
    console.log(`\n🔍 Testing Unsplash for: "${query}"`);

    try {
        const response = await fetch(
            `${UNSPLASH_BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
            {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
                    'Accept-Version': 'v1'
                }
            }
        );

        if (!response.ok) {
            console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
            return { success: false, error: response.status };
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const photo = data.results[0];
            console.log(`   ✅ Image Found!`);
            console.log(`      📷 Photographer: ${photo.user.name}`);
            console.log(`      🔗 URL: ${photo.urls.regular.substring(0, 60)}...`);
            console.log(`      📐 Size: ${photo.width}x${photo.height}`);
            return {
                success: true,
                photographer: photo.user.name,
                url: photo.urls.regular,
                thumbnail: photo.urls.small
            };
        } else {
            console.log(`   ⚠️ No results found`);
            return { success: false, error: 'No results' };
        }
    } catch (error) {
        console.log(`   ❌ Fetch Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testWikiAPI(query) {
    console.log(`\n📚 Testing Wikipedia for: "${query}"`);

    try {
        const url = `${WIKI_SEARCH_API}?action=query&generator=prefixsearch&gpssearch=${encodeURIComponent(query)}&gpslimit=1&prop=coordinates|pageimages|description&piprop=thumbnail&pithumbsize=200&format=json`;

        const response = await fetch(url, { headers: WIKI_HEADERS });

        if (!response.ok) {
            console.log(`   ❌ API Error: ${response.status}`);
            return { success: false };
        }

        const data = await response.json();

        if (data.query && data.query.pages) {
            const pages = Object.values(data.query.pages);
            if (pages.length > 0) {
                const page = pages[0];
                const hasCoords = page.coordinates && page.coordinates.length > 0;
                const hasImage = !!page.thumbnail;

                console.log(`   ✅ Page Found: ${page.title}`);
                console.log(`      📍 Coordinates: ${hasCoords ? 'Yes' : 'No'}`);
                console.log(`      🖼️ Thumbnail: ${hasImage ? 'Yes' : 'No'}`);
                if (hasImage) {
                    console.log(`      🔗 Image URL: ${page.thumbnail.source.substring(0, 60)}...`);
                }
                return { success: true, hasCoords, hasImage, title: page.title };
            }
        }

        console.log(`   ⚠️ No results`);
        return { success: false };
    } catch (error) {
        console.log(`   ❌ Fetch Error: ${error.message}`);
        return { success: false };
    }
}

async function runVerification() {
    console.log('='.repeat(60));
    console.log('🧪 UNSPLASH INTEGRATION VERIFICATION');
    console.log('   4-Phase Protocol: Phase 3 (API Integration Test)');
    console.log('='.repeat(60));

    let unsplashPassed = 0;
    let wikiPassed = 0;

    for (const location of TEST_LOCATIONS) {
        const unsplashResult = await testUnsplashAPI(location);
        const wikiResult = await testWikiAPI(location);

        if (unsplashResult.success) unsplashPassed++;
        if (wikiResult.success) wikiPassed++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Unsplash API: ${unsplashPassed}/${TEST_LOCATIONS.length} locations returned images`);
    console.log(`Wikipedia API: ${wikiPassed}/${TEST_LOCATIONS.length} locations found`);

    if (unsplashPassed === TEST_LOCATIONS.length) {
        console.log('\n✅ PHASE 3 PASSED: Unsplash API integration working correctly');
    } else if (unsplashPassed > 0) {
        console.log('\n⚠️ PHASE 3 PARTIAL: Some locations may not have Unsplash images');
    } else {
        console.log('\n❌ PHASE 3 FAILED: Unsplash API not returning images');
    }

    console.log('\n📋 PHASE 4 CHECKLIST (Manual UI Verification):');
    console.log('   [ ] Open app and navigate to Explore mode');
    console.log('   [ ] Search for "Thailand" - verify scenic photo appears');
    console.log('   [ ] Verify "Photo by [Name]" attribution overlay visible');
    console.log('   [ ] Tap attribution - verify it opens photographer profile');
    console.log('   [ ] Add location to Bucket List - verify it saves');
    console.log('   [ ] Close card and search for another location');

    console.log('\n' + '='.repeat(60));
}

runVerification().catch(console.error);
