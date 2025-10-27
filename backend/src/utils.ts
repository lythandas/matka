// backend/src/utils.ts
import { User, ApiUser } from './types';

export const mapDbUserToApiUser = (dbUser: User): ApiUser => ({
  id: dbUser.id,
  username: dbUser.username,
  isAdmin: dbUser.is_admin,
  name: dbUser.name,
  surname: dbUser.surname,
  profile_image_url: dbUser.profile_image_url,
  language: dbUser.language,
  created_at: dbUser.created_at,
});