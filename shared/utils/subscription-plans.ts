export const getMaxOrganizationMembers = ({
  isPersonalOrg,
  subscriptionPlanType
}: {
  isPersonalOrg: boolean;
  subscriptionPlanType: any;
}) => {
  return isPersonalOrg ? 1 : subscriptionPlanType === 'FLEXIBLE' ? 25 : Infinity;
};
