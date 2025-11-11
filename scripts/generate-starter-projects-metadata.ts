import { join } from 'node:path';
import { STARTER_PROJECTS_METADATA_DIST_PATH, STARTER_PROJECTS_SOURCE_PATH } from '@shared/naming/project-fs-paths';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { getUniqueDuplicates, hasDuplicates } from '@shared/utils/misc';
import { remove, writeJson } from 'fs-extra';
import { getAllStarterProjectIds } from './generate-starter-project';
import { getStarterProjectMetadata } from './starter-projects/utils';

export const generateStarterProjectsMetadata = async () => {
  logInfo('Generating starter projects metadata...');
  // await exec('npx', ['prettier', 'starter-projects', '--write'], { disableStdout: true });
  await remove(STARTER_PROJECTS_METADATA_DIST_PATH);
  const starterProjects = await getAllStarterProjectIds();
  const metadata = await Promise.all(
    starterProjects.map(async (starterProjectName) => {
      return getStarterProjectMetadata({ absoluteProjectPath: join(STARTER_PROJECTS_SOURCE_PATH, starterProjectName) });
    })
  );

  const allProjectIds = metadata.map((proj) => proj.starterProjectId);
  if (hasDuplicates(allProjectIds)) {
    throw new Error(`There are duplicate starter names in starter projects: ${getUniqueDuplicates(allProjectIds)}`);
  }
  const sorted = metadata.sort((a, b) => a.priority - b.priority);

  await writeJson(STARTER_PROJECTS_METADATA_DIST_PATH, sorted, { spaces: 2 });

  logSuccess(`Successfully generated starter projects metadata to ${STARTER_PROJECTS_METADATA_DIST_PATH}`);
  return STARTER_PROJECTS_METADATA_DIST_PATH;
  // await Promise.all([remove(join(outputDirPath, '.prettierrc')), remove(join(outputDirPath, '.eslintrc'))]);
};

if (import.meta.main) {
  generateStarterProjectsMetadata();
}
