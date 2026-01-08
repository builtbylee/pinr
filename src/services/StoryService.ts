import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { deletePin } from './firestoreService';
import { Memory } from '../store/useMemoryStore';
import { uploadImage } from './storageService';
import { addPin } from './firestoreService';
import { notificationService } from './NotificationService';
import { getUserProfile } from './userService';

export interface Story {
    id: string;
    creatorId: string;
    title: string;
    description?: string;
    pinIds: string[]; // Ordered list of pin IDs (1-10)
    coverPinId?: string; // Optional: ID of pin to use as cover image
    createdAt: number;
    updatedAt: number;
}

export interface PinDraft {
    tempId: string;
    localImageUri: string;
    title: string;
    location: { lat: number; lon: number; name: string } | null;
    visitDate: number | null;
}

export const STORIES_COLLECTION = 'stories';
export const MAX_STORIES_PER_USER = 5;
export const MAX_PINS_PER_STORY = 10;

class StoryService {
    /**
     * Create a new story for a user (via Cloud Function for limit enforcement)
     */
    async createStory(userId: string, data: Pick<Story, 'title' | 'description' | 'pinIds' | 'coverPinId'>): Promise<{ success: boolean; storyId?: string; error?: string }> {
        try {
            // Call Cloud Function for server-side limit enforcement
            const result = await functions().httpsCallable('createStory')({
                title: data.title,
                description: data.description,
                pinIds: data.pinIds,
                coverPinId: data.coverPinId,
            });

            const response = result.data as any;

            if (!response.success) {
                return { success: false, error: response.error || 'Failed to create story' };
            }

            if (__DEV__) console.log('[StoryService] Created story via Cloud Function:', response.storyId ? response.storyId.substring(0, 8) + '...' : 'NULL');
            return { success: true, storyId: response.storyId };

        } catch (error: any) {
            if (__DEV__) console.error('[StoryService] Error creating story:', error?.message || 'Unknown error');
            // Handle specific error codes
            if (error.code === 'functions/resource-exhausted') {
                return { success: false, error: `You can only have up to ${MAX_STORIES_PER_USER} stories.` };
            }
            if (error.code === 'functions/invalid-argument') {
                return { success: false, error: error.message || 'Invalid story data.' };
            }
            return { success: false, error: 'Failed to create story.' };
        }
    }

    /**
     * Create a story with fresh photos (batch upload flow).
     * 1. Uploads all photos
     * 2. Creates pins for each
     * 3. Creates the story document
     * 4. Notifies friends
     */
    async createStoryWithPhotos(
        userId: string,
        storyTitle: string,
        pinDrafts: PinDraft[],
        friends: string[]
    ): Promise<{ success: boolean; storyId?: string; error?: string }> {
        try {
            if (__DEV__) console.log('[StoryService] Starting batch story creation:', storyTitle || 'NONE');

            // 1. Validate limits
            if (pinDrafts.length > MAX_PINS_PER_STORY) {
                return { success: false, error: `A story can have at most ${MAX_PINS_PER_STORY} pins.` };
            }

            const userStoriesSnapshot = await firestore()
                .collection(STORIES_COLLECTION)
                .where('creatorId', '==', userId)
                .get();

            if (userStoriesSnapshot.size >= MAX_STORIES_PER_USER) {
                return { success: false, error: `You can only have up to ${MAX_STORIES_PER_USER} stories.` };
            }

            // 2. Upload photos and create pins in parallel
            const uploadPromises = pinDrafts.map(async (draft) => {
                try {
                    // Upload image
                    const pinId = `story_pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const downloadUrl = await uploadImage(draft.localImageUri, userId, pinId);

                    // Create pin memory
                    const pinData = {
                        id: '', // Will be set by addPin
                        title: draft.title,
                        location: draft.location
                            ? [draft.location.lon, draft.location.lat] as [number, number]
                            : [0, 0] as [number, number],
                        locationName: draft.location?.name || 'Unknown Location',
                        imageUris: [downloadUrl],
                        date: draft.visitDate ? new Date(draft.visitDate).toISOString() : new Date().toISOString(),
                        creatorId: userId,
                        pinColor: 'magenta' as const,
                        expiresAt: null,
                    };

                    const newPinId = await addPin(pinData as any);
                    if (__DEV__) console.log('[StoryService] Created pin:', newPinId ? newPinId.substring(0, 8) + '...' : 'NULL');
                    return newPinId;
                } catch (pinError: any) {
                    if (__DEV__) console.error('[StoryService] Error creating pin:', pinError?.message || 'Unknown error');
                    return null;
                }
            });

            const results = await Promise.all(uploadPromises);
            const createdPinIds = results.filter((id): id is string => id !== null);

            if (createdPinIds.length === 0) {
                return { success: false, error: 'Failed to create any pins for the story.' };
            }

            // 3. Create story
            const result = await this.createStory(userId, {
                title: storyTitle,
                pinIds: createdPinIds,
                coverPinId: createdPinIds[0], // Explicitly set cover pin
            });

            if (!result.success) {
                return result;
            }

            // 4. Notify friends
            const userProfile = await getUserProfile(userId);
            const creatorName = userProfile?.username || 'Someone';

            for (const friendUid of friends) {
                notificationService.notifyNewStory(friendUid, creatorName, storyTitle);
            }

            if (__DEV__) console.log('[StoryService] Story created successfully:', result.storyId ? result.storyId.substring(0, 8) + '...' : 'NULL');
            return result;

        } catch (error: any) {
            if (__DEV__) console.error('[StoryService] Error in batch story creation:', error?.message || 'Unknown error');
            return { success: false, error: 'Failed to create story.' };
        }
    }

    /**
     * Update a story with pin drafts (handles new photos, updates to existing pins, and reordering).
     */
    async updateStoryWithPhotos(
        userId: string,
        storyId: string,
        storyTitle: string,
        pinDrafts: PinDraft[]
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (__DEV__) console.log('[StoryService] Starting story update:', storyTitle || 'NONE');
            const { updatePin } = require('./firestoreService');

            // 1. Separate new vs existing pins
            const newDrafts = pinDrafts.filter(d => d.tempId.startsWith('temp_'));
            const existingDrafts = pinDrafts.filter(d => !d.tempId.startsWith('temp_'));

            // 2. Create new pins
            const newPinIdMap: Record<string, string> = {};

            if (newDrafts.length > 0) {
                const uploadPromises = newDrafts.map(async (draft) => {
                    try {
                        const pinId = `story_pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const downloadUrl = await uploadImage(draft.localImageUri, userId, pinId);

                        const pinData = {
                            id: '',
                            title: draft.title,
                            location: draft.location
                                ? [draft.location.lon, draft.location.lat] as [number, number]
                                : [0, 0] as [number, number],
                            locationName: draft.location?.name || 'Unknown Location',
                            imageUris: [downloadUrl],
                            date: draft.visitDate ? new Date(draft.visitDate).toISOString() : new Date().toISOString(),
                            creatorId: userId,
                            pinColor: 'magenta' as const,
                            expiresAt: null,
                        };

                        const newPinId = await addPin(pinData as any);
                        newPinIdMap[draft.tempId] = newPinId;
                        return newPinId;
                    } catch (e: any) {
                        if (__DEV__) console.error('[StoryService] Error creating new pin for update:', e?.message || 'Unknown error');
                        return null;
                    }
                });
                await Promise.all(uploadPromises);
            }

            // 3. Update existing pins
            const updatePromises = existingDrafts.map(async (draft) => {
                try {
                    await updatePin(draft.tempId, {
                        title: draft.title,
                        location: draft.location
                            ? [draft.location.lon, draft.location.lat]
                            : [0, 0], // Note: firestoreService might expect geopoint or array, checking usage
                        locationName: draft.location?.name,
                        date: draft.visitDate ? new Date(draft.visitDate).toISOString() : undefined
                    });
                } catch (e: any) {
                    if (__DEV__) console.error('[StoryService] Error updating pin:', draft.tempId ? draft.tempId.substring(0, 8) + '...' : 'NULL', e?.message || 'Unknown error');
                }
            });
            await Promise.all(updatePromises);

            // 4. Construct final pin ID list in order
            const finalPinIds = pinDrafts.map(d => {
                if (d.tempId.startsWith('temp_')) {
                    return newPinIdMap[d.tempId];
                }
                return d.tempId;
            }).filter(id => !!id); // Filter out any failed creations

            // 5. Update Story
            await this.updateStory(storyId, {
                title: storyTitle,
                pinIds: finalPinIds,
                coverPinId: finalPinIds[0] // Update cover to first pin
            });

            return { success: true };

        } catch (error: any) {
            if (__DEV__) console.error('[StoryService] Error in updateStoryWithPhotos:', error?.message || 'Unknown error');
            return { success: false, error: 'Failed to update story.' };
        }
    }

    /**
     * Update an existing story.
     */
    async updateStory(storyId: string, updates: Partial<Pick<Story, 'title' | 'description' | 'pinIds' | 'coverPinId'>>): Promise<{ success: boolean; error?: string }> {
        try {
            if (updates.pinIds && updates.pinIds.length > MAX_PINS_PER_STORY) {
                return { success: false, error: `A story can have at most ${MAX_PINS_PER_STORY} pins.` };
            }

            await firestore().collection(STORIES_COLLECTION).doc(storyId).update({
                ...updates,
                updatedAt: Date.now(),
            });

            if (__DEV__) console.log('[StoryService] Updated story:', storyId ? storyId.substring(0, 8) + '...' : 'NULL');
            return { success: true };
        } catch (error: any) {
            if (__DEV__) console.error('[StoryService] Error updating story:', error?.message || 'Unknown error');
            return { success: false, error: 'Failed to update story.' };
        }
    }

    /**
     * Delete a story.
     */
    async deleteStory(storyId: string): Promise<boolean> {
        try {
            // 1. Get story to find associated pins
            const story = await this.getStory(storyId);
            if (!story) return false;

            // 2. Delete all associated pins
            if (story.pinIds && story.pinIds.length > 0) {
                if (__DEV__) console.log(`[StoryService] Deleting ${story.pinIds.length} pins for story ${storyId ? storyId.substring(0, 8) + '...' : 'NULL'}`);
                await Promise.all(story.pinIds.map(pinId => deletePin(pinId).catch(e => {
                    if (__DEV__) console.warn(`[StoryService] Failed to delete pin ${pinId ? pinId.substring(0, 8) + '...' : 'NULL'}:`, e?.message || 'Unknown error');
                })));
            }

            // 3. Delete story document
            await firestore().collection(STORIES_COLLECTION).doc(storyId).delete();
            if (__DEV__) console.log('[StoryService] Deleted story:', storyId ? storyId.substring(0, 8) + '...' : 'NULL');
            return true;
        } catch (error: any) {
            if (__DEV__) console.error('[StoryService] Error deleting story:', error?.message || 'Unknown error');
            return false;
        }
    }

    /**
     * Get all stories created by a specific user.
     */
    async getUserStories(userId: string): Promise<Story[]> {
        try {
            const snapshot = await firestore()
                .collection(STORIES_COLLECTION)
                .where('creatorId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => doc.data() as Story);
        } catch (error: any) {
            if (__DEV__) console.error('[StoryService] Error fetching user stories:', error?.message || 'Unknown error');
            return [];
        }
    }

    /**
     * Get a single story by ID.
     */
    async getStory(storyId: string): Promise<Story | null> {
        try {
            const doc = await firestore().collection(STORIES_COLLECTION).doc(storyId).get();
            if (doc.exists()) {
                return doc.data() as Story;
            }
            return null;
        } catch (error: any) {
            if (__DEV__) console.error('[StoryService] Error fetching story:', error?.message || 'Unknown error');
            return null;
        }
    }

    /**
     * Helper to parse Firestore REST API fields recursively
     */
    private parseFirestoreField(value: any): any {
        if (!value) return null;
        if (value.stringValue !== undefined) return value.stringValue;
        if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
        if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
        if (value.booleanValue !== undefined) return value.booleanValue;
        if (value.timestampValue !== undefined) return new Date(value.timestampValue).getTime();
        if (value.geoPointValue !== undefined) return {
            latitude: value.geoPointValue.latitude,
            longitude: value.geoPointValue.longitude
        };
        if (value.arrayValue !== undefined) {
            return (value.arrayValue.values || []).map((v: any) => this.parseFirestoreField(v));
        }
        if (value.mapValue !== undefined) {
            const map: any = {};
            const fields = value.mapValue.fields || {};
            for (const key in fields) {
                map[key] = this.parseFirestoreField(fields[key]);
            }
            return map;
        }
        return null;
    }

    /**
     * Subscribe to user's stories (Real-time) with iOS Fail-Fast
     */
    subscribeToUserStories(userId: string, callback: (stories: Story[]) => void): () => void {
        const { Platform } = require('react-native');
        let hasReceivedSnapshot = false;
        let timeoutId: NodeJS.Timeout | null = null;
        let unsubscribeSnapshot: () => void;

        // AGGRESSIVE FIX: Fail fast on iOS to avoid startup hang
        const timeoutMs = Platform.OS === 'ios' ? 500 : 10000;

        timeoutId = setTimeout(async () => {
            if (!hasReceivedSnapshot) {
                if (__DEV__) console.warn(`[StoryService] ⚠️ Stories subscription timeout after ${timeoutMs}ms, trying REST API...`);
                try {
                    const auth = require('@react-native-firebase/auth').default;
                    const currentUser = auth().currentUser;

                    if (currentUser) {
                        const token = await currentUser.getIdToken(true);
                        const projectId = 'days-c4ad4'; // Hardcoded ID for consistency with other services

                        // Structured Query for Stories by Creator
                        const queryBody = {
                            structuredQuery: {
                                from: [{ collectionId: STORIES_COLLECTION }],
                                where: {
                                    fieldFilter: {
                                        field: { fieldPath: 'creatorId' },
                                        op: 'EQUAL',
                                        value: { stringValue: userId }
                                    }
                                },
                                orderBy: [
                                    {
                                        field: { fieldPath: 'createdAt' },
                                        direction: 'DESCENDING'
                                    }
                                ]
                            }
                        };

                        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(queryBody)
                        });

                        if (response.ok) {
                            const results = await response.json();
                            if (__DEV__) console.log(`[StoryService] ✅ REST query succeeded, found ${results.length - 1} possible stories`); // -1 because runQuery often returns a readTime only object at end

                            const stories: Story[] = [];
                            for (const result of results) {
                                if (result.document) {
                                    const doc = result.document;
                                    const pathParts = doc.name.split('/');
                                    const id = pathParts[pathParts.length - 1];

                                    const fields = doc.fields;
                                    const storyData: any = { id };
                                    for (const key in fields) {
                                        storyData[key] = this.parseFirestoreField(fields[key]);
                                    }
                                    stories.push(storyData as Story);
                                }
                            }

                            hasReceivedSnapshot = true;
                            callback(stories);

                        } else {
                            if (__DEV__) console.error('[StoryService] ❌ REST query failed:', response.status);
                        }
                    }
                } catch (e: any) {
                    if (__DEV__) console.error('[StoryService] ❌ REST query error:', e?.message || 'Unknown error');
                }
            }
        }, timeoutMs);

        unsubscribeSnapshot = firestore()
            .collection(STORIES_COLLECTION)
            .where('creatorId', '==', userId)
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    hasReceivedSnapshot = true;
                    if (timeoutId) clearTimeout(timeoutId);

                    const stories = snapshot.docs.map(doc => doc.data() as Story);
                    // console.log('[StoryService] Real-time snapshot received:', stories.length);
                    callback(stories);
                },
                (error: any) => {
                    if (error?.code === 'firestore/permission-denied') {
                        if (__DEV__) console.log('[StoryService] Subscription ended (user logged out)');
                    } else {
                        if (__DEV__) console.error('[StoryService] Subscription error:', error?.message || 'Unknown error');
                    }
                }
            );

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            unsubscribeSnapshot();
        };
    }
}

export const storyService = new StoryService();
