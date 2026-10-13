// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { collapsedRectangle, expandedRectangle, objectRectangle } from '../src/tableau/geometry.js';

const authored = { x: 840, y: 20, width: 140, height: 36 };

describe('panel bounds', () => {
  it('keeps the authored right edge and preferred panel dimensions when possible', () => {
    expect(expandedRectangle(authored, { width: 1000, height: 800 })).toEqual({ x: 560, y: 20, width: 420, height: 700 });
  });
  it('fits a 600 × 400 dashboard with the required margin', () => {
    expect(expandedRectangle(authored, { width: 600, height: 400 })).toEqual({ x: 172, y: 8, width: 420, height: 384 });
  });
  it('restores exact authored geometry, or clamps it after a dashboard shrink', () => {
    expect(collapsedRectangle(authored, { width: 1000, height: 800 })).toEqual(authored);
    expect(collapsedRectangle(authored, { width: 600, height: 400 })).toEqual({ ...authored, x: 460 });
  });
  it('rejects unsupported sizes and missing geometry before calling Tableau', () => {
    expect(() => expandedRectangle(authored, { width: 200, height: 200 })).toThrow(/at least 320/);
    expect(() => expandedRectangle(authored, { width: NaN, height: 800 })).toThrow(/dimensions/);
    expect(() => objectRectangle({})).toThrow(/valid position/);
  });
});
