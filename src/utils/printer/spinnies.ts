// @copied from https://github.com/jcarpanelli/spinnies/blob/master/index.js
import readline from 'node:readline';
import cliCursor from 'cli-cursor';
import stripAnsi from 'strip-ansi';

const dots = {
  interval: 50,
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
};
const dashes = {
  interval: 250,
  frames: ['-', '_']
};
const VALID_STATUSES = ['succeed', 'fail', 'spinning'] as const;
const envFlagEnabled = (value?: string) => ['1', 'true', 'yes'].includes((value || '').toLowerCase());
const RUNNING_IN_CI = envFlagEnabled(process.env.CI);
const FORCE_SIMPLE_MODE = envFlagEnabled(process.env.STACKTAPE_SIMPLE_SPINNER);
const FORCE_DISABLE_MODE = envFlagEnabled(process.env.STACKTAPE_DISABLE_SPINNER);

function purgeSpinnerOptions(options) {
  const opts = { ...options };

  if (!VALID_STATUSES.includes(options.status)) {
    delete opts.status;
  }

  return { ...opts };
}

function purgeSpinnersOptions({ spinner, disableSpins, ...others }) {
  const prefixes = prefixOptions(others as any);
  const disableSpinsOption = typeof disableSpins === 'boolean' ? { disableSpins } : {};
  spinner = turnToValidSpinner(spinner);

  return { ...prefixes, ...disableSpinsOption, spinner };
}

function turnToValidSpinner(spinner: any = {}) {
  const platformSpinner = terminalSupportsUnicode() ? dots : dashes;
  // @ts-expect-error todo
  if (!typeof spinner === 'object') {
    return platformSpinner;
  }
  let { interval, frames } = spinner;
  if (!Array.isArray(frames) || frames.length < 1) {
    frames = platformSpinner.frames;
  }
  if (typeof interval !== 'number') {
    interval = platformSpinner.interval;
  }

  return { interval, frames };
}

function prefixOptions({ succeedPrefix, failPrefix }) {
  if (terminalSupportsUnicode()) {
    failPrefix = failPrefix || '✖';
  } else {
    failPrefix = failPrefix || '×';
  }

  return { succeedPrefix, failPrefix };
}

function breakText(text, prefixLength) {
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? breakLine(line, prefixLength) : breakLine(line, 0)))
    .join('\n');
}

function breakLine(line, prefixLength) {
  const columns = process.stderr.columns || 95;
  return line.length >= columns - prefixLength
    ? `${line.substring(0, columns - prefixLength - 1)}\n${breakLine(
        line.substring(columns - prefixLength - 1, line.length),
        0
      )}`
    : line;
}

function getLinesLength(text, prefixLength) {
  return stripAnsi(text)
    .split('\n')
    .map((line, index) => (index === 0 ? line.length + prefixLength : line.length));
}

function writeStream(stream, output, rawLines) {
  if (!output) {
    return;
  }
  stream.write(output);
  if (rawLines.length) {
    readline.moveCursor(stream, 0, -rawLines.length);
  }
}

function cleanStream(stream, rawLines) {
  if (!rawLines.length) {
    return;
  }
  rawLines.forEach((lineLength, index) => {
    readline.moveCursor(stream, lineLength, index);
    readline.clearLine(stream, 1);
    readline.moveCursor(stream, -lineLength, -index);
  });
  readline.moveCursor(stream, 0, rawLines.length);
  readline.clearScreenDown(stream);
  readline.moveCursor(stream, 0, -rawLines.length);
}

function terminalSupportsUnicode() {
  // The default command prompt and powershell in Windows do not support Unicode characters.
  // However, the VSCode integrated terminal and the Windows Terminal both do.
  return process.platform !== 'win32' || process.env.TERM_PROGRAM === 'vscode' || !!process.env.WT_SESSION;
}

type SpinnerStatus = (typeof VALID_STATUSES)[number];
type SpinnerState = {
  status: SpinnerStatus;
  text: string;
  succeedPrefix: string;
  failPrefix: string;
  indent?: number;
};

export class Spinnies {
  options: any;
  spinners: Record<string, SpinnerState> = {};

  isCursorHidden = false;
  isStopped = false;
  currentInterval: NodeJS.Timeout | null = null;
  stream: NodeJS.WriteStream = process.stderr;
  lineCount = 0;
  currentFrameIndex = 0;
  lastFrameTimestamp = 0;
  renderMode: 'interactive' | 'basic';
  basicModeLastPrintedText: Record<string, string> = {};
  colorizeFail: (text: string) => string;
  colorizeProgress: (text: string) => string;
  succeedPrefix: string;

  constructor(options: {
    succeedPrefix: string;
    colorizeFail: (text: string) => string;
    colorizeProgress: (text: string) => string;
  }) {
    this.colorizeFail = options.colorizeFail;
    this.colorizeProgress = options.colorizeProgress;
    // @ts-expect-error todo
    options = purgeSpinnersOptions(options || ({} as any));
    this.options = {
      spinner: terminalSupportsUnicode() ? dots : dashes,
      disableSpins: false,
      ...options
    };
    this.renderMode = this.shouldUseInteractiveMode() ? 'interactive' : 'basic';
    this.options.disableSpins = this.renderMode === 'basic';
    this.succeedPrefix = options.succeedPrefix;
  }

  pick(name) {
    return this.spinners[name];
  }

  add(name, options: any = {}) {
    if (typeof name !== 'string') {
      throw new TypeError('A spinner reference name must be specified');
    }
    if (!options.text) {
      options.text = name;
    }
    const spinnerProperties: SpinnerState = {
      succeedPrefix: this.options.succeedPrefix,
      failPrefix: this.options.failPrefix,
      status: 'spinning',
      ...purgeSpinnerOptions(options)
    };

    this.spinners[name] = spinnerProperties;
    this.isStopped = false;
    if (this.renderMode === 'basic') {
      this.logBasicStatus(name, 'start');
      return spinnerProperties;
    }
    this.updateSpinnerState();

    return spinnerProperties;
  }

  update(name, options: any = {}) {
    const { status } = options;
    this.setSpinnerProperties(name, options, status);
    if (this.renderMode === 'basic') {
      this.logBasicStatus(name, 'update');
      return this.spinners[name];
    }
    this.updateSpinnerState();

    return this.spinners[name];
  }

  succeed(name, options: { text?: string } = {}) {
    const text = options.text || this.spinners[name]?.text || name;
    delete this.spinners[name];
    delete this.basicModeLastPrintedText[name];
    if (this.renderMode === 'interactive') {
      this.updateSpinnerState();
      readline.cursorTo(this.stream, 0);
      readline.clearLine(this.stream, 1);
    }
    console.info(`${this.succeedPrefix} ${text}`);
  }

  fail(name, options = {}) {
    this.setSpinnerProperties(name, options, 'fail');
    if (this.renderMode === 'basic') {
      this.logBasicStatus(name, 'fail');
      delete this.spinners[name];
      return null;
    }
    this.updateSpinnerState();
    return this.spinners[name];
  }

  stopAllSpinners = () => {
    Object.keys(this.spinners).forEach((name) => {
      delete this.spinners[name];
      delete this.basicModeLastPrintedText[name];
    });
    this.isStopped = true;
    if (this.renderMode === 'interactive') {
      this.stopRenderLoop();
      readline.clearScreenDown(this.stream);
    }
  };

  hasActiveSpinners() {
    return !!Object.values(this.spinners).find(({ status }) => status === 'spinning');
  }

  getSpinnerStatus(spinnerIdentifier: string) {
    return this.spinners[spinnerIdentifier]?.status || null;
  }

  setSpinnerProperties(name: string, options, status: SpinnerStatus = 'spinning') {
    if (!this.spinners[name]) {
      throw new Error(`No spinner initialized with name ${name}`);
    }
    options = purgeSpinnerOptions(options);
    this.spinners[name] = { ...this.spinners[name], ...options, status };
  }

  updateSpinnerState() {
    if (this.renderMode === 'basic' || this.isStopped) {
      return;
    }
    if (!this.hasActiveSpinners()) {
      this.handleNoActiveSpinners();
      return;
    }
    this.ensureRenderLoop();
  }

  loopStream() {
    const { frames, interval } = this.options.spinner;
    return setInterval(() => {
      if (this.renderMode !== 'interactive') {
        return;
      }
      const now = Date.now();
      if (this.lastFrameTimestamp && now - this.lastFrameTimestamp > interval * 20) {
        this.fallbackToBasicMode('event-loop-blocked');
        return;
      }
      this.lastFrameTimestamp = now;
      this.setStreamOutput(frames[this.currentFrameIndex]);
      this.currentFrameIndex = this.currentFrameIndex === frames.length - 1 ? 0 : ++this.currentFrameIndex;
    }, interval);
  }

  setStreamOutput(frame = '') {
    if (this.renderMode !== 'interactive') {
      return;
    }
    try {
      let output = '';
      const linesLength: number[] = [];
      const hasActiveSpinners = this.hasActiveSpinners();
      Object.entries(this.spinners).forEach(([_spinnerName, spinnerState]) => {
        const { indent = 0, status } = spinnerState;
        const text = spinnerState.text;
        let prefixLength = indent;
        let lineText = text;
        let line = '';
        if (status === 'spinning') {
          prefixLength += frame.length + 1;
          lineText = breakText(text, prefixLength);
          line = `${this.colorizeProgress(frame)} ${lineText}`;
        } else if (status === 'fail') {
          const failLabel = spinnerState.failPrefix || '✖';
          prefixLength += stripAnsi(failLabel).length + 1;
          lineText = breakText(text, prefixLength);
          line = `${this.colorizeFail(failLabel)} ${lineText}`;
        } else {
          lineText = breakText(text, prefixLength);
          line = lineText;
        }
        linesLength.push(...getLinesLength(lineText, prefixLength));
        output += indent ? `${' '.repeat(indent)}${line}\n` : `${line}\n`;
      });

      if (!hasActiveSpinners) {
        readline.clearScreenDown(this.stream);
      }
      writeStream(this.stream, output, linesLength);
      if (hasActiveSpinners) {
        cleanStream(this.stream, linesLength);
      }
      this.lineCount = linesLength.length;
    } catch {
      this.fallbackToBasicMode('render-error');
    }
  }

  cleanUpAfterExitSignal() {
    if (this.renderMode === 'interactive') {
      cliCursor.show();
      readline.moveCursor(process.stderr, 0, this.lineCount);
    }
  }

  private shouldUseInteractiveMode() {
    if (FORCE_DISABLE_MODE || FORCE_SIMPLE_MODE || RUNNING_IN_CI) {
      return false;
    }
    if (!this.stream || typeof this.stream.write !== 'function') {
      return false;
    }
    return Boolean(this.stream.isTTY);
  }

  private ensureRenderLoop() {
    if (this.currentInterval || !this.hasActiveSpinners()) {
      return;
    }
    this.lastFrameTimestamp = Date.now();
    this.currentInterval = this.loopStream();
    if (!this.isCursorHidden) {
      cliCursor.hide();
      this.isCursorHidden = true;
    }
  }

  private handleNoActiveSpinners() {
    this.setStreamOutput();
    this.stopRenderLoop();
    this.spinners = {};
  }

  private stopRenderLoop() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    if (this.isCursorHidden) {
      this.isCursorHidden = false;
      cliCursor.show();
    }
    this.lineCount = 0;
  }

  private fallbackToBasicMode(_reason: string) {
    if (this.renderMode === 'basic') {
      return;
    }
    this.renderMode = 'basic';
    this.options.disableSpins = true;
    this.stopRenderLoop();
    Object.keys(this.spinners).forEach((name) => {
      const spinner = this.spinners[name];
      const phase = spinner.status === 'fail' ? 'fail' : 'start';
      this.logBasicStatus(name, phase);
    });
  }

  private logBasicStatus(name: string, phase: 'start' | 'update' | 'fail') {
    const spinner = this.spinners[name];
    if (!spinner) {
      return;
    }
    const text = spinner.text;
    if (phase === 'update' && this.basicModeLastPrintedText[name] === text) {
      return;
    }
    if (phase !== 'fail') {
      this.basicModeLastPrintedText[name] = text;
    } else {
      delete this.basicModeLastPrintedText[name];
    }
    let prefix: string;
    if (phase === 'fail') {
      prefix = this.colorizeFail(spinner.failPrefix || '✖');
    } else if (phase === 'start') {
      prefix = this.colorizeProgress('•');
    } else {
      prefix = this.colorizeProgress('↻');
    }
    this.stream.write(`${prefix} ${text}\n`);
  }
}
