import type { TodayVersionCount } from '../types';
import { versionChips } from '../utils/todayVersionChips';

interface TodayVersionChipsProps {
  /** One of the API's today-by-version lists; nothing shows when it is missing or empty. */
  counts: readonly TodayVersionCount[] | null | undefined;
  /** Read by screen readers, e.g. "In progress today by app version". */
  label: string;
}

const PLATFORM_CLASSES: Record<'iOS' | 'Android', string> = {
  iOS: 'font-semibold text-blue-700 dark:text-blue-300',
  Android: 'font-semibold text-green-700 dark:text-green-300',
};

/** The chips under a "today" count on the Rounds page: one per platform and app version, in the API's order. */
export function TodayVersionChips({ counts, label }: TodayVersionChipsProps) {
  const chips = versionChips(counts);
  if (chips.length === 0) return null;

  // role="list": Tailwind's reset removes list styling, and Safari's VoiceOver then stops announcing it as a list.
  // Each chip reads as one sentence ("iOS 3.8.0 (37): 107 rounds"); the visible pieces are hidden from screen readers.
  return (
    <ul role="list" aria-label={label} className="mt-1 mb-1.5 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li
          key={chip.key}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-0.5 text-[13px] dark:border-gray-700 dark:bg-gray-800"
        >
          <span className="sr-only">
            {`${chip.platformLabel} ${chip.version}: ${chip.count} ${chip.count === 1 ? 'round' : 'rounds'}`}
          </span>
          <span aria-hidden="true" className={PLATFORM_CLASSES[chip.platformLabel]}>
            {chip.platformLabel}
          </span>
          <span aria-hidden="true" className="text-gray-700 dark:text-gray-200">
            {chip.version}
          </span>
          <span aria-hidden="true" className="font-bold tabular-nums text-gray-900 dark:text-white">
            {chip.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
