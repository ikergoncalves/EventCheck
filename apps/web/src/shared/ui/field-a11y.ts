/**
 * Kept out of `form.tsx` so that file exports components and nothing else,
 * which is what React Fast Refresh needs to stay reliable.
 */

/**
 * The `aria-describedby` value matching what `Field` actually rendered.
 *
 * `Field` shows the hint only while there is no error, so pointing at both
 * would reference an element that is not in the document half the time.
 */
export function describedBy(
  id: string,
  { error, hint }: { error?: string; hint?: string },
): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}
