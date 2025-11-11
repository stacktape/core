/* eslint-disable @typescript-eslint/no-this-alias */
// @ts-nocheck
// ORIGINALLY this repo https://github.com/auth0/node-s3-client

import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import url from 'node:url';
import { S3 } from '@aws-sdk/client-s3';
import { Pend, stringMatchesGlob } from '@shared/utils/misc';
import fdSlicer from 'fd-slicer';
import findit from 'findit2';
import fsExtra from 'fs-extra';
import mime from 'mime';
import StreamSink from 'streamsink';
import { MultipartETag } from './multipart-etag';

const { mkdirp, remove } = fsExtra;
const MAX_PUTOBJECT_SIZE = 5 * 1024 * 1024 * 1024;
const MAX_DELETE_COUNT = 1000;
const MAX_MULTIPART_COUNT = 10000;
const MIN_MULTIPART_SIZE = 5 * 1024 * 1024;

const TO_UNIX_RE = new RegExp(quotemeta(path.sep), 'g');

type ClientType = {
  s3: S3;
  s3Pend: Pend;
  s3RetryCount: number;
  s3RetryDelay: number;
  multipartUploadThreshold: number;
  multipartUploadSize: number;
  multipartDownloadThreshold: number;
  multipartDownloadSize: number;
};

export function S3Sync(options) {
  this.s3 = new S3(options.clientArgs);
  options.s3Plugins.forEach((plugin) => {
    this.s3.middlewareStack.use(plugin);
  });
  // this.s3.middlewareStack.add(
  //   (next) => async (args) => {
  //     delete args.request.headers['content-type'];
  //     return next(args);
  //   },
  //   { step: 'build' }
  // );
  this.s3Pend = new Pend({ max: 20 });
  this.s3RetryCount = options.s3RetryCount || 3;
  this.s3RetryDelay = options.s3RetryDelay || 1000;
  this.multipartUploadThreshold = options.multipartUploadThreshold || 20 * 1024 * 1024;
  this.multipartUploadSize = options.multipartUploadSize || 15 * 1024 * 1024;
  this.multipartDownloadThreshold = options.multipartDownloadThreshold || 20 * 1024 * 1024;
  this.multipartDownloadSize = options.multipartDownloadSize || 15 * 1024 * 1024;

  if (this.multipartUploadThreshold < MIN_MULTIPART_SIZE) {
    throw new Error('Minimum multipartUploadThreshold is 5MB.');
  }
  if (this.multipartUploadThreshold > MAX_PUTOBJECT_SIZE) {
    throw new Error('Maximum multipartUploadThreshold is 5GB.');
  }
  if (this.multipartUploadSize < MIN_MULTIPART_SIZE) {
    throw new Error('Minimum multipartUploadSize is 5MB.');
  }
  if (this.multipartUploadSize > MAX_PUTOBJECT_SIZE) {
    throw new Error('Maximum multipartUploadSize is 5GB.');
  }
}

S3Sync.prototype.deleteObjects = function (s3Params) {
  const self: ClientType = this;
  const ee = new EventEmitter();

  const params = {
    Bucket: s3Params.Bucket,
    Delete: extend({}, s3Params.Delete),
    MFA: s3Params.MFA
  };
  const slices = chunkArray(params.Delete.Objects, MAX_DELETE_COUNT);
  const pend = new Pend();

  ee.progressAmount = 0;
  ee.progressTotal = params.Delete.Objects.length;

  slices.forEach(uploadSlice);
  pend.wait((err) => {
    if (err) {
      ee.emit('error', err);
      return;
    }
    ee.emit('end');
  });
  return ee;

  function uploadSlice(slice) {
    pend.go((cb) => {
      doWithRetry(tryDeletingObjects, self.s3RetryCount, self.s3RetryDelay, (err, data) => {
        if (err) {
          cb(err);
        } else {
          ee.progressAmount += slice.length;
          ee.emit('progress');
          ee.emit('data', data);
          cb();
        }
      });
    });

    function tryDeletingObjects(cb) {
      self.s3Pend.go((pendCb) => {
        params.Delete.Objects = slice;
        self.s3.deleteObjects(params, (err, data) => {
          pendCb();
          cb(err, data);
        });
      });
    }
  }
};

S3Sync.prototype.uploadFile = function (params) {
  const self: { s3: S3 } = this;
  const uploader = new EventEmitter();
  uploader.progressMd5Amount = 0;
  uploader.progressAmount = 0;
  uploader.progressTotal = 0;
  uploader.abort = handleAbort;
  uploader.getPublicUrl = function () {
    return getPublicUrl(s3Params.Bucket, s3Params.Key, self.s3.config.region, self.s3.config.endpoint);
  };
  uploader.getPublicUrlHttp = function () {
    return getPublicUrlHttp(s3Params.Bucket, s3Params.Key, self.s3.config.endpoint);
  };

  const localFile = params.localFile;
  let localFileStat = null;
  var s3Params = extend({}, params.s3Params);
  if (s3Params.ContentType === undefined) {
    // const defaultContentType = params.defaultContentType || 'application/octet-stream';
    s3Params.ContentType = mime.getType(localFile);
  }

  let fatalError = false;
  let localFileSlicer = null;
  const parts = [];

  openFile();

  return uploader;

  function handleError(err) {
    if (localFileSlicer) {
      localFileSlicer.unref();
      localFileSlicer = null;
    }
    if (fatalError) {
      return;
    }
    fatalError = true;
    uploader.emit('error', err);
  }

  function handleAbort() {
    fatalError = true;
  }

  function openFile() {
    fs.open(localFile, 'r', (err, fd) => {
      if (err) {
        return handleError(err);
      }
      localFileSlicer = fdSlicer.createFromFd(fd, { autoClose: true });
      localFileSlicer.on('error', handleError);
      localFileSlicer.on('close', () => {
        uploader.emit('fileClosed');
      });

      // keep an extra reference alive until we decide that we're completely
      // done with the file
      localFileSlicer.ref();

      uploader.emit('fileOpened', localFileSlicer);

      fs.fstat(fd, (e, stat) => {
        if (e) {
          return handleError(e);
        }
        localFileStat = stat;
        uploader.progressTotal = stat.size;
        startPuttingObject();
      });
    });
  }

  function startPuttingObject() {
    if (localFileStat.size >= self.multipartUploadThreshold) {
      let multipartUploadSize = self.multipartUploadSize;
      const partsRequiredCount = Math.ceil(localFileStat.size / multipartUploadSize);
      if (partsRequiredCount > MAX_MULTIPART_COUNT) {
        multipartUploadSize = smallestPartSizeFromFileSize(localFileStat.size);
      }
      if (multipartUploadSize > MAX_PUTOBJECT_SIZE) {
        const err = new Error(`File size exceeds maximum object size: ${localFile}`);
        err.retryable = false;
        handleError(err);
        return;
      }
      startMultipartUpload(multipartUploadSize);
    } else {
      doWithRetry(tryPuttingObject, self.s3RetryCount, self.s3RetryDelay, onPutObjectDone);
    }

    function onPutObjectDone(err, data) {
      if (fatalError) {
        return;
      }
      if (err) {
        return handleError(err);
      }
      if (localFileSlicer) {
        localFileSlicer.unref();
        localFileSlicer = null;
      }
      uploader.emit('end', data);
    }
  }

  function startMultipartUpload(multipartUploadSize) {
    doWithRetry(tryCreateMultipartUpload, self.s3RetryCount, self.s3RetryDelay, (err, data) => {
      if (fatalError) {
        return;
      }
      if (err) {
        return handleError(err);
      }
      uploader.emit('data', data);
      s3Params = {
        Bucket: s3Params.Bucket,
        Key: encodeSpecialCharacters(s3Params.Key),
        SSECustomerAlgorithm: s3Params.SSECustomerAlgorithm,
        SSECustomerKey: s3Params.SSECustomerKey,
        SSECustomerKeyMD5: s3Params.SSECustomerKeyMD5
      };
      queueAllParts(data.UploadId, multipartUploadSize);
    });
  }

  function queueAllParts(uploadId, multipartUploadSize) {
    let cursor = 0;
    let nextPartNumber = 1;
    const pend = new Pend();
    while (cursor < localFileStat.size) {
      const start = cursor;
      let end = cursor + multipartUploadSize;
      if (end > localFileStat.size) {
        end = localFileStat.size;
      }
      cursor = end;
      const part = { PartNumber: nextPartNumber++ };
      parts.push(part);
      pend.go(makeUploadPartFn(start, end, part, uploadId));
    }
    pend.wait((err) => {
      if (fatalError) {
        return;
      }
      if (err) {
        return handleError(err);
      }
      completeMultipartUpload();
    });
  }

  function makeUploadPartFn(start, end, part, uploadId) {
    return function (cb) {
      doWithRetry(tryUploadPart, self.s3RetryCount, self.s3RetryDelay, (err, data) => {
        if (fatalError) {
          return;
        }
        if (err) {
          return handleError(err);
        }
        uploader.emit('part', data);
        cb();
      });
    };

    function tryUploadPart(cb) {
      if (fatalError) {
        return;
      }
      self.s3Pend.go((pendCb) => {
        if (fatalError) {
          pendCb();
          return;
        }
        const inStream = localFileSlicer.createReadStream({ start, end });
        let errorOccurred = false;
        inStream.on('error', (err) => {
          if (fatalError || errorOccurred) {
            return;
          }
          handleError(err);
        });
        s3Params.ContentLength = end - start;
        s3Params.PartNumber = part.PartNumber;
        s3Params.UploadId = uploadId;

        const multipartETag = new MultipartETag({ size: s3Params.ContentLength, count: 1 });
        let prevBytes = 0;
        let overallDelta = 0;
        const pend = new Pend();
        const haveETag = pend.hold();
        multipartETag.on('progress', () => {
          if (fatalError || errorOccurred) {
            return;
          }
          const delta = multipartETag.bytes - prevBytes;
          prevBytes = multipartETag.bytes;
          uploader.progressAmount += delta;
          overallDelta += delta;
          uploader.emit('progress');
        });
        multipartETag.on('end', () => {
          if (fatalError || errorOccurred) {
            return;
          }
          const delta = multipartETag.bytes - prevBytes;
          uploader.progressAmount += delta;
          uploader.progressTotal += end - start - multipartETag.bytes;
          uploader.emit('progress');
          haveETag();
        });
        inStream.pipe(multipartETag);
        s3Params.Body = multipartETag;

        self.s3.uploadPart(extend({}, s3Params), (err, data) => {
          pendCb();
          if (fatalError || errorOccurred) {
            return;
          }
          if (err) {
            errorOccurred = true;
            uploader.progressAmount -= overallDelta;
            cb(err);
            return;
          }
          pend.wait(() => {
            if (fatalError) {
              return;
            }
            if (!compareMultipartETag(data.ETag, multipartETag)) {
              errorOccurred = true;
              uploader.progressAmount -= overallDelta;
              cb(new Error('ETag does not match MD5 checksum'));
              return;
            }
            part.ETag = data.ETag;
            cb(null, data);
          });
        });
      });
    }
  }

  function completeMultipartUpload() {
    localFileSlicer.unref();
    localFileSlicer = null;
    doWithRetry(tryCompleteMultipartUpload, self.s3RetryCount, self.s3RetryDelay, (err, data) => {
      if (fatalError) {
        return;
      }
      if (err) {
        return handleError(err);
      }
      uploader.emit('end', data);
    });
  }

  function tryCompleteMultipartUpload(cb) {
    if (fatalError) {
      return;
    }
    self.s3Pend.go((pendCb) => {
      if (fatalError) {
        pendCb();
        return;
      }
      s3Params = {
        Bucket: s3Params.Bucket,
        Key: s3Params.Key,
        UploadId: s3Params.UploadId,
        MultipartUpload: {
          Parts: parts
        }
      };
      self.s3.completeMultipartUpload(s3Params, (err, data) => {
        pendCb();
        if (fatalError) {
          return;
        }
        cb(err, data);
      });
    });
  }

  function tryCreateMultipartUpload(cb) {
    if (fatalError) {
      return;
    }
    self.s3Pend.go((pendCb) => {
      if (fatalError) {
        return pendCb();
      }
      self.s3.createMultipartUpload(s3Params, (err, data) => {
        pendCb();
        if (fatalError) {
          return;
        }
        cb(err, data);
      });
    });
  }

  function tryPuttingObject(cb) {
    self.s3Pend.go((pendCb) => {
      if (fatalError) {
        return pendCb();
      }
      const inStream = localFileSlicer.createReadStream();
      inStream.on('error', handleError);
      const pend = new Pend();
      const multipartETag = new MultipartETag({ size: localFileStat.size, count: 1 });
      pend.go((innerCb) => {
        multipartETag.on('end', () => {
          if (fatalError) {
            return;
          }
          uploader.progressAmount = multipartETag.bytes;
          uploader.progressTotal = multipartETag.bytes;
          uploader.emit('progress');
          localFileStat.size = multipartETag.bytes;
          localFileStat.multipartETag = multipartETag;
          innerCb();
        });
      });
      multipartETag.on('progress', () => {
        if (fatalError) {
          return;
        }
        uploader.progressAmount = multipartETag.bytes;
        uploader.emit('progress');
      });
      s3Params.ContentLength = localFileStat.size;
      uploader.progressAmount = 0;
      inStream.pipe(multipartETag);
      s3Params.Body = multipartETag;
      self.s3.putObject(s3Params, (err, data) => {
        pendCb();
        if (fatalError) {
          return;
        }
        if (err) {
          cb(err);
          return;
        }
        pend.wait(() => {
          if (fatalError) {
            return;
          }
          if (!compareMultipartETag(data.ETag, localFileStat.multipartETag)) {
            cb(new Error('ETag does not match MD5 checksum'));
            return;
          }
          cb(null, data);
        });
      });
    });
  }
};

S3Sync.prototype.downloadFile = function (params) {
  const self: ClientType = this;
  const downloader = new EventEmitter();
  const localFile = params.localFile;
  const s3Params = extend({}, params.s3Params);

  const dirPath = path.dirname(localFile);
  downloader.progressAmount = 0;
  mkdirp(dirPath, (err) => {
    if (err) {
      downloader.emit('error', err);
      return;
    }

    doWithRetry(doDownloadWithPend, self.s3RetryCount, self.s3RetryDelay, (err) => {
      if (err) {
        downloader.emit('error', err);
        return;
      }
      downloader.emit('end');
    });
  });

  return downloader;

  function doDownloadWithPend(cb) {
    self.s3Pend.go((pendCb) => {
      doTheDownload((err) => {
        pendCb();
        cb(err);
      });
    });
  }

  function doTheDownload(cb) {
    const request = self.s3.getObject(s3Params);
    let errorOccurred = false;
    const hashCheckPend = new Pend();

    request.on('httpHeaders', (statusCode, headers, resp) => {
      if (statusCode >= 300) {
        handleError(new Error(`http status code ${statusCode}`));
        return;
      }
      if (headers['content-length'] === undefined) {
        var outStream = fs.createWriteStream(localFile);
        outStream.on('error', handleError);
        downloader.progressTotal = 0;
        downloader.progressAmount = -1;
        request.on('httpData', (chunk) => {
          downloader.progressTotal += chunk.length;
          downloader.progressAmount += chunk.length;
          downloader.emit('progress');
          outStream.write(chunk);
        });

        request.on('httpDone', () => {
          if (errorOccurred) {
            return;
          }
          downloader.progressAmount += 1;
          downloader.emit('progress');
          outStream.end();
          cb();
        });
      } else {
        const contentLength = Number.parseInt(headers['content-length'], 10);
        downloader.progressTotal = contentLength;
        downloader.progressAmount = 0;
        downloader.emit('progress');
        downloader.emit('httpHeaders', statusCode, headers, resp);
        const eTag = cleanETag(headers.etag);
        const eTagCount = getETagCount(eTag);

        var outStream = fs.createWriteStream(localFile);
        const multipartETag = new MultipartETag({ size: contentLength, count: eTagCount });
        const httpStream = resp.httpResponse.createUnbufferedStream();

        httpStream.on('error', handleError);
        outStream.on('error', handleError);

        hashCheckPend.go((cb) => {
          multipartETag.on('end', () => {
            if (multipartETag.bytes !== contentLength) {
              handleError(new Error('Downloaded size does not match Content-Length'));
              return;
            }
            if (eTagCount === 1 && !multipartETag.anyMatch(eTag)) {
              handleError(new Error('ETag does not match MD5 checksum'));
              return;
            }
            cb();
          });
        });
        multipartETag.on('progress', () => {
          downloader.progressAmount = multipartETag.bytes;
          downloader.emit('progress');
        });
        outStream.on('close', () => {
          if (errorOccurred) {
            return;
          }
          hashCheckPend.wait(cb);
        });

        httpStream.pipe(multipartETag);
        httpStream.pipe(outStream);
        multipartETag.resume();
      }
    });

    request.send(handleError);

    function handleError(err) {
      if (!err) {
        return;
      }
      if (errorOccurred) {
        return;
      }
      errorOccurred = true;
      cb(err);
    }
  }
};

/* params:
 *  - recursive: false
 *  - s3Params:
 *    - Bucket: params.s3Params.Bucket,
 *    - Delimiter: null,
 *    - Marker: null,
 *    - MaxKeys: null,
 *    - Prefix: prefix,
 */
S3Sync.prototype.listObjects = function (params) {
  const self: ClientType = this;
  const ee = new EventEmitter();
  const s3Details = extend({}, params.s3Params);
  const recursive = !!params.recursive;
  let abort = false;

  ee.progressAmount = 0;
  ee.objectsFound = 0;
  ee.dirsFound = 0;
  findAllS3Objects(s3Details.Marker, s3Details.Prefix, (err) => {
    if (err) {
      ee.emit('error', err);
      return;
    }
    ee.emit('end');
  });

  ee.abort = function () {
    abort = true;
  };

  return ee;

  function findAllS3Objects(marker, prefix, cb) {
    if (abort) {
      return;
    }
    doWithRetry(listObjects, self.s3RetryCount, self.s3RetryDelay, (err, data) => {
      if (abort) {
        return;
      }
      if (err) {
        return cb(err);
      }

      if (!data.Contents) {
        data.Contents = [];
      }
      if (!data.CommonPrefixes) {
        data.CommonPrefixes = [];
      }
      ee.progressAmount += 1;
      ee.objectsFound += data.Contents.length;
      ee.dirsFound += data.CommonPrefixes.length;
      ee.emit('progress');
      ee.emit('data', data);

      const pend = new Pend();

      if (recursive) {
        data.CommonPrefixes.forEach(recurse);
        data.CommonPrefixes = [];
      }

      if (data.IsTruncated) {
        pend.go(findNext1000);
      }

      pend.wait((err) => {
        cb(err);
      });

      function findNext1000(cb) {
        const nextMarker = data.NextMarker || data.Contents[data.Contents.length - 1].Key;
        findAllS3Objects(nextMarker, prefix, cb);
      }

      function recurse(dirObj) {
        const prefix = dirObj.Prefix;
        pend.go((cb) => {
          findAllS3Objects(null, prefix, cb);
        });
      }
    });

    function listObjects(cb) {
      if (abort) {
        return;
      }
      self.s3Pend.go((pendCb) => {
        if (abort) {
          pendCb();
          return;
        }
        s3Details.Marker = marker;
        s3Details.Prefix = prefix;
        self.s3.listObjects(s3Details, (err, data) => {
          pendCb();
          if (abort) {
            return;
          }
          cb(err, data);
        });
      });
    }
  }
};

/* params:
 * - deleteRemoved - delete s3 objects with no corresponding local file. default false
 * - localDir - path on local file system to sync
 * - s3Params:
 *   - Bucket (required)
 *   - Key (required)
 */
S3Sync.prototype.uploadDir = function (params) {
  return syncDir(this, params, true);
};

S3Sync.prototype.downloadDir = function (params) {
  return syncDir(this, params, false);
};

S3Sync.prototype.deleteDir = function (s3Params) {
  const self: ClientType = this;
  const ee = new EventEmitter();
  const bucket = s3Params.Bucket;
  const mfa = s3Params.MFA;
  const listObjectsParams = {
    recursive: true,
    s3Params: {
      Bucket: bucket,
      Prefix: s3Params.Prefix
    }
  };
  const finder = self.listObjects(listObjectsParams);
  const pend = new Pend();
  ee.progressAmount = 0;
  ee.progressTotal = 0;
  finder.on('error', (err) => {
    ee.emit('error', err);
  });
  finder.on('data', (objects) => {
    ee.progressTotal += objects.Contents.length;
    ee.emit('progress');
    if (objects.Contents.length > 0) {
      pend.go(deleteThem);
    }

    function deleteThem(cb) {
      const params = {
        Bucket: bucket,
        Delete: {
          Objects: objects.Contents.map(keyOnly),
          Quiet: true
        },
        MFA: mfa
      };
      const deleter = self.deleteObjects(params);
      deleter.on('error', (err) => {
        finder.abort();
        ee.emit('error', err);
      });
      deleter.on('end', () => {
        ee.progressAmount += objects.Contents.length;
        ee.emit('progress');
        cb();
      });
    }
  });
  finder.on('end', () => {
    pend.wait(() => {
      ee.emit('end');
    });
  });
  return ee;
};

S3Sync.prototype.copyObject = function (_s3Params) {
  const self: ClientType = this;
  const ee = new EventEmitter();
  const s3Params = extend({}, _s3Params);
  delete s3Params.MFA;
  doWithRetry(doCopyWithPend, self.s3RetryCount, self.s3RetryDelay, (err, data) => {
    if (err) {
      ee.emit('error', err);
    } else {
      ee.emit('end', data);
    }
  });
  function doCopyWithPend(cb) {
    self.s3Pend.go((pendCb) => {
      doTheCopy((err, data) => {
        pendCb();
        cb(err, data);
      });
    });
  }
  function doTheCopy(cb) {
    self.s3.copyObject(s3Params, cb);
  }
  return ee;
};

S3Sync.prototype.moveObject = function (s3Params) {
  const self: ClientType = this;
  const ee = new EventEmitter();
  const copier = self.copyObject(s3Params);
  const copySource = s3Params.CopySource;
  const mfa = s3Params.MFA;
  copier.on('error', (err) => {
    ee.emit('error', err);
  });
  copier.on('end', (data) => {
    ee.emit('copySuccess', data);
    const slashIndex = copySource.indexOf('/');
    const sourceBucket = copySource.substring(0, slashIndex);
    const sourceKey = copySource.substring(slashIndex + 1);
    const deleteS3Params = {
      Bucket: sourceBucket,
      Delete: {
        Objects: [
          {
            Key: sourceKey
          }
        ],
        Quiet: true
      },
      MFA: mfa
    };
    const deleter = self.deleteObjects(deleteS3Params);
    deleter.on('error', (err) => {
      ee.emit('error', err);
    });
    let deleteData;
    deleter.on('data', (data) => {
      deleteData = data;
    });
    deleter.on('end', () => {
      ee.emit('end', deleteData);
    });
  });
  return ee;
};

S3Sync.prototype.downloadBuffer = function (s3Params) {
  const self: ClientType = this;
  const downloader = new EventEmitter();
  s3Params = extend({}, s3Params);

  downloader.progressAmount = 0;

  doWithRetry(doDownloadWithPend, self.s3RetryCount, self.s3RetryDelay, (err, buffer) => {
    if (err) {
      downloader.emit('error', err);
      return;
    }
    downloader.emit('end', buffer);
  });

  return downloader;

  function doDownloadWithPend(cb) {
    self.s3Pend.go((pendCb) => {
      doTheDownload((err, buffer) => {
        pendCb();
        cb(err, buffer);
      });
    });
  }

  function doTheDownload(cb) {
    let errorOccurred = false;
    const request = self.s3.getObject(s3Params);
    const hashCheckPend = new Pend();
    request.on('httpHeaders', (statusCode, headers, resp) => {
      if (statusCode >= 300) {
        handleError(new Error(`http status code ${statusCode}`));
        return;
      }
      const contentLength = Number.parseInt(headers['content-length'], 10);
      downloader.progressTotal = contentLength;
      downloader.progressAmount = 0;
      downloader.emit('progress');
      downloader.emit('httpHeaders', statusCode, headers, resp);
      const eTag = cleanETag(headers.etag);
      const eTagCount = getETagCount(eTag);

      const outStream = new StreamSink();
      const multipartETag = new MultipartETag({ size: contentLength, count: eTagCount });
      const httpStream = resp.httpResponse.createUnbufferedStream();

      httpStream.on('error', handleError);
      outStream.on('error', handleError);

      hashCheckPend.go((cb) => {
        multipartETag.on('end', () => {
          if (multipartETag.bytes !== contentLength) {
            handleError(new Error('Downloaded size does not match Content-Length'));
            return;
          }
          if (eTagCount === 1 && !multipartETag.anyMatch(eTag)) {
            handleError(new Error('ETag does not match MD5 checksum'));
            return;
          }
          cb();
        });
      });
      multipartETag.on('progress', () => {
        downloader.progressAmount = multipartETag.bytes;
        downloader.emit('progress');
      });
      outStream.on('finish', () => {
        if (errorOccurred) {
          return;
        }
        hashCheckPend.wait(() => {
          cb(null, outStream.toBuffer());
        });
      });

      httpStream.pipe(multipartETag);
      httpStream.pipe(outStream);
      multipartETag.resume();
    });

    request.send(handleError);

    function handleError(err) {
      if (!err) {
        return;
      }
      if (errorOccurred) {
        return;
      }
      errorOccurred = true;
      cb(err);
    }
  }
};

S3Sync.prototype.downloadStream = function (s3Params) {
  const self: ClientType = this;
  const downloadStream = new PassThrough();
  s3Params = extend({}, s3Params);

  doDownloadWithPend((err) => {
    if (err) {
      downloadStream.emit('error', err);
    }
  });
  return downloadStream;

  function doDownloadWithPend(cb) {
    self.s3Pend.go((pendCb) => {
      doTheDownload((err) => {
        pendCb();
        cb(err);
      });
    });
  }

  function doTheDownload(cb) {
    let errorOccurred = false;
    const request = self.s3.getObject(s3Params);
    request.on('httpHeaders', (statusCode, headers, resp) => {
      if (statusCode >= 300) {
        handleError(new Error(`http status code ${statusCode}`));
        return;
      }
      downloadStream.emit('httpHeaders', statusCode, headers, resp);
      const httpStream = resp.httpResponse.createUnbufferedStream();

      httpStream.on('error', handleError);

      downloadStream.on('finish', () => {
        if (errorOccurred) {
          return;
        }
        cb();
      });

      httpStream.pipe(downloadStream);
    });

    request.send(handleError);

    function handleError(err) {
      if (!err) {
        return;
      }
      if (errorOccurred) {
        return;
      }
      errorOccurred = true;
      cb(err);
    }
  }
};

function syncDir(self, params, directionIsToS3: boolean) {
  const ee = new EventEmitter();
  const finditOpts = {
    fs,
    followSymlinks: params.followSymlinks == null ? true : !!params.followSymlinks
  };
  const localDir = params.localDir;
  const deleteRemoved = params.deleteRemoved === true;
  let fatalError = false;
  const prefix = params.s3Params.Prefix ? ensureSlash(params.s3Params.Prefix) : '';
  const bucket = params.s3Params.Bucket;
  const listObjectsParams = {
    recursive: true,
    s3Params: {
      Bucket: bucket,
      Prefix: prefix
    }
  };
  const getS3Params = params.getS3Params;
  const baseUpDownS3Params = extend({}, params.s3Params);
  const upDownFileParams = {
    s3Params: baseUpDownS3Params,
    defaultContentType: params.defaultContentType
  };
  delete upDownFileParams.s3Params.Prefix;

  // skipped files are considered non-existent
  // this only works when direction is to S3
  const skipFiles: string[] = params.skipFiles || [];

  ee.activeTransfers = 0;
  ee.progressAmount = 0;
  ee.progressTotal = 0;
  ee.progressMd5Amount = 0;
  ee.progressMd5Total = 0;
  ee.objectsFound = 0;
  ee.filesFound = 0;
  ee.deleteAmount = 0;
  ee.deleteTotal = 0;
  ee.doneFindingFiles = false;
  ee.doneFindingObjects = false;
  ee.doneMd5 = false;

  const allLocalFiles = [];
  const allS3Objects = [];
  let localFileCursor = 0;
  let s3ObjectCursor = 0;
  let objectsToDelete = [];

  findAllS3Objects();
  startFindAllFiles();

  return ee;

  function flushDeletes() {
    if (objectsToDelete.length === 0) {
      return;
    }
    const thisObjectsToDelete = objectsToDelete;
    objectsToDelete = [];
    const params = {
      Bucket: bucket,
      Delete: {
        Objects: thisObjectsToDelete,
        Quiet: true
      }
    };
    const deleter = self.deleteObjects(params);
    deleter.on('error', handleError);
    deleter.on('end', () => {
      if (fatalError) {
        return;
      }
      ee.deleteAmount += thisObjectsToDelete.length;
      ee.emit('progress');
      checkDoMoreWork();
    });
  }

  function checkDoMoreWork() {
    if (fatalError) {
      return;
    }

    const localFileStat = allLocalFiles[localFileCursor];
    const s3Object = allS3Objects[s3ObjectCursor];

    // need to wait for a file or object. checkDoMoreWork will get called
    // again when that happens.
    if (!localFileStat && !ee.doneMd5) {
      return;
    }
    if (!s3Object && !ee.doneFindingObjects) {
      return;
    }

    // need to wait until the md5 is done computing for the local file
    if (localFileStat && !localFileStat.multipartETag) {
      return;
    }

    // localFileStat or s3Object could still be null - in that case we have
    // reached the real end of the list.

    // if they're both null, we've reached the true end
    if (!localFileStat && !s3Object) {
      // if we don't have any pending deletes or uploads, we're actually done
      flushDeletes();
      if (ee.deleteAmount >= ee.deleteTotal && ee.progressAmount >= ee.progressTotal && ee.activeTransfers === 0) {
        ee.emit('end');
        // prevent checkDoMoreWork from doing any more work
        fatalError = true;
      }
      // either way, there's nothing else to do in this method
      return;
    }

    // special case for directories when deleteRemoved is true and we're
    // downloading a dir from S3. We don't add directories to the list
    // unless this case is true, so we assert that fact here.
    if (localFileStat && localFileStat.isDirectory()) {
      assert.ok(!directionIsToS3);
      assert.ok(deleteRemoved);

      localFileCursor += 1;
      setImmediate(checkDoMoreWork);

      if (!s3Object || s3Object.key.indexOf(localFileStat.s3Path) !== 0) {
        deleteLocalDir();
      }
      return;
    }

    if (directionIsToS3) {
      if (!localFileStat) {
        deleteS3Object();
      } else if (!s3Object) {
        uploadLocalFile();
      } else if (localFileStat.s3Path < s3Object.key) {
        uploadLocalFile();
      } else if (localFileStat.s3Path > s3Object.key) {
        deleteS3Object();
      } else if (!compareMultipartETag(s3Object.ETag, localFileStat.multipartETag)) {
        // both file cursor and s3 cursor should increment
        s3ObjectCursor += 1;
        uploadLocalFile();
      } else {
        // we always update the metadata
        // i.e even if file has not changed, metadata or tags could have and therefore we need to do this
        // @todo in future - we might detect when metadata has changed and update only in those cases
        // both file cursor and s3 cursor should increment
        localFileCursor += 1;
        s3ObjectCursor += 1;
        updateMetadataOfObject();
      }
    } else if (!localFileStat) {
      downloadS3Object();
    } else if (!s3Object) {
      deleteLocalFile();
    } else if (localFileStat.s3Path < s3Object.key) {
      deleteLocalFile();
    } else if (localFileStat.s3Path > s3Object.key) {
      downloadS3Object();
    } else if (!compareMultipartETag(s3Object.ETag, localFileStat.multipartETag)) {
      // both file cursor and s3 cursor should increment
      localFileCursor += 1;
      downloadS3Object();
    } else {
      skipThisOne();
    }

    function deleteLocalDir() {
      const fullPath = path.join(localDir, localFileStat.path);
      ee.deleteTotal += 1;
      remove(fullPath, (err) => {
        if (fatalError) {
          return;
        }
        if (err && err.code !== 'ENOENT') {
          return handleError(err);
        }
        ee.deleteAmount += 1;
        ee.emit('progress');
        checkDoMoreWork();
      });
    }

    function deleteLocalFile() {
      localFileCursor += 1;
      setImmediate(checkDoMoreWork);
      if (!deleteRemoved) {
        return;
      }
      ee.deleteTotal += 1;
      const fullPath = path.join(localDir, localFileStat.path);
      fs.unlink(fullPath, (err) => {
        if (fatalError) {
          return;
        }
        if (err && err.code !== 'ENOENT') {
          return handleError(err);
        }
        ee.deleteAmount += 1;
        ee.emit('progress');
        checkDoMoreWork();
      });
    }

    function downloadS3Object() {
      s3ObjectCursor += 1;
      setImmediate(checkDoMoreWork);
      const fullPath = path.join(localDir, toNativeSep(s3Object.key));

      if (getS3Params) {
        getS3Params(fullPath, s3Object, haveS3Params);
      } else {
        startDownload();
      }

      function haveS3Params(err, s3Params) {
        if (fatalError) {
          return;
        }
        if (err) {
          return handleError(err);
        }

        if (!s3Params) {
          // user has decided to skip this file
          return;
        }

        upDownFileParams.s3Params = extend(extend({}, baseUpDownS3Params), s3Params);
        startDownload();
      }

      function startDownload() {
        ee.progressTotal += s3Object.Size;
        const fullKey = s3Object.Key;
        upDownFileParams.s3Params.Key = fullKey;
        upDownFileParams.localFile = fullPath;
        const downloader = self.downloadFile(upDownFileParams);
        let prevAmountDone = 0;
        ee.activeTransfers++;
        ee.emit('fileDownloadStart', fullPath, fullKey);
        downloader.on('error', handleError);
        downloader.on('progress', () => {
          if (fatalError) {
            return;
          }
          const delta = downloader.progressAmount - prevAmountDone;
          prevAmountDone = downloader.progressAmount;
          ee.progressAmount += delta;
          ee.emit('progress');
        });
        downloader.on('end', () => {
          ee.activeTransfers--;
          ee.emit('fileDownloadEnd', fullPath, fullKey);
          ee.emit('progress');
          checkDoMoreWork();
        });
      }
    }

    function skipThisOne() {
      s3ObjectCursor += 1;
      localFileCursor += 1;
      setImmediate(checkDoMoreWork);
    }

    function updateMetadataOfObject() {
      setImmediate(checkDoMoreWork);
      const fullPath = path.join(localDir, localFileStat.path);

      if (getS3Params) {
        getS3Params(fullPath, localFileStat, haveS3Params);
      } else {
        upDownFileParams.s3Params = baseUpDownS3Params;
        startCopy();
      }

      function haveS3Params(err, s3Params) {
        if (fatalError) {
          return;
        }
        if (err) {
          return handleError(err);
        }

        if (!s3Params) {
          // user has decided to skip this file
          return;
        }

        upDownFileParams.s3Params = extend(extend({}, baseUpDownS3Params), s3Params);
        startCopy();
      }

      function startCopy() {
        const fullKey = prefix + localFileStat.s3Path;
        upDownFileParams.s3Params.Key = fullKey;
        const copier = self.copyObject({
          CopySource: `${upDownFileParams.s3Params.Bucket}/${upDownFileParams.s3Params.Key}`,
          TaggingDirective: 'REPLACE',
          MetadataDirective: 'REPLACE',
          ContentType: mime.getType(fullPath),
          ...upDownFileParams.s3Params
        });
        ee.activeTransfers++;
        ee.emit('copyStart', fullKey);
        copier.on('error', (err) => {
          handleError(err);
        });
        copier.on('progress', () => {
          if (fatalError) {
            return;
          }
          ee.emit('progress');
        });
        copier.on('end', () => {
          ee.activeTransfers--;
          ee.emit('copySuccess', fullKey);
          ee.emit('progress');
          checkDoMoreWork();
        });
      }
    }

    function uploadLocalFile() {
      localFileCursor += 1;
      setImmediate(checkDoMoreWork);
      const fullPath = path.join(localDir, localFileStat.path);

      if (getS3Params) {
        getS3Params(fullPath, localFileStat, haveS3Params);
      } else {
        upDownFileParams.s3Params = baseUpDownS3Params;
        startUpload();
      }

      function haveS3Params(err, s3Params) {
        if (fatalError) {
          return;
        }
        if (err) {
          return handleError(err);
        }

        if (!s3Params) {
          // user has decided to skip this file
          return;
        }

        upDownFileParams.s3Params = extend(extend({}, baseUpDownS3Params), s3Params);
        startUpload();
      }

      function startUpload() {
        ee.progressTotal += localFileStat.size;
        const fullKey = prefix + localFileStat.s3Path;
        upDownFileParams.s3Params.Key = fullKey;
        upDownFileParams.localFile = fullPath;
        const uploader = self.uploadFile(upDownFileParams);
        let prevAmountDone = 0;
        let prevAmountTotal = localFileStat.size;
        ee.activeTransfers++;
        ee.emit('fileUploadStart', fullPath, fullKey);
        uploader.on('error', handleError);
        uploader.on('progress', () => {
          if (fatalError) {
            return;
          }
          const amountDelta = uploader.progressAmount - prevAmountDone;
          prevAmountDone = uploader.progressAmount;
          ee.progressAmount += amountDelta;

          const totalDelta = uploader.progressTotal - prevAmountTotal;
          prevAmountTotal = uploader.progressTotal;
          ee.progressTotal += totalDelta;

          ee.emit('progress');
        });
        uploader.on('end', () => {
          ee.activeTransfers--;
          ee.emit('fileUploadEnd', fullPath, fullKey);
          ee.emit('progress');
          checkDoMoreWork();
        });
      }
    }

    function deleteS3Object() {
      s3ObjectCursor += 1;
      setImmediate(checkDoMoreWork);
      if (!deleteRemoved) {
        return;
      }
      objectsToDelete.push({ Key: s3Object.Key });
      ee.deleteTotal += 1;
      ee.emit('progress');
      assert.ok(objectsToDelete.length <= 1000);
      if (objectsToDelete.length === 1000) {
        flushDeletes();
      }
    }
  }

  function handleError(err) {
    if (fatalError) {
      return;
    }
    fatalError = true;
    ee.emit('error', err);
  }

  function findAllS3Objects() {
    const finder = self.listObjects(listObjectsParams);
    finder.on('error', handleError);
    finder.on('data', (data) => {
      if (fatalError) {
        return;
      }
      ee.objectsFound += data.Contents.length;
      ee.emit('progress');

      data.Contents.forEach((object) => {
        object.key = object.Key.substring(prefix.length);
        allS3Objects.push(object);
      });
      checkDoMoreWork();
    });
    finder.on('end', () => {
      if (fatalError) {
        return;
      }
      ee.doneFindingObjects = true;
      ee.emit('progress');
      checkDoMoreWork();
    });
  }

  function startFindAllFiles() {
    findAllFiles((err) => {
      if (fatalError) {
        return;
      }
      if (err) {
        return handleError(err);
      }

      ee.doneFindingFiles = true;
      ee.emit('progress');

      allLocalFiles.sort((a, b) => {
        if (a.s3Path < b.s3Path) {
          return -1;
        }
        if (a.s3Path > b.s3Path) {
          return 1;
        }
        return 0;
      });
      startComputingMd5Sums();
    });
  }

  function startComputingMd5Sums() {
    let index = 0;
    computeOne();

    function computeOne() {
      if (fatalError) {
        return;
      }
      const localFileStat = allLocalFiles[index];
      if (!localFileStat) {
        ee.doneMd5 = true;
        ee.emit('progress');
        checkDoMoreWork();
        return;
      }
      if (localFileStat.multipartETag) {
        index += 1;
        setImmediate(computeOne);
        return;
      }
      const fullPath = path.join(localDir, localFileStat.path);
      const inStream = fs.createReadStream(fullPath);
      const multipartETag = new MultipartETag();
      inStream.on('error', handleError);
      let prevBytes = 0;
      multipartETag.on('progress', () => {
        const delta = multipartETag.bytes - prevBytes;
        prevBytes = multipartETag.bytes;
        ee.progressMd5Amount += delta;
      });
      multipartETag.on('end', () => {
        if (fatalError) {
          return;
        }
        localFileStat.multipartETag = multipartETag;
        checkDoMoreWork();
        ee.emit('progress');
        index += 1;
        computeOne();
      });
      inStream.pipe(multipartETag);
      multipartETag.resume();
    }
  }

  function findAllFiles(cb) {
    const dirWithSlash = ensureSep(localDir);
    const walker = findit(dirWithSlash, finditOpts);
    walker.on('error', (err) => {
      walker.stop();
      // when uploading, we don't want to delete based on a nonexistent source directory
      // but when downloading, the destination directory does not have to exist.
      if (!directionIsToS3 && err.path === dirWithSlash && err.code === 'ENOENT') {
        cb();
      } else {
        cb(err);
      }
    });
    walker.on('directory', (dir, stat, stop, linkPath) => {
      if (fatalError) {
        return walker.stop();
      }
      // we only need to save directories when deleteRemoved is true
      // and we're syncing to disk from s3
      if (!deleteRemoved || directionIsToS3) {
        return;
      }
      const relPath = path.relative(localDir, linkPath || dir);
      if (relPath === '') {
        return;
      }
      stat.path = relPath;
      stat.s3Path = `${toUnixSep(relPath)}/`;
      stat.multipartETag = new MultipartETag();
      allLocalFiles.push(stat);
    });
    walker.on('file', (file, stat, linkPath) => {
      if (fatalError) {
        return walker.stop();
      }
      const relPath = path.relative(localDir, linkPath || file);
      // ignoring local files (considering them non-existent)
      // works only for directionToS3=true
      if (directionIsToS3 && skipFiles?.some((globPattern) => stringMatchesGlob(relPath, globPattern))) {
        return;
      }
      stat.path = relPath;
      stat.s3Path = toUnixSep(relPath);
      ee.filesFound += 1;
      ee.progressMd5Total += stat.size;
      ee.emit('progress');
      allLocalFiles.push(stat);
    });
    walker.on('end', () => {
      cb();
    });
  }
}

function ensureChar(str, c) {
  return str[str.length - 1] === c ? str : str + c;
}

function ensureSep(dir) {
  return ensureChar(dir, path.sep);
}

function ensureSlash(dir) {
  return ensureChar(dir, '/');
}

function doWithRetry(fn, tryCount, delay, cb) {
  let tryIndex = 0;

  tryOnce();

  function tryOnce() {
    fn((err, result) => {
      if (err) {
        if (err.retryable === false) {
          cb(err);
        } else {
          tryIndex += 1;
          if (tryIndex >= tryCount) {
            cb(err);
          } else {
            setTimeout(tryOnce, delay);
          }
        }
      } else {
        cb(null, result);
      }
    });
  }
}

function extend(target, source) {
  for (const propName in source) {
    target[propName] = source[propName];
  }
  return target;
}

function chunkArray(array, maxLength) {
  const slices = [array];
  while (slices[slices.length - 1].length > maxLength) {
    slices.push(slices[slices.length - 1].splice(maxLength));
  }
  return slices;
}

function cleanETag(eTag) {
  return eTag ? eTag.replace(/^\s*(?:'\s*)?"?\s*(.*?)\s*(?:"\s*)?'?\s*$/, '$1') : '';
}

function compareMultipartETag(eTag, multipartETag) {
  return multipartETag.anyMatch(cleanETag(eTag));
}

function getETagCount(eTag) {
  const match = (eTag || '').match(/[a-f0-9]{32}-(\d+)$/i);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function keyOnly(item) {
  return {
    Key: item.Key,
    VersionId: item.VersionId
  };
}

function encodeSpecialCharacters(filename) {
  // Note: these characters are valid in URIs, but S3 does not like them for
  // some reason.
  return encodeURI(filename).replace(/[!'()* ]/g, (char) => {
    return `%${char.charCodeAt(0).toString(16)}`;
  });
}

function getPublicUrl(bucket, key, bucketLocation, endpoint) {
  const nonStandardBucketLocation = bucketLocation && bucketLocation !== 'us-east-1';
  const hostnamePrefix = nonStandardBucketLocation ? `s3-${bucketLocation}` : 's3';
  const parts = {
    protocol: 'https:',
    hostname: `${hostnamePrefix}.${endpoint || 'amazonaws.com'}`,
    pathname: `/${bucket}/${encodeSpecialCharacters(key)}`
  };
  return url.format(parts);
}

function getPublicUrlHttp(bucket, key, endpoint) {
  const parts = {
    protocol: 'http:',
    hostname: `${bucket}.${endpoint || 's3.amazonaws.com'}`,
    pathname: `/${encodeSpecialCharacters(key)}`
  };
  return url.format(parts);
}

function toUnixSep(str) {
  return str.replace(TO_UNIX_RE, '/');
}

function toNativeSep(str) {
  return str.replace(/\//g, path.sep);
}

function quotemeta(str) {
  return String(str).replace(/(\W)/g, '\\$1');
}

function smallestPartSizeFromFileSize(fileSize) {
  const partSize = Math.ceil(fileSize / MAX_MULTIPART_COUNT);
  return partSize < MIN_MULTIPART_SIZE ? MIN_MULTIPART_SIZE : partSize;
}
