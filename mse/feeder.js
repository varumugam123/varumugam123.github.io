function Feeder(sourceBuffer, urls, endedCb, onAppendComplete, isVideo) {
    this.endedCb = endedCb
    this.appendComplete = onAppendComplete;

    this.onUpdateEnd = function (e) {
        if (this.sourceBuffer.updating || this.urls.length == 0 || this.ended)
            return

        if (this.fetchindex > 0 && this.appendComplete !== undefined && this.appendComplete != null)
            this.appendComplete(isVideo, (this.fetchindex / this.urls.length) * 100)

        if (this.fetchindex == this.urls.length) {
            this.sourceBuffer.onupdateend = undefined
            console.log("VIVEK-DBG: All " + (isVideo ? "video" : "audio") + " buffers are pushed");
            this.ended = true
            this.xhr = undefined
            this.endedCb()
        } else {
            var url = this.urls[this.fetchindex];
            this.fetchAndAppend(url)
            this.fetchindex++
        }
    }

    this.appendToBuffer = function (videoChunk, url) {
        try {
            console.log('VIVEK-DBG: appendToBuffer: ' + url)
            this.sourceBuffer.appendBuffer(new Uint8Array(videoChunk))
        } catch (e) {
            console.error('Failed to append');
        }
    }

    this.fetchAndAppend = function (url) {
        if (this.xhr)
            throw 'Cannot fetch "' + url + '"'

        if (this.cachedData[url] !== undefined) {
            this.appendToBuffer(this.cachedData[url], url);
            return;
        }

        console.log('VIVEK-DBG: fetchAndAppend: ' + url)
        var xhr = new XMLHttpRequest()
        xhr.open('GET', url)
        xhr.responseType = 'arraybuffer'
        xhr.onload = (e) => {
            var xhr = this.xhr
            this.xhr = null
            if (xhr.status != 200) {
                console.error('Load failed. Unexpected status code ' + xhr.status + ' for ' + url)
                this.ended = true
                this.endedCb()
                return
            }

            this.cachedData[url] = xhr.response;
            this.appendToBuffer(xhr.response, url)
        }
        xhr.send()
        this.xhr = xhr
    }

    sourceBuffer.feeder = this;

    this.ended = false
    this.fetchindex = 0
    this.xhr = undefined
    this.urls = urls
    this.cachedData = {};

    this.sourceBuffer = sourceBuffer
    this.sourceBuffer.onupdateend = (e) => { this.onUpdateEnd() }

    this.onUpdateEnd()
}