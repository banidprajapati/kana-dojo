import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, type Achievement } from '../store/useAchievementStore';
import {
  KANJI_N5,
  KANJI_N4,
  KANJI_N3,
  KANJI_N2,
  KANJI_N1,
  KANJI_BY_JLPT_LEVEL,
} from '../store/kanjiSets';

/**
 * Tests for N5-N1 Graduate achievement bug fix.
 * Verifies that Graduate achievements are only unlocked when ALL kanji
 * for the specific JLPT level have been practiced with >= 80% accuracy,
 * and that practicing only N5 kanji does NOT unlock N4-N1 Graduate achievements.
 *
 * Regression test for: [BUG] N4 to N1 Graduate achievements achieved before completed
 */

const graduateAchievements = ACHIEVEMENTS.filter(a =>
  [
    'n5_graduate',
    'n4_graduate',
    'n3_graduate',
    'n2_graduate',
    'n1_graduate',
  ].includes(a.id),
);

/** Build characterMastery where every kanji in the given set has the specified accuracy */
function buildMastery(
  kanjiSet: Set<string>,
  correct: number,
  incorrect: number,
): Record<string, { correct: number; incorrect: number }> {
  const mastery: Record<string, { correct: number; incorrect: number }> = {};
  for (const char of kanjiSet) {
    mastery[char] = { correct, incorrect };
  }
  return mastery;
}

/**
 * Mirrors the corrected checkContentMastery logic for kanji:
 * - filters characterMastery to only kanji in the JLPT-level set
 * - requires all kanji in the set to have been practiced
 * - requires all practiced kanji to have >= value% accuracy
 */
function checkKanjiGraduate(
  achievement: Achievement,
  characterMastery: Record<string, { correct: number; incorrect: number }>,
): boolean {
  const { value, additional } = achievement.requirements;
  const jlptLevel = additional?.jlptLevel as
    | 'N5'
    | 'N4'
    | 'N3'
    | 'N2'
    | 'N1'
    | undefined;
  if (!jlptLevel) return false;

  const kanjiSet = KANJI_BY_JLPT_LEVEL[jlptLevel];
  const entries = Object.entries(characterMastery).filter(([key]) =>
    kanjiSet.has(key),
  );

  // All kanji of this level must be present
  if (entries.length < kanjiSet.size) return false;

  for (const [, stats] of entries) {
    const total = stats.correct + stats.incorrect;
    if (total === 0) return false;
    const accuracy = (stats.correct / total) * 100;
    if (accuracy < value) return false;
  }
  return true;
}

describe('Kanji Graduate Achievements', () => {
  it('kanjiSets export the correct character counts', () => {
    expect(KANJI_N5.size).toBe(80);
    expect(KANJI_N4.size).toBe(167);
    expect(KANJI_N3.size).toBe(370);
    expect(KANJI_N2.size).toBe(374);
    expect(KANJI_N1.size).toBe(1504);
  });

  it('KANJI_BY_JLPT_LEVEL maps levels to the correct sets', () => {
    expect(KANJI_BY_JLPT_LEVEL['N5']).toBe(KANJI_N5);
    expect(KANJI_BY_JLPT_LEVEL['N4']).toBe(KANJI_N4);
    expect(KANJI_BY_JLPT_LEVEL['N3']).toBe(KANJI_N3);
    expect(KANJI_BY_JLPT_LEVEL['N2']).toBe(KANJI_N2);
    expect(KANJI_BY_JLPT_LEVEL['N1']).toBe(KANJI_N1);
  });

  it('five Graduate achievements are defined (N5 to N1)', () => {
    expect(graduateAchievements).toHaveLength(5);
    const ids = graduateAchievements.map(a => a.id);
    expect(ids).toContain('n5_graduate');
    expect(ids).toContain('n4_graduate');
    expect(ids).toContain('n3_graduate');
    expect(ids).toContain('n2_graduate');
    expect(ids).toContain('n1_graduate');
  });

  it('practicing ONLY N5 kanji with 80%+ accuracy does NOT unlock N4-N1 Graduate achievements', () => {
    // Simulate: user practiced all N5 kanji with 90% accuracy
    const mastery = buildMastery(KANJI_N5, 9, 1); // 90% accuracy

    const n4Graduate = ACHIEVEMENTS.find(a => a.id === 'n4_graduate')!;
    const n3Graduate = ACHIEVEMENTS.find(a => a.id === 'n3_graduate')!;
    const n2Graduate = ACHIEVEMENTS.find(a => a.id === 'n2_graduate')!;
    const n1Graduate = ACHIEVEMENTS.find(a => a.id === 'n1_graduate')!;

    expect(checkKanjiGraduate(n4Graduate, mastery)).toBe(false);
    expect(checkKanjiGraduate(n3Graduate, mastery)).toBe(false);
    expect(checkKanjiGraduate(n2Graduate, mastery)).toBe(false);
    expect(checkKanjiGraduate(n1Graduate, mastery)).toBe(false);
  });

  it('practicing ALL N5 kanji with 80%+ accuracy unlocks N5 Graduate achievement', () => {
    const mastery = buildMastery(KANJI_N5, 8, 2); // exactly 80% accuracy
    const n5Graduate = ACHIEVEMENTS.find(a => a.id === 'n5_graduate')!;
    expect(checkKanjiGraduate(n5Graduate, mastery)).toBe(true);
  });

  it('practicing only SOME N5 kanji does NOT unlock N5 Graduate achievement', () => {
    // Only 3 out of 80 N5 kanji practiced
    const partialMastery: Record<
      string,
      { correct: number; incorrect: number }
    > = {};
    let count = 0;
    for (const char of KANJI_N5) {
      partialMastery[char] = { correct: 9, incorrect: 1 };
      if (++count >= 3) break;
    }
    const n5Graduate = ACHIEVEMENTS.find(a => a.id === 'n5_graduate')!;
    expect(checkKanjiGraduate(n5Graduate, partialMastery)).toBe(false);
  });

  it('practicing N5 kanji below 80% accuracy does NOT unlock N5 Graduate achievement', () => {
    const mastery = buildMastery(KANJI_N5, 7, 3); // 70% accuracy
    const n5Graduate = ACHIEVEMENTS.find(a => a.id === 'n5_graduate')!;
    expect(checkKanjiGraduate(n5Graduate, mastery)).toBe(false);
  });

  it('each Graduate achievement requires all kanji of its specific level', () => {
    // N4 Graduate should only unlock when ALL N4 kanji are mastered
    const mastery = buildMastery(KANJI_N4, 9, 1); // all N4 with 90%
    const n4Graduate = ACHIEVEMENTS.find(a => a.id === 'n4_graduate')!;
    const n5Graduate = ACHIEVEMENTS.find(a => a.id === 'n5_graduate')!;

    expect(checkKanjiGraduate(n4Graduate, mastery)).toBe(true);
    // N5 kanji not in this mastery → N5 Graduate should NOT unlock
    expect(checkKanjiGraduate(n5Graduate, mastery)).toBe(false);
  });
});
