import { localDateStr } from '@/lib/local-date';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The last `count` local days, today first, as YYYY-MM-DD. */
export function recentDays(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    return localDateStr(day);
  });
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseLocal(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Today", "Yesterday", "Mon 12" — and the spoken "Monday, Oct 12". */
export function dayPillLabel(date: string, today: string = localDateStr()): { text: string; spoken: string } {
  const day = parseLocal(date);
  const todayDate = parseLocal(today);
  const yesterday = localDateStr(new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1));
  const spoken = `${WEEKDAY_LONG[day.getDay()]}, ${MONTH[day.getMonth()]} ${day.getDate()}`;
  if (date === today) return { text: 'Today', spoken: `Today, ${spoken}` };
  if (date === yesterday) return { text: 'Yesterday', spoken: `Yesterday, ${spoken}` };
  return { text: `${WEEKDAY[day.getDay()]} ${day.getDate()}`, spoken };
}
