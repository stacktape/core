import { describe, expect, test } from 'bun:test';
import { outputNames } from './stack-output-names';

describe('stack-output-names', () => {
  test('should return deployment version output name', () => {
    expect(outputNames.deploymentVersion()).toBe('StpDeploymentVersion');
  });

  test('should return stack info map output name', () => {
    expect(outputNames.stackInfoMap()).toBe('StpStackInfoMap');
  });

  test('all output names should start with Stp prefix', () => {
    expect(outputNames.deploymentVersion()).toMatch(/^Stp/);
    expect(outputNames.stackInfoMap()).toMatch(/^Stp/);
  });

  test('all functions should return consistent values', () => {
    expect(outputNames.deploymentVersion()).toBe(outputNames.deploymentVersion());
    expect(outputNames.stackInfoMap()).toBe(outputNames.stackInfoMap());
  });
});
