import type { Stack } from '@aws-sdk/client-cloudformation';
import type { AwsSdkManager } from '@shared/aws/sdk-manager';
import { awsResourceNames } from '@shared/naming/aws-resource-names';
import { consoleLinks } from '@shared/naming/console-links';
import { stackMetadataNames } from '@shared/naming/metadata-names';
import { outputNames } from '@shared/naming/stack-output-names';
import {
  getCfTemplateS3Key,
  getStacktapeStackInfoFromTemplateDescription,
  getStpTemplateS3Key
} from '@shared/naming/utils';

const getStackInfoMap = ({ stackDetails }: { stackDetails: Stack }) => {
  const stackData: StackInfoMap = JSON.parse(
    stackDetails.Outputs?.find(({ OutputKey }) => OutputKey === outputNames.stackInfoMap())?.OutputValue || '{}'
  );
  return {
    ...stackData,
    metadata: {
      [stackMetadataNames.name()]: { showDuringPrint: true, value: stackDetails.StackName },
      [stackMetadataNames.createdTime()]: { showDuringPrint: false, value: new Date(stackDetails.CreationTime) },
      [stackMetadataNames.lastUpdatedTime()]: {
        showDuringPrint: false,
        value: new Date(stackDetails.LastUpdatedTime)
      },
      ...stackData.metadata
    }
  } as StackInfoMap;
};

export const getResourcesWithSpecificLinks = ({
  linkNamePrefix,
  stackDetails
}: {
  linkNamePrefix: 'logs' | 'metrics';
  stackDetails: Stack;
}) => {
  const stackInfoMap = getStackInfoMap({ stackDetails });

  const resources: {
    [stacktapeResourceName: string]: { [linkName: string]: string };
  } = {};

  Object.entries(stackInfoMap.resources || {}).forEach(([resourceName, { links }]) => {
    const linkEntries = Object.entries(links || {});

    const relevantEntries = linkEntries.filter(([linkName]) => linkName.startsWith(linkNamePrefix));

    if (relevantEntries.length) {
      resources[resourceName] = relevantEntries.reduce<Record<string, string>>((obj, [linkName, linkValue]) => {
        return { ...obj, [linkName]: linkValue as string };
      }, {});
    }
  });

  return resources;
};

export const getStackCfTemplate = async ({
  stackDetails,
  awsSdkManager
}: {
  stackDetails: Stack;
  awsSdkManager: AwsSdkManager;
}) => {
  const version = stackDetails.Outputs?.find(
    ({ OutputKey }) => OutputKey === outputNames.deploymentVersion()
  )?.OutputValue;
  const { globallyUniqueStackHash } = getStacktapeStackInfoFromTemplateDescription(stackDetails.Description);
  return awsSdkManager.getFromBucket({
    bucketName: awsResourceNames.deploymentBucket(globallyUniqueStackHash),
    s3Key: getCfTemplateS3Key(version)
  });
};

export const getStackStpTemplate = async ({
  stackDetails,
  awsSdkManager
}: {
  stackDetails: Stack;
  awsSdkManager: AwsSdkManager;
}) => {
  const version = stackDetails.Outputs?.find(
    ({ OutputKey }) => OutputKey === outputNames.deploymentVersion()
  )?.OutputValue;
  const { globallyUniqueStackHash } = getStacktapeStackInfoFromTemplateDescription(stackDetails.Description);
  return awsSdkManager.getFromBucket({
    bucketName: awsResourceNames.deploymentBucket(globallyUniqueStackHash),
    s3Key: getStpTemplateS3Key(version)
  });
};

export const getStackCfTemplateS3ConsoleLink = ({ stackDetails }: { stackDetails: Stack }) => {
  const version = stackDetails.Outputs?.find(
    ({ OutputKey }) => OutputKey === outputNames.deploymentVersion()
  )?.OutputValue;
  const { globallyUniqueStackHash } = getStacktapeStackInfoFromTemplateDescription(stackDetails.Description);
  return consoleLinks.s3Object({
    bucketName: awsResourceNames.deploymentBucket(globallyUniqueStackHash),
    objectKey: getCfTemplateS3Key(version)
  });
};

export const getStackStpTemplateS3ConsoleLink = ({ stackDetails }: { stackDetails: Stack }) => {
  const version = stackDetails.Outputs?.find(
    ({ OutputKey }) => OutputKey === outputNames.deploymentVersion()
  )?.OutputValue;
  const { globallyUniqueStackHash } = getStacktapeStackInfoFromTemplateDescription(stackDetails.Description);
  return consoleLinks.s3Object({
    bucketName: awsResourceNames.deploymentBucket(globallyUniqueStackHash),
    objectKey: getStpTemplateS3Key(version)
  });
};

// export const getGroupedResources = ({ stackDetails }: { stackDetails: Stack }) => {
//   const stackInfoMap = getStackInfoMap({ stackDetails });

//   const resources: {
//     withLogs: { [stacktapeResourceName: string]: { [linkName: string]: string } };
//     withMetrics: { [stacktapeResourceName: string]: { [linkName: string]: string } };
//   } = { withLogs: {}, withMetrics: {} };

//   Object.entries(stackInfoMap.resources || {}).forEach(([resourceName, { links }]) => {
//     const linkEntries = Object.entries(links || {});

//     const logEntries = linkEntries.filter(([linkName]) => linkName.startsWith('logs'));
//     const metricEntries = linkEntries.filter(([linkName]) => linkName.startsWith('metrics'));

//     if (logEntries.length) {
//       resources.withLogs[resourceName] = logEntries.reduce<Record<string, string>>((obj, [linkName, linkValue]) => {
//         return { ...obj, [linkName]: linkValue as string };
//       }, {});
//     }
//     if (metricEntries.length) {
//       resources.withMetrics[resourceName] = metricEntries.reduce<Record<string, string>>(
//         (obj, [linkName, linkValue]) => {
//           return { ...obj, [linkName]: linkValue as string };
//         },
//         {}
//       );
//     }
//   });

//   return resources;
// };
