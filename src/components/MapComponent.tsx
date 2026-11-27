"use client";

import React, { useRef, useEffect } from 'react';
import L from 'leaflet';
import { showError } from '@/utils/toast';
import { Post } from '@/types';

// Fix for default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapComponentProps {
  posts?: Post[];
  coordinates?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  onMarkerClick?: (post: Post, index: number) => void;
  mapRefreshKey?: number; // Used for invalidateSize
}

const MapComponent: React.FC<MapComponentProps> = ({
  posts,
  coordinates,
  zoom = 7,
  className,
  onMarkerClick,
  mapRefreshKey = 0,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null); // Renamed to markersLayerRef for clarity

  // Effect for map initialization (runs once)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only if it doesn't exist
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [0, 0], // Default center, will be adjusted by markers or coordinates
        zoom: zoom,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

      mapRef.current.on('error', (e: any) => {
        console.error('Leaflet Map Error:', e.error);
        showError('Failed to load map tiles.');
      });

      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    // Cleanup function for the map
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // Effect for managing markers (runs when posts or coordinates change)
  useEffect(() => {
    const currentMap = mapRef.current;
    const currentMarkersLayer = markersLayerRef.current;

    if (!currentMap || !currentMarkersLayer) return;

    currentMarkersLayer.clearLayers(); // Clear existing markers

    const latLngs: L.LatLngExpression[] = [];

    if (posts && posts.length > 0) {
      posts.forEach((post, index) => {
        if (post.coordinates) {
          const latLng: L.LatLngExpression = [post.coordinates.lat, post.coordinates.lng];
          const marker = L.marker(latLng);

          marker.on('click', () => {
            onMarkerClick?.(post, index);
          });

          currentMarkersLayer.addLayer(marker);
          latLngs.push(latLng);
        }
      });

      if (latLngs.length > 0) {
        if (latLngs.length === 1) {
          currentMap.setView(latLngs[0], zoom);
        } else {
          const bounds = L.latLngBounds(latLngs);
          currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: zoom });
        }
      }
    } else if (coordinates) {
      const latLng: L.LatLngExpression = [coordinates.lat, coordinates.lng];
      const marker = L.marker(latLng);
      currentMarkersLayer.addLayer(marker);
      currentMap.setView(latLng, zoom);
    }
  }, [posts, coordinates, zoom, onMarkerClick]); // Dependencies: posts, coordinates, zoom, onMarkerClick

  // Effect for invalidating map size (runs when mapRefreshKey or map instance changes)
  useEffect(() => {
    const currentMap = mapRef.current;
    if (currentMap) {
      // A small delay can help if the container is still animating its size
      setTimeout(() => {
        currentMap.invalidateSize();
      }, 200);
    }
  }, [mapRefreshKey, mapRef.current]); // Dependencies: mapRefreshKey, mapRef.current

  return (
    <div ref={mapContainerRef} className={`w-full h-64 rounded-md relative overflow-hidden z-0 ${className}`} />
  );
};

export default MapComponent;