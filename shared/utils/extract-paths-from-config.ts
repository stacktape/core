import get from 'lodash/get';

const propertyNamesToWatchFor: { propertyName: string; oftenGenerated?: boolean }[] = [
  { propertyName: 'filePath' },
  { propertyName: 'executeScript' },
  { propertyName: 'executeScripts' },
  { propertyName: 'entryfilePath' },
  { propertyName: 'directoryPath', oftenGenerated: true },
  { propertyName: 'uploadDirectoryPath', oftenGenerated: true },
  { propertyName: 'packagePath' },
  { propertyName: 'buildContextPath' },
  { propertyName: 'dockerfilePath' },
  { propertyName: 'tsConfigPath' },
  { propertyName: 'sourceDirectoryPath' },
  { propertyName: 'appDirectory' }
];

const getInfo = (stacktapeConfig: StacktapeConfig, pathToNode: string) => {
  const pathType = getPathType(pathToNode);
  if (pathType === 'resource') {
    return {
      pathType,
      name: pathToNode.split('.')[2],
      resourceType: get(stacktapeConfig, pathToNode.split('.').slice(1, 3).concat('type'))
    };
  }
  if (pathType === 'directive') {
    return { pathType, name: get(stacktapeConfig, pathToNode.split('.').slice(1, 3).concat('name')) };
  }
  if (pathType === 'script') {
    return { pathType, name: pathToNode.split('.')[2] };
  }
};

const getPathType = (pathToNode: string) => {
  return pathToNode.startsWith('.resources')
    ? ('resource' as const)
    : pathToNode.startsWith('.directives')
      ? ('directive' as const)
      : pathToNode.startsWith('.scripts')
        ? ('script' as const)
        : undefined;
};

const cleanPath = (path: string) => {
  const pathParts = path?.split(':');
  return pathParts.length > 1 ? pathParts.slice(0, -1).join(':') : path;
};

export type ExtractedPath = {
  path: string;
  pathType: 'resource' | 'script' | 'directive';
  pathPropertyLocation: string;
  name?: string;
  resourceType?: string;
  oftenGenerated?: boolean;
};

export const extractPaths = ({ stacktapeConfig }: { stacktapeConfig: StacktapeConfig }) => {
  const result: ExtractedPath[] = [];

  const processNode = (node: any, pathToNode: string) => {
    if (node === null) {
      return;
    }
    if (Array.isArray(node)) {
      return node.map((nodeValue, index) => processNode(nodeValue, pathToNode.concat(`.${index}`)));
    }
    if (typeof node === 'object') {
      Object.entries(node).forEach(([propName, nodeValue]) => {
        const matchingProperty = propertyNamesToWatchFor.find(({ propertyName }) => propertyName === propName);

        if (matchingProperty) {
          if (Array.isArray(nodeValue)) {
            nodeValue.forEach((val) => {
              result.push({
                path: cleanPath(val),
                pathPropertyLocation: `${pathToNode}.${propName}`,
                oftenGenerated: matchingProperty.oftenGenerated,
                ...getInfo(stacktapeConfig, pathToNode)
              });
            });
          } else {
            result.push({
              path: cleanPath(nodeValue as string),
              pathPropertyLocation: `${pathToNode}.${propName}`,
              oftenGenerated: matchingProperty.oftenGenerated,
              ...getInfo(stacktapeConfig, pathToNode)
            });
          }
          return;
        }
        processNode(nodeValue, `${pathToNode}.${propName}`);
      });
    }
  };
  processNode(stacktapeConfig, '');
  return result;
};
