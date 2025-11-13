import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:readline', () => ({
  default: {
    createInterface: mock(() => ({
      on: mock((event: string, handler: Function) => {
        if (event === 'line') {
          setTimeout(() => handler('Waiting for connections...'), 100);
        }
        return { on: mock() };
      })
    }))
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    region: 'us-east-1',
    userData: { id: 'user-123' }
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e96: mock((props: any) => new Error(`Tunnel error: ${props.err.message}`)),
    e130: mock((props: any) => new Error(`Port ${props.port} already in use`))
  }
}));

mock.module('@shared/naming/utils', () => ({
  injectedParameterEnvVarName: mock((stpName: string, paramName: string) => `STP_${stpName}_${paramName}`)
}));

mock.module('@shared/utils/misc', () => ({
  wait: mock(async (ms: number) => new Promise((resolve) => setTimeout(resolve, 10)))
}));

mock.module('@shared/utils/ports', () => ({
  isPortInUse: mock(async () => false)
}));

mock.module('@shared/utils/session-manager-exec', () => ({
  sessionManagerPath: '/usr/local/bin/session-manager-plugin'
}));

mock.module('execa', () => ({
  default: mock(() => ({
    stdout: { pipe: mock(), on: mock() },
    stderr: { pipe: mock() },
    kill: mock(),
    exitCode: 0
  }))
}));

mock.module('find-free-ports', () => ({
  default: mock(async (count: number) => Array.from({ length: count }, (_, i) => 50000 + i))
}));

mock.module('p-retry', () => ({
  default: mock(async (fn: Function) => fn())
}));

mock.module('./aws-sdk-manager', () => ({
  awsSdkManager: {
    startSsmSession: mock(async () => ({ SessionId: 'session-123' })),
    terminateSsmSession: mock(async () => {}),
    startEcsExecSsmSession: mock(async () => ({ SessionId: 'ecs-session-123' })),
    startSsmShellScript: mock(async () => ({ Command: { CommandId: 'cmd-123' } })),
    getSsmShellScriptExecution: mock(async () => ({
      Status: 'Success',
      RequestedDateTime: new Date(),
      CommandId: 'cmd-123'
    }))
  }
}));

mock.module('./cloudwatch-logs', () => ({
  SsmExecuteScriptCloudwatchLogPrinter: mock(
    class {
      printLogs = mock(async () => {});
    }
  )
}));

mock.module('./printer', () => ({
  printer: {
    debug: mock()
  }
}));

describe('ssm-session', () => {
  beforeEach(() => {
    mock.restore();
  });

  describe('SsmPortForwardingTunnel', () => {
    test('should create tunnel instance', async () => {
      const { SsmPortForwardingTunnel } = await import('./ssm-session');

      const tunnel = new SsmPortForwardingTunnel({
        localPort: 5000,
        targetInfo: {
          bastionInstanceId: 'i-123456',
          remoteHost: 'db.example.com',
          remotePort: 5432,
          targetStpName: 'myDatabase',
          affectedReferencableParams: ['connectionString']
        }
      });

      expect(tunnel.localPort).toBe(5000);
      expect(tunnel.remoteHost).toBe('db.example.com');
      expect(tunnel.remotePort).toBe(5432);
    });

    test('should connect tunnel', async () => {
      const { SsmPortForwardingTunnel } = await import('./ssm-session');
      const { awsSdkManager } = await import('./aws-sdk-manager');

      const tunnel = new SsmPortForwardingTunnel({
        localPort: 5000,
        targetInfo: {
          bastionInstanceId: 'i-123456',
          remoteHost: 'db.example.com',
          remotePort: 5432,
          targetStpName: 'myDatabase',
          affectedReferencableParams: []
        }
      });

      await tunnel.connect();

      expect(awsSdkManager.startSsmSession).toHaveBeenCalled();
    });
  });

  describe('runBastionSsmShellSession', () => {
    test('should start bastion shell session', async () => {
      const { runBastionSsmShellSession } = await import('./ssm-session');
      const { awsSdkManager } = await import('./aws-sdk-manager');

      await runBastionSsmShellSession({
        instanceId: 'i-123456',
        region: 'us-east-1'
      });

      expect(awsSdkManager.startSsmSession).toHaveBeenCalled();
      expect(awsSdkManager.terminateSsmSession).toHaveBeenCalled();
    });
  });

  describe('runEcsExecSsmShellSession', () => {
    test('should start ECS exec session', async () => {
      const { runEcsExecSsmShellSession } = await import('./ssm-session');
      const { awsSdkManager } = await import('./aws-sdk-manager');

      const task = {
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/cluster/task-id',
        clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster',
        containers: [{ name: 'web', runtimeId: 'runtime-123' }]
      };

      await runEcsExecSsmShellSession({
        task: task as any,
        containerName: 'web',
        region: 'us-east-1'
      });

      expect(awsSdkManager.startEcsExecSsmSession).toHaveBeenCalled();
      expect(awsSdkManager.terminateSsmSession).toHaveBeenCalled();
    });

    test('should use default shell command', async () => {
      const { runEcsExecSsmShellSession } = await import('./ssm-session');
      const { awsSdkManager } = await import('./aws-sdk-manager');

      const task = {
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/cluster/task-id',
        clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster',
        containers: [{ name: 'web', runtimeId: 'runtime-123' }]
      };

      await runEcsExecSsmShellSession({
        task: task as any,
        containerName: 'web',
        region: 'us-east-1'
      });

      const callArgs = (awsSdkManager.startEcsExecSsmSession as any).mock.calls[0][0];
      expect(callArgs.command).toBe('/bin/sh');
    });
  });

  describe('runSsmShellScript', () => {
    test('should run shell script via SSM', async () => {
      const { runSsmShellScript } = await import('./ssm-session');
      const { awsSdkManager } = await import('./aws-sdk-manager');

      await runSsmShellScript({
        instanceId: 'i-123456',
        commands: ['echo "Hello"', 'ls -la'],
        env: { NODE_ENV: 'production' }
      });

      expect(awsSdkManager.startSsmShellScript).toHaveBeenCalled();
      expect(awsSdkManager.getSsmShellScriptExecution).toHaveBeenCalled();
    });
  });

  describe('startPortForwardingSessions', () => {
    test('should start port forwarding sessions', async () => {
      const { startPortForwardingSessions } = await import('./ssm-session');

      const targets = [
        {
          bastionInstanceId: 'i-123',
          remoteHost: 'db1.example.com',
          remotePort: 5432,
          targetStpName: 'db1',
          affectedReferencableParams: []
        },
        {
          bastionInstanceId: 'i-456',
          remoteHost: 'db2.example.com',
          remotePort: 3306,
          targetStpName: 'db2',
          affectedReferencableParams: []
        }
      ];

      const tunnels = await startPortForwardingSessions({ targets });

      expect(tunnels).toHaveLength(2);
      expect(tunnels[0].remoteHost).toBe('db1.example.com');
      expect(tunnels[1].remoteHost).toBe('db2.example.com');
    });

    test('should use specified start port', async () => {
      const { startPortForwardingSessions } = await import('./ssm-session');

      const targets = [
        {
          bastionInstanceId: 'i-123',
          remoteHost: 'db.example.com',
          remotePort: 5432,
          targetStpName: 'db',
          affectedReferencableParams: []
        }
      ];

      const tunnels = await startPortForwardingSessions({
        targets,
        startAtPort: 6000
      });

      expect(tunnels[0].localPort).toBe(6000);
    });
  });

  describe('substituteTunneledEndpointsInEnvironmentVars', () => {
    test('should substitute tunneled endpoints in env vars', async () => {
      const { substituteTunneledEndpointsInEnvironmentVars, SsmPortForwardingTunnel } = await import('./ssm-session');

      const tunnel = new SsmPortForwardingTunnel({
        localPort: 5000,
        targetInfo: {
          bastionInstanceId: 'i-123',
          remoteHost: 'db.example.com',
          remotePort: 5432,
          targetStpName: 'myDatabase',
          affectedReferencableParams: ['connectionString']
        }
      });

      const env = [
        { name: 'STP_myDatabase_connectionString', value: 'postgresql://db.example.com:5432/mydb' }
      ];

      const result = substituteTunneledEndpointsInEnvironmentVars({
        tunnels: [tunnel],
        env
      });

      expect(result[0].value).toContain('127.0.0.1:5000');
    });
  });
});
