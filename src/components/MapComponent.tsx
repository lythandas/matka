"use client";

import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { showError } from '@/utils/toast';

interface MapComponentProps {
  coordinates: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

const MapComponent: React.FC<MapComponentProps> = ({ coordinates, zoom = 10, className }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapId] = useState(() => `map-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (mapRef.current) return;

    if (!mapContainerRef.current) {
      showError("Map container not found.");
      return;
    }

    mapRef.current = new maplibregl.Map({
      container: mapId,
      style: 'https://tiles.stadiamaps.com/styles/osm_bright.json',
      center: [coordinates.lng, coordinates.lat],
      zoom: zoom,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    new maplibregl.Marker()
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
    <div ref={mapContainerRef} id={mapId} className={`w-full h-64 rounded-md relative overflow-hidden ${className}`} />
  );
};

export default MapComponent;