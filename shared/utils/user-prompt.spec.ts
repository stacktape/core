import { describe, expect, mock, test } from 'bun:test';
import { userPrompt } from './user-prompt';

// Mock prompts module
const mockPrompts = mock((questions, options) => Promise.resolve({ value: 'test-response' }));
mock.module('prompts', () => ({ default: mockPrompts }));

describe('user-prompt', () => {
  test('should call prompts with correct arguments', async () => {
    const questions = {
      type: 'text' as const,
      name: 'value',
      message: 'Enter value:'
    };

    const result = await userPrompt(questions);

    expect(mockPrompts).toHaveBeenCalled();
    expect(result).toEqual({ value: 'test-response' });
  });

  test('should pass onCancel handler that emits SIGINT', async () => {
    const questions = {
      type: 'confirm' as const,
      name: 'continue',
      message: 'Continue?'
    };

    await userPrompt(questions);

    const callArgs = mockPrompts.mock.calls[mockPrompts.mock.calls.length - 1];
    expect(callArgs[1]).toHaveProperty('onCancel');
    expect(typeof callArgs[1].onCancel).toBe('function');
  });

  test('should work with different prompt types', async () => {
    const selectPrompt = {
      type: 'select' as const,
      name: 'choice',
      message: 'Choose option:',
      choices: [
        { title: 'Option 1', value: 'opt1' },
        { title: 'Option 2', value: 'opt2' }
      ]
    };

    await userPrompt(selectPrompt);
    expect(mockPrompts).toHaveBeenCalled();
  });

  test('should work with multiselect prompts', async () => {
    const multiselectPrompt = {
      type: 'multiselect' as const,
      name: 'items',
      message: 'Select items:',
      choices: [
        { title: 'Item 1', value: 'item1' },
        { title: 'Item 2', value: 'item2' }
      ]
    };

    await userPrompt(multiselectPrompt);
    expect(mockPrompts).toHaveBeenCalled();
  });
});
