// src/lib/permissions.ts

import { User, JourneyCollaborator } from '@/types';

export const PERMISSION_MAP: { [key: string]: string } = {
  'create_post': 'Create Posts',
  'delete_post': 'Delete Own Posts', // Refers to own posts
  'edit_post': 'Edit Own Posts', // Refers to own posts
  'create_journey': 'Create Journeys',
  'delete_journey': 'Delete Own Journeys', // Refers to own journeys
  'edit_journey': 'Edit Own Journeys', // Refers to own journeys
  'manage_users': 'Manage Users (Admin Only)',
  'edit_any_journey': 'Edit Any Journey (Admin Only)',
  'delete_any_journey': 'Delete Any Journey (Admin Only)',
  'delete_any_post': 'Delete Any Post (Admin Only)',
  'edit_any_post': 'Edit Any Post (Admin Only)',
  'manage_roles': 'Manage Roles (Admin Only)',
  'manage_journey_access': 'Manage Journey Collaborators', // New permission
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

  // 1. Global Admin Override
  if (currentUser.role === 'admin' && currentUser.permissions.includes('manage_roles')) {
    // Admins with 'manage_roles' implicitly have all permissions
    return true;
  }

  // 2. Global 'any' permissions (e.g., edit_any_post, delete_any_journey)
  if (currentUser.permissions.includes(`edit_any_${requiredPermission.split('_')[1]}`) && requiredPermission.startsWith('edit_')) {
    return true;
  }
  if (currentUser.permissions.includes(`delete_any_${requiredPermission.split('_')[1]}`) && requiredPermission.startsWith('delete_')) {
    return true;
  }
  if (currentUser.permissions.includes(requiredPermission) && requiredPermission.includes('any')) {
    return true;
  }

  // 3. Journey Owner Override
  if (journeyOwnerId && currentUser.id === journeyOwnerId) {
    // Journey owner has all permissions for their own journey
    return true;
  }

  // 4. Journey-specific permissions
  const userJourneyPerms = journeyCollaborators.find(collab => collab.user_id === currentUser.id)?.permissions || [];
  if (userJourneyPerms.includes(requiredPermission)) {
    return true;
  }

  // 5. Global role permissions (excluding 'any' permissions already checked)
  if (currentUser.permissions.includes(requiredPermission)) {
    // Special handling for 'own' permissions if a post is involved
    if ((requiredPermission === 'delete_post' || requiredPermission === 'edit_post') && postId && postAuthorId) {
      return currentUser.id === postAuthorId;
    }
    return true;
  }

  // If it's an 'own' permission and no post context, or not the owner, it's false
  if ((requiredPermission === 'delete_post' || requiredPermission === 'edit_post') && (!postId || !postAuthorId || currentUser.id !== postAuthorId)) {
    return false;
  }
  if ((requiredPermission === 'delete_journey' || requiredPermission === 'edit_journey') && journeyOwnerId && currentUser.id !== journeyOwnerId) {
    return false;
  }

  return false;
};