import { describe, expect, it } from 'vitest';
import { buildSection, sectionCapacity, shuffle } from './sectionBuilder';
import { SCORED_SECTIONS, TOPICS, type Domain } from '../config/blueprint';
import { PET_ITEMS } from '../content';

const DOMAINS: Domain[] = ['verbal', 'quant'];

function sizeOf(domain: Domain): number {
  return SCORED_SECTIONS.find((s) => s.domain === domain)!.questionCount;
}

describe('section assembly', () => {
  it('always returns a full-length section', () => {
    DOMAINS.forEach((domain) => {
      expect(buildSection(domain, sizeOf(domain))).toHaveLength(sizeOf(domain));
    });
  });

  it('never repeats an item inside one section', () => {
    DOMAINS.forEach((domain) => {
      const section = buildSection(domain, sizeOf(domain));
      expect(new Set(section.map((i) => i.id)).size).toBe(section.length);
    });
  });

  it('draws only from the requested domain', () => {
    DOMAINS.forEach((domain) => {
      const allowed = new Set(TOPICS[domain].map((t) => t.id));
      buildSection(domain, sizeOf(domain)).forEach((item) => {
        expect(allowed.has(item.topic as never)).toBe(true);
      });
    });
  });

  it('honours the blueprint topic mix rather than drawing at random', () => {
    // A verbal section with no reading comprehension would train the wrong pacing,
    // since reading is the biggest time sink on the real section.
    const section = buildSection('verbal', sizeOf('verbal'));
    const reading = section.filter((i) => i.topic === 'reading').length;
    const quota = TOPICS.verbal.find((t) => t.id === 'reading')!.questionsPerSection;

    expect(reading).toBe(quota);
  });
});

describe('no-repeat selection', () => {
  it('avoids excluded items when the bank has room', () => {
    const first = buildSection('verbal', sizeOf('verbal'));
    const exclude = new Set(first.map((i) => i.id));
    const second = buildSection('verbal', sizeOf('verbal'), { exclude });

    const overlap = second.filter((i) => exclude.has(i.id));
    expect(overlap).toHaveLength(0);
  });

  it('builds two back-to-back sections with no shared items', () => {
    // This is the property that makes a second mock feel like a different exam.
    DOMAINS.forEach((domain) => {
      const exclude = new Set<string>();
      const a = buildSection(domain, sizeOf(domain), { exclude });
      a.forEach((i) => exclude.add(i.id));
      const b = buildSection(domain, sizeOf(domain), { exclude });

      const shared = b.filter((i) => a.some((x) => x.id === i.id));
      expect(shared).toHaveLength(0);
    });
  });

  it('still returns a full section when everything has been seen', () => {
    // Degrading to a repeated item is correct; returning a short section would
    // silently corrupt the score derived from it.
    const everything = new Set(PET_ITEMS.map((i) => i.id));
    DOMAINS.forEach((domain) => {
      const section = buildSection(domain, sizeOf(domain), { exclude: everything });
      expect(section).toHaveLength(sizeOf(domain));
      expect(new Set(section.map((i) => i.id)).size).toBe(section.length);
    });
  });

  it('prefers unseen items over seen ones when both are available', () => {
    const domain: Domain = 'quant';
    const pool = PET_ITEMS.filter((i) => TOPICS[domain].some((t) => t.id === i.topic));
    // Exclude only a handful; the section should contain none of them.
    const exclude = new Set(pool.slice(0, 5).map((i) => i.id));
    const section = buildSection(domain, sizeOf(domain), { exclude });

    expect(section.filter((i) => exclude.has(i.id))).toHaveLength(0);
  });
});

describe('bank capacity', () => {
  it('holds enough items for more than one full sitting per domain', () => {
    // Two scored sections per domain per mock; capacity below that guarantees repeats.
    DOMAINS.forEach((domain) => {
      const perMock = sizeOf(domain) * 2;
      expect(sectionCapacity(domain)).toBeGreaterThan(perMock);
    });
  });
});

describe('shuffle', () => {
  it('preserves every element', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = shuffle(input);
    expect(output).toHaveLength(input.length);
    expect([...output].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5];
    shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
