import { useState, useEffect, useRef } from 'react';
import Supercluster from 'supercluster';
import { BBox, GeoJsonProperties } from 'geojson';

export interface Point {
    type: 'Feature';
    properties: {
        cluster: boolean;
        id: string; // pinId or clusterId
        originalId?: string; // for leaves
        [key: string]: any;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
}

interface UseMapClustersProps {
    points: Point[];
    bounds: BBox | null; // [minLng, minLat, maxLng, maxLat]
    zoom: number;
}

export const useMapClusters = ({ points, bounds, zoom }: UseMapClustersProps) => {
    const [clusters, setClusters] = useState<any[]>([]);
    const superclusterRef = useRef<Supercluster>(
        new Supercluster({
            radius: 12, // Reduced further to 12 to strictly group only overlapping pins
            maxZoom: 18,
        })
    );

    // Initialize supercluster with points
    useEffect(() => {
        if (points) {
            superclusterRef.current.load(points);
        }
    }, [points]);

    // Update clusters when bounds/zoom change
    // Battery optimization: Skip clustering when zoomed in very close (individual pins visible)
    useEffect(() => {
        if (superclusterRef.current && points.length > 0) {
            // Battery optimization: When zoomed in very close (zoom > 8), show individual pins
            // Clustering is only needed at lower zoom levels
            if (zoom > 8) {
                // At high zoom, return individual points (no clustering needed)
                setClusters(points);
                return;
            }

            // Get clusters for current view
            try {
                // FIX: Always use world bounds to ensure pins render immediately.
                // Previously, we required `bounds` to be non-null, which blocked rendering
                // until the map reported its visible bbox (could take 10+ seconds).
                const worldBounds: BBox = [-180, -90, 180, 90];
                const clusteredPoints = superclusterRef.current.getClusters(worldBounds, Math.floor(zoom));
                setClusters(clusteredPoints);
            } catch (error) {
                if (__DEV__) console.warn('[useMapClusters] Failed to get clusters:', error);
                setClusters([]);
            }
        } else if (points.length === 0) {
            setClusters([]);
        }
    }, [points, zoom]); // Note: bounds removed from dependency, using world bounds always

    const getLeaves = (clusterId: number, limit = 10, offset = 0) => {
        if (!superclusterRef.current) return [];
        return superclusterRef.current.getLeaves(clusterId, limit, offset);
    };

    return {
        clusters,
        supercluster: superclusterRef.current,
        getLeaves
    };
};
