import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAvatarInitials(name?: string | null, username?: string | null): string {
  if (name && name.trim().length > 0) {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  }
  if (username && username.trim().length > 0) {
    return username.charAt(0).toUpperCase();
  }
  return '?';
}