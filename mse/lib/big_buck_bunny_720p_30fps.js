// Main manifests :
// http://dash.edgesuite.net/akamai/bbb_30fps/bbb_30fps.mpd
// https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd

class BBBContent extends BaseContent {
    constructor() {
        super();

        this.name = "bigbuckbunny"

        this.videoInitUrls = [
            'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps_1280x720_4000k/bbb_30fps_1280x720_4000k_0.m4v',
        ];
        this.videoUrls = [
            'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps_1280x720_4000k/bbb_30fps_1280x720_4000k_$Number$.m4v',
        ];

        this.audioInitUrls = [
            'https://dash.akamaized.net/akamai/bbb_30fps/bbb_a64k/bbb_a64k_0.m4a'
        ];
        this.audioUrls = [
            'https://dash.akamaized.net/akamai/bbb_30fps/bbb_a64k/bbb_a64k_$Number$.m4a'
        ];

        this.videoCodec = 'video/mp4; codecs="avc1.640028"';
        this.audioCodec = 'audio/mp4; codecs="mp4a.40.2"';
        this.contentStartsFrom = 1;
        this.segmentDuration = 4;
    }
};