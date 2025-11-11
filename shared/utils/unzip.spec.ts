import { describe, expect, mock, test } from 'bun:test';

// Mock yauzl
const mockZipFile = {
  readEntry: mock(() => {}),
  on: mock(function (event, callback) {
    if (event === 'end') {
      setTimeout(callback, 10);
    }
    return this;
  }),
  openReadStream: mock((entry, callback) => {
    const mockStream = {
      pipe: mock(() => mockStream),
      on: mock(() => mockStream)
    };
    callback(null, mockStream);
  })
};

mock.module('yauzl', () => ({
  default: {
    open: mock((path, options, callback) => {
      callback(null, mockZipFile);
    })
  }
}));

mock.module('fs-extra', () => ({
  createWriteStream: mock(() => ({
    on: mock(function (event, callback) {
      if (event === 'close') {
        setTimeout(callback, 5);
      }
      return this;
    })
  })),
  ensureDirSync: mock(() => {})
}));

describe('unzip', () => {
  test('should unzip file to output directory', async () => {
    const { unzip } = await import('./unzip');
    const result = await unzip({
      zipFilePath: '/path/to/file.zip',
      outputDir: '/output/dir'
    });

    expect(result).toBeDefined();
    expect(result.outputDirPath).toBeDefined();
  });

  test('should filter files by extension', async () => {
    const { unzip } = await import('./unzip');
    await unzip({
      zipFilePath: '/path/to/file.zip',
      outputDir: '/output/dir',
      filterExts: ['.ts', '.js']
    });

    expect(mockZipFile.readEntry).toHaveBeenCalled();
  });

  test('should handle empty filter extensions', async () => {
    const { unzip } = await import('./unzip');
    await unzip({
      zipFilePath: '/path/to/file.zip',
      outputDir: '/output/dir',
      filterExts: []
    });

    expect(mockZipFile.readEntry).toHaveBeenCalled();
  });
});
