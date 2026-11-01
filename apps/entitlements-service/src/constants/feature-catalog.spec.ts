import {
  FEATURE_CATALOG,
  FEATURE_KEYS,
} from './feature-catalog';

describe('Feature catalog', () => {
  it('has unique keys', () => {
    const keys = FEATURE_CATALOG.map((feature) => feature.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses lowercase dot-separated keys', () => {
    for (const feature of FEATURE_CATALOG) {
      expect(feature.key).toMatch(/^[a-z][a-z0-9_.]{2,119}$/);
    }
  });

  it('declares a quantity unit for every quantity feature', () => {
    for (const feature of FEATURE_CATALOG) {
      if (feature.value_type === 'quantity') {
        expect(feature.unit).toBeTruthy();
      }
    }
  });

  it('exposes every catalog key in the lookup set', () => {
    expect(FEATURE_KEYS.size).toBe(FEATURE_CATALOG.length);
    for (const feature of FEATURE_CATALOG) {
      expect(FEATURE_KEYS.has(feature.key)).toBe(true);
    }
  });
});
