"use client";

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl'; // Changed from maplibregl
import { showError } from '@/utils/toast';

interface MapComponentProps {
  coordinates: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

// IMPORTANT: You need to set your Mapbox Access Token in your .env file
// Example: VITE_MAPBOX_ACCESS_TOKEN=YOUR_MAPBOX_ACCESS_TOKEN
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const MapComponent: React.FC<MapComponentProps> = ({ coordinates, zoom = 10, className }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null); // Changed from maplibregl.Map
  const [mapId] = useState(() => `map-${Math.random().toString(36).substring(2, 9)}`); // Unique ID for each map instance

  useEffect(() => {
    if (mapRef.current) return; // Initialize map only once

    if (!mapContainerRef.current) {
      showError("Map container not found.");
      return;
    }

    if (!mapboxgl.accessToken) {
      showError("Mapbox Access Token is not set. Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file.");
      return;
    }

    mapRef.current = new mapboxgl.Map({
      container: mapId,
      style: 'mapbox://styles/mapbox/streets-v11', // Using a detailed Mapbox Streets style
      center: [coordinates.lng, coordinates.lat],
      zoom: zoom,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right'); // Changed from maplibregl.NavigationControl

    new mapboxgl.Marker() // Changed from maplibregl.Marker
      .setLngLat([coordinates.lng, coordinates.lat])
      .addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coordinates, zoom, mapId]);

  return (
    <div ref={mapContainerRef} id={mapId} className={`w-full h-64 rounded-md ${className}`} />
  );
};

export default MapComponent;