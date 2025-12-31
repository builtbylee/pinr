const UNSPLASH_ACCESS_KEY = 'rFNlqCHJdsSGfm7qdipGVhQBc63hnawiBPazQUbH2qo';
const UNSPLASH_BASE_URL = 'https://api.unsplash.com';

export interface UnsplashImage {
    id: string;
    url: string; // Regular URL (good for cards)
    thumbnail: string; // Small URL
    photographer: {
        name: string;
        username: string;
        url: string;
    };
    downloadLocation: string; // Required for triggering download event (API guideline)
}

export const searchUnsplashImage = async (query: string): Promise<UnsplashImage | null> => {
    try {
        console.log(`[UnsplashService] Searching for: ${query}`);
        // Orientation landscape is best for cards
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
            console.warn('[UnsplashService] API Error:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const photo = data.results[0];
            return {
                id: photo.id,
                url: photo.urls.regular,
                thumbnail: photo.urls.small,
                photographer: {
                    name: photo.user.name,
                    username: photo.user.username,
                    url: photo.user.html // Link to profile
                },
                downloadLocation: photo.links.download_location
            };
        }

        return null;
    } catch (error) {
        console.error('[UnsplashService] Search Failed:', error);
        return null;
    }
};

// Required by Unsplash: Trigger a download event when stats are needed
// (For this app, we might skip it for now or implement if strictly following "Production" rules, 
// but for Dev it's fine. We'll add the function for future use)
export const triggerDownload = async (downloadLocation: string) => {
    try {
        await fetch(downloadLocation, {
            headers: {
                'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
            }
        });
    } catch (e) {
        // Ignore
    }
};
