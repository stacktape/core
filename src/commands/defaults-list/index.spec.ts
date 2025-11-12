import { describe, expect, mock, test, spyOn, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    persistedState: {
      cliArgsDefaults: {},
      otherDefaults: {}
    }
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {}),
    makeBold: mock((text: string) => `**${text}**`),
    colorize: mock((color: string, text: string) => `[${color}]${text}[/${color}]`)
  }
}));

describe('defaults-list command', () => {
  let consoleInfoSpy: any;

  beforeEach(() => {
    consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});
  });

  test('should display message when no defaults are configured', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');
    globalStateManager.persistedState = {
      cliArgsDefaults: {},
      otherDefaults: {}
    };

    const { commandDefaultsList } = await import('./index');
    await commandDefaultsList();

    expect(printer.info).toHaveBeenCalledWith('No defaults are configured on this system');
  });

  test('should display CLI arg defaults', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.persistedState = {
      cliArgsDefaults: {
        region: 'us-east-1',
        stage: 'dev'
      },
      otherDefaults: {}
    };

    const { commandDefaultsList } = await import('./index');
    await commandDefaultsList();

    expect(consoleInfoSpy).toHaveBeenCalled();
    const output = consoleInfoSpy.mock.calls.map((call: any) => call[0]).join(' ');
    expect(output).toContain('Configured defaults');
    expect(output).toContain('region');
    expect(output).toContain('stage');
  });

  test('should display other defaults', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.persistedState = {
      cliArgsDefaults: {},
      otherDefaults: {
        awsProfile: 'my-profile',
        projectName: 'my-project'
      }
    };

    const { commandDefaultsList } = await import('./index');
    await commandDefaultsList();

    expect(consoleInfoSpy).toHaveBeenCalled();
    const output = consoleInfoSpy.mock.calls.map((call: any) => call[0]).join(' ');
    expect(output).toContain('awsProfile');
    expect(output).toContain('projectName');
  });

  test('should merge CLI args defaults and other defaults', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.persistedState = {
      cliArgsDefaults: {
        region: 'us-west-2'
      },
      otherDefaults: {
        awsProfile: 'production'
      }
    };

    const { commandDefaultsList } = await import('./index');
    await commandDefaultsList();

    expect(consoleInfoSpy).toHaveBeenCalled();
    const output = consoleInfoSpy.mock.calls.map((call: any) => call[0]).join(' ');
    expect(output).toContain('region');
    expect(output).toContain('awsProfile');
  });
});
