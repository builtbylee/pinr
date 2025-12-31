import { MAPBOX_TOKEN } from '../constants/Config';

const MAPBOX_GEOCODING_API = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export interface GeocodingResult {
    id: string;
    text: string;           // e.g. "Paris"
    place_name: string;     // e.g. "Paris, France"
    center: [number, number]; // [lon, lat]
    context?: any[];
    image?: string; // Optional thumbnail URL (e.g. from Wiki)
}

export const searchPlaces = async (query: string): Promise<GeocodingResult[]> => {
    if (!query || query.length < 3) return [];

    try {
        const url = `${MAPBOX_GEOCODING_API}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=place,country,locality&limit=5`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`[GeocodingService] Error ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.features.map((f: any) => ({
            id: f.id,
            text: f.text,
            place_name: f.place_name,
            center: f.center,
            context: f.context
        }));

    } catch (error) {
        console.error('[GeocodingService] Search failed:', error);
        return [];
    }
};
