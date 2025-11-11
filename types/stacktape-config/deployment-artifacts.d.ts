interface DockerBuildArg {
  /**
   * #### Argument name
   */
  argName: string;
  /**
   * #### Argument value
   */
  value: string;
}

interface EsLanguageSpecificConfig {
  /**
   * #### The path to the `tsconfig.json` file.
   *
   * ---
   *
   * This is primarily used to resolve path aliases during the build process.
   */
  tsConfigPath?: string;
  /**
   * #### Emits TypeScript decorator metadata in the final bundle.
   *
   * ---
   *
   * This is required by frameworks like NestJS and ORMs like TypeORM.
   * It's disabled by default as it can increase build times.
   */
  emitTsDecoratorMetadata?: boolean;
  /**
   * #### A list of dependencies to exclude from the main bundle.
   *
   * ---
   *
   * These dependencies will be treated as "external" and will not be bundled directly into your application's code.
   * Instead, they will be installed separately in the deployment package.
   * Use `*` to exclude all dependencies from the bundle.
   */
  dependenciesToExcludeFromBundle?: string[];
  /**
   * #### The output module format for the compiled code.
   *
   * ---
   *
   * - `cjs` (CommonJS): The standard module system for Node.js.
   * - `esm` (ECMAScript Modules): The modern standard for JavaScript modules. Allows features like top-level `await`.
   *
   * > **Note:** Many Node.js dependencies do not yet support ES modules.
   * > Using `esm` may also affect the quality of stack traces for errors.
   *
   * @default 'cjs'
   */
  outputModuleFormat?: 'cjs' | 'esm';
  /**
   * #### The major version of Node.js to use.
   *
   * @default 18
   */
  nodeVersion?: 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;
  /**
   * #### Disables the generation of source maps.
   *
   * ---
   *
   * Disabling source maps can reduce the size of your deployment package, but it will make it more difficult to debug errors in production, as stack traces will not map back to your original source code.
   */
  disableSourceMaps?: boolean;
  /**
   * #### Outputs source maps to a specified directory.
   *
   * ---
   *
   * If you use this option, source maps will not be uploaded to AWS, and stack traces in CloudWatch logs will not be correctly mapped.
   * This is useful if you plan to upload source maps to an external error tracking service like Sentry.
   */
  outputSourceMapsTo?: string;
  /**
   * #### A list of dependencies to exclude from the deployment package.
   *
   * ---
   *
   * This only applies to dependencies that are not statically bundled.
   * To exclude a dependency from the static bundle, use `dependenciesToExcludeFromBundle`.
   * Use `*` to exclude all non-bundled dependencies.
   */
  dependenciesToExcludeFromDeploymentPackage?: string[];
}

interface PyLanguageSpecificConfig {
  /**
   * #### The path to your project's dependency file.
   *
   * ---
   *
   * This can be a `requirements.txt`, `Pipfile`, or `pyproject.toml` file.
   */
  packageManagerFile?: string;
  /**
   * #### The Python package manager to use.
   *
   * ---
   *
   * Stacktape will automatically detect the package manager based on the files in your project.
   * You only need to set this if you are using a non-standard file name for your dependencies.
   */
  packageManager?: SupportedPythonPackageManager;
  /**
   * #### The version of Python to use.
   *
   * @default 3.9
   */
  pythonVersion?: SupportedPythonVersion;
  /**
   * #### The Python web server gateway interface to use.
   *
   * ---
   *
   * > This property is only for the `stacktape-image-buildpack`.
   *
   * You can choose between `WSGI` (for frameworks like Flask or Django) and `ASGI` (for frameworks like FastAPI).
   * The server will automatically bind to the port specified by the `PORT` environment variable.
   *
   * To use this, you must specify the application variable in your `entryfilePath` (e.g., `my_app/main.py:app`).
   */
  runAppAs?: SupportedPythonRunAppAs;
  /**
   * #### Minifies the Python code.
   *
   * ---
   *
   * If enabled, Stacktape will minify the Python code using `pyminify`.
   * This can reduce the size of the deployment package, but it will make it more difficult to debug errors in production, as stack traces will not map back to your original source code.
   *
   * @default true
   */
  minify?: boolean;
}

type SupportedPythonVersion = 2.7 | 3.6 | 3.7 | 3.8 | 3.9 | 3.11 | 3.12 | 3.13 | 3.14;

type SupportedPythonPackageManager = 'pip' | 'pipenv' | 'poetry';

type SupportedPythonRunAppAs = 'WSGI' | 'ASGI';

interface JavaLanguageSpecificConfig {
  /**
   * #### Specifies whether to use Maven instead of Gradle.
   *
   * ---
   *
   * By default, Stacktape uses Gradle to build Java projects.
   */
  useMaven?: boolean;
  /**
   * #### The path to your project's build file (`pom.xml` for Maven or `build.gradle` for Gradle).
   */
  packageManagerFile?: string;
  /**
   * #### The version of Java to use.
   *
   * @default 11
   */
  javaVersion?: SupportedJavaVersion;
}

type SupportedJavaVersion = 8 | 11 | 17 | 19;

interface GoLanguageSpecificConfig {}

interface StpBuildpackSharedProps {
  /**
   * #### The path to the entry point of your application, relative to your Stacktape configuration file.
   *
   * ---
   *
   * Stacktape will attempt to bundle your code and its dependencies into a single file.
   * If a dependency cannot be bundled (e.g., it relies on binary executables), it will be installed and included in the deployment package separately.
   */
  entryfilePath: string;
  /**
   * #### A glob pattern of files to explicitly include in the deployment package.
   *
   * ---
   *
   * The path is relative to your Stacktape configuration file.
   */
  includeFiles?: string[];
  /**
   * #### A glob pattern of files to explicitly exclude from the deployment package.
   *
   * ---
   */
  excludeFiles?: string[];
  /**
   * #### A list of dependencies to exclude from the deployment package.
   */
  excludeDependencies?: string[];
  /**
   * #### Language-specific packaging configuration.
   */
  languageSpecificConfig?:
    | EsLanguageSpecificConfig
    | PyLanguageSpecificConfig
    | JavaLanguageSpecificConfig
    | GoLanguageSpecificConfig;
}

interface StpBuildpackLambdaPackagingProps extends StpBuildpackSharedProps {
  /**
   * #### The name of the handler function to be executed when the Lambda is invoked.
   */
  handlerFunction?: string;
}

interface StpBuildpackLambdaPackaging {
  type: 'stacktape-lambda-buildpack';
  properties: StpBuildpackLambdaPackagingProps;
}

interface CustomArtifactLambdaPackagingProps {
  /**
   * #### The path to a pre-built deployment package.
   *
   * ---
   *
   * If the path points to a directory or a non-zip file, Stacktape will automatically zip it for you.
   */
  packagePath: string;
  /**
   * #### The handler function to be executed when the Lambda is invoked.
   *
   * ---
   *
   * The syntax is `{{filepath}}:{{functionName}}`.
   *
   * Example: `my-lambda/index.js:default`
   */
  handler?: string;
}

interface CustomArtifactLambdaPackaging {
  type: 'custom-artifact';
  properties: CustomArtifactLambdaPackagingProps;
}

/**
 * #### Configures a pre-built container image.
 */
interface PrebuiltImageBjPackagingProps {
  /**
   * #### The name or URL of the container image.
   */
  image: string; // image name or url
  /**
   * #### A command to be executed when the container starts.
   *
   * ---
   *
   * This overrides the `CMD` instruction in the Dockerfile.
   *
   * Example: `['/app/start.sh']`
   */
  command?: string[];
}

/**
 * #### Configures a pre-built container image.
 */
interface PrebuiltImageCwPackagingProps extends PrebuiltImageBjPackagingProps {
  /**
   * #### The ARN of a secret containing credentials for a private container registry.
   *
   * ---
   *
   * The secret must be a JSON object with `username` and `password` keys.
   * You can create secrets using the `stacktape secret:create` command.
   */
  repositoryCredentialsSecretArn?: string;
  /**
   * #### A script to be executed when the container starts.
   *
   * ---
   *
   * This overrides the `ENTRYPOINT` instruction in the Dockerfile.
   */
  entryPoint?: string[];
}

interface PrebuiltBjImagePackaging {
  type: 'prebuilt-image';
  properties: PrebuiltImageBjPackagingProps;
}

interface PrebuiltCwImagePackaging {
  type: 'prebuilt-image';
  properties: PrebuiltImageCwPackagingProps;
}

/**
 * #### Configures an image to be built by Stacktape from a specified Dockerfile.
 */
interface CustomDockerfileBjImagePackagingProps {
  /**
   * #### The path to the Dockerfile, relative to `buildContextPath`.
   */
  dockerfilePath?: string;
  /**
   * #### The path to the build context directory, relative to your Stacktape configuration file.
   */
  buildContextPath: string;
  /**
   * #### A list of arguments to pass to the `docker build` command.
   */
  buildArgs?: DockerBuildArg[];
  /**
   * #### A command to be executed when the container starts.
   *
   * ---
   *
   * This overrides the `CMD` instruction in the Dockerfile.
   *
   * Example: `['/app/start.sh']`
   */
  command?: string[];
}

/**
 * #### Configures an image to be built by Stacktape from a specified Dockerfile.
 */
interface CustomDockerfileCwImagePackagingProps extends CustomDockerfileBjImagePackagingProps {
  /**
   * #### A script to be executed when the container starts.
   *
   * ---
   *
   * This overrides the `ENTRYPOINT` instruction in the Dockerfile.
   */
  entryPoint?: string[];
}

interface CustomDockerfileBjImagePackaging {
  type: 'custom-dockerfile';
  properties: CustomDockerfileBjImagePackagingProps;
}

interface CustomDockerfileCwImagePackaging {
  type: 'custom-dockerfile';
  properties: CustomDockerfileCwImagePackagingProps;
}

interface ExternalBuildpackBjImagePackagingProps {
  /**
   * #### The Buildpack Builder to use.
   *
   * ---
   *
   * @default "paketobuildpacks/builder-jammy-base"
   */
  builder?: string;
  /**
   * #### The specific Buildpack to use.
   *
   * ---
   *
   * By default, the buildpack is detected automatically.
   */
  buildpacks?: string[];
  /**
   * #### The path to the source code directory.
   */
  sourceDirectoryPath: string;
  /**
   * #### A command to be executed when the container starts.
   *
   * ---
   *
   * Example: `['/app/start.sh']`
   */
  command?: string[];
}

interface ExternalBuildpackCwImagePackagingProps extends ExternalBuildpackBjImagePackagingProps {}

interface ExternalBuildpackBjImagePackaging {
  type: 'external-buildpack';
  properties: ExternalBuildpackBjImagePackagingProps;
}

interface ExternalBuildpackCwImagePackaging {
  type: 'external-buildpack';
  properties: ExternalBuildpackCwImagePackagingProps;
}

interface NixpacksPhase {
  /**
   * #### The name of the build phase.
   */
  name: string;
  /**
   * #### A list of shell commands to execute in this phase.
   */
  cmds?: string[];
  /**
   * #### A list of Nix packages to install in this phase.
   */
  nixPkgs?: string[];
  /**
   * #### A list of Nix libraries to include in this phase.
   */
  nixLibs?: string[];
  /**
   * #### A list of Nix overlay files to apply in this phase.
   */
  nixOverlay?: string[];
  /**
   * #### The Nixpkgs archive to use.
   */
  nixpkgsArchive?: string;
  /**
   * #### A list of APT packages to install in this phase.
   */
  aptPkgs?: string[];
  /**
   * #### A list of directories to cache between builds to speed up subsequent builds.
   */
  cacheDirectories?: string[];
  /**
   * #### A list of file paths to include in this phase; all other files will be excluded.
   */
  onlyIncludeFiles?: string[];
}

interface NixpacksBjImagePackagingProps {
  /**
   * #### The path to the source code directory.
   */
  sourceDirectoryPath: string;
  /**
   * #### The base image to use for building the application.
   *
   * ---
   *
   * For more details, see the [Nixpacks documentation](https://nixpacks.com/docs/configuration/file#build-image).
   */
  buildImage?: string;
  /**
   * #### A list of providers to use for determining the build and runtime environments.
   */
  providers?: string[];
  /**
   * #### The command to execute when starting the application.
   *
   * ---
   *
   * This overrides the default start command inferred by Nixpacks.
   */
  startCmd?: string;
  /**
   * #### The base image to use for running the application.
   */
  startRunImage?: string;
  /**
   * #### A list of file paths to include in the runtime environment; all other files will be excluded.
   */
  startOnlyIncludeFiles?: string[];
  /**
   * #### The build phases for the application.
   */
  phases?: NixpacksPhase[];
}

interface NixpacksCwImagePackagingProps extends NixpacksBjImagePackagingProps {}

interface NixpacksBjImagePackaging {
  type: 'nixpacks';
  properties: NixpacksBjImagePackagingProps;
}

interface NixpacksCwImagePackaging {
  type: 'nixpacks';
  properties: NixpacksCwImagePackagingProps;
}

/**
 * #### Configures an image to be built automatically by Stacktape from your source code.
 */
interface StpBuildpackBjImagePackagingProps extends StpBuildpackSharedProps {
  /**
   * #### Language-specific packaging configuration.
   */
  languageSpecificConfig?:
    | EsLanguageSpecificConfig
    | PyLanguageSpecificConfig
    | JavaLanguageSpecificConfig
    | GoLanguageSpecificConfig;
  /**
   * #### Builds the image with support for glibc-based binaries.
   *
   * ---
   *
   * By default, Stacktape uses Alpine-based Docker images, which use `musl` instead of `glibc`.
   * Enable this option if your application has native dependencies that require `glibc`.
   * This will result in a larger container image.
   */
  requiresGlibcBinaries?: boolean;
  /**
   * #### A list of commands to be executed during the `docker build` process.
   *
   * ---
   *
   * These commands are executed using the `RUN` directive in the Dockerfile.
   * This is useful for installing additional system dependencies in your container.
   */
  customDockerBuildCommands?: string[];
}

/**
 * #### Configures an image to be built automatically by Stacktape from your source code.
 */
interface StpBuildpackCwImagePackagingProps extends StpBuildpackBjImagePackagingProps {}

interface StpBuildpackBjImagePackaging {
  type: 'stacktape-image-buildpack';
  properties: StpBuildpackBjImagePackagingProps;
}

interface StpBuildpackCwImagePackaging {
  type: 'stacktape-image-buildpack';
  properties: StpBuildpackCwImagePackagingProps;
}
