"use client";

import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { showError } from '@/utils/toast';

interface MapComponentProps {
  coordinates: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

const MapComponent: React.FC<MapComponentProps> = ({ coordinates, zoom = 14, className }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const cleanupMap = () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };

    // Initialize map only if container is available and map is not already initialized
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current, // Pass the DOM element directly
        style: 'https://demotiles.maplibre.org/style.json', // Changed to a non-Stadia style
        center: [coordinates.lng, coordinates.lat],
        zoom: zoom,
      });

      mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      mapRef.current.on('load', () => {
        if (mapRef.current) {
          new maplibregl.Marker()
            .setLngLat([coordinates.lng, coordinates.lat])
            .addTo(mapRef.current);
        }
      });
    } else if (mapRef.current) {
      // If map exists, update center and marker if coordinates change
      mapRef.current.setCenter([coordinates.lng, coordinates.lat]);
      mapRef.current.setZoom(zoom);
      // Remove existing markers
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof maplibregl.Marker) {
          layer.remove();
        }
      });
      // Add new marker
      new maplibregl.Marker()
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(mapRef.current);
    }

    return cleanupMap;
  }, [coordinates, zoom, mapContainerRef.current]);

  return (
    <div ref={mapContainerRef} className={`w-full h-64 rounded-md relative overflow-hidden ${className}`} />
  );
};

export default MapComponent;