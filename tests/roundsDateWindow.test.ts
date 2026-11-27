import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUND_DATE_WINDOW_DAYS,
  getApiErrorMessage,
  getApiErrorStatus,
  hasPartialRoundDate,
  isFullGolflinkNo,
  isPlausibleDateValue,
  needsRoundDateWindow,
  shiftDateValue,
  withRoundDateWindow,
  type RoundDateWindowFilters,
} from '../src/utils/roundsDateWindow.ts';

const EMPTY: RoundDateWindowFilters = {
  roundDateFrom: '',
  roundDateTo: '',
  startTimeFrom: '',
  startTimeTo: '',
  holeRange: '',
  golflinkNo: '',
};

const TODAY = '2026-11-27';
const COMPUTED_SORT_IDS = [
  'golferName',
  'golflinkNo',
  'clubName',
  'state',
  'compType',
  'operatingSystem',
  'dailyHandicap',
  'holeCount',
  'isSubmitted',
];

describe('needsRoundDateWindow', () => {
  it('is false for the default view (Start Time sort, no filters)', () => {
    assert.equal(needsRoundDateWindow(EMPTY, 'startTime'), false);
  });

  it('is false for a Date sort or no sort with no filters', () => {
    assert.equal(needsRoundDateWindow(EMPTY, 'roundDate'), false);
    assert.equal(needsRoundDateWindow(EMPTY, undefined), false);
  });

  it('is true for each of the nine computed-column sorts with no dates', () => {
    for (const sortId of COMPUTED_SORT_IDS) {
      assert.equal(needsRoundDateWindow(EMPTY, sortId), true, sortId);
    }
  });

  it('is true for a Holes, Start-time or To-only filter with the default sort', () => {
    assert.equal(needsRoundDateWindow({ ...EMPTY, holeRange: '18' }, 'startTime'), true);
    assert.equal(needsRoundDateWindow({ ...EMPTY, startTimeFrom: '07:00' }, 'startTime'), true);
    assert.equal(needsRoundDateWindow({ ...EMPTY, startTimeTo: '09:00' }, 'startTime'), true);
    assert.equal(needsRoundDateWindow({ ...EMPTY, roundDateTo: '2026-11-20' }, 'startTime'), true);
  });

  it('is false once a From date is set', () => {
    assert.equal(needsRoundDateWindow({ ...EMPTY, roundDateFrom: '2026-11-01' }, 'clubName'), false);
    assert.equal(
      needsRoundDateWindow({ ...EMPTY, roundDateFrom: '2026-11-01', holeRange: '1-9' }, 'startTime'),
      false
    );
  });

  it('is false for a full GA number, which the API finds by index', () => {
    assert.equal(needsRoundDateWindow({ ...EMPTY, golflinkNo: '1234567890' }, 'clubName'), false);
    assert.equal(needsRoundDateWindow({ ...EMPTY, golflinkNo: ' 1234567890 ' }, 'holeCount'), false);
  });

  it('is true for a partial GA number', () => {
    assert.equal(needsRoundDateWindow({ ...EMPTY, golflinkNo: '12345' }, 'clubName'), true);
  });
});

describe('isFullGolflinkNo', () => {
  it('needs at least ten digits and nothing else', () => {
    assert.equal(isFullGolflinkNo('1234567890'), true);
    assert.equal(isFullGolflinkNo('12345678901'), true);
    assert.equal(isFullGolflinkNo('123456789'), false);
    assert.equal(isFullGolflinkNo('123456789X'), false);
    assert.equal(isFullGolflinkNo(''), false);
    assert.equal(isFullGolflinkNo('   '), false);
  });
});

describe('shiftDateValue', () => {
  it('shifts across month and year ends', () => {
    assert.equal(shiftDateValue('2026-11-27', -29), '2026-10-29');
    assert.equal(shiftDateValue('2026-03-01', -1), '2026-02-28');
    assert.equal(shiftDateValue('2028-03-01', -1), '2028-02-29');
    assert.equal(shiftDateValue('2026-12-31', 1), '2027-01-01');
    assert.equal(shiftDateValue('2026-11-27', 0), '2026-11-27');
  });

  it('keeps whole days across a daylight-saving change', () => {
    // Sydney clocks go forward on 2026-10-04.
    assert.equal(shiftDateValue('2026-10-10', -10), '2026-09-30');
  });

  it('keeps years below 100 and pads them to four digits', () => {
    // new Date(2, ...) would give 1902.
    assert.equal(shiftDateValue('0002-11-20', 0), '0002-11-20');
    assert.equal(shiftDateValue('0020-11-20', -1), '0020-11-19');
    assert.equal(shiftDateValue('0202-11-20', 0), '0202-11-20');
  });

  it("returns '' for a value it can't read", () => {
    assert.equal(shiftDateValue('', -1), '');
    assert.equal(shiftDateValue('27/11/2026', -1), '');
    assert.equal(shiftDateValue('2026-11-27T00:00', -1), '');
  });
});

describe('withRoundDateWindow', () => {
  it('fills in the last 30 days ending today for a Club sort with no dates', () => {
    const result = withRoundDateWindow(EMPTY, 'clubName', TODAY);
    assert.deepEqual(result, { ...EMPTY, roundDateFrom: '2026-10-29', roundDateTo: TODAY });
    assert.equal(ROUND_DATE_WINDOW_DAYS, 30);
  });

  it('ends the window on the To date when only a To date is set', () => {
    const result = withRoundDateWindow({ ...EMPTY, roundDateTo: '2026-11-20' }, 'startTime', TODAY);
    assert.equal(result.roundDateFrom, '2026-10-22');
    assert.equal(result.roundDateTo, '2026-11-20');
  });

  it('waits while the To year is still being typed, and never rewrites it', () => {
    // Chrome emits 0002-11-20, 0020-11-20, 0202-11-20, then 2026-11-20 as the year is typed.
    for (const partial of ['0002-11-20', '0020-11-20', '0202-11-20', 'garbage']) {
      const filters = { ...EMPTY, roundDateTo: partial };
      assert.equal(withRoundDateWindow(filters, 'startTime', TODAY), filters, partial);
      assert.equal(withRoundDateWindow(filters, 'clubName', TODAY), filters, partial);
    }

    const typed = withRoundDateWindow({ ...EMPTY, roundDateTo: '2026-11-20' }, 'clubName', TODAY);
    assert.equal(typed.roundDateFrom, '2026-10-22');
    assert.equal(typed.roundDateTo, '2026-11-20');
  });

  it('returns the same object when nothing needs to change', () => {
    const dated = { ...EMPTY, roundDateFrom: '2026-11-01' };
    assert.equal(withRoundDateWindow(EMPTY, 'startTime', TODAY), EMPTY);
    assert.equal(withRoundDateWindow(dated, 'clubName', TODAY), dated);
  });

  it('keeps the other filters and extra fields', () => {
    const filters = { ...EMPTY, holeRange: '18', golferLastName: 'Smith' };
    const result = withRoundDateWindow(filters, 'startTime', TODAY);
    assert.equal(result.holeRange, '18');
    assert.equal(result.golferLastName, 'Smith');
    assert.equal(result.roundDateFrom, '2026-10-29');
  });

  it('leaves a full GA number search undated', () => {
    const filters = { ...EMPTY, golflinkNo: '1234567890' };
    assert.equal(withRoundDateWindow(filters, 'clubName', TODAY), filters);
  });
});

describe('getApiErrorMessage', () => {
  it("prefers the API's ProblemDetails detail", () => {
    const error = Object.assign(new Error('Request failed with status code 400'), {
      response: { status: 400, data: { detail: 'Choose a round date range.' } },
    });
    assert.equal(getApiErrorMessage(error), 'Choose a round date range.');
  });

  it("falls back to the error's message", () => {
    assert.equal(getApiErrorMessage(new Error('Network Error')), 'Network Error');
    const blankDetail = Object.assign(new Error('Request failed'), { response: { data: { detail: '  ' } } });
    assert.equal(getApiErrorMessage(blankDetail), 'Request failed');
    const nullData = Object.assign(new Error('Request failed'), { response: { data: null } });
    assert.equal(getApiErrorMessage(nullData), 'Request failed');
  });

  it("says 'Unknown error' for anything else", () => {
    assert.equal(getApiErrorMessage(null), 'Unknown error');
    assert.equal(getApiErrorMessage('oops'), 'Unknown error');
  });
});

describe('getApiErrorStatus', () => {
  it('reads the HTTP status when there is one', () => {
    assert.equal(getApiErrorStatus({ response: { status: 400 } }), 400);
    assert.equal(getApiErrorStatus({ response: { status: '400' } }), undefined);
    assert.equal(getApiErrorStatus(new Error('Network Error')), undefined);
    assert.equal(getApiErrorStatus(null), undefined);
  });
});

describe('isPlausibleDateValue', () => {
  it('accepts real dates from 2000 to 2100', () => {
    assert.equal(isPlausibleDateValue('2026-11-27'), true);
    assert.equal(isPlausibleDateValue('2000-01-01'), true);
    assert.equal(isPlausibleDateValue('2100-12-31'), true);
  });

  it('rejects years still being typed, out-of-range years and malformed values', () => {
    assert.equal(isPlausibleDateValue('0002-11-20'), false);
    assert.equal(isPlausibleDateValue('0202-11-20'), false);
    assert.equal(isPlausibleDateValue('1999-12-31'), false);
    assert.equal(isPlausibleDateValue('2101-01-01'), false);
    assert.equal(isPlausibleDateValue('2026-02-30'), false);
    assert.equal(isPlausibleDateValue(''), false);
    assert.equal(isPlausibleDateValue('27/11/2026'), false);
  });
});

describe('hasPartialRoundDate', () => {
  it('is false when both dates are empty or real', () => {
    assert.equal(hasPartialRoundDate({ roundDateFrom: '', roundDateTo: '' }), false);
    assert.equal(hasPartialRoundDate({ roundDateFrom: '2026-10-29', roundDateTo: '2026-11-27' }), false);
    assert.equal(hasPartialRoundDate({ roundDateFrom: '2026-10-29', roundDateTo: '' }), false);
  });

  it('is true while either date holds a year still being typed', () => {
    assert.equal(hasPartialRoundDate({ roundDateFrom: '0202-10-29', roundDateTo: '2026-11-27' }), true);
    assert.equal(hasPartialRoundDate({ roundDateFrom: '', roundDateTo: '0002-11-20' }), true);
  });
});
