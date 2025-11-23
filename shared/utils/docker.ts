import { isAbsolute, join } from 'node:path';
import { exec } from '@shared/utils/exec';
import { getAllFilesInDir } from '@shared/utils/fs-utils';
import { getByteSize, getError } from '@shared/utils/misc';
import { validateEnvVariableValue } from '@shared/utils/validation';
import Dockerode from 'dockerode';

const dockerClient = new Dockerode({});

export const handleDockerError = (err: Error, message?: string) => {
  if (
    (err.message.includes('connect ENOENT') && err.message.includes('pipe/docker_engine')) ||
    err.message.includes('cannot connect to the Docker daemon.') ||
    err.message.includes('failed to dial gRPC')
  ) {
    throw getError({
      type: 'DOCKER',
      message: "Can't connect to the docker daemon. Make sure you have Docker running.",
      stack: err.stack
    });
  }
  if (err.message.includes('docker ENOENT')) {
    throw getError({
      type: 'DOCKER',
      message: `Can't invoke docker. Make sure you have Docker running. Error: ${
        typeof err === 'string' ? err : err.message
      }`,
      stack: err.stack
    });
  }
  if (err.message.includes('unauthenticated pull rate limit')) {
    throw getError({
      type: 'DOCKER',
      message: typeof err === 'string' ? err : err.message,
      hint: [
        'To avoid rate limit problems, try using AWS ECR public repository mirror instead of Docker Hub for you base images.',
        'Example: Instead of "node:21" use "public.ecr.aws/docker/library/node:21"',
        'See all available images in AWS Public ECR registry: https://gallery.ecr.aws/'
      ].join('\n'),
      stack: err.stack
    });
  }
  throw getError({
    type: 'DOCKER',
    message: message || (typeof err === 'string' ? err : err.message),
    stack: err.stack
  });
};

const getDockerArgsFromCli = (args: StacktapeArgs) => {
  return (args?.dockerArgs || [])
    .map((arg) => {
      const [argName, ...value] = arg.split(' ');
      return [argName, value.join(' ')];
    })
    .flat();
};

const buildDockerBuildArgs = (buildArgs: Record<string, string>) => {
  return Object.entries(buildArgs || {})
    .map(([argName, value]) => {
      return ['--build-arg', `${argName}=${value}`];
    })
    .flat();
};

export const getDockerImageDetails = async (tag: string) => {
  const images = await dockerClient.listImages().catch(handleDockerError);
  const image = images.find((img) => img.RepoTags?.some((repoTag) => repoTag.split(':')[0] === tag || repoTag === tag));

  return { size: getByteSize(image.Size, 'MB', 2), id: image.Id, created: image.Created };
};

export const execDocker = (commands: string[], args?: { cwd?: string }) => {
  const { cwd } = args || {};
  return exec('docker', commands, {
    disableStdout: true,
    disableStderr: true,
    env: { DOCKER_BUILDKIT: 1 },
    cwd: cwd || process.cwd()
  }).catch(handleDockerError);
};

export const inspectDockerContainer = async (containerName: string): Promise<Dockerode.ContainerInspectInfo> => {
  const container = dockerClient.getContainer(containerName);
  return container
    .inspect()
    .catch((err) => {
      if (err.message.includes('no such container') || err.message.includes('No such container')) {
        return {} as any;
      }
      throw err;
    })
    .catch(handleDockerError);
};

export const listDockerContainers = () => {
  return dockerClient.listContainers().catch(handleDockerError);
};

export const stopDockerContainer = async (containerName: string, waitTime: number) => {
  const container = dockerClient.getContainer(containerName);
  await container.stop({ t: waitTime, signal: 'SIGTERM' }).catch(handleDockerError);
};

export const dockerLogin = async ({
  user,
  password,
  proxyEndpoint
}: {
  user: string;
  password: string;
  proxyEndpoint: string;
}) => {
  const result = await execDocker(['login', '-u', user, '-p', password, proxyEndpoint]);
  if (result.stderr && !result.stderr.includes('Using --password via the CLI is insecure')) {
    throw getError({
      type: 'DOCKER',
      message: `Failed to login to AWS container registry. Error message: \n${result.stderr}`
    });
  }
};

export const tagDockerImage = async (sourceImage: string, newTag: string) => {
  const { stderr } = await execDocker(['tag', sourceImage, newTag]);
  if (stderr) {
    throw getError({
      type: 'DOCKER',
      message: `Failed to tag docker image. Error message:\n${stderr}`
    });
  }
};

export const pushDockerImage = async (tagWithRepositoryUrl: string) => {
  const { stderr } = await execDocker(['push', `${tagWithRepositoryUrl}`]);
  if (stderr) {
    throw getError({
      type: 'DOCKER',
      message: `Failed to push docker image ${tagWithRepositoryUrl} to remote repository. Error message:\n${stderr}`
    });
  }
};

type PortMapping = { containerPort: number; hostPort: number; protocol?: string };

const getPortsArgs = (ports: PortMapping[]): string[] => {
  return (ports || [])
    .map(({ protocol, containerPort, hostPort }) => ['-p', `${hostPort}:${containerPort}/${protocol || 'tcp'}`])
    .flat();
};

const getEnvironmentArgsForDocker = (jobEnvironment: Record<string, any>): string[] => {
  const res = [];
  for (const varName in jobEnvironment) {
    const value = jobEnvironment[varName];
    validateEnvVariableValue(varName, value);
    res.push('-e', `${varName}=${value}`);
  }
  return res;
};

export const dockerRun = async ({
  name,
  image,
  entryPoint,
  volumeMapping,
  environment,
  portMappings,
  command,
  transformStderrLine,
  transformStdoutLine,
  transformStderrPut,
  transformStdoutPut,
  args,
  onStart
}: {
  args: StacktapeArgs;
  name: string;
  image: string;
  entryPoint?: string[];
  command?: string[];
  volumeMapping?: string;
  portMappings?: PortMapping[];
  environment: Record<string, any>;
  transformStderrLine?: StdTransformer | StdTransformer[];
  transformStdoutLine?: StdTransformer | StdTransformer[];
  transformStderrPut?: StdTransformer | StdTransformer[];
  transformStdoutPut?: StdTransformer | StdTransformer[];
  onStart?: (msg: string) => any;
}) => {
  if (command && entryPoint) {
    throw getError({
      type: 'UNEXPECTED',
      message: 'Only one of command and entryPoint can be specified when running Docker container.'
    });
  }
  const dockerArgs = ['--rm', '--name', name];
  let commandToExecute = command;
  if (volumeMapping) {
    dockerArgs.push('-v', volumeMapping);
  }
  // we are using host network to allow the container to use bastion tunnels
  // after they implement capability for tunnel to bind to other than 127.0.0.1, we can remove this switch back
  // see here https://github.com/aws/session-manager-plugin/pull/54
  dockerArgs.push('--network', 'host');
  if (Object.keys(environment).length) {
    dockerArgs.push(...getEnvironmentArgsForDocker(environment));
  }
  if (portMappings) {
    dockerArgs.push(...getPortsArgs(portMappings));
  }
  dockerArgs.push(...getDockerArgsFromCli(args));
  if (entryPoint) {
    const entryPointArr = entryPoint.map((cmd) => cmd.trim());
    const [initialCmd, ...restCommands] = entryPointArr;
    commandToExecute = restCommands;
    dockerArgs.push('--entrypoint', initialCmd);
  }
  dockerArgs.push(image);
  if (commandToExecute) {
    dockerArgs.push(...commandToExecute);
  }
  if (onStart) {
    onStart(`Running container ${name}...`);
  }

  return exec('docker', ['run', ...dockerArgs], {
    transformStderrLine,
    transformStdoutLine,
    transformStderrPut,
    transformStdoutPut,
    env: { DOCKER_BUILDKIT: 1 }
  });
};

export const buildDockerImageUsingDockerode = async ({
  buildContextPath,
  dockerfilePath,
  imageTag,
  buildArgs
}: {
  buildContextPath: string;
  dockerfilePath?: string;
  imageTag: string;
  buildArgs?: Record<string, string>;
}) => {
  const start = Date.now();
  const contextPath = buildContextPath
    ? isAbsolute(buildContextPath)
      ? buildContextPath
      : join(process.cwd(), buildContextPath)
    : process.cwd();

  // @note these will be copied into tarball and Dockerfile can then use them to 'COPY'
  const srcFilesForBuild = await getAllFilesInDir(contextPath);
  const stream = await dockerClient
    .buildImage(
      { src: srcFilesForBuild, context: contextPath },
      { t: imageTag, dockerfile: dockerfilePath, buildargs: buildArgs || {} }
    )
    .catch(handleDockerError);

  const buildResult: { duration: number; dockerOutput: any[] } = await new Promise((resolve, reject) => {
    const dockerOutput: any[] = [];
    let infoMessage = '';
    stream.on('data', (data) => {
      const lines = data.toString().split('\r\n').filter(Boolean);
      lines.forEach((line) => {
        const parsedLine = JSON.parse(line);
        const errMessage = parsedLine.error || parsedLine?.errorDetail?.message;
        if (errMessage) {
          reject(
            getError({
              type: 'DOCKER',
              message: `Error building docker image with tag ${imageTag}:\n${errMessage.trim()}. Build log:\n${infoMessage}`
            })
          );
        }
        if (parsedLine.stream) {
          infoMessage += parsedLine.stream;
        } else {
          dockerOutput.push(parsedLine);
        }
      });
    });
    stream.on('end', () => {
      dockerOutput.push({ message: infoMessage });
      resolve({ dockerOutput, duration: Date.now() - start });
    });
  });
  const imageDetails = await getDockerImageDetails(imageTag);
  return { ...imageDetails, ...buildResult };
};

export const buildDockerImage = async ({
  buildContextPath,
  buildArgs,
  imageTag,
  dockerfilePath,
  dockerBuildOutputArchitecture
}: {
  buildContextPath: string;
  dockerfilePath?: string;
  imageTag: string;
  buildArgs?: Record<string, string>;
  dockerBuildOutputArchitecture?: DockerBuildOutputArchitecture;
}) => {
  const start = Date.now();
  const contextPath = buildContextPath
    ? isAbsolute(buildContextPath)
      ? buildContextPath
      : join(process.cwd(), buildContextPath)
    : process.cwd();
  const command = [
    'build',
    ...(dockerBuildOutputArchitecture ? ['--platform', dockerBuildOutputArchitecture] : []),
    '-t',
    imageTag,
    ...(dockerfilePath ? ['-f', join(buildContextPath, dockerfilePath)] : []),
    ...buildDockerBuildArgs(buildArgs),
    contextPath
  ];

  let stderr;
  try {
    ({ stderr } = await execDocker(command));
  } catch (err) {
    handleDockerError(err, `Error building docker image ${imageTag}:\n${err.message}`);
  }
  const imageDetails = await getDockerImageDetails(imageTag);
  return { ...imageDetails, dockerOutput: stderr, duration: Date.now() - start };
};

export const getDockerBuildxSupportedPlatforms = async (): Promise<string[]> => {
  const { stdout } = await execDocker(['buildx', 'inspect', '--bootstrap']);

  // Parse the output to find the Platforms line
  const lines = stdout.split('\n');
  const platformsLine = lines.find((line) => line.trim().startsWith('Platforms:'));

  if (!platformsLine) {
    throw getError({
      type: 'DOCKER',
      message: 'Unable to find supported platforms in docker buildx inspect output'
    });
  }

  // Extract platforms from the line (format: "Platforms: linux/amd64, linux/arm64, ...")
  const platformsText = platformsLine.split('Platforms:')[1]?.trim();
  if (!platformsText) {
    throw getError({
      type: 'DOCKER',
      message: 'Unable to parse supported platforms from docker buildx inspect output'
    });
  }

  // Split by comma and clean up whitespace
  const platforms = platformsText
    .split(',')
    .map((platform) => platform.trim())
    .filter(Boolean);

  return platforms;
};

export const isDockerRunning = async (): Promise<boolean> => {
  try {
    await dockerClient.info();
    return true;
  } catch {
    return false;
  }
};

export const installDockerPlatforms = async (platforms: string[]): Promise<void> => {
  if (!platforms.length) {
    return;
  }

  const platformsArg = platforms.join(',');
  const { stderr, exitCode } = await execDocker([
    'run',
    '--rm',
    '--privileged',
    'tonistiigi/binfmt',
    '--install',
    platformsArg
  ]);

  if (exitCode !== 0) {
    throw getError({
      type: 'DOCKER',
      message: `Failed to install Docker platforms ${platformsArg}. Error message:\n${stderr}`
    });
  }
};
