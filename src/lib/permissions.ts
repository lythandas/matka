// src/lib/permissions.ts

import { User, JourneyCollaborator } from '@/types';

export const PERMISSION_MAP: { [key: string]: string } = {
  // Admin-specific global permissions
  'manage_users': 'Manage users',
  'manage_roles': 'Manage roles',
  'edit_any_journey': 'Edit any journey',
  'delete_any_journey': 'Delete any journey',
  'edit_any_post': 'Edit any post',
  'delete_any_post': 'Delete any post',

  // Journey-specific permissions (can be assigned to collaborators)
  'publish_post_on_journey': 'Publish posts on this journey',
  'manage_journey_access': 'Manage journey collaborators', // Also implicitly for owner
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
  // This is a strong override for full control.
  if (currentUser.role === 'admin' && currentUser.permissions.includes('manage_roles')) {
    return true;
  }

  // 2. Explicit Global Permissions (e.g., 'manage_users', 'manage_roles', 'edit_any_journey')
  // These are typically for admin roles and are checked directly from the user's global permissions.
  if (currentUser.permissions.includes(requiredPermission)) {
    return true;
  }

  // 3. Implicit Permissions for Journey Owners
  // Journey owners have full control over their own journeys and posts within them.
  const isJourneyOwner = journeyOwnerId && currentUser.id === journeyOwnerId;
  if (isJourneyOwner) {
    if (['edit_journey', 'delete_journey', 'manage_journey_access', 'create_post', 'edit_post', 'delete_post'].includes(requiredPermission)) {
      return true;
    }
  }

  // 4. Implicit Permissions for Post Authors
  // Post authors can always edit and delete their own posts.
  const isPostAuthor = postId && postAuthorId && currentUser.id === postAuthorId;
  if (isPostAuthor) {
    if (['edit_post', 'delete_post'].includes(requiredPermission)) {
      return true;
    }
  }

  // 5. Journey-specific permissions for collaborators
  // Check if the user is a collaborator on this specific journey and has the required permission.
  const userJourneyPerms = journeyCollaborators.find(collab => collab.user_id === currentUser.id)?.permissions || [];
  if (userJourneyPerms.includes(requiredPermission)) {
    return true;
  }

  // 6. Default/Implicit Permissions for all authenticated users
  // All authenticated users can create their own journeys.
  if (requiredPermission === 'create_journey') {
    return true;
  }

  // If none of the above conditions are met, permission is denied.
  return false;
};