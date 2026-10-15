import {
  MAX_REST_EXTENSION_SECONDS,
  adjustRest,
  setsDoneFor,
} from '@/lib/rest-timer';

describe('adjustRest', () => {
  it('adds and removes 15 seconds, moving the total with it', () => {
    expect(adjustRest({ secondsLeft: 40, total: 90, plannedSeconds: 90, delta: 15 })).toEqual({ secondsLeft: 55, total: 105 });
    expect(adjustRest({ secondsLeft: 40, total: 90, plannedSeconds: 90, delta: -15 })).toEqual({ secondsLeft: 25, total: 75 });
  });

  it('never shortens a rest below 5 seconds left', () => {
    expect(adjustRest({ secondsLeft: 12, total: 60, plannedSeconds: 60, delta: -15 })).toEqual({ secondsLeft: 5, total: 53 });
    expect(adjustRest({ secondsLeft: 4, total: 60, plannedSeconds: 60, delta: -15 })).toEqual({ secondsLeft: 4, total: 60 });
  });

  it('stops lengthening five minutes past the planned rest', () => {
    const cap = 60 + MAX_REST_EXTENSION_SECONDS;
    expect(adjustRest({ secondsLeft: 300, total: cap - 5, plannedSeconds: 60, delta: 15 })).toEqual({ secondsLeft: 305, total: cap });
    expect(adjustRest({ secondsLeft: 300, total: cap, plannedSeconds: 60, delta: 15 })).toEqual({ secondsLeft: 300, total: cap });
  });
});

describe('setsDoneFor', () => {
  it('counts the set a rest follows as done', () => {
    expect(setsDoneFor({ kind: 'rest', setNumber: 2 }, 30)).toBe(2);
  });

  it('counts a work set once its countdown reaches 0', () => {
    expect(setsDoneFor({ kind: 'work', setNumber: 3 }, 12)).toBe(2);
    expect(setsDoneFor({ kind: 'work', setNumber: 3 }, 0)).toBe(3);
  });
});
