import { describe, expect, test } from 'bun:test';
import {
  getStacktapeFee,
  getStacktapeFeeMultiplier,
  getStacktapeFeePercentage,
  M_CONGRADY_GMAIL_ORG_ID,
  TRIGGER_DEV_ORGANIZATION_ID
} from './stacktape-fees';

describe('stacktape-fees utilities', () => {
  describe('constants', () => {
    test('TRIGGER_DEV_ORGANIZATION_ID should be defined', () => {
      expect(TRIGGER_DEV_ORGANIZATION_ID).toBe('cljhizzbv000epc077cojgboy');
    });

    test('M_CONGRADY_GMAIL_ORG_ID should be defined', () => {
      expect(M_CONGRADY_GMAIL_ORG_ID).toBe('clg14s9so0001k308d63lbyje');
    });
  });

  describe('getStacktapeFeeMultiplier', () => {
    test('should return 0.3 for costs up to $1000', () => {
      expect(getStacktapeFeeMultiplier(0)).toBe(0.3);
      expect(getStacktapeFeeMultiplier(500)).toBe(0.3);
      expect(getStacktapeFeeMultiplier(1000)).toBe(0.3);
    });

    test('should return 0.28 for costs between $1000 and $4000', () => {
      expect(getStacktapeFeeMultiplier(1001)).toBe(0.28);
      expect(getStacktapeFeeMultiplier(2500)).toBe(0.28);
      expect(getStacktapeFeeMultiplier(4000)).toBe(0.28);
    });

    test('should return 0.26 for costs between $4000 and $10000', () => {
      expect(getStacktapeFeeMultiplier(4001)).toBe(0.26);
      expect(getStacktapeFeeMultiplier(7000)).toBe(0.26);
      expect(getStacktapeFeeMultiplier(10000)).toBe(0.26);
    });

    test('should return 0.24 for costs between $10000 and $17500', () => {
      expect(getStacktapeFeeMultiplier(10001)).toBe(0.24);
      expect(getStacktapeFeeMultiplier(15000)).toBe(0.24);
      expect(getStacktapeFeeMultiplier(17500)).toBe(0.24);
    });

    test('should return 0.22 for costs between $17500 and $25000', () => {
      expect(getStacktapeFeeMultiplier(17501)).toBe(0.22);
      expect(getStacktapeFeeMultiplier(20000)).toBe(0.22);
      expect(getStacktapeFeeMultiplier(25000)).toBe(0.22);
    });

    test('should return 0.2 for costs over $25000', () => {
      expect(getStacktapeFeeMultiplier(25001)).toBe(0.2);
      expect(getStacktapeFeeMultiplier(50000)).toBe(0.2);
      expect(getStacktapeFeeMultiplier(100000)).toBe(0.2);
    });

    test('should handle exact threshold values correctly', () => {
      expect(getStacktapeFeeMultiplier(1000)).toBe(0.3);
      expect(getStacktapeFeeMultiplier(1001)).toBe(0.28);
      expect(getStacktapeFeeMultiplier(4000)).toBe(0.28);
      expect(getStacktapeFeeMultiplier(4001)).toBe(0.26);
    });
  });

  describe('getStacktapeFeePercentage', () => {
    test('should return percentage string for various cost levels', () => {
      expect(getStacktapeFeePercentage(500)).toBe('30%');
      expect(getStacktapeFeePercentage(2000)).toBe('28%');
      expect(getStacktapeFeePercentage(5000)).toBe('26%');
      expect(getStacktapeFeePercentage(12000)).toBe('24%');
      expect(getStacktapeFeePercentage(20000)).toBe('22%');
      expect(getStacktapeFeePercentage(30000)).toBe('20%');
    });

    test('should format percentage with 2 decimal places', () => {
      const percentage = getStacktapeFeePercentage(1000);
      expect(percentage).toMatch(/^\d+(\.\d{1,2})?%$/);
    });

    test('should include % symbol', () => {
      const percentage = getStacktapeFeePercentage(1000);
      expect(percentage).toContain('%');
    });
  });

  describe('getStacktapeFee', () => {
    describe('standard pricing', () => {
      test('should calculate fee for low costs (30%)', () => {
        const fee = getStacktapeFee({ awsCosts: 1000 });
        expect(fee).toBe(300);
      });

      test('should calculate fee for medium costs (28%)', () => {
        const fee = getStacktapeFee({ awsCosts: 2000 });
        expect(fee).toBe(560);
      });

      test('should calculate fee for higher costs (26%)', () => {
        const fee = getStacktapeFee({ awsCosts: 5000 });
        expect(fee).toBe(1300);
      });

      test('should round fee to 2 decimal places', () => {
        const fee = getStacktapeFee({ awsCosts: 333.33 });
        expect(fee).toBe(100);
        expect(typeof fee).toBe('number');
      });

      test('should handle zero costs', () => {
        const fee = getStacktapeFee({ awsCosts: 0 });
        expect(fee).toBe(0);
      });

      test('should handle very small costs', () => {
        const fee = getStacktapeFee({ awsCosts: 0.01 });
        expect(fee).toBeGreaterThanOrEqual(0);
      });

      test('should handle very large costs', () => {
        const fee = getStacktapeFee({ awsCosts: 1000000 });
        expect(fee).toBe(200000);
      });
    });

    describe('custom pricing for TRIGGER_DEV', () => {
      test('should apply tiered pricing for Trigger.dev organization', () => {
        // First $25k at 20% = $5,000
        const fee1 = getStacktapeFee({
          awsCosts: 25000,
          organizationId: TRIGGER_DEV_ORGANIZATION_ID
        });
        expect(fee1).toBe(5000);
      });

      test('should apply second tier for Trigger.dev ($25k-$50k at 13%)', () => {
        // First $25k at 20% = $5,000
        // Next $25k at 13% = $3,250
        // Total = $8,250
        const fee = getStacktapeFee({
          awsCosts: 50000,
          organizationId: TRIGGER_DEV_ORGANIZATION_ID
        });
        expect(fee).toBe(8250);
      });

      test('should apply third tier for Trigger.dev ($50k-$100k at 8%)', () => {
        // First $25k at 20% = $5,000
        // Next $25k at 13% = $3,250
        // Next $50k at 8% = $4,000
        // Total = $12,250
        const fee = getStacktapeFee({
          awsCosts: 100000,
          organizationId: TRIGGER_DEV_ORGANIZATION_ID
        });
        expect(fee).toBe(12250);
      });

      test('should apply fourth tier for Trigger.dev (>$100k at 5%)', () => {
        // First $25k at 20% = $5,000
        // Next $25k at 13% = $3,250
        // Next $50k at 8% = $4,000
        // Next $50k at 5% = $2,500
        // Total = $14,750
        const fee = getStacktapeFee({
          awsCosts: 150000,
          organizationId: TRIGGER_DEV_ORGANIZATION_ID
        });
        expect(fee).toBe(14750);
      });

      test('should handle small amounts for Trigger.dev', () => {
        // $10k at 20% = $2,000
        const fee = getStacktapeFee({
          awsCosts: 10000,
          organizationId: TRIGGER_DEV_ORGANIZATION_ID
        });
        expect(fee).toBe(2000);
      });
    });

    describe('organization-specific behavior', () => {
      test('should use standard pricing for unknown organization', () => {
        const standardFee = getStacktapeFee({ awsCosts: 1000 });
        const orgFee = getStacktapeFee({
          awsCosts: 1000,
          organizationId: 'unknown-org-id'
        });
        expect(orgFee).toBe(standardFee);
      });

      test('should use standard pricing when no organizationId provided', () => {
        const fee1 = getStacktapeFee({ awsCosts: 5000 });
        const fee2 = getStacktapeFee({
          awsCosts: 5000,
          organizationId: undefined
        });
        expect(fee1).toBe(fee2);
      });

      test('should differentiate between Trigger.dev and standard pricing', () => {
        const standardFee = getStacktapeFee({ awsCosts: 30000 });
        const triggerFee = getStacktapeFee({
          awsCosts: 30000,
          organizationId: TRIGGER_DEV_ORGANIZATION_ID
        });
        expect(triggerFee).not.toBe(standardFee);
        expect(triggerFee).toBeLessThan(standardFee);
      });
    });

    describe('edge cases', () => {
      test('should handle fractional AWS costs', () => {
        const fee = getStacktapeFee({ awsCosts: 1234.56 });
        expect(typeof fee).toBe('number');
        expect(fee).toBeGreaterThan(0);
      });

      test('should return number type, not string', () => {
        const fee = getStacktapeFee({ awsCosts: 1000 });
        expect(typeof fee).toBe('number');
      });

      test('should handle negative costs gracefully', () => {
        const fee = getStacktapeFee({ awsCosts: -100 });
        expect(typeof fee).toBe('number');
      });
    });
  });
});
