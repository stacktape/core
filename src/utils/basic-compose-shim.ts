// Shim for basic-compose to handle CommonJS/ESM interop in Bun
// Use dynamic require to properly load CommonJS module
// eslint-disable-next-line ts/no-require-imports
const basicComposeModule = require('basic-compose');

// The module exports default via CommonJS
const compose = basicComposeModule.default || basicComposeModule;

export default compose;
