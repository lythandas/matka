// Pure post→date grouping for the calendar navigation (spec:
// docs/superpowers/specs/2026-11-27-calendar-post-navigation-design.md).
// No React, no DOM — proven headless by `npm run check:dates`.
//
// `created_at` is chosen by the author at post creation (PostDatePicker), so
// it is de facto the journey-day date. Grouping uses the LOCAL date, matching
// what ListPostCard displays (format(new Date(created_at), 'PPP p')).

import { format, startOfMonth, endOfMonth } from 'date-fns';

/** 'yyyy-MM-dd' in local time — consistent with what ListPostCard displays. */
export function dateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

/** dateKey → post ids, in the order of the received array (the displayed order). */
export function groupPostsByDate(posts: { id: string; created_at: string }[]): Map<string, string[]> {
  const group = new Map<string, string[]>();
  for (const post of posts) {
    const key = dateKey(post.created_at);
    if (!key) continue;
    const ids = group.get(key);
    if (ids) ids.push(post.id);
    else group.set(key, [post.id]);
  }
  return group;
}

/** Month containing the oldest post → month containing the newest; null when empty. */
export function journeyMonthRange(posts: { created_at: string }[]): { startMonth: Date; endMonth: Date } | null {
  let min: Date | null = null;
  let max: Date | null = null;
  for (const post of posts) {
    const date = new Date(post.created_at);
    if (Number.isNaN(date.getTime())) continue;
    if (!min || date < min) min = date;
    if (!max || date > max) max = date;
  }
  if (!min || !max) return null;
  return { startMonth: startOfMonth(min), endMonth: startOfMonth(endOfMonth(max)) };
}

/** First post id of the day in the group's order; null when the day has no post. */
export function firstPostIdForDate(group: Map<string, string[]>, dateKey: string): string | null {
  return group.get(dateKey)?.[0] ?? null;
}
