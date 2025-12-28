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
    useEffect(() => {
        if (bounds && superclusterRef.current) {
            // Get clusters for current view
            try {
                // STABILITY FIX: Cluster the entire world instead of just visible bounds.
                // This prevents pins from disappearing when spinning the globe (bounds calculation lag).
                // Mapbox native view handles the clipping of off-screen markers.
                const worldBounds: BBox = [-180, -90, 180, 90];
                const clusteredPoints = superclusterRef.current.getClusters(worldBounds, Math.floor(zoom));
                setClusters(clusteredPoints);
            } catch (error) {
                console.warn('[useMapClusters] Failed to get clusters:', error);
                setClusters([]);
            }
        }
    }, [points, zoom]); // Removed 'bounds' dependency for stability

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
