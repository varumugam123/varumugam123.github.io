var searchParams = (new URL(document.location)).searchParams
var checkProp = (prop) => { let propVal = searchParams.get(prop); return (propVal === 'on' || propVal === 'true'); }
var getParamValue = (param) => { let val = parseFloat(searchParams.get(param), 10); return isNaN(val) ? -1 : val; }

var logEvents = checkProp('logEvents')
var moderateTimeupdateLogging = checkProp('moderateTimeupdateLogging')
var cacheMediaBeforeTest = checkProp('cacheMediaBeforeTest')
var mediaContent;

var ms = null
var video = document.querySelector('video')

class Logger {
    constructor(logger = console.log) {
        this.logger = logger;
        this.prefix = "VIVEK-DBG: ";
        this.enableTimeTag = true;
    }

    setPrefix(prefix = "") {
        this.prefix = prefix;
    }

    tagTime(enable) {
        this.enableTimeTag = enable;
    }

    log(msg) {
        if (this.prefix !== undefined && this.prefix)
            msg = this.prefix + msg;

        if (this.enableTimeTag) {
            let fixWidth = (input, length, padding) => {
                padding = String(padding || "0");
                return (padding.repeat(length) + input).slice(-length);
            }

            let date = new Date();

            msg = `[${fixWidth(date.getUTCHours(), 2, 0)}:${fixWidth(date.getUTCMinutes(), 2, 0)}:${fixWidth(date.getUTCSeconds(), 2, 0)}:${fixWidth(date.getUTCMilliseconds(), 3, 0)}] ${msg}`;
        }

        this.logger(msg);

        return msg;
    }
}

var myLogger = new Logger();

function logMsg(msg) {
    if (myLogger)
        myLogger.log(msg);
    else
        console.log("VIVEK-DBG: " + msg);
}

if (window.checkTestCaseAPI) {
    checkTestCaseAPI();
} else {
    logMsg("checkTestCaseAPI() is not found, running in Non-RDK browser");
    function reportFail(status, msg) { logMsg(((msg === undefined) ? "Success" : msg)); }
    function reportPass(status, msg) { logMsg(((msg === undefined) ? "Success" : msg)); }
}

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initApp, 0)
})

function initApp() {
    video.installEventHandlers = function () {
        var lastLoggedEvent = 'timeupdate'
        var lastLoggedTime = 0
        video.genericEventHandler = (e) => {
            lastLoggedEvent = e.name;
            if (logEvents)
                logMsg("Received event: " + e.type + " @ " + video.currentTime);
        }
        video.timeUpdateEventHandler = (e) => {
            if (moderateTimeupdateLogging ? ((lastLoggedEvent != 'timeupdate') || ((video.currentTime - lastLoggedTime) >= 1)) : true) {
                lastLoggedEvent = 'timeupdate';
                lastLoggedTime = video.currentTime
                logMsg("Received event: timeupdate @ " + lastLoggedTime);
            }
        }

        video.events = ['abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'encrypted',
            'ended', 'error', 'loadeddata', 'loadedmetadata', 'loadstart', 'pause', 'play', 'playing',
            'progress', 'ratechange', 'seeked', 'seeking', 'stalled', 'suspend', 'volumechange', 'waiting'];
        video.events.forEach((event) => { video.addEventListener(event, video.genericEventHandler); });
        video.addEventListener('timeupdate', video.timeUpdateEventHandler);
    }

    video.removeEventHandlers = function () {
        if (video.events === undefined || video.events == null)
            return;
        video.events.forEach((event) => { video.removeEventListener(event, video.genericEventHandler); });
        video.removeEventListener('timeupdate', video.timeUpdateEventHandler);
    }

    cacheMediaIfRequiredSync().then(() => {
        ms = new MediaSource()
        waitForEvent(ms, 'sourceopen', 10000).then(onSourceOpen).catch((e) => { logMsg("Failed to open MediaSource, " + e); });

        video.installEventHandlers();
        video.src = window.URL.createObjectURL(ms)
    });
}

function checkForPlaying() {
    return (video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
}

// Scheduling functions

var gTimerIds = []

function clearTimer(id) {
    clearTimeout(id)
    gTimerIds = gTimerIds.filter((val) => { return val != id })
}

function clearAllTimers() {
    gTimerIds.forEach(clearTimeout)
    gTimerIds = []
}

function scheduleTask(t, delay) {
    let wrapper = () => {
        let id = -1;
        let task = t;
        id = setTimeout(() => {
            clearTimer(id);
            task();
        }, delay);
        gTimerIds.push(id);
        return id;
    }
    return wrapper();
}

class InterruptablePromise {
    constructor(handler, cleanupFunction) {
        this.promise = new Promise((resolve, reject) => {
            this.forceResolve = (args) => {
                if (cleanupFunction !== undefined && cleanupFunction)
                    cleanupFunction();
                resolve(args);
            };

            this.forceReject = (args) => {
                if (cleanupFunction !== undefined && cleanupFunction)
                    cleanupFunction();
                reject(args);
            };

            handler(resolve, reject);
        });
    }

    then(onResolve, onReject) {
        return this.promise.then(onResolve, onReject);
    }

    catch(onReject) {
        return this.promise.catch(onReject);
    }

    finally(onFinally) {
        return this.promise.finally(onFinally);
    }
}

function waitForTime(delay) {
    let wrapper = () => {
        let id = -1;
        return new InterruptablePromise((resolve, reject) => {
            id = scheduleTask(resolve, delay);
        }, () => { clearTimer(id); });
    };

    return wrapper();
}

function waitForCondition(condition, duration, reason) {
    let wrapper = () => {
        let timeout = duration
        let predicate = condition
        let id = -1

        return new InterruptablePromise((resolve, reject) => {
            var checkCondition = () => {
                if (predicate()) {
                    resolve();
                    return
                }

                if (timeout <= 0) {
                    reject(reason === undefined ? "Timeout waiting for condition" : reason);
                } else {
                    let delay = timeout > 1000 ? 1000 : timeout;
                    timeout -= delay;
                    id = scheduleTask(checkCondition, delay);
                }
            }

            checkCondition();
        }, () => { clearTimer(id); });
    };

    return wrapper();
}

function waitForEvent(element, event, duration, errormsg) {
    let wrapper = () => {
        let id = -1
        let timeout = duration
        let eventHandler = null

        function cleanUp() {
            clearTimer(id)
            element.removeEventListener(event, eventHandler)
        }

        return new InterruptablePromise((resolve, reject) => {
            eventHandler = function onEvent() {
                cleanUp();
                resolve();
            }

            element.addEventListener(event, eventHandler)

            if (timeout <= 0) {
                reject(errormsg === undefined ? ("Timeout waiting for event " + event) : errormsg);
            } else {
                id = scheduleTask(() => {
                    cleanUp();
                    reject(errormsg === undefined ? ("Timeout waiting for event " + event) : errormsg);
                }, timeout);
            }
        }, () => { cleanUp(); });
    };

    return wrapper();
}

function monitorTimePolling(expectedTime, interval, counter, timeStepFunction, breakerFunction, reason) {
    let wrapper = () => {
        let expected = expectedTime;
        let count = counter;
        let id = -1;
        let delay = interval;

        return new InterruptablePromise((resolve, reject) => {
            let checkTime = () => {
                if (breakerFunction !== undefined && breakerFunction && breakerFunction()) {
                    clearTimer(id);
                    resolve("Breaker function returned true");
                    return;
                }

                let currentTime = video.currentTime
                if (currentTime >= expected || (expected - currentTime) < 0.066) {
                    if (count > 0) {
                        count--;

                        if (timeStepFunction !== undefined && timeStepFunction)
                            expected = currentTime + timeStepFunction();

                        id = scheduleTask(checkTime, delay);
                    } else {
                        clearTimer(id);
                        resolve();
                    }
                    return;
                }

                clearTimer(id);
                reject(reason ? reason : ("Timeout waiting for time " + expected + ", monitorTime failed @ count " + count + ", current time " + currentTime));
            }

            checkTime();
        });
    }

    return wrapper();
}

function monitorTimeOnUpdateEvent(element, expectedTime, counter, timeStepFunction, breakerFunction, reason) {
    let wrapper = () => {
        let expected = expectedTime;
        let count = counter;
        let id = -1;

        return new InterruptablePromise((resolve, reject) => {
            let checkTime = () => {
                if (breakerFunction !== undefined && breakerFunction()) {
                    cleanUp();
                    resolve("Breaker function returned true");
                    return;
                }

                let currentTime = video.currentTime
                if (currentTime >= expected || (expected - currentTime) <= 0.066) {
                    if (count > 0) {
                        count--;

                        if (timeStepFunction !== undefined && timeStepFunction)
                            expected = currentTime + timeStepFunction();
                    } else {
                        cleanUp(id);
                        resolve();
                    }
                    return;
                }

                cleanUp();
                reject(reason ? reason : ("Timeout waiting for time " + expected + ", monitorTime failed @ count " + count + ", current time " + currentTime));
            }

            function cleanUp() {
                element.removeEventListener('timeupdate', checkTime);
                clearTimer(id);
            }

            id = waitForEvent(element, 'timeupdate', 10000, "Failed to receive timeupdate event").catch(() => {
                cleanUp();
                reject("Failed to receive timeupdate event");
            });

            element.addEventListener('timeupdate', checkTime);
        });
    }

    return wrapper();
}

function cacheMediaIfRequiredSync(urlsToCache = []) {
    return new InterruptablePromise((resolve, reject) => {
        if (Feeder !== undefined && cacheMediaBeforeTest) {
            let urls = urlsToCache
            if (urls === undefined || urls == null || urls.length == 0) {
                if (mediaContent !== undefined && mediaContent === 'bigbucksbunny') {
                    logMsg("Caching big buck bunny media");
                } else {
                    logMsg("Caching media was enbaled but no urls provided, skipping caching");
                    resolve();
                    return;
                }

                urls = urls.concat(urlsThroughNumber(videoUrls[0], 0, 5));
                urls = urls.concat(urlsThroughNumber(audioUrls[0], 0, 5));
            }

            new Feeder(
                {
                    isCachingBuffer: true,
                    updating: false,
                    appendBuffer: function (data) { if (this.onupdateend !== undefined && this.onupdateend) { this.onupdateend(); } }
                },
                urls, () => {
                    logMsg("Cached media");
                    resolve();
                }, null, 1);
        } else {
            resolve();
        }
    });
}

function logSourceBufferInfo(buffer, video) {
    for (let i = 0; i < buffer.buffered.length; ++i) {
        logMsg((video ? "Video" : "Audio") + " Buffer info: " + i + ", [" + buffer.buffered.start(i) + " - " + buffer.buffered.end(i) + "]");
    }
}

function logAllSourceBufferInfo() {
    forAllSourceBuffers(logSourceBufferInfo);
}

// Ref : https://dev.to/ycmjason/how-to-create-range-in-javascript-539i#:~:text=range%20is%20a%20function%20that,be%20using%20a%20for%20loop.
const rangeImpl = (s, e) => e > s ? Array(e - s + 1).fill(0).map((x, y) => y + s) : Array(s - e + 1).fill(0).map((x, y) => - y + s);
function range(start, end) {
    if (end === undefined) {
        end = start;
        start = 0;
    }
    return rangeImpl(start, end);
}

function bufferIndexFromTime(time, segmentDuration = 4, segmentsStartFrom = 1) {
    return Math.floor(time / segmentDuration) + segmentsStartFrom;
}

function urlsThroughNumber(urlTemplate, start, end) {
    return range(start, end).map((i) => urlTemplate.replace('$Number$', i));
}

function nextDivisibleNumber(number, divisor) {
    return Math.ceil((number - 0.001) / divisor) * divisor;
}

// Cleanup functions

function performCommonCleanup() {
    video.pause();
    video.removeEventHandlers();
    clearAllTimers();
    performFeederCleanup();

    ms = null
    waitForTime(3000).then(() => {
        video.src = ''
        video.remove()
    }).catch((e) => { logMsg("Failed to remove video, " + e); });
}
