import { describe, expect, mock, test } from 'bun:test';

// Mock AWS SDK S3
mock.module('@aws-sdk/client-s3', () => ({
  S3: mock(function (config: any) {
    this.config = config;
    this.middlewareStack = {
      use: mock(() => {})
    };
    this.putObject = mock((params, callback) => {
      setTimeout(() => callback(null, { ETag: '"abc123"' }), 10);
    });
    this.getObject = mock((params) => ({
      on: mock(function (event, handler) {
        if (event === 'httpHeaders') {
          setTimeout(() => handler(200, { 'content-length': '100', etag: '"abc123"' }, {
            httpResponse: {
              createUnbufferedStream: () => {
                const PassThrough = require('node:stream').PassThrough;
                const stream = new PassThrough();
                setTimeout(() => {
                  stream.write(Buffer.from('test data'));
                  stream.end();
                }, 10);
                return stream;
              }
            }
          }), 10);
        }
        return this;
      }),
      send: mock((callback) => {
        if (callback) callback();
      })
    }));
    this.listObjects = mock((params, callback) => {
      setTimeout(() => callback(null, {
        Contents: [
          { Key: 'file1.txt', Size: 100, ETag: '"abc123"' }
        ],
        IsTruncated: false
      }), 10);
    });
    this.deleteObjects = mock((params, callback) => {
      setTimeout(() => callback(null, { Deleted: [] }), 10);
    });
    this.createMultipartUpload = mock((params, callback) => {
      setTimeout(() => callback(null, { UploadId: 'upload-123' }), 10);
    });
    this.uploadPart = mock((params, callback) => {
      setTimeout(() => callback(null, { ETag: '"part-abc"' }), 10);
    });
    this.completeMultipartUpload = mock((params, callback) => {
      setTimeout(() => callback(null, { Location: 's3://bucket/key' }), 10);
    });
    this.copyObject = mock((params, callback) => {
      setTimeout(() => callback(null, { CopyObjectResult: {} }), 10);
    });
  })
}));

// Mock other dependencies
mock.module('@shared/utils/misc', () => ({
  Pend: mock(function (opts: any = {}) {
    this.max = opts.max || Infinity;
    this.pending = 0;
    this.callbacks = [];

    this.go = (fn) => {
      fn(() => {});
    };

    this.hold = () => {
      return () => {};
    };

    this.wait = (cb) => {
      if (cb) cb();
    };
  }),
  stringMatchesGlob: mock(() => false)
}));

mock.module('fd-slicer', () => ({
  default: {
    createFromFd: mock(() => ({
      on: mock(function () {
        return this;
      }),
      ref: mock(() => {}),
      unref: mock(() => {}),
      createReadStream: mock(() => {
        const PassThrough = require('node:stream').PassThrough;
        const stream = new PassThrough();
        setTimeout(() => {
          stream.write(Buffer.from('test'));
          stream.end();
        }, 10);
        return stream;
      })
    }))
  }
}));

mock.module('findit2', () => ({
  default: mock(() => ({
    on: mock(function () {
      return this;
    }),
    stop: mock(() => {})
  }))
}));

mock.module('mime', () => ({
  default: {
    getType: mock(() => 'application/octet-stream')
  }
}));

mock.module('fs-extra', () => ({
  mkdirp: mock(async (dir, cb) => cb?.()),
  remove: mock(async (path, cb) => cb?.())
}));

mock.module('streamsink', () => ({
  default: mock(function () {
    this.toBuffer = () => Buffer.from('test data');
    this.on = mock(function (event, handler) {
      if (event === 'finish') {
        setTimeout(handler, 10);
      }
      return this;
    });
    this.write = mock(() => {});
  })
}));

describe('s3-sync/index', () => {
  describe('S3Sync constructor', () => {
    test('should create S3Sync instance', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      expect(client).toBeDefined();
      expect(client.s3).toBeDefined();
    });

    test('should apply middleware plugins', async () => {
      const { S3Sync } = await import('./index');
      const plugin = { applyToStack: mock(() => {}) };

      new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: [plugin]
      });

      expect(plugin.applyToStack).toHaveBeenCalled();
    });

    test('should set default multipart thresholds', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      expect(client.multipartUploadThreshold).toBeGreaterThan(0);
      expect(client.multipartUploadSize).toBeGreaterThan(0);
    });

    test('should throw error for invalid multipart upload threshold', async () => {
      const { S3Sync } = await import('./index');

      expect(() => {
        new S3Sync({
          clientArgs: { region: 'us-east-1' },
          s3Plugins: [],
          multipartUploadThreshold: 1024 // Too small
        });
      }).toThrow();
    });
  });

  describe('deleteObjects', () => {
    test('should delete objects from S3', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const deleter = client.deleteObjects({
        Bucket: 'test-bucket',
        Delete: {
          Objects: [{ Key: 'file1.txt' }]
        }
      });

      expect(deleter).toBeDefined();
      expect(deleter.on).toBeDefined();
    });

    test('should emit end event after deletion', (done) => {
      (async () => {
        const { S3Sync } = await import('./index');

        const client = new S3Sync({
          clientArgs: { region: 'us-east-1' },
          s3Plugins: []
        });

        const deleter = client.deleteObjects({
          Bucket: 'test-bucket',
          Delete: {
            Objects: [{ Key: 'file1.txt' }]
          }
        });

        deleter.on('end', () => {
          done();
        });
      })();
    });
  });

  describe('listObjects', () => {
    test('should list objects in S3 bucket', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const lister = client.listObjects({
        s3Params: {
          Bucket: 'test-bucket',
          Prefix: 'folder/'
        },
        recursive: true
      });

      expect(lister).toBeDefined();
      expect(lister.on).toBeDefined();
    });

    test('should emit data event with objects', (done) => {
      (async () => {
        const { S3Sync } = await import('./index');

        const client = new S3Sync({
          clientArgs: { region: 'us-east-1' },
          s3Plugins: []
        });

        const lister = client.listObjects({
          s3Params: {
            Bucket: 'test-bucket'
          },
          recursive: false
        });

        lister.on('data', (data: any) => {
          expect(data.Contents).toBeDefined();
          done();
        });
      })();
    });
  });

  describe('downloadBuffer', () => {
    test('should download file to buffer', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const downloader = client.downloadBuffer({
        Bucket: 'test-bucket',
        Key: 'file.txt'
      });

      expect(downloader).toBeDefined();
      expect(downloader.on).toBeDefined();
    });

    test('should emit end event with buffer', (done) => {
      (async () => {
        const { S3Sync } = await import('./index');

        const client = new S3Sync({
          clientArgs: { region: 'us-east-1' },
          s3Plugins: []
        });

        const downloader = client.downloadBuffer({
          Bucket: 'test-bucket',
          Key: 'file.txt'
        });

        downloader.on('end', (buffer: Buffer) => {
          expect(Buffer.isBuffer(buffer)).toBe(true);
          done();
        });
      })();
    });
  });

  describe('copyObject', () => {
    test('should copy object in S3', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const copier = client.copyObject({
        Bucket: 'dest-bucket',
        CopySource: 'source-bucket/file.txt',
        Key: 'file.txt'
      });

      expect(copier).toBeDefined();
      expect(copier.on).toBeDefined();
    });

    test('should emit end event after copy', (done) => {
      (async () => {
        const { S3Sync } = await import('./index');

        const client = new S3Sync({
          clientArgs: { region: 'us-east-1' },
          s3Plugins: []
        });

        const copier = client.copyObject({
          Bucket: 'dest-bucket',
          CopySource: 'source-bucket/file.txt',
          Key: 'file.txt'
        });

        copier.on('end', () => {
          done();
        });
      })();
    });
  });

  describe('moveObject', () => {
    test('should move object in S3', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const mover = client.moveObject({
        Bucket: 'dest-bucket',
        CopySource: 'source-bucket/file.txt',
        Key: 'file.txt'
      });

      expect(mover).toBeDefined();
      expect(mover.on).toBeDefined();
    });
  });

  describe('deleteDir', () => {
    test('should delete directory in S3', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const deleter = client.deleteDir({
        Bucket: 'test-bucket',
        Prefix: 'folder/'
      });

      expect(deleter).toBeDefined();
      expect(deleter.on).toBeDefined();
    });
  });

  describe('uploadDir', () => {
    test('should upload directory to S3', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const uploader = client.uploadDir({
        localDir: '/local/dir',
        s3Params: {
          Bucket: 'test-bucket',
          Prefix: 'uploads/'
        }
      });

      expect(uploader).toBeDefined();
      expect(uploader.on).toBeDefined();
    });
  });

  describe('downloadDir', () => {
    test('should download directory from S3', async () => {
      const { S3Sync } = await import('./index');

      const client = new S3Sync({
        clientArgs: { region: 'us-east-1' },
        s3Plugins: []
      });

      const downloader = client.downloadDir({
        localDir: '/local/dir',
        s3Params: {
          Bucket: 'test-bucket',
          Prefix: 'downloads/'
        }
      });

      expect(downloader).toBeDefined();
      expect(downloader.on).toBeDefined();
    });
  });
});
