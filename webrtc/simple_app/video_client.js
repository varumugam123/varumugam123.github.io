//our username 
var params = {};
location.search.substring(1).split('&').forEach((param) => {let kv = param.split('='); params[kv[0]] = kv[1]})
  
var name; 
var peer;
  
var yourConn; 
var stream;
var handlersInstalled;

//connecting to our signaling server
//var conn = new WebSocket('ws://192.168.2.108:9090');

var config = {
    host: '192.168.2.104', // ipAddr of device running Thunder
    port: 9998,
    default: 1,
    token: ""
};

tc = ThunderJS(config);
  
function gotStream(myStream)
{ 
    console.log("Got the Stream - manual login");
    stream = myStream; 

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
            console.log('Assigned to srcObject');
        } catch (error) {
            console.log(error);
            localVideo.src = URL.createObjectURL(stream);
        }

        console.log('Local Video Streaming');
    }

    // stream.getTracks().forEach(function(track) {
    //         console.log('Adding track');
    //         yourConn.addTrack(track, stream);
    // });

    if (yourConn.addStream === undefined) {
        console.log('add stream not defined');
    } else{
        // setup stream listening 
        yourConn.addStream(stream); 
        console.log('add stream defined');
    }

    /*
    //when a remote user adds stream to the peer connection, we display it 
    yourConn.ontrack = function (e) { 
        console.log("On  Add track");
        //var c = document.getElementById("canvas1");
        //var ctx = c.getContext("2d");
        //ctx.fillStyle = "#FF0000";
        //ctx.fillRect(20, 20, 150, 100);

        if(window.webkitURL === undefined ){
            //remoteVideo.src = e.stream;
            console.log('window.webkitURL not defined - Remote VIdeo/Audio Stream');
        } else {
            try {
                remoteVideo.srcObject = e.streams[0];
                console.log('Assigned to srcObject');
            } catch (error) {
                console.log(error);
                remoteVideo.src = URL.createObjectURL(stream);
                console.log('Assigned to src');
            }    
            remoteVideo.src = window.URL.createObjectURL(e.stream); 
            remoteVideo.src = e.stream;
            console.log('window.webkitURL defined.. Remote Audio/Video Stream');
        }
    };
    */
}

//alias for sending JSON encoded messages 
function send(message) { 
    message.name = name;
    if (peer != undefined)
        message.peer = peer; 

    tc.call("org.rdk.SignallingServer", "message", message).then(result => { console.log(result); }).catch((error) => { console.log(error); });
};
  
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

var eventHandlerInstaller;

callPage.style.display = "none";

// Login when the user clicks the button 
loginBtn.addEventListener("click", function (event) { 
    if(name === undefined)
        name = usernameInput.value; 

    if(eventHandlerInstaller != undefined) {
        clearTimeout(eventHandlerInstaller);
        installEventHandlers();
    }
    
    if (name.length > 0) { 
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
            console.log("webkitRTCPeerConnection defined here in the try block");
        } catch(exception){
            yourConn =  new RTCPeerConnection(configuration);
            console.log("in exception block");
        }
        console.log("RTC connection good");    
     
        yourConn.ontrack = function (e) { 
            console.log("On Add track");
            try {
                remoteVideo.srcObject = e.streams[0];
                console.log('Assigned to srcObject');
            } catch (error) {
                console.log(error);
                remoteVideo.src = URL.createObjectURL(e.streams[0]);
                console.log('Assigned to src');
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
            hasUserMedia.then(gotStream)
            .catch(function (err) {
                console.log(err.name + ": " + err.message);
                /*
                console.log("Auto login");
                send({
                    type: "login",
                    name: "stb"
                });
                */
            });
        }
    } 
};
  
//initiating a call 
callBtn.addEventListener("click", function () {
    var callToUsername = callToUsernameInput.value;
    console.log("to call " + callToUsernameInput.value);

    if (callToUsername.length > 0) { 
        peer = callToUsername;

        // create an offer 
        yourConn.createOffer().then(function(offer) {
            console.log("offer create success");
            return yourConn.setLocalDescription(offer);
        }).then(function() {
            send({ 
                type: "offer", 
                offer: yourConn.localDescription 
            }); 
            //console.log(offer);
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
function handleOffer(offer, name) { 
    peer = name; 
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

    if (yourConn != undefined) {
        yourConn.close(); 
        yourConn.onicecandidate = null; 
        yourConn.onaddstream = null; 
    }
};

function installEventHandlers() {
    if (handlersInstalled === undefined || handlersInstalled == false) {
        handlersInstalled = true;
        console.log("Installing Event handler");

        //when we got a message from a signaling server 
        tc.on("org.rdk.SignallingServer", "event", (event) => {
            if(event.target != name && event.target != "*")
                return;

            console.log("Got Event : ", event);

            switch(event.type) { 
                case "login": 
                if(event.name == name)
                    handleLogin(event.success); 
                break; 

                //when somebody wants to call us 
                case "offer": 
                handleOffer(event.offer, event.peer); 
                break; 

                case "answer": 
                handleAnswer(event.answer); 
                break; 

                //when a remote peer sends an ice candidate to us 
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
        });
    }
}

window.onload = (event) => {
    eventHandlerInstaller = setTimeout(installEventHandlers, 1000);
    installEventHandlers();

    if(params.name != undefined) {
        name = params.name;
        loginBtn.click();
    }
}

window.onunload = (event) => {
    console.log("Unloading");
    send({ type: "leave" });  
}

window.onbeforeunload = window.onunload;
