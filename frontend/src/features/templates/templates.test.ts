import { describe, it, expect } from 'vitest';
import { AUTOMATION_TEMPLATES, TEMPLATE_CATEGORIES } from './templates';
import { STEP_TYPE_INFO } from '../../shared/types/workflow';

describe('AUTOMATION_TEMPLATES', () => {
  it('provides at least 6 templates', () => {
    expect(AUTOMATION_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it('has unique template ids', () => {
    const ids = AUTOMATION_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has a valid category', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      expect(TEMPLATE_CATEGORIES).toContain(t.category);
    }
  });

  it('every template definition has at least one stage with steps', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      expect(t.definition.stations.length).toBeGreaterThanOrEqual(1);
      for (const station of t.definition.stations) {
        expect(station.steps.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every step uses a known type and unique id within its template', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      const stepIds = t.definition.stations.flatMap(s => s.steps.map(st => st.id));
      expect(new Set(stepIds).size).toBe(stepIds.length);
      for (const station of t.definition.stations) {
        for (const step of station.steps) {
          expect(Object.keys(STEP_TYPE_INFO)).toContain(step.type);
        }
      }
    }
  });

  it('every stage and step carries canvas positions', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      for (const station of t.definition.stations) {
        expect(station.position).toEqual({ x: expect.any(Number), y: expect.any(Number) });
        for (const step of station.steps) {
          expect(step.position).toEqual({ x: expect.any(Number), y: expect.any(Number) });
        }
      }
    }
  });
});
