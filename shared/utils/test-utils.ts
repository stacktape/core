import kleur from 'kleur';
import { getTimeString } from './logging';
import { wait } from './misc';

export class TestExecutor {
  testResults = {};
  jobQueue: { testFn: (arg: object) => any; testFnProps: any }[] = [];
  currentlyExecuting = 0;
  concurrencyLimit: number;
  waitAfterExecution: number;
  logExecutions: boolean;

  constructor(opts: { concurrencyLimit?: number; waitAfterExecution?: number; logExecutions?: boolean } = {}) {
    this.concurrencyLimit = opts.concurrencyLimit || Infinity;
    this.waitAfterExecution = opts.waitAfterExecution || 0;
    this.logExecutions = opts.logExecutions || false;
  }

  add = async <T extends object>({ testFn, testFnProps }: { testFn: (arg: T) => any; testFnProps: T }) => {
    if (this.currentlyExecuting >= this.concurrencyLimit) {
      this.jobQueue.push({ testFn, testFnProps });
      return;
    }

    this.currentlyExecuting++;
    let result;
    let error;
    if (this.logExecutions) {
      console.info(`${kleur.magenta('i')} ${getTimeString()} [${kleur.yellow(testFn.name)}] Starting...`);
    }
    try {
      result = await testFn(testFnProps);
    } catch (err) {
      const stackTrace = err.stack ? `\n    at${err.stack.split('    at').slice(1).join('    at')}\n` : '\n';
      console.info(
        `${kleur.red('✖')} ${getTimeString()} [${kleur.yellow(testFn.name)}] Failed with error:\n${
          err.message || err
        }${stackTrace}`
      );
      error = err;
    }
    await wait(this.waitAfterExecution);
    if (this.logExecutions) {
      console.info(`${kleur.green('✔')} ${getTimeString()} [${kleur.yellow(testFn.name)}] Success.`);
    }
    this.testResults[testFn.name] = { result, error };

    this.currentlyExecuting--;
    const nextJob = this.jobQueue.pop();
    if (nextJob) {
      this.add(nextJob);
    }
  };
}

// const testSomething = async () => {
//   await wait(1000);
// };

// const testExecutor = new TestExecutor({ logExecutions: true, concurrencyLimit: 2, waitAfterExecution: 5000 });

// (async () => {
//   testExecutor.add(testSomething);
//   testExecutor.add(testSomething);
//   testExecutor.add(testSomething);
//   testExecutor.add(testSomething);
//   testExecutor.add(testSomething);
// })();
