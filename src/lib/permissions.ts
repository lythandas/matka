// src/lib/permissions.ts

export const PERMISSION_MAP: { [key: string]: string } = {
  'create_post': 'Create Posts',
  'delete_post': 'Delete Own Posts',
  'create_journey': 'Create Journeys',
  'delete_journey': 'Delete Own Journeys',
  'manage_users': 'Manage Users (Admin Only)',
  'edit_any_journey': 'Edit Any Journey',
  'delete_any_journey': 'Delete Any Journey',
  'delete_any_post': 'Delete Any Post',
  'edit_any_post': 'Edit Any Post',
  'manage_roles': 'Manage Roles (Admin Only)', // New permission
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_MAP);

export const getPermissionDisplayName = (permissionKey: string): string => {
  return PERMISSION_MAP[permissionKey] || permissionKey.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};