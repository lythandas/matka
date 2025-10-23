// src/types/index.ts

export interface User {
  id: string;
  username: string;
  isAdmin: boolean; // Replaced role and permissions with a simple isAdmin flag
  name?: string;
  surname?: string;
  profile_image_url?: string;
  created_at?: string;
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
  media_items?: MediaInfo[]; // Changed to an array of MediaInfo
  coordinates?: { lat: number; lng: number };
  created_at: string;
  user_id: string;
  author_username: string;
  author_name?: string;
  author_surname?: string;
  author_profile_image_url?: string;
  journey_id: string; // Added journey_id to Post interface
}

// New: Interface for a user's permissions within a specific journey
export interface JourneyCollaborator {
  id: string; // ID of the journey_user_permissions entry
  user_id: string;
  username: string;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  can_publish_posts: boolean; // Simplified to a single boolean permission for collaborators
}