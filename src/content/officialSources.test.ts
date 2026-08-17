import { describe, expect, it } from 'vitest';
import { externalItemId, isExternalItemId, OFFICIAL_SOURCES } from './officialSources';
import { PET_ITEMS, ENGLISH_ITEMS } from './index';

describe('external item ids', () => {
  it('is stable for the same question', () => {
    expect(externalItemId('מבחן א', 'מילולי א׳', 14)).toBe(
      externalItemId('מבחן א', 'מילולי א׳', 14),
    );
  });

  it('distinguishes question number, section and source', () => {
    const base = externalItemId('מבחן א', 'מילולי א׳', 14);
    expect(base).not.toBe(externalItemId('מבחן א', 'מילולי א׳', 15));
    expect(base).not.toBe(externalItemId('מבחן א', 'כמותי א׳', 14));
    expect(base).not.toBe(externalItemId('מבחן ב', 'מילולי א׳', 14));
  });

  it('tolerates stray whitespace in the source name', () => {
    // The source is free text, so "מבחן א " and "מבחן א" must not become two questions.
    expect(externalItemId('  מבחן א  ', 'מילולי א׳', 3)).toBe(
      externalItemId('מבחן א', 'מילולי א׳', 3),
    );
  });

  it('is recognisable as external', () => {
    expect(isExternalItemId(externalItemId('מבחן א', 'מילולי א׳', 1))).toBe(true);
  });

  it('never collides with an authored item id', () => {
    // A collision would make the review screen look for question text the app does not
    // store, or overwrite a real item's spaced-repetition card.
    const authored = new Set([...PET_ITEMS, ...ENGLISH_ITEMS].map((i) => i.id));
    authored.forEach((id) => expect(isExternalItemId(id)).toBe(false));
  });
});

describe('official sources', () => {
  it('points only at official, freely published material', () => {
    OFFICIAL_SOURCES.forEach((source) => {
      expect(source.url).toMatch(/^https:\/\/(www\.)?(nite\.org\.il|campus\.gov\.il)/);
    });
  });

  it('gives every source a label and a description', () => {
    OFFICIAL_SOURCES.forEach((source) => {
      expect(source.label.length).toBeGreaterThan(0);
      expect(source.description.length).toBeGreaterThan(0);
    });
  });
});
