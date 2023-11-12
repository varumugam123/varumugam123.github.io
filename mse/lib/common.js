var searchParams = (new URL(document.location)).searchParams
var checkProp = (prop) => { let propVal = searchParams.get(prop); return (propVal === 'on' || propVal === 'true'); }
var getParamValue = (param) => { let val = parseFloat(searchParams.get(param), 10); return isNaN(val) ? -1 : val; }

var logEvents = checkProp('logEvents')
var moderateTimeupdateLogging = checkProp('moderateTimeupdateLogging')
var cacheMediaBeforeTest = checkProp('cacheMediaBeforeTest')

var ms = null
var video = document.querySelector('video')
var audio = document.querySelector('audio')
const gMediaElement = (audio !== undefined && audio) ? audio : video

if (window.checkTestCaseAPI) {
    checkTestCaseAPI();
} else {
    logMsg("checkTestCaseAPI() is not found, running in Non-RDK browser");
    function reportFail(status, msg) { logMsg(((msg === undefined) ? "Success" : msg)); }
    function reportPass(status, msg) { logMsg(((msg === undefined) ? "Success" : msg)); }
}

document.addEventListener('DOMContentLoaded', function () {
    scheduleTask(() => {
        initApp(gMediaElement)
    }, 0)
})

function initApp(mediaElement = gMediaElement) {
    mediaElement.installEventHandlers = function () {
        var lastLoggedEvent = 'timeupdate'
        var lastLoggedTime = 0
        mediaElement.genericEventHandler = (e) => {
            lastLoggedEvent = e.name;
            if (logEvents)
                logMsg("Received event: " + e.type + " @ " + mediaElement.currentTime);
        }
        mediaElement.timeUpdateEventHandler = (e) => {
            if (moderateTimeupdateLogging ? ((lastLoggedEvent != 'timeupdate') || ((mediaElement.currentTime - lastLoggedTime) >= 1)) : true) {
                lastLoggedEvent = 'timeupdate';
                lastLoggedTime = mediaElement.currentTime
                logMsg("Received event: timeupdate @ " + lastLoggedTime);
            }
        }

        mediaElement.events = ['abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'encrypted',
            'ended', 'error', 'loadeddata', 'loadedmetadata', 'loadstart', 'pause', 'play', 'playing',
            'progress', 'ratechange', 'seeked', 'seeking', 'stalled', 'suspend', 'volumechange', 'waiting'];
        mediaElement.events.forEach((event) => { mediaElement.addEventListener(event, mediaElement.genericEventHandler); });
        mediaElement.addEventListener('timeupdate', mediaElement.timeUpdateEventHandler);
    }

    mediaElement.removeEventHandlers = function () {
        if (mediaElement.events === undefined || mediaElement.events == null)
            return;
        mediaElement.events.forEach((event) => { mediaElement.removeEventListener(event, mediaElement.genericEventHandler); });
        mediaElement.removeEventListener('timeupdate', mediaElement.timeUpdateEventHandler);
    }

    mediaElement.installEventHandlers();
}

function initializeMSE(mediaElement = gMediaElement) {
    ms = new MediaSource()
    waitForEvent(ms, 'sourceopen', 10000).then(onSourceOpen).catch((e) => { logMsg("Failed to open MediaSource, " + e); });
    mediaElement.src = window.URL.createObjectURL(ms)
}

function checkForPlaying(mediaElement = gMediaElement) {
    return (mediaElement.currentTime > 0 && !mediaElement.paused && !mediaElement.ended && mediaElement.readyState > 2);
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

function waitForCondition(condition, duration, reason, peepInterval = 1000) {
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
                    let delay = (timeout > peepInterval) ? peepInterval : timeout;
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

function monitorTimePolling(expectedTime, interval, counter, timeStepFunction, breakerFunction, reason, mediaElement = gMediaElement) {
    let wrapper = () => {
        let expected = expectedTime;
        let count = counter;
        let id = -1;
        let delay = interval;

        return new InterruptablePromise((resolve, reject) => {
            let lastReadPosition = -1;
            let checkTime = () => {
                if (breakerFunction !== undefined && breakerFunction && breakerFunction()) {
                    clearTimer(id);
                    resolve("Breaker function returned true");
                    return;
                }

                let currentTime = mediaElement.currentTime
                let shouldProceedOnBackwardJump = false;

                if (lastReadPosition != -1 && currentTime < lastReadPosition) {
                    logWarn("Time jumped backward from " + lastReadPosition + " to " + currentTime + "!!!");
                    shouldProceedOnBackwardJump = true;
                }

                if (currentTime >= expected || (expected - currentTime) < 0.066 || shouldProceedOnBackwardJump) {
                    lastReadPosition = currentTime;
                    if (count > 0) {
                        count--;

                        if (timeStepFunction !== undefined && timeStepFunction)
                            expected = currentTime + timeStepFunction(currentTime);

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
            let lastReadPosition = -1;
            let checkTime = () => {
                if (breakerFunction !== undefined && breakerFunction()) {
                    cleanUp();
                    resolve("Breaker function returned true");
                    return;
                }

                let currentTime = element.currentTime
                let shouldProceedOnBackwardJump = false;

                if (lastReadPosition != -1 && currentTime < lastReadPosition) {
                    logWarn("Time jumped backward from " + lastReadPosition + " to " + currentTime + "!!!");
                    shouldProceedOnBackwardJump = true;
                }

                if (currentTime >= expected || (expected - currentTime) <= 0.066 || shouldProceedOnBackwardJump) {
                    lastReadPosition = currentTime;
                    if (count > 0) {
                        count--;

                        if (timeStepFunction !== undefined && timeStepFunction)
                            expected = currentTime + timeStepFunction(currentTime);
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

function cacheMediaIfRequired(urlsToCache = []) {
    return new InterruptablePromise((resolve, reject) => {
        if (Feeder !== undefined && cacheMediaBeforeTest) {
            let urls = urlsToCache
            if (urls === undefined || urls == null || urls.length == 0) {
                logMsg("Caching media was enbaled but no urls provided, skipping caching");
                resolve();
                return;
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

function logSourceBufferInfo(buffer, mediaElement = gMediaElement) {
    for (let i = 0; i < buffer.buffered.length; ++i) {
        logMsg((mediaElement ? "mediaElement" : "Audio") + " Buffer info: " + i + ", [" + buffer.buffered.start(i) + " - " + buffer.buffered.end(i) + "]");
    }
}

function logAllSourceBufferInfo() {
    forAllSourceBuffers(logSourceBufferInfo);
}

// Ref : https://dev.to/ycmjason/how-to-create-range-in-javascript-539i#:~:text=range%20is%20a%20function%20that,be%20using%20a%20for%20loop.
function range(start, end) {
    if (end === undefined) {
        end = start;
        start = 0;
    }

    return ((s, e) => e > s ? Array(e - s + 1).fill(0).map((x, y) => y + s) : Array(s - e + 1).fill(0).map((x, y) => - y + s))(start, end);
}

function bufferIndexFromTime(time, segmentDuration = 4, segmentsStartFrom = 1) {
    return Math.floor(time / segmentDuration) + segmentsStartFrom;
}

function urlsThroughNumber(urlTemplate, start, end) {
    return range(start, end).map((i) => urlTemplate.replace('$Number$', i));
}

function nextDivisibleNumber(number, divisor) {
    return Math.ceil((number > 0 ? (number - 0.001) : number) / divisor) * divisor;
}

class BaseContent {
    constructor() {
        this.name = "base"

        this.videoInitUrls = [];
        this.videoUrls = [];

        this.audioInitUrls = [];
        this.audioUrls = [];

        this.videoCodec = '';
        this.audioCodec = '';
        this.contentStartsFrom = 0;
        this.segmentDuration = 0;
    }

    getUrls(video, sIndex, eIndex, includeInit = false) {
        let dataUrl = (video ? this.videoUrls : this.audioUrls)[0]
        let urls = urlsThroughNumber(dataUrl, sIndex, eIndex);
        if (includeInit)
            urls.unshift("init_" + (video ? this.videoInitUrls : this.audioInitUrls)[0]);
        return urls;
    }

    getVideoUrls(sIndex, eIndex, includeInit = false) {
        return this.getUrls(true, sIndex, eIndex, includeInit);
    }

    getAudioUrls(sIndex, eIndex, includeInit = false) {
        return this.getUrls(false, sIndex, eIndex, includeInit);
    }

    getUrlsForTime(video, start, end, includeInit = false) {
        let startSegment = bufferIndexFromTime(start, this.segmentDuration, this.contentStartsFrom);
        let endSegment = bufferIndexFromTime(end, this.segmentDuration, this.contentStartsFrom);
        return this.getUrls(video, startSegment, endSegment, includeInit);
    }

    getVideoUrlsForTime(start, end, includeInit = false) {
        return this.getUrlsForTime(true, start, end, includeInit);
    }

    getAudioUrlsForTime(start, end, includeInit = false) {
        return this.getUrlsForTime(false, start, end, includeInit);
    }
};

// Cleanup functions

function performCommonCleanup(mediaElement = gMediaElement) {
    mediaElement.pause();
    mediaElement.removeEventHandlers();
    clearAllTimers();
    performFeederCleanup();

    waitForTime(3000).then(() => {
        mediaElement.src = ''
        mediaElement.remove()
        ms = null
    }).catch((e) => { logMsg("Failed to remove media element, " + e); });
}
