"use client";

import React, { useRef, useEffect } from 'react';
import L from 'leaflet'; // Import Leaflet
import { showError } from '@/utils/toast';

// Fix for default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapComponentProps {
  coordinates: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

const MapComponent: React.FC<MapComponentProps> = ({ coordinates, zoom = 14, className }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

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
        center: [coordinates.lat, coordinates.lng],
        zoom: zoom,
        zoomControl: false, // We'll add it manually
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      // Add zoom control
      L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

      // Add marker directly after map initialization
      markerRef.current = L.marker([coordinates.lat, coordinates.lng]).addTo(mapRef.current);

      mapRef.current.on('error', (e: any) => {
        console.error('Leaflet Map Error:', e.error);
        showError('Failed to load map tiles.');
      });

    } else {
      // If map exists, update center and marker
      mapRef.current.setView([coordinates.lat, coordinates.lng], zoom);

      if (markerRef.current) {
        markerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
      } else {
        markerRef.current = L.marker([coordinates.lat, coordinates.lng]).addTo(mapRef.current);
      }
    }

    return cleanupMap;
  }, [coordinates, zoom]);

  return (
    <div ref={mapContainerRef} className={`w-full h-64 rounded-md relative overflow-hidden ${className}`} />
  );
};

export default MapComponent;