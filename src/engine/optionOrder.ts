import type { EnglishItem, Item, PetItem } from '../content/schema';

/**
 * Randomises which position the correct answer occupies.
 *
 * Items are authored with the correct answer written first — that is the only sane way
 * to write a question, because the distractors are designed *against* the answer and
 * the trap explanations are keyed to them. Serving them in that order makes the whole
 * app worthless: you can score 100% by always tapping option א without reading, and
 * every downstream number (ability rating, mastery, score projection, error taxonomy)
 * becomes noise.
 *
 * So the shuffle happens once, at the content-loading boundary in `src/content/index.ts`,
 * and nothing downstream ever sees the authored order. Doing it there rather than at
 * each of the eight call sites that compare against `correctIndex` means a new screen
 * cannot forget to do it, and means authoring bias can never leak into the app again
 * however the bank grows.
 *
 * The permutation is derived from the item id, not from a random seed, so it is stable:
 * the same question shows the same option order in a drill today, in the review queue
 * next week, and after a page reload. An unstable order would make the review of a
 * missed item show a different arrangement than the one that produced the mistake.
 */

/** Every arrangement of four options, in a fixed order. */
export const PERMUTATIONS: readonly (readonly number[])[] = buildPermutations(4);

function buildPermutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of buildPermutations(n - 1)) {
    for (let i = 0; i <= rest.length; i += 1) {
      out.push([...rest.slice(0, i), n - 1, ...rest.slice(i)]);
    }
  }
  return out.sort((a, b) => a.join('').localeCompare(b.join('')));
}

/**
 * FNV-1a, 32-bit. Chosen over something like a simple char-code sum because ids in this
 * bank differ only in their last two characters (`al-001`, `al-002`, …) and a weak hash
 * would map that near-sequential input onto a near-sequential permutation index.
 */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Final avalanche (murmur3 finaliser) so that low bits, which `% 24` reads, depend on
  // the whole hash rather than mostly on the last character.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * The arrangement this item is served in: `permutationFor(id)[presented] === authored`.
 */
export function permutationFor(id: string): readonly number[] {
  return PERMUTATIONS[hashId(id) % PERMUTATIONS.length];
}

/**
 * Returns the item as it should be shown: options permuted, `correctIndex` remapped to
 * follow the correct option's text, and `trapExplanations` re-keyed so each explanation
 * stays attached to the option it explains.
 */
export function presentItem<T extends Item>(item: T): T {
  const perm = permutationFor(item.id);

  const options = perm.map((source) => item.options[source]);
  const correctIndex = perm.indexOf(item.correctIndex);

  const trapExplanations: Record<string, string> = {};
  perm.forEach((source, presented) => {
    const explanation = item.trapExplanations[String(source)];
    if (explanation !== undefined) trapExplanations[String(presented)] = explanation;
  });

  return { ...item, options, correctIndex, trapExplanations };
}

/** Convenience wrappers that keep the concrete item type through the map. */
export function presentAll<T extends PetItem[] | EnglishItem[]>(items: T): T {
  return (items as Item[]).map(presentItem) as T;
}
