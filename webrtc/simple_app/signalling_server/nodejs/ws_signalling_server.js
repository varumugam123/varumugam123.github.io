//require our websocket library
var WebSocketServer = require('ws').Server;

//creating a websocket server at port 9090
var wss = new WebSocketServer({port: 9090});

//all connected to the server users
var users = {};
var count = 0 ;

//when a user connects to our sever
wss.on('connection', function(connection) {
    count++;
    console.log("User connected", count);

    //when server gets a message from a connected user
    connection.on('message', message => {
        console.log("Received message : ", message);

        //accepting only JSON messages
        var data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Invalid JSON");
            data = {};
        }

        switch (data.type) {
            case "login":
                console.log("User logged : ", data.name);

                //if anyone is logged in with this username then refuse
                if(users[data.name]) {
                    sendTo(connection, {
                        type: "login",
                        name: data.name,
                        success: false
                    });
                } else {
                    //save user connection on the server
                    users[data.name] = connection;
                    connection.name = data.name;

                    sendTo(connection, {
                        type: "login",
                        name: data.name,
                        success: true
                    });
                }
            break;

            case "offer":
            case "answer":
            case "candidate":
                //for ex. UserA wants to call UserB
                console.log("Sending " + data.type + " to: ", data.peer);

                //if UserB exists then send him offer details
                var peerConnection = users[data.peer];

                let event = {
                        type: data.type,
                        name: peerConnection.name,
                        peer: connection.name
                };

                if(peerConnection != null) {
                    //setting that UserA connected with UserB
                    connection.peer = data.peer;
                    event[data.type] = data[data.type];

                    sendTo(peerConnection, event);
                }
            break;

            case "leave":
                console.log("Disconnecting from", data.name);
                var conn = users[data.name];

                //notify the other user so he can disconnect his peer connection
                if(conn != null)
                    conn.peer = null;

                // sendTo(conn, {
                //     type: "leave",
                //     name: data.name
                // });
            break;

            default:
                sendTo(connection, {
                    type: "error",
                    message: "Command not found: " + data.type
                });
            break;
        }
    });

    //when user exits, for example closes a browser window
    //this may help if we are still in "offer","answer" or "candidate" state
    connection.on("close", function() {
        console.log("Closing connection");
        if(count > 0)
            count--;

        if(connection.name) {
            delete users[connection.name];

            if(connection.peer) {
                console.log("Disconnecting from ", connection.peer);
                var conn = users[connection.peer];
                conn.peer = null;

                if(conn != null) {
                    sendTo(conn, {
                        type: "leave"
                    });
                }
            }
        }
    });
});

function sendTo(connection, message) {
   connection.send(JSON.stringify(message));
   console.log("Message sent : ", JSON.stringify(message));
}
