const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (!token) {
    console.error('[Config] CRITICAL: EXPO_PUBLIC_MAPBOX_TOKEN environment variable is not set!');
}
export const MAPBOX_TOKEN = token || '';
