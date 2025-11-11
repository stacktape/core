const kleur = require('kleur');
const stripAnsi = require('strip-ansi');

const getTimeString = () => {
  const date = new Date();
  return `(${kleur.gray(`${date.toLocaleTimeString('sk-SK')}:${date.getMilliseconds()}`)})`;
};

/**
 * Success prints message
 *
 * @param {string} message - message to print
 */
const logSuccess = (message) => {
  console.info(`${kleur.green('✔')} ${getTimeString()} ${message}`);
};

/**
 * Success prints message
 *
 * @param {string} message - message to print
 */
const logWarn = (message) => {
  console.info(`${kleur.yellow('~')} ${getTimeString()} ${message}`);
};

/**
 * Info prints message
 *
 * @param {string} message - message to print
 */
const logInfo = (message) => {
  console.info(`${kleur.cyan('i')} ${getTimeString()} ${message}`);
};

/**
 * Pretty prints error
 *
 * @param {Error} error
 * @param {string} prefix
 */
const logError = (error, prefix = '') => {
  const errDetails =
    error instanceof Error ? error.stack || error.message : `Unknown error:\n${JSON.stringify(error, null, 2)}`;
  console.error(`${kleur.red('✖')} ${getTimeString()}${prefix ? ` ${prefix}` : ''} ${errDetails}`);
};

/**
 * Pretty log error messages
 *
 * @param {string[]} errorMessage
 */
const logErrorMessage = (errorMessages) => {
  const beginning = `${kleur.red('✖')} ${getTimeString()}`;
  const beginningLength = stripAnsi(beginning).length + 1;
  console.error(`${beginning} ${errorMessages.join(`\n${' '.repeat(beginningLength)}`)}`);
};

module.exports = { getTimeString, logError, logInfo, logSuccess, logWarn, logErrorMessage };
