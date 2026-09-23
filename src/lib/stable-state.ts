/**
 * A state updater that keeps the current value when `next` has the same
 * content: `setProfile(unlessUnchanged(loadedProfile))`.
 *
 * The tabs reload their data on every focus, and each reload hands React
 * brand-new objects even when nothing changed. That re-ran every memo keyed
 * on them (Home's and Train's plan-engine runs included) and re-rendered the
 * whole screen on a plain tab switch. Keeping the old reference lets React
 * skip the update entirely when the reload found nothing new.
 *
 * Content is compared as JSON, which fits what these screens hold: plain
 * data read back from AsyncStorage or derived from it. Not for Maps, Sets or
 * class instances, whose contents JSON can't see. Two equal objects that
 * list their keys in a different order compare as changed, which only costs
 * the re-render this exists to skip.
 */
export function unlessUnchanged<T>(next: T): <S>(prev: S) => S | T {
  return (prev) => (Object.is(prev, next) || JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
}
