import firestore from '@react-native-firebase/firestore';
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
     * Create a new story for a user.
     * Enforces limits: 5 stories per user, 10 pins per story.
     */
    async createStory(userId: string, data: Pick<Story, 'title' | 'description' | 'pinIds' | 'coverPinId'>): Promise<{ success: boolean; storyId?: string; error?: string }> {
        try {
            // 1. Validate Pin Count
            if (data.pinIds.length > MAX_PINS_PER_STORY) {
                return { success: false, error: `A story can have at most ${MAX_PINS_PER_STORY} pins.` };
            }

            // 2. Validate Story Count
            const userStoriesSnapshot = await firestore()
                .collection(STORIES_COLLECTION)
                .where('creatorId', '==', userId)
                .get();

            if (userStoriesSnapshot.size >= MAX_STORIES_PER_USER) {
                return { success: false, error: `You can only have up to ${MAX_STORIES_PER_USER} stories.` };
            }

            // 3. Create Story
            const newStoryRef = firestore().collection(STORIES_COLLECTION).doc();
            const timestamp = Date.now();

            const story: Story = {
                id: newStoryRef.id,
                creatorId: userId,
                title: data.title,
                description: data.description || '',
                pinIds: data.pinIds,
                coverPinId: data.coverPinId || (data.pinIds.length > 0 ? data.pinIds[0] : undefined),
                createdAt: timestamp,
                updatedAt: timestamp,
            };

            await newStoryRef.set(story);
            console.log('[StoryService] Created story:', story.id);
            return { success: true, storyId: story.id };

        } catch (error) {
            console.error('[StoryService] Error creating story:', error);
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
            console.log('[StoryService] Starting batch story creation:', storyTitle);

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
                    console.log('[StoryService] Created pin:', newPinId);
                    return newPinId;
                } catch (pinError) {
                    console.error('[StoryService] Error creating pin:', pinError);
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

            console.log('[StoryService] Story created successfully:', result.storyId);
            return result;

        } catch (error) {
            console.error('[StoryService] Error in batch story creation:', error);
            return { success: false, error: 'Failed to create story.' };
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

            console.log('[StoryService] Updated story:', storyId);
            return { success: true };
        } catch (error) {
            console.error('[StoryService] Error updating story:', error);
            return { success: false, error: 'Failed to update story.' };
        }
    }

    /**
     * Delete a story.
     */
    async deleteStory(storyId: string): Promise<boolean> {
        try {
            await firestore().collection(STORIES_COLLECTION).doc(storyId).delete();
            console.log('[StoryService] Deleted story:', storyId);
            return true;
        } catch (error) {
            console.error('[StoryService] Error deleting story:', error);
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
        } catch (error) {
            console.error('[StoryService] Error fetching user stories:', error);
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
        } catch (error) {
            console.error('[StoryService] Error fetching story:', error);
            return null;
        }
    }

    /**
     * Subscribe to user's stories (Real-time).
     */
    subscribeToUserStories(userId: string, callback: (stories: Story[]) => void): () => void {
        return firestore()
            .collection(STORIES_COLLECTION)
            .where('creatorId', '==', userId)
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    const stories = snapshot.docs.map(doc => doc.data() as Story);
                    callback(stories);
                },
                (error) => {
                    console.error('[StoryService] Subscription error:', error);
                }
            );
    }
}

export const storyService = new StoryService();
