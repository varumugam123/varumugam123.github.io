var searchParams = (new URL(document.location)).searchParams
var checkProp = (prop) => { return (prop === 'on' || prop === 'true'); }
var getParamValue = (searchParam, param) => { let val = parseFloat(searchParam.get(param), 10); return isNaN(val) ? -1 : val; }

var logEvents = checkProp(searchParams.get('logEvents'))
var moderateTimeupdateLogging = checkProp(searchParams.get('moderateTimeupdateLogging'))

var ms = null
var video = document.querySelector('video')

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initApp, 0)
})

function initApp() {
    ms = new MediaSource()
    ms.addEventListener('sourceopen', onSourceOpen)

    video.src = window.URL.createObjectURL(ms)

    var lastLoggedEvent = 'timeupdate'
    var lastLoggedTime = 0
    const events = ['abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'encrypted', 'ended', 'error', 'loadeddata', 'loadedmetadata', 'loadstart', 'pause', 'play', 'playing', 'progress', 'ratechange', 'seeked', 'seeking', 'stalled', 'suspend', 'volumechange', 'waiting'];
    for (let event in events) {
        video.addEventListener(events[event], function (e) {
            lastLoggedEvent = events[event];
            if (logEvents)
                console.log("VIVEK-DBG: Received event: " + events[event] + " @ " + video.currentTime);
        })
        // console.log("VIVEK-DBG: Added event listener for: " + events[event]);
    }
    video.addEventListener('timeupdate', function (e) {
        if (moderateTimeupdateLogging ? ((lastLoggedEvent != 'timeupdate') || ((video.currentTime - lastLoggedTime) > 1)) : true) {
            lastLoggedEvent = 'timeupdate';
            lastLoggedTime = video.currentTime
            console.log("VIVEK-DBG: Received event: timeupdate @ " + lastLoggedTime);
        }
    })
}

function waitForTime(delay) {
    let wrapper = () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => { resolve(); }, delay);
        });
    };
    return wrapper();
}

function waitForCondition(condition, duration, reason) {
    let wrapper = () => {
        let timeout = duration
        let predicate = condition
        let id = -1

        return new Promise((resolve, reject) => {
            var checkCondition = () => {
                clearTimeout(id)
                if (predicate()) {
                    resolve();
                    return
                }

                if (timeout <= 0) {
                    reject(reason === undefined ? "Timeout waiting for condition" : reason);
                } else {
                    id = setTimeout(checkCondition, timeout);
                    timeout = 0;
                }
            }

            checkCondition();
        });
    };
    return wrapper();
}

function waitForEvent(element, event, duration, errormsg) {
    let wrapper = () => {
        let id = -1
        let timeout = duration
        return new Promise((resolve, reject) => {
            let onEvent = function () {
                clearTimeout(id)
                element.removeEventListener(event, onEvent)
                resolve();
            }

            element.addEventListener(event, onEvent)

            if (timeout <= 0) {
                reject(errormsg === undefined ? ("Timeout waiting for event " + event) : errormsg);
            } else {
                id = setTimeout(() => {
                    element.removeEventListener(event, onEvent)
                    reject(errormsg === undefined ? ("Timeout waiting for event " + event) : errormsg);
                }, timeout);
            }
        });
    };
    return wrapper();
}

// function waitForPromiseSync(promise) {
//     let wrapper = async () => {
//         console.log("Before waiting for promise");
//         let result = await promise.catch((e) => { console.log(e); return false; })
//         console.log("After waiting for promise");
//         return result;
//     };
//     wrapper();
// }

