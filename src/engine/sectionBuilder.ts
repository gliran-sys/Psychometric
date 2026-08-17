import { PET_ITEMS } from '../content';
import { TOPICS, type Domain } from '../config/blueprint';
import type { Item, PetItem } from '../content/schema';

/**
 * Assembles exam sections that mirror the real topic mix — and, crucially, that do not
 * repeat items you have already seen.
 *
 * A large bank alone does not prevent repeats: drawing at random with no memory will
 * serve the same question again long before the bank is exhausted (the birthday
 * problem). The exclusion set is what actually makes a second mock feel like a
 * different exam.
 */

export function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface BuildSectionOptions {
  /** Item ids to avoid — items already used in this sitting or in recent ones. */
  exclude?: Set<string>;
}

/**
 * Draws one section for a domain, following the blueprint's per-topic quota so a
 * verbal section always contains reading comprehension rather than whatever the
 * shuffle happened to surface.
 *
 * Exclusion is best-effort by design: running out of unseen items must degrade to
 * repeating an old one rather than producing a short section, because a short section
 * would silently corrupt the score it feeds.
 */
export function buildSection(
  domain: Domain,
  questionCount: number,
  options: BuildSectionOptions = {},
): Item[] {
  const exclude = options.exclude ?? new Set<string>();
  const topics = TOPICS[domain];
  const picked: PetItem[] = [];
  const used = new Set<string>();

  const take = (pool: PetItem[], count: number) => {
    for (const item of pool) {
      if (picked.length >= questionCount || count <= 0) break;
      if (used.has(item.id)) continue;
      picked.push(item);
      used.add(item.id);
      count -= 1;
    }
  };

  // Pass 1: fill each topic's quota from items the user has not seen.
  topics.forEach((topic) => {
    const fresh = PET_ITEMS.filter(
      (i) => i.topic === topic.id && !exclude.has(i.id) && !used.has(i.id),
    );
    take(shuffle(fresh), topic.questionsPerSection);
  });

  // Pass 2: a topic may have run dry of unseen items. Top its quota up from seen ones
  // rather than letting the section drift away from the real topic mix.
  topics.forEach((topic) => {
    const have = picked.filter((i) => i.topic === topic.id).length;
    if (have >= topic.questionsPerSection) return;
    const seen = PET_ITEMS.filter((i) => i.topic === topic.id && !used.has(i.id));
    take(shuffle(seen), topic.questionsPerSection - have);
  });

  // Pass 3: the blueprint quotas may sum to less than the section length; fill the
  // remainder from anywhere in the domain, unseen first.
  if (picked.length < questionCount) {
    const inDomain = (i: PetItem) => topics.some((t) => t.id === i.topic);
    const rest = PET_ITEMS.filter((i) => inDomain(i) && !used.has(i.id));
    const [fresh, seen] = [
      rest.filter((i) => !exclude.has(i.id)),
      rest.filter((i) => exclude.has(i.id)),
    ];
    take(shuffle(fresh), questionCount - picked.length);
    take(shuffle(seen), questionCount - picked.length);
  }

  return picked.slice(0, questionCount);
}

/**
 * How many distinct items a full sitting of these sections consumes — used to warn
 * when the bank is too thin to support another non-repeating mock.
 */
export function sectionCapacity(domain: Domain): number {
  const topics = TOPICS[domain];
  return PET_ITEMS.filter((i) => topics.some((t) => t.id === i.topic)).length;
}
