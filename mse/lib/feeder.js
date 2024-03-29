
var gCachedData = {};

function Feeder(sourceBuffer, urls, endedCb, onAppendComplete, isVideo) {
    this.appendComplete = onAppendComplete;

    this.endedCb = function () {
        if (this.sourceBuffer !== undefined && this.sourceBuffer)
            this.sourceBuffer.onupdateend = undefined;
        if (endedCb !== undefined && endedCb != null)
            endedCb();
    }

    this.fetchAndAppendNextFragment = function () {
        if (!this.sourceBuffer || (this.sourceBuffer && this.sourceBuffer.updating) || this.urls.length == 0 || this.ended)
            return

        if (this.fetchindex == this.urls.length) {
            logMsg("All " + (isVideo ? "video" : "audio") + " buffers are processed");
            this.sourceBuffer.onupdateend = null;
            this.ended = true
            this.endedCb()
        } else {
            this.fetchAndAppend(this.urls[this.fetchindex])
        }
    }

    this.onUpdateEnd = function (e) {
        this.fetchindex++;

        // If we need to report only the data buffer append completion
        if (false) {
            const numberOfInitSegmentsPushedSoFar = this.initSegmentPositions.filter((value) => { return value < this.fetchindex; }).length;
            this.bufferCount = this.fetchindex - numberOfInitSegmentsPushedSoFar;
        } else {
            this.bufferCount++;

        }

        if (this.bufferCount > 0 && this.appendComplete !== undefined && this.appendComplete)
            this.appendComplete(isVideo, (this.bufferCount / this.urls.length) * 100)

        this.fetchAndAppendNextFragment();
    }

    this.appendToBuffer = function (videoChunk, url) {
        try {
            if (this.sourceBuffer !== undefined && this.sourceBuffer) {
                logMsg((sourceBuffer.isCachingBuffer ? "caching: " : "append: ") + url)
                this.sourceBuffer.appendBuffer(new Uint8Array(videoChunk))
            } else {
                logMsg('simulate append: ' + url)
                this.onUpdateEnd(null)
            }
        } catch (e) {
            console.error('Failed to append');
        }
    }

    this.fetch = function (url, completionHandler) {
        if (this.xhr)
            throw 'Cannot fetch "' + url + '"'

        if (gCachedData[url] !== undefined) {
            completionHandler({ status: 200, response: gCachedData[url] }, url);
            return;
        }

        logMsg('fetch: ' + url)
        var xhr = new XMLHttpRequest()
        xhr.open('GET', url)
        xhr.responseType = 'arraybuffer'
        xhr.onload = (e) => {
            var xhr = this.xhr
            this.xhr = null
            if (xhr.status == 200)
                gCachedData[url] = xhr.response;
            completionHandler(xhr, url)
        }
        xhr.send()
        this.xhr = xhr
    }

    this.fetchAndAppend = function (url) {
        if (url.substr(0, 5) == "init_") {
            this.initSegmentPositions.push(this.fetchindex);
            url = url.substr(5);
        }

        this.fetch(url, (xhr, url) => {
            if (xhr.status != 200) {
                console.error('Load failed. Unexpected status code ' + xhr.status + ' for ' + url)
                this.ended = true
                this.endedCb()
                return
            }

            this.appendToBuffer(xhr.response, url)
        })
    }

    this.abort = function () {
        if (this.xhr !== undefined && this.xhr) {
            this.xhr.abort()
            this.xhr = null
        }
    }

    this.xhr = undefined
    this.urls = urls
    this.ended = false
    this.fetchindex = 0
    this.bufferCount = 0
    this.initSegmentPositions = [];

    this.sourceBuffer = sourceBuffer
    this.sourceBuffer.onupdateend = (e) => { this.onUpdateEnd() }

    scheduleTask(() => { this.fetchAndAppendNextFragment(); }, 10);
}

// Utility functions

var feeders = { video: null, audio: null }

function forAllFeeders(doSomething) {
    // for (let key in feeders) {
    //     if (feeders.hasOwnProperty(key) && feeders[key] && !(feeders[key].ended)) {
    //     }
    // }
    if (feeders !== undefined && feeders != null) {
        [true, false].forEach((isVideo) => {
            let feeder = isVideo ? feeders.video : feeders.audio;
            if (feeder !== undefined && feeder)
                doSomething(feeder, isVideo);
        });
    }
}

function forAllSourceBuffers(doSomething) {
    forAllFeeders((feeder, isVideo) => {
        if (feeder.sourceBuffer !== undefined && feeder.sourceBuffer)
            doSomething(feeder.sourceBuffer, isVideo);
    });
}

function allFeedersMeetCondition(predicate) {
    let feederCount = 0;
    let feederMeetConditionCount = 0;
    forAllFeeders((feeder, isVideo) => {
        ++feederCount;
        if (predicate(feeder, isVideo))
            ++feederMeetConditionCount;
    });
    return feederCount == feederMeetConditionCount;
}

function allBuffersMeetCondition(predicate) {
    let bufferCount = 0;
    let bufferMeetConditionCount = 0;
    forAllSourceBuffers((buffer, isVideo) => {
        ++bufferCount;
        if (predicate(buffer, isVideo))
            ++bufferMeetConditionCount;
    });
    return bufferCount == bufferMeetConditionCount;
}

function performFeederCleanup() {
    forAllFeeders((feeder, isVideo) => {
        feeder.abort();
        if (feeder.sourceBuffer)
            feeder.sourceBuffer.abort();
    });
    feeders = { video: null, audio: null }
}


