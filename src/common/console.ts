const reset = "\x1b[0m";
const bright = "\x1b[1m";
const dim = "\x1b[2m";
const underscore = "\x1b[4m";
const blink = "\x1b[5m";
const reverse = "\x1b[7m";
const hidden = "\x1b[8m";

const fgBlack = "\x1b[30m";
const fgRed = "\x1b[31m";
const fgGreen = "\x1b[32m";
const fgYellow = "\x1b[33m";
const fgBlue = "\x1b[34m";
const fgMagenta = "\x1b[35m";
const fgCyan = "\x1b[36m";
const fgWhite = "\x1b[37m";
const fgGray = "\x1b[90m";

const bgBlack = "\x1b[40m";
const bgRed = "\x1b[41m";
const bgGreen = "\x1b[42m";
const bgYellow = "\x1b[43m";
const bgBlue = "\x1b[44m";
const bgMagenta = "\x1b[45m";
const bgCyan = "\x1b[46m";
const bgWhite = "\x1b[47m";
const bgGray = "\x1b[100m";

export function info(message?: any, ...optionalParams: any[]): void {
    process.stdout.write(fgGreen);
    optionalParams && optionalParams.length > 0
        ? console.info(message, optionalParams)
        : console.info(message);
    process.stdout.write(reset);
}

export function debug(message?: any, ...optionalParams: any[]): void {
    process.stdout.write(fgYellow);
    optionalParams && optionalParams.length > 0
        ? console.debug(message, optionalParams)
        : console.debug(message);
    process.stdout.write(reset);
}
