// src/lib/permissions.ts

import { User, JourneyCollaborator } from '@/types';

export const PERMISSION_MAP: { [key: string]: string } = {
  // Implicit permissions (handled by logic, not explicitly assigned to roles/collaborators)
  // 'create_journey': 'Create Journeys', // All authenticated users can create their own journeys
  // 'edit_own_journey': 'Edit Own Journey', // Journey owner can edit their own journey
  // 'delete_own_journey': 'Delete Own Journey', // Journey owner can delete their own journey
  // 'create_post': 'Create Posts', // Post author can create posts in their own journey or if collaborator
  // 'edit_own_post': 'Edit Own Posts', // Post author can edit their own posts
  // 'delete_own_post': 'Delete Own Posts', // Post author can delete their own posts

  // Explicit permissions (assigned to roles or journey collaborators)
  'publish_post_on_journey': 'Publish posts on this journey',
  'manage_users': 'Manage users (admin only)',
  'manage_roles': 'Manage roles (admin only)',
  'edit_any_journey': 'Edit any journey (admin only)',
  'delete_any_journey': 'Delete any journey (admin only)',
  'edit_any_post': 'Edit any post (admin only)',
  'delete_any_post': 'Delete any post (admin only)',
  'manage_journey_access': 'Manage journey collaborators',
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_MAP);

export const getPermissionDisplayName = (permissionKey: string): string => {
  return PERMISSION_MAP[permissionKey] || permissionKey.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Checks if a user has a specific permission, considering global role, journey ownership, and journey-specific permissions.
 * @param currentUser The authenticated user object.
 * @param requiredPermission The permission key to check (e.g., 'create_post').
 * @param journeyOwnerId The ID of the user who owns the current journey (if applicable).
 * @param journeyCollaborators An array of collaborators for the current journey, including their permissions.
 * @param postId (Optional) The ID of the post being checked, for 'own' post permissions.
 * @param postAuthorId (Optional) The ID of the author of the post being checked.
 * @returns True if the user has the permission, false otherwise.
 */
export const userHasPermission = (
  currentUser: User | null,
  requiredPermission: string,
  journeyOwnerId?: string,
  journeyCollaborators: JourneyCollaborator[] = [],
  postId?: string,
  postAuthorId?: string
): boolean => {
  if (!currentUser) return false;

  // 1. Global Admin Override: Admins with 'manage_roles' implicitly have all permissions
  if (currentUser.role === 'admin' && currentUser.permissions.includes('manage_roles')) {
    return true;
  }

  // 2. Global 'any' permissions (e.g., edit_any_post, delete_any_journey)
  if (currentUser.permissions.includes(requiredPermission) && requiredPermission.includes('any')) {
    return true;
  }

  // 3. Journey Owner Override: Owner has full control over their own journey
  if (journeyOwnerId && currentUser.id === journeyOwnerId) {
    // Owner can create/edit/delete their own journey
    if (['create_journey', 'edit_journey', 'delete_journey'].includes(requiredPermission)) return true;
    // Owner can create/edit/delete posts in their own journey
    if (['create_post', 'edit_post', 'delete_post'].includes(requiredPermission)) return true;
    // Owner can manage collaborators for their own journey
    if (requiredPermission === 'manage_journey_access') return true;
  }

  // 4. Journey-specific permissions for collaborators
  const userJourneyPerms = journeyCollaborators.find(collab => collab.user_id === currentUser.id)?.permissions || [];
  if (userJourneyPerms.includes(requiredPermission)) {
    return true;
  }

  // 5. Implicit 'own' permissions for non-owners/non-admins
  // All authenticated users can create their own journeys
  if (requiredPermission === 'create_journey') {
    return true;
  }
  // Users can edit their own posts
  if (requiredPermission === 'edit_post' && postId && postAuthorId && currentUser.id === postAuthorId) {
    return true;
  }
  // Users can delete their own posts
  if (requiredPermission === 'delete_post' && postId && postAuthorId && currentUser.id === postAuthorId) {
    return true;
  }

  // If none of the above, permission is denied
  return false;
};