// Main manifests :
// HLS : https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8
// DASH : https://bitdash-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd

// Other test content :
// http://dash.edgesuite.net/akamai/
// https://dash.akamaized.net/akamai/

class RedBullContent extends BaseContent {
    constructor() {
        super();

        this.name = "redbull"

        this.videoInitUrls = [
            'https://bitdash-a.akamaihd.net/content/MI201109210084_1/video/720_2400000/dash/init.mp4'
        ];
        this.videoUrls = [
            'https://bitdash-a.akamaihd.net/content/MI201109210084_1/video/720_2400000/dash/segment_$Number$.m4s'
        ];

        this.audioInitUrls = [
            'https://bitdash-a.akamaihd.net/content/MI201109210084_1/audio/1_stereo_128000/dash/init.mp4'
        ];
        this.audioUrls = [
            'https://bitdash-a.akamaihd.net/content/MI201109210084_1/audio/1_stereo_128000/dash/segment_$Number$.m4s'
        ];

        this.videoCodec = 'video/mp4; codecs="avc1.42c00d"';
        this.audioCodec = 'audio/mp4; codecs="mp4a.40.2"';
        this.contentStartsFrom = 0;
        this.segmentDuration = 4;
    }
};