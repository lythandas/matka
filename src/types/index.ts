// src/types/index.ts

export interface User {
  id: string;
  username: string;
  role: string; // Role name (e.g., 'admin', 'user')
  permissions: string[]; // Permissions derived from the role
  name?: string;
  surname?: string;
  profile_image_url?: string;
  created_at?: string; // Added for AdminPage
}

export interface Journey {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  owner_username: string;
  owner_name?: string;
  owner_surname?: string;
  owner_profile_image_url?: string;
}

// Define the structure for media content
export type MediaInfo = 
  | { type: 'image'; urls: { small?: string; medium?: string; large?: string; original?: string } }
  | { type: 'video'; url: string };

export interface Post {
  id: string;
  title?: string;
  message: string;
  image_urls?: MediaInfo; // Updated to use MediaInfo type
  spotify_embed_url?: string;
  coordinates?: { lat: number; lng: number };
  created_at: string;
  user_id: string;
  author_username: string;
  author_name?: string;
  author_surname?: string;
  author_profile_image_url?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  created_at: string;
}

// New: Interface for a user's permissions within a specific journey
export interface JourneyCollaborator {
  id: string; // ID of the journey_user_permissions entry
  user_id: string;
  username: string;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  permissions: string[]; // Permissions specific to this journey
}