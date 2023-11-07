
class Logger {
    constructor(logMsg = console.log, logWarn = console.warn, logError = console.error) {
        this.logMsg = logMsg;
        this.logWarn = logWarn;
        this.logError = logError;

        this.prefix = "VIVEK-DBG: ";
        this.enableTimeTag = true;
    }

    setPrefix(prefix = "") {
        this.prefix = prefix;
    }

    tagTime(enable) {
        this.enableTimeTag = enable;
    }

    getPrefix() {
        let prefix = '';
        if (this.prefix !== undefined && this.prefix)
            prefix = this.prefix;

        if (this.enableTimeTag) {
            let fixWidth = (input, length, padding) => {
                padding = String(padding || "0");
                return (padding.repeat(length) + input).slice(-length);
            }

            let date = new Date();
            prefix = `[${fixWidth(date.getUTCHours(), 2, 0)}:${fixWidth(date.getUTCMinutes(), 2, 0)}:${fixWidth(date.getUTCSeconds(), 2, 0)}:${fixWidth(date.getUTCMilliseconds(), 3, 0)}] ${prefix}`;
        }

        return prefix;
    }

    stringify(...msg) {
        msg.forEach((item, index) => { msg[index] = (typeof (item) == "object") ? JSON.stringify(item) : item; })
        return msg.join(', ');
    }

    log(...msg) {
        this.logMsg(this.getPrefix() + this.stringify(...msg));
        return msg;
    }

    warn(...msg) {
        this.logWarn(this.getPrefix() + this.stringify(...msg));
    }

    error(...msg) {
        this.logError(this.getPrefix() + this.stringify(...msg));
        return msg;
    }
}

var myLogger = new Logger();

function logMsg(...msg) {
    if (myLogger)
        myLogger.log(...msg);
    else
        console.log(...msg);
}

function logWarn(...msg) {
    if (myLogger)
        myLogger.warn(...msg);
    else
        console.warn(...msg);
}

function logError(...msg) {
    if (myLogger)
        myLogger.error(...msg);
    else
        console.error(...msg);
}