// The admin API (GET /rounds/search, RoundsSearchGuard) refuses a search that has to compute its fields for every
// round when there is no From date: a sort on any column except Date or Start Time, or a Holes, Start-time or
// To-date-only filter. Without dates that reads all 1.16M rounds (105 s on prod). The Rounds page fills in the last
// 30 days instead, in the date inputs, so the golfer can see and change it. 30 days is about 27k rounds, about 1 s.

export const ROUND_DATE_WINDOW_DAYS = 30;

const FULL_GOLFLINK_LENGTH = 10;
const INDEXED_SORT_IDS = new Set(['startTime', 'roundDate']);

export type RoundDateWindowFilters = {
  roundDateFrom: string;
  roundDateTo: string;
  startTimeFrom: string;
  startTimeTo: string;
  holeRange: string;
  golflinkNo: string;
};

// A full GA number is an exact index match in the API, so it is fast without dates.
export function isFullGolflinkNo(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= FULL_GOLFLINK_LENGTH && /^\d+$/.test(normalized);
}

// True when the API would refuse this search for want of a From date.
export function needsRoundDateWindow(filters: RoundDateWindowFilters, sortId: string | undefined): boolean {
  if (filters.roundDateFrom) return false;
  if (isFullGolflinkNo(filters.golflinkNo)) return false;

  const sortsByComputedColumn = Boolean(sortId) && !INDEXED_SORT_IDS.has(sortId as string);
  const hasComputedFilter =
    Boolean(filters.holeRange) ||
    Boolean(filters.startTimeFrom) ||
    Boolean(filters.startTimeTo) ||
    Boolean(filters.roundDateTo);

  return sortsByComputedColumn || hasComputedFilter;
}

const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_PLAUSIBLE_YEAR = 2000;
const MAX_PLAUSIBLE_YEAR = 2100;

// 'YYYY-MM-DD' shifted by whole days, in local time like the date inputs. Returns '' for a value it can't read.
export function shiftDateValue(value: string, days: number): string {
  const match = DATE_VALUE.exec(value);
  if (!match) return '';

  // setFullYear, because new Date(2, ...) would mean 1902.
  const date = new Date(2000, 0, 1);
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + days);

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Chrome gives a date box a value at every keystroke in its year (0002, 0020, 0202, then 2026). A year outside
// 2000 to 2100 is one still being typed, or a typo, never a real round date.
export function isPlausibleDateValue(value: string): boolean {
  const match = DATE_VALUE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  return year >= MIN_PLAUSIBLE_YEAR && year <= MAX_PLAUSIBLE_YEAR && shiftDateValue(value, 0) === value;
}

// True while a date box holds a year still being typed. The page waits instead of searching from year 2 or 202,
// which reads every round.
export function hasPartialRoundDate(filters: Pick<RoundDateWindowFilters, 'roundDateFrom' | 'roundDateTo'>): boolean {
  return [filters.roundDateFrom, filters.roundDateTo].some((value) => value !== '' && !isPlausibleDateValue(value));
}

// Fills in the 30 days that end on the To date (or today) when the API would otherwise refuse the search.
// Returns the same object when nothing needs to change, or while the To date is still being typed.
// The To date is never rewritten.
export function withRoundDateWindow<T extends RoundDateWindowFilters>(
  filters: T,
  sortId: string | undefined,
  todayDateValue: string
): T {
  if (!needsRoundDateWindow(filters, sortId)) return filters;
  if (filters.roundDateTo && !isPlausibleDateValue(filters.roundDateTo)) return filters;

  const roundDateTo = filters.roundDateTo || todayDateValue;
  return {
    ...filters,
    roundDateFrom: shiftDateValue(roundDateTo, -(ROUND_DATE_WINDOW_DAYS - 1)),
    roundDateTo,
  };
}

type ApiErrorShape = {
  message?: unknown;
  response?: { status?: unknown; data?: { detail?: unknown } | null };
};

export function getApiErrorStatus(error: unknown): number | undefined {
  const status = (error as ApiErrorShape | null)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

// The API's own message (ProblemDetails.detail) when it sent one, else the error's message.
export function getApiErrorMessage(error: unknown): string {
  const detail = (error as ApiErrorShape | null)?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;

  if (error instanceof Error && error.message) return error.message;
  return 'Unknown error';
}
