import { describe, expect, it } from 'vitest';
import { buildPlan, daysBetween, generateQuests, phaseFor } from './planner';
import { RETAKE_INTERVAL_DAYS } from '../config/amirnet';

const START = '2026-08-16';

function plan(days: number, englishDone = false) {
  const testDate = new Date('2026-08-16T00:00:00Z');
  testDate.setUTCDate(testDate.getUTCDate() + days);
  return buildPlan({
    startDate: START,
    testDate: testDate.toISOString().slice(0, 10),
    dailyMinutes: 35,
    englishDone,
  });
}

describe('study plan structure', () => {
  it('covers every day from today to the test with no gaps', () => {
    const p = plan(70);
    expect(p.days).toHaveLength(70);
    expect(p.days[0].date).toBe(START);

    p.days.forEach((day, i) => {
      if (i === 0) return;
      expect(daysBetween(p.days[i - 1].date, day.date)).toBe(1);
    });
  });

  it('runs the phases in order and assigns every day to one', () => {
    const p = plan(70);
    const phases = p.days.map((d) => d.phase);

    expect(phases[0]).toBe('A');
    expect(phases[phases.length - 1]).toBe('C');
    expect(new Set(phases)).toEqual(new Set(['A', 'B', 'C']));

    // Phases must never interleave — once you leave a phase you do not return to it.
    const order = ['A', 'B', 'C'];
    let seen = 0;
    phases.forEach((phase) => {
      const index = order.indexOf(phase);
      expect(index).toBeGreaterThanOrEqual(seen);
      seen = index;
    });
  });

  it('protects at least a week of simulation on a short runway', () => {
    // Walking into the test without full timed mocks is the classic way to underperform,
    // so phase C is the one that must not be squeezed out.
    const p = plan(21);
    const simulationDays = p.days.filter((d) => d.phase === 'C').length;
    expect(simulationDays).toBeGreaterThanOrEqual(7);
  });

  it('resolves the phase for a given date', () => {
    const p = plan(70);
    expect(phaseFor(p, START)).toBe('A');
    expect(phaseFor(p, '2030-01-01')).toBeNull();
  });
});

describe('AMIRNET scheduling inside the plan', () => {
  it('slots the real sitting around week five when there is room', () => {
    const p = plan(70);
    expect(p.amirnetSittingDay).toBe(28);
    expect(p.days[28].amirnetSitting).toBe(true);
  });

  it('leaves a full retake window before the PET', () => {
    // Booking it too late means a miss cannot be fixed — the whole strategic advantage
    // of AMIRNET is that it can be retaken after 35 days.
    const p = plan(70);
    const daysAfterSitting = p.totalDays - p.amirnetSittingDay!;
    expect(daysAfterSitting).toBeGreaterThanOrEqual(RETAKE_INTERVAL_DAYS);
  });

  it('sits it early when the runway is too short for a retake', () => {
    const p = plan(30);
    expect(p.amirnetSittingDay).not.toBeNull();
    expect(p.amirnetSittingDay!).toBeLessThan(30);
  });

  it('skips the English track entirely once the exemption is cleared', () => {
    const p = plan(70, true);
    expect(p.amirnetSittingDay).toBeNull();
    expect(p.days.every((d) => d.englishFocus === null)).toBe(true);
  });

  it('stops assigning English work after the sitting', () => {
    const p = plan(70);
    const afterSitting = p.days.slice(p.amirnetSittingDay! + 1);
    expect(afterSitting.every((d) => d.englishFocus === null)).toBe(true);
  });

  it('gives English work every day up to the sitting', () => {
    const p = plan(70);
    const beforeSitting = p.days.slice(0, p.amirnetSittingDay!);
    expect(beforeSitting.every((d) => d.englishFocus !== null)).toBe(true);
  });
});

describe('daily quests', () => {
  it('caps the day at three quests', () => {
    const quests = generateQuests({
      weakestTopic: { id: 'analogies', label: 'אנלוגיות' },
      dueCardCount: 20,
      englishDone: false,
      phase: 'C',
    });
    expect(quests.length).toBeLessThanOrEqual(3);
  });

  it('targets the weakest topic', () => {
    const quests = generateQuests({
      weakestTopic: { id: 'geometry', label: 'גאומטריה' },
      dueCardCount: 0,
      englishDone: false,
      phase: 'B',
    });
    expect(quests[0].href).toContain('geometry');
  });

  it('drops the English quest once the exemption is cleared', () => {
    const quests = generateQuests({
      weakestTopic: null,
      dueCardCount: 0,
      englishDone: true,
      phase: 'B',
    });
    expect(quests.some((q) => q.id === 'english-vocab')).toBe(false);
  });

  it('never asks for more review than is actually due', () => {
    const quests = generateQuests({
      weakestTopic: null,
      dueCardCount: 3,
      englishDone: true,
      phase: 'B',
    });
    const review = quests.find((q) => q.id === 'review-due');
    expect(review?.target).toBe(3);
  });

  it('adds a timed-section quest during the simulation phase', () => {
    const quests = generateQuests({
      weakestTopic: null,
      dueCardCount: 0,
      englishDone: true,
      phase: 'C',
    });
    expect(quests.some((q) => q.id === 'timed-section')).toBe(true);
  });
});
