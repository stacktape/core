export const TRIGGER_DEV_ORGANIZATION_ID = 'cljhizzbv000epc077cojgboy';
export const M_CONGRADY_GMAIL_ORG_ID = 'clg14s9so0001k308d63lbyje';

export const getStacktapeFeeMultiplier = (totalAwsCosts: number) => {
  let multiplier = 0.3;
  if (totalAwsCosts > 1000) {
    multiplier = 0.28;
  }
  if (totalAwsCosts > 4000) {
    multiplier = 0.26;
  }
  if (totalAwsCosts > 10000) {
    multiplier = 0.24;
  }
  if (totalAwsCosts > 17500) {
    multiplier = 0.22;
  }
  if (totalAwsCosts > 25000) {
    multiplier = 0.2;
  }
  return multiplier;
};

export const getStacktapeFee = ({ awsCosts, organizationId }: { awsCosts: number; organizationId?: string }) => {
  const customPricing = getPerOrganizationCustomPricing({ awsCosts, organizationId });
  if (customPricing !== undefined) {
    return customPricing;
  }
  const multiplier = getStacktapeFeeMultiplier(awsCosts);
  return +(awsCosts * multiplier).toFixed(2);
};

export const getStacktapeFeePercentage = (totalAwsCosts: number) => {
  return `${+(getStacktapeFeeMultiplier(totalAwsCosts) * 100).toFixed(2)}%`;
};

const getPerOrganizationCustomPricing = ({
  awsCosts,
  organizationId
}: {
  awsCosts: number;
  organizationId?: string;
}) => {
  if (organizationId === TRIGGER_DEV_ORGANIZATION_ID) {
    return getTieredFee({
      tiers: [
        { amount: 25000, percentage: 20 },
        { amount: 25000, percentage: 13 },
        { amount: 50000, percentage: 8 },
        { amount: Infinity, percentage: 5 }
      ],
      awsCosts
    });
  }
};

const getTieredFee = ({ tiers, awsCosts }: { tiers: { amount: number; percentage: number }[]; awsCosts: number }) => {
  let fee = 0;
  let remainingAwsCosts = awsCosts;

  while (remainingAwsCosts > 0) {
    fee += ((remainingAwsCosts < tiers[0].amount ? remainingAwsCosts : tiers[0].amount) * tiers[0].percentage) / 100;
    remainingAwsCosts -= tiers[0].amount;
    tiers.shift();
  }
  return fee;
};
