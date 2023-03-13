var params = {};

if(location.search != undefined && location.search != '') {
    location.search.substring(1).split('&').forEach((param) => {
        let kv = param.split('='); params[kv[0]] = kv[1]
    })
}

var name = '';
var peer = '';
var yourConn = null;

//connecting to our signaling server
var signallingServer;
var appEventHandler;

if(params.use_thunder != undefined && (params.use_thunder == true || params.use_thunder == 'true' || params.use_thunder == '1')) {
    params.use_thunder = true;
    var config = {
        host: '192.168.2.104',
        port: 9998,
        default: 1,
        token: ""
    };

    if(params.thunder_endpoint != undefined)
        config.host = params.thunder_endpoint;

    if(params.thunder_token != undefined)
        config.token = params.thunder_token;

    signallingServer = ThunderJS(config);

    if(signallingServer != undefined)
        console.log("Connected to the signaling server org.rdk.SignallingServer");

    signallingServer.sendMessage = (message) => {
        signallingServer.call("org.rdk.SignallingServer", "message", message)
            .then((result) => { if(result.success != true) console.log("Result of sending message : ", result); })
            .catch((error) => { console.log(error); });
    }

    signallingServer.on("org.rdk.SignallingServer", "event", (event) => {
        if(event.target != name && event.target != "*")
            return;

        // console.log("Got Thunder Event : ", event);

        if(appEventHandler != undefined)
            appEventHandler(event);
        else
            console.log("appEventHandler is not defined, events are not handled by app");
    });
} else {
    params.use_thunder = false;
    if(params.ws_endpoint === undefined) {
        params.ws_endpoint = '192.168.2.108:9090';
        console.log("No configs set for signalling server, defaulting to " + params.ws_endpoint);
    }
    signallingServer = new WebSocket('ws://' + params.ws_endpoint);

    signallingServer.onopen = function () {
        console.log("Connected to the signaling server " + params.ws_endpoint);
        tryAutoLogin();
    };

    signallingServer.onerror = function (err) {
        console.log("Got error", err);
    };

    signallingServer.sendMessage = (message) => {
        signallingServer.send(JSON.stringify(message));
    }

    signallingServer.onmessage = (msg) => {
        // console.log("Got ws:// message - " + JSON.stringify(msg.data));

        if(appEventHandler != undefined)
            appEventHandler(JSON.parse(msg.data));
        else
            console.log("appEventHandler is not defined, events are not handled by app");
    }
}

// alias for sending messages to signalling server
function send(message) {
    message.name = name;
    if (peer != undefined)
        message.peer = peer;

    console.log("Message to be sent : ", message);
    signallingServer.sendMessage(message);
};

function gotStreamFromUserMedia(myStream)
{
    console.log("Got the Stream from navigator.getUserMedia");
    var stream = myStream;

    if(window.webkitURL === undefined ){
        console.log('window.webkitURL not defined');
        //localAudio.src = stream;
    }
    else
    {
        //displaying local video stream on the page
        //localAudio.src = stream;

        try {
            localVideo.srcObject = stream;
            console.log('Assigned to srcObject of localVideo');
        } catch (error) {
            console.log(error);
            localVideo.src = URL.createObjectURL(stream);
            console.log('Assigned to src of localVideo');
        }

        console.log('Local Video Streaming');
    }

    stream.getTracks().forEach(function(track) {
        console.log('Adding track');
        yourConn.addTrack(track, stream);
    });

    if (yourConn.addStream === undefined) {
        console.log('addStream not defined');
    } else{
        // setup stream listening
        console.log('Adding stream');
        yourConn.addStream(stream);
    }
}

//******
//UI selectors block
//******

var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');

var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');
var hangUpBtn = document.querySelector('#hangUpBtn');

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

callPage.style.display = "none";

// Login when the user clicks the button
loginBtn.addEventListener("click", function (event) {
    if(name === undefined || name == '')
        name = usernameInput.value;

    if (name != '') {
        send({
            type: "login",
            name: name
        });
    }
});

function handleLogin(success) {
    if (success === false) {
        alert("Ooops...try a different username");
    } else {
        loginPage.style.display = "none";
        callPage.style.display = "block";

        //**********************
        //Starting a peer connection
        //**********************
        //using Google public stun server
        //sequence<RTCIceServer> iceServers = [{ "urls": "stun:stun2.1.google.com:19302" }];

        var configuration = {
            "iceServers" :[{ "urls": 'stun:stun2.1.google.com:19302' }]
        };

        try{
            yourConn = new webkitRTCPeerConnection(configuration);
            console.log("RTCPeerConnection created");
        } catch(exception){
            yourConn =  new RTCPeerConnection(configuration);
            console.log("RTCPeerConnection created in exception block");
        }

        yourConn.ontrack = function (e) {
            console.log("On Add track");
            try {
                remoteVideo.srcObject = e.streams[0];
                console.log('Assigned to srcObject of remoteVideo');
            } catch (error) {
                console.log(error);
                remoteVideo.src = URL.createObjectURL(e.streams[0]);
                console.log('Assigned to src of of remoteVideo');
            }
        };

        yourConn.onicecandidate = function (event) {
            if (event.candidate) {
                send({
                    type: "candidate",
                    candidate: event.candidate
                });
            }
        };

        //getting local video stream
        if (navigator.mediaDevices != undefined && navigator.mediaDevices.getUserMedia != undefined && name != "stb") {
            var hasUserMedia = navigator.mediaDevices.getUserMedia({ video: true });
            hasUserMedia
                .then(gotStreamFromUserMedia)
                .catch(function (err) {
                        console.log(err.name + ": " + err.message);
                });
        } else if (name == 'stb' && params.peer != undefined && params.peer != '') {
            // setTimeout(() => {
            //     callToUsernameInput.value = params.peer;
            //     callBtn.click();
            // }, 500);
        }
    }
};

//initiating a call
callBtn.addEventListener("click", function () {
    var callToUsername = callToUsernameInput.value;
    console.log("Calling " + callToUsernameInput.value);

    if (callToUsername.length > 0) {
        peer = callToUsername;

        // create an offer
        yourConn.createOffer().then(function(offer) {
            return yourConn.setLocalDescription(offer);
        }).then(function() {
            send({
                type: "offer",
                offer: yourConn.localDescription
            });
        }).catch(function(reason) {
            // An error occurred, so handle the failure to connect
            console.log("exception in creating offer" + reason);
        });
    }

    // document.getElementById("all").style.visibility = "hidden";
});

function handleCall() {
    var callToUsername = "stb";
    console.log("handleCall starting");

    if (callToUsername.length > 0) {
        peer = callToUsername;

        // create an offer
        yourConn.createOffer().then(function(offer) {
            return yourConn.setLocalDescription(offer);
        }).then(function(offer) {
            send({
                type: "offer",
                offer: offer
            });
            console.log(offer);
        }).catch(function(reason) {
            // An error occurred, so handle the failure to connect
            console.log("exception in creating offer" + reason);
        });
    }
};

//when somebody sends us an offer
function handleOffer(offer, peerFromEvent) {
    peer = peerFromEvent;
    yourConn.setRemoteDescription(new RTCSessionDescription(offer));

    //create an answer to an offer
    yourConn.createAnswer().then(function(answer) {
        console.log("promise resolved, setLocalDescription");
        return yourConn.setLocalDescription(answer);
    }).then(function() {
        // Send the answer to the remote peer through the signaling server.
        console.log("setLocalDescription success : Sending answer");
        send({
            type: "answer",
            answer: yourConn.currentLocalDescription
        });
    }).catch();
};

//when we got an answer from a remote user
function handleAnswer(answer) {
    console.log("Got answer");
    yourConn.setRemoteDescription(new RTCSessionDescription(answer));
};

//when we got an ice candidate from a remote user
function handleCandidate(candidate) {
    console.log("Got candidate");
    yourConn.addIceCandidate(new RTCIceCandidate(candidate));
};

//hang up
hangUpBtn.addEventListener("click", function () {
    send({ type: "leave" });
    handleLeave();
});

function handleLeave() {
    peer = null;
    // remoteVideo.src = null;
    // remoteAudio.srcObject = null;

    if (yourConn != undefined && yourConn != null) {
        yourConn.close();
        yourConn.onicecandidate = null;
        yourConn.onaddstream = null;
        yourConn = null;
    }
};

appEventHandler = function(event) {
    console.log("Processing Event : ", event);

    switch(event.type) {
        case "login":
            if(event.name == name)
                handleLogin(event.success);
            break;

        case "offer":
            handleOffer(event.offer, event.peer);
            break;

        case "answer":
            handleAnswer(event.answer);
            break;

        case "candidate":
            handleCandidate(event.candidate);
            break;

        case "leave":
            if(event.name == name)
                handleLeave();
            break;

        case "call":
            handleCall();
            break;

        default:
            break;
    }
}

function tryAutoLogin() {
    if((name === undefined || name == '') && params.name != undefined)
        name = params.name;

    loginBtn.click();
}

if (params.use_thunder) {
    window.onload = setTimeout(tryAutoLogin, 500);
}

window.onunload = (event) => {
    console.log("Unloading");
    send({ type: "leave" });
}

// window.onbeforeunload = window.onunload;
