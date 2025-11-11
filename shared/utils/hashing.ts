// /* eslint-disable no-param-reassign */
// /* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable no-shadow */
// // from https://github.com/mcavage/node-dirsum

// const crypto = require('crypto');
// const fs = require('fs');

// function _summarize(method, hashes) {
//   const keys = Object.keys(hashes);
//   keys.sort();

//   const obj: any = {};
//   obj.files = hashes;
//   const hash = crypto.createHash(method);
//   for (let i = 0; i < keys.length; i++) {
//     if (typeof hashes[keys[i]] === 'string') {
//       hash.update(hashes[keys[i]]);
//     } else if (typeof hashes[keys[i]] === 'object') {
//       hash.update(hashes[keys[i]].hash);
//     } else {
//       console.error(`Unknown type found in hash: ${typeof hashes[keys[i]]}`);
//     }
//   }

//   obj.hash = hash.digest('hex');
//   return obj;
// }

// function digest(root, method, callback) {
//   if (!root || typeof root !== 'string') {
//     throw new TypeError('root is required (string)');
//   }
//   if (method) {
//     if (typeof method === 'string') {
//       // NO-OP
//     } else if (typeof method === 'function') {
//       callback = method;
//       method = 'md5';
//     } else {
//       throw new TypeError('hash must be a string');
//     }
//   } else {
//     throw new TypeError('callback is required (function)');
//   }
//   if (!callback) {
//     throw new TypeError('callback is required (function)');
//   }

//   const hashes = {};

//   fs.readdir(root, (err, files) => {
//     if (err) {
//       return callback(err);
//     }

//     if (files.length === 0) {
//       return callback(undefined, { hash: '', files: {} });
//     }

//     let hashed = 0;
//     files.forEach((f) => {
//       const path = `${root}/${f}`;
//       fs.stat(path, (err, stats) => {
//         if (err) {
//           return callback(err);
//         }

//         if (stats.isDirectory()) {
//           return digest(path, method, (err, hash) => {
//             if (err) {
//               return hash;
//             }

//             hashes[f] = hash;
//             if (++hashed >= files.length) {
//               return callback(undefined, _summarize(method, hashes));
//             }
//           });
//         }
//         if (stats.isFile()) {
//           fs.readFile(path, 'utf8', (err, data) => {
//             if (err) {
//               return callback(err);
//             }

//             const hash = crypto.createHash(method);
//             hash.update(data);
//             hashes[f] = hash.digest('hex');

//             if (++hashed >= files.length) {
//               return callback(undefined, _summarize(method, hashes));
//             }
//           });
//         } else {
//           console.error('Skipping hash of %s', f);
//           if (++hashed > files.length) {
//             return callback(undefined, _summarize(method, hashes));
//           }
//         }
//       });
//     });
//   });
// }

// export const getDirectoryCheckSum = () => {

// }

import { createHash } from 'node:crypto';
import { hashElement } from 'folder-hash';
import { shortHash } from './short-hash';

export const getDirectoryChecksum = async ({
  absoluteDirectoryPath,
  excludeGlobs
}: {
  absoluteDirectoryPath: string;
  excludeGlobs?: string[];
}) => {
  const res = await hashElement(absoluteDirectoryPath, {
    encoding: 'hex',
    folders: { exclude: excludeGlobs || [] }
  });
  return res.hash;
};

export const mergeHashes = (...hashes: string[]) => {
  const result = createHash('sha1');

  hashes.forEach((hash) => {
    result.update(hash);
  });

  return result.digest('hex');
};

export const getGloballyUniqueStackHash = ({
  region,
  stackName,
  accountId
}: {
  region: string;
  stackName: string;
  accountId: string;
}) => shortHash(region + stackName + accountId);
