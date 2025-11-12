import { describe, expect, mock, test, spyOn, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {}
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    makeBold: mock((text: string) => `**${text}**`),
    colorize: mock((color: string, text: string) => `[${color}]${text}[/${color}]`),
    getLink: mock((name: string, label: string) => `${label} (${name})`)
  }
}));

mock.module('marked', () => ({
  marked: Object.assign(
    mock((text: string) => text),
    {
      use: mock(() => {})
    }
  )
}));

mock.module('marked-terminal', () => ({
  markedTerminal: mock(() => ({}))
}));

// Mock the JSON import
const mockCommandsInfo = {
  deploy: {
    description: 'Deploy your stack to AWS',
    args: {
      '--region': {
        description: 'AWS region to deploy to',
        required: true
      },
      '--stage': {
        description: 'Stage name',
        required: false
      }
    }
  },
  delete: {
    description: 'Delete your stack from AWS',
    args: {
      '--region': {
        description: 'AWS region',
        required: true
      }
    }
  }
};

mock.module('../../../@generated/schemas/cli-schema.json', () => mockCommandsInfo);

describe('help command', () => {
  let consoleInfoSpy: any;

  beforeEach(() => {
    consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});
  });

  test('should show all commands when no specific command is requested', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {};

    const { commandHelp } = await import('./index');
    await commandHelp();

    expect(consoleInfoSpy).toHaveBeenCalled();
    const output = consoleInfoSpy.mock.calls.map((call: any) => call[0]).join(' ');
    expect(output).toContain('Available commands');
    expect(output).toContain('deploy');
    expect(output).toContain('delete');
  });

  test('should show specific command details when command is specified', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = { command: 'deploy' };

    const { commandHelp } = await import('./index');
    await commandHelp();

    expect(consoleInfoSpy).toHaveBeenCalled();
    const output = consoleInfoSpy.mock.calls.map((call: any) => call[0]).join(' ');
    expect(output).toContain('Options');
    expect(output).toContain('--region');
    expect(output).toContain('--stage');
  });
});
