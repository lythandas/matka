"use client";

import React, { useRef, useEffect } from 'react';
import L from 'leaflet'; // Import Leaflet
import { showError } from '@/utils/toast';
import { Post } from '@/types'; // Import Post type

// Fix for default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapComponentProps {
  posts?: Post[]; // Now accepts an array of posts
  coordinates?: { lat: number; lng: number }; // Keep for single point usage
  zoom?: number;
  className?: string;
  onMarkerClick?: (post: Post, index: number) => void; // Callback for marker clicks
}

const MapComponent: React.FC<MapComponentProps> = ({
  posts,
  coordinates, // Still support single coordinate for other uses
  zoom = 14,
  className,
  onMarkerClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null); // Use LayerGroup for multiple markers

  useEffect(() => {
    const cleanupMap = () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };

    if (!mapContainerRef.current) {
      cleanupMap();
      return;
    }

    if (!mapRef.current) {
      // Initialize map
      mapRef.current = L.map(mapContainerRef.current, {
        center: [0, 0], // Default center, will be adjusted
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
    }

    // Clear existing markers
    if (markersRef.current) {
      markersRef.current.clearLayers();
    } else {
      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const currentMap = mapRef.current;
    const currentMarkersLayer = markersRef.current;

    const latLngs: L.LatLngExpression[] = [];

    // Handle multiple posts
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
    } else if (coordinates) { // Fallback to single coordinate if posts not provided
      const latLng: L.LatLngExpression = [coordinates.lat, coordinates.lng];
      const marker = L.marker(latLng);
      currentMarkersLayer.addLayer(marker);
      currentMap.setView(latLng, zoom);
    }

    // Invalidate size to ensure map renders correctly, especially in dialogs
    // A small delay can help if the container is still animating its size
    setTimeout(() => {
      currentMap.invalidateSize();
    }, 0);


    return cleanupMap;
  }, [posts, coordinates, zoom, onMarkerClick]);

  return (
    <div ref={mapContainerRef} className={`w-full h-64 rounded-md relative overflow-hidden z-0 ${className}`} />
  );
};

export default MapComponent;