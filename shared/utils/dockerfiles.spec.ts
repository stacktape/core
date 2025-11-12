import { describe, expect, test } from 'bun:test';
import {
  buildEsBinInstallerDockerfile,
  buildEsDockerfile,
  buildGoArtifactDockerfile,
  buildGoDockerfile,
  buildJavaArtifactDockerfile,
  buildJavaDockerfile,
  buildPythonArtifactDockerfile,
  buildPythonDockerfile
} from './dockerfiles';

describe('dockerfiles', () => {
  describe('buildEsDockerfile', () => {
    test('should build basic Node.js Dockerfile without dependencies', () => {
      const dockerfile = buildEsDockerfile({
        dependencies: [],
        packageManager: 'npm',
        requiresGlibcBinaries: false,
        nodeVersion: 20
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/node:20-alpine');
      expect(dockerfile).toContain('tini');
      expect(dockerfile).toContain('CMD ["node"');
      expect(dockerfile).not.toContain('RUN npm');
    });

    test('should include npm install for dependencies', () => {
      const dockerfile = buildEsDockerfile({
        dependencies: [{ name: 'express', version: '4.18.0' }],
        packageManager: 'npm',
        requiresGlibcBinaries: false,
        nodeVersion: 18
      });

      expect(dockerfile).toContain('RUN npm install --save express@4.18.0');
      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/node:18-alpine AS deps');
    });

    test('should handle pnpm package manager', () => {
      const dockerfile = buildEsDockerfile({
        dependencies: [{ name: 'lodash', version: '4.17.21' }],
        packageManager: 'pnpm',
        requiresGlibcBinaries: false,
        nodeVersion: 20
      });

      expect(dockerfile).toContain('RUN npm install -g pnpm');
      expect(dockerfile).toContain('RUN pnpm add lodash@4.17.21');
    });

    test('should handle yarn package manager', () => {
      const dockerfile = buildEsDockerfile({
        dependencies: [{ name: 'react', version: '18.0.0' }],
        packageManager: 'yarn',
        requiresGlibcBinaries: false,
        nodeVersion: 20
      });

      expect(dockerfile).toContain('RUN command -v yarn');
      expect(dockerfile).toContain('RUN yarn add react@18.0.0');
    });

    test('should use glibc image when required', () => {
      const dockerfile = buildEsDockerfile({
        dependencies: [{ name: 'sharp', version: '0.32.0' }],
        packageManager: 'npm',
        requiresGlibcBinaries: true,
        nodeVersion: 20
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/node:20');
      expect(dockerfile).not.toContain('-alpine');
      expect(dockerfile).toContain('apt-get');
    });

    test('should include custom Docker build commands', () => {
      const dockerfile = buildEsDockerfile({
        dependencies: [],
        packageManager: 'npm',
        requiresGlibcBinaries: false,
        nodeVersion: 20,
        customDockerBuildCommands: ['apk add --no-cache git', 'npm install -g typescript']
      });

      expect(dockerfile).toContain('RUN apk add --no-cache git');
      expect(dockerfile).toContain('RUN npm install -g typescript');
    });
  });

  describe('buildEsBinInstallerDockerfile', () => {
    test('should build binary installer Dockerfile', () => {
      const dockerfile = buildEsBinInstallerDockerfile({
        installationDirName: 'node_modules',
        packageManager: 'npm',
        lambdaRuntimeVersion: 20,
        dependencies: [{ name: 'aws-sdk', version: '2.1400.0' }]
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/sam/build-nodejs20.x AS build');
      expect(dockerfile).toContain('RUN mkdir /node_modules');
      expect(dockerfile).toContain('RUN npm install --save aws-sdk@2.1400.0');
      expect(dockerfile).toContain('FROM scratch AS artifact');
    });
  });

  describe('buildPythonArtifactDockerfile', () => {
    test('should build Python artifact Dockerfile with pip', () => {
      const dockerfile = buildPythonArtifactDockerfile({
        pythonVersion: 3.11,
        packageManager: 'pip'
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/python:3.11');
      expect(dockerfile).toContain('RUN pip install -r requirements.txt --target .');
      expect(dockerfile).not.toContain('pipenv');
      expect(dockerfile).not.toContain('poetry');
    });

    test('should handle pipenv package manager', () => {
      const dockerfile = buildPythonArtifactDockerfile({
        pythonVersion: 3.10,
        packageManager: 'pipenv'
      });

      expect(dockerfile).toContain('RUN pip install pipenv');
      expect(dockerfile).toContain('RUN pipenv lock -r');
    });

    test('should handle poetry package manager', () => {
      const dockerfile = buildPythonArtifactDockerfile({
        pythonVersion: 3.12,
        packageManager: 'poetry'
      });

      expect(dockerfile).toContain('RUN pip install "poetry<2.0.0"');
      expect(dockerfile).toContain('RUN poetry export');
    });

    test('should include minification when requested', () => {
      const dockerfile = buildPythonArtifactDockerfile({
        pythonVersion: 3.11,
        packageManager: 'pip',
        minify: true
      });

      expect(dockerfile).toContain('RUN pip install python-minifier');
      expect(dockerfile).toContain('RUN pyminify . --in-place');
    });

    test('should use alpine variant when specified', () => {
      const dockerfile = buildPythonArtifactDockerfile({
        pythonVersion: 3.11,
        packageManager: 'pip',
        alpine: true
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/python:3.11-alpine');
    });
  });

  describe('buildJavaArtifactDockerfile', () => {
    test('should build Java artifact Dockerfile', () => {
      const dockerfile = buildJavaArtifactDockerfile({
        javaVersion: 17
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/gradle:7.5.1-jdk17');
      expect(dockerfile).toContain('RUN gradle stacktapeDist');
      expect(dockerfile).not.toContain('gradle init --type pom');
    });

    test('should convert Maven to Gradle when useMaven is true', () => {
      const dockerfile = buildJavaArtifactDockerfile({
        javaVersion: 11,
        useMaven: true
      });

      expect(dockerfile).toContain('RUN "1\\nno\\n" | gradle init --type pom');
    });

    test('should use alpine variant', () => {
      const dockerfile = buildJavaArtifactDockerfile({
        javaVersion: 21,
        alpine: true
      });

      expect(dockerfile).toContain('jdk21-alpine');
    });
  });

  describe('buildGoArtifactDockerfile', () => {
    test('should build Go artifact Dockerfile', () => {
      const dockerfile = buildGoArtifactDockerfile({
        alpine: false
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/golang');
      expect(dockerfile).toContain('RUN go get github.com/aws/aws-lambda-go/lambda');
      expect(dockerfile).toContain('RUN GOOS=linux GOARCH=amd64 go build -o bootstrap main.go');
    });

    test('should use alpine variant', () => {
      const dockerfile = buildGoArtifactDockerfile({
        alpine: true
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/golang:alpine');
    });
  });

  describe('buildPythonDockerfile', () => {
    test('should build Python runtime Dockerfile', () => {
      const dockerfile = buildPythonDockerfile({
        pythonVersion: 3.11,
        entryfilePath: '/app/main.py'
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/python:3.11');
      expect(dockerfile).toContain('CMD ["python", "main.py"]');
    });

    test('should configure ASGI server', () => {
      const dockerfile = buildPythonDockerfile({
        pythonVersion: 3.11,
        entryfilePath: '/app/api/main.py',
        packageManagerFile: '/app/pyproject.toml',
        runAppAs: 'ASGI',
        handler: 'app'
      });

      expect(dockerfile).toContain('RUN pip install uvicorn');
      expect(dockerfile).toContain('CMD python -m uvicorn');
      expect(dockerfile).toContain(':app');
    });

    test('should configure WSGI server', () => {
      const dockerfile = buildPythonDockerfile({
        pythonVersion: 3.10,
        entryfilePath: '/app/wsgi.py',
        runAppAs: 'WSGI',
        handler: 'application'
      });

      expect(dockerfile).toContain('RUN pip install gunicorn');
      expect(dockerfile).toContain('CMD python -m gunicorn');
    });
  });

  describe('buildJavaDockerfile', () => {
    test('should build Java runtime Dockerfile', () => {
      const dockerfile = buildJavaDockerfile({
        javaVersion: 17,
        entryfilePath: '/app/com/example/Main.java'
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/gradle:7.5.1-jdk17');
      expect(dockerfile).toContain('CMD java -classpath');
    });

    test('should include custom Docker commands', () => {
      const dockerfile = buildJavaDockerfile({
        javaVersion: 11,
        entryfilePath: '/app/Main.java',
        customDockerBuildCommands: ['apt-get update', 'apt-get install -y curl']
      });

      expect(dockerfile).toContain('RUN apt-get update');
      expect(dockerfile).toContain('RUN apt-get install -y curl');
    });
  });

  describe('buildGoDockerfile', () => {
    test('should build Go runtime Dockerfile', () => {
      const dockerfile = buildGoDockerfile({
        entryfilePath: '/app/main.go',
        alpine: false
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/golang');
      expect(dockerfile).toContain('CMD go run main.go');
    });

    test('should use alpine variant', () => {
      const dockerfile = buildGoDockerfile({
        entryfilePath: '/app/cmd/server/main.go',
        alpine: true
      });

      expect(dockerfile).toContain('FROM public.ecr.aws/docker/library/golang:alpine');
    });

    test('should include custom build commands', () => {
      const dockerfile = buildGoDockerfile({
        entryfilePath: '/app/main.go',
        alpine: false,
        customDockerBuildCommands: ['go get -u golang.org/x/tools/...']
      });

      expect(dockerfile).toContain('RUN go get -u golang.org/x/tools/...');
    });
  });
});
