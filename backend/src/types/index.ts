// backend/src/types/index.ts

export interface User {
  id: string;
  username: string;
  password_hash: string;
  is_admin: boolean;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  language?: string;
  created_at: string;
}

export type ApiUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  language?: string;
  created_at: string;
};

export interface Journey {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  owner_username: string;
  owner_name?: string;
  owner_surname?: string;
  owner_profile_image_url?: string;
  is_public: boolean;
}

export interface JourneyCollaborator {
  id: string;
  journey_id: string;
  user_id: string;
  username: string;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  can_read_posts: boolean;
  can_publish_posts: boolean;
  can_modify_post: boolean;
  can_delete_posts: boolean;
}

export type MediaInfo =
  | { type: 'image'; urls: { small?: string; medium?: string; large?: string; original?: string } }
  | { type: 'video'; url: string };

export interface Post {
  id: string;
  journey_id: string;
  user_id: string;
  author_username: string;
  author_name?: string;
  author_surname?: string;
  author_profile_image_url?: string;
  title?: string;
  message: string;
  media_items?: MediaInfo[];
  coordinates?: { lat: number; lng: number };
  created_at: string;
  is_draft?: boolean; // New field for drafts
}