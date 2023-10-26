let useLocalResources = false;

let videoInitUrls = [
    'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps_1280x720_4000k/bbb_30fps_1280x720_4000k_0.m4v',
]
let videoUrls = [
    'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps_1280x720_4000k/bbb_30fps_1280x720_4000k_$Number$.m4v',
]

let audioUrls = [
    'https://dash.akamaized.net/akamai/bbb_30fps/bbb_a64k/bbb_a64k_$Number$.m4a'
]
let audioInitUrls = [
    'https://dash.akamaized.net/akamai/bbb_30fps/bbb_a64k/bbb_a64k_0.m4a'
]

if (useLocalResources) {
    videoInitUrls = ['./big_buck_bunny_resource/bbb_30fps_1280x720_4000k_0.m4v']
    videoUrls = ['./big_buck_bunny_resource/bbb_30fps_1280x720_4000k_$Number$.m4v']
    audioInitUrls = ['./big_buck_bunny_resource/bbb_a64k_0.m4a']
    audioUrls = ['./big_buck_bunny_resource/bbb_a64k_$Number$.m4a']
}

const segmentDuration = 4.0  // seconds

function bufferIndexFromTime(time, segmentDuration = 4) {
    return Math.floor(time / segmentDuration) + 1;
}

function urlsThroughNumber(urlTemplate, start, end) {
    var result = []
    for (let i = start; i <= end; ++i)
        result.push(urlTemplate.replace('$Number$', i))
    return result
}

