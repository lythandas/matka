"use client";

// PostCalendarPanel — fixed one-month calendar glued to the left edge of the
// wall column (desktop only), letting the user jump to a day's posts.
//
// Reference render: docs/mockups/calendar-post-navigation.html (v4).
// Spec: docs/superpowers/specs/2026-11-27-calendar-post-navigation-design.md
//
// - Placement: `left: max(1.5rem, calc(50% - 650px))` — the wall column is a
//   centered max-w-3xl (768px, so its left edge sits at 50% - 384px); the panel
//   is 242px wide (7 × 32px day cells + 16px padding + 2px border) + 24px gap
//   → 50% - 650px. It follows the column on resize and falls back to the
//   window edge when there is no room. The wall is NOT shifted.
// - Hidden below the xl breakpoint (1280px): at 1280px the panel's right edge
//   (1.5rem + 242px = 288px) exactly touches the cards' left edge
//   (50% - 384px + 2rem padding = 288px), so it never overlaps the cards above
//   xl — mobile is explicitly out of scope (spec, Non-goals).
// - Markers: days with posts = discreet primary dot; current day (topmost
//   visible post, tracked by Index) = theme-color ring + accent background.
// - Displayed-month auto-switch: only on a genuine month change of the current
//   day (effect keyed on the current day's month, not on the displayed month),
//   so manual chevron browsing is never parasited — no grace timer.
//
// This is a wrapper: src/components/ui/calendar.tsx is never edited; all
// styling goes through props (classNames / modifiersClassNames / components).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { buttonVariants } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameMonth, parseISO, startOfMonth } from 'date-fns';
import type { Locale } from 'date-fns/locale';
import { useDayRender, type DayProps } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getDateFnsLocale } from '@/utils/date-locales';
import { Post } from '@/types';
import { dateKey, firstPostIdForDate, groupPostsByDate, journeyMonthRange } from '@/utils/postDates';

interface PostCalendarPanelProps {
  posts: Post[]; // published posts, in the displayed (sorted) order
  currentDateKey: string | null; // day of the topmost visible post
  onDateSelect: (dateKey: string, firstPostId: string) => void;
}

/** Day cell with per-day tooltip/aria-label (« {date} — {n} posts »). */
interface CalendarDayDeps {
  group: Map<string, string[]>;
  locale: Locale;
  dayLabel: (date: string, count: number) => string;
}

function makeCalendarDay({ group, locale, dayLabel }: CalendarDayDeps) {
  const CalendarDay = (props: DayProps) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dayRender = useDayRender(props.date, props.displayMonth, buttonRef);
    if (dayRender.isHidden) {
      return <div role="gridcell" />;
    }
    if (!dayRender.isButton) {
      return <div {...dayRender.divProps} />;
    }
    const buttonProps =
      dayRender.buttonProps as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>;
    const ids = group.get(format(props.date, 'yyyy-MM-dd'));
    if (!ids) {
      return <button ref={buttonRef} name="day" {...buttonProps} />;
    }
    const label = dayLabel(format(props.date, 'PPP', { locale }), ids.length);
    return (
      <button ref={buttonRef} name="day" {...buttonProps} title={label} aria-label={label} />
    );
  };
  return CalendarDay;
}

const PostCalendarPanel: React.FC<PostCalendarPanelProps> = ({
  posts,
  currentDateKey,
  onDateSelect,
}) => {
  const { t } = useTranslation();
  const currentLocale = getDateFnsLocale();

  const group = useMemo(() => groupPostsByDate(posts), [posts]);
  const range = useMemo(() => journeyMonthRange(posts), [posts]);
  // Journey extent (first post day → last post day): days outside are
  // attenuated and not clickable; days inside without a post stay inert.
  const extent = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const post of posts) {
      const date = new Date(post.created_at);
      if (Number.isNaN(date.getTime())) continue;
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    }
    return { min, max };
  }, [posts]);

  // Displayed month, controlled: default = month of the first post in the
  // displayed order (topmost post of the wall with the default sort).
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(posts.length > 0 ? new Date(posts[0].created_at) : new Date()),
  );
  const handleMonthChange = (next: Date) => setMonth(next);

  // Auto-switch: when the current day genuinely changes month, follow it so
  // the ring is always visible. Keyed on the current day's month only — a
  // scroll that does not change that month never touches the displayed month.
  const currentMonthKey = currentDateKey ? currentDateKey.slice(0, 7) : '';
  useEffect(() => {
    if (!currentMonthKey) return;
    const target = parseISO(`${currentMonthKey}-01`);
    setMonth((prev) => (isSameMonth(prev, target) ? prev : target));
  }, [currentMonthKey]);

  const CalendarDay = useMemo(
    () =>
      makeCalendarDay({
        group,
        locale: currentLocale,
        dayLabel: (date, count) => t('indexPage.dayWithPosts', { date, count }),
      }),
    [group, currentLocale, t],
  );

  if (posts.length === 0 || !range || !extent.min || !extent.max) return null;

  const modifiers = {
    hasPosts: Array.from(group.keys(), (key) => parseISO(key)),
    current: currentDateKey ? [parseISO(currentDateKey)] : [],
  };

  const handleSelect = (day: Date | undefined) => {
    if (!day) return;
    const key = dateKey(day.toISOString());
    const firstPostId = firstPostIdForDate(group, key);
    if (firstPostId) onDateSelect(key, firstPostId); // day without post: ignored
  };

  return (
    <aside
      className="fixed top-24 z-20 hidden xl:block rounded-lg border border-border bg-card text-card-foreground shadow-md"
      style={{ left: 'max(1.5rem, calc(50% - 650px))' }}
      aria-label={t('indexPage.calendarPanel')}
    >
      <Calendar
        mode="single"
        month={month}
        onMonthChange={handleMonthChange}
        onSelect={handleSelect}
        locale={currentLocale}
        fromMonth={range.startMonth}
        toMonth={range.endMonth}
        fixedWeeks
        showOutsideDays={false}
        disabled={{ before: extent.min, after: extent.max }}
        modifiers={modifiers}
        modifiersClassNames={{
          hasPosts:
            'relative font-semibold cursor-pointer after:pointer-events-none after:absolute after:bottom-[3px] after:left-1/2 after:-translate-x-1/2 after:h-[5px] after:w-[5px] after:rounded-full after:bg-primary',
          current: 'rounded-full border-2 border-primary bg-accent font-bold after:hidden',
        }}
        className="p-2"
        classNames={{
          head_cell: 'text-muted-foreground rounded-md w-8 font-normal text-xs',
          row: 'flex w-full mt-1',
          cell: 'h-8 w-8 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
          day: cn(
            buttonVariants({ variant: 'ghost' }),
            'h-8 w-8 p-0 font-normal text-sm rounded-full',
          ),
          // No persistent selection (the panel is permanent, clicks only
          // navigate) and the real "today" is not a marker in this design.
          day_selected: '',
          day_today: '',
        }}
        components={{
          Day: CalendarDay,
          IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
          IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        }}
      />
    </aside>
  );
};

export default PostCalendarPanel;
