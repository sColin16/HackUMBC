const socket = io('/')
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001'
})
const myVideo = document.createElement('video')
myVideo.muted = true;

let myGroup = 2;

/**
 * Stores all the information about a peer, including access to the call object
 */
class PeerInfo {
  constructor(videoObj, call, conn) {
    this.videoObj = videoObj;
    this.call = call;
    this.conn = conn;
  }
}

const peers = {} // Dictionary of (userID, PeerInfo) pairs

const peerVideos = {}; // Stores video DOM objects, hashed by userID
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  // Add own video stream to video object
  injectVideoStream(myVideo, stream);

  // Move video stream to the default room
  moveVideoStream(myVideo, myGroup);

  let peerGroup;
  let peerUserId;

  myPeer.on('connection', conn => {
    console.log("Peer establishing connection")
    let newPeer = new PeerInfo();
    const video = document.createElement('video');

    newPeer.conn = conn;
    newPeer.videoObj = video;
    peerUserId = conn.peer;

    peers[peerUserId] = newPeer;

    conn.on('data', data => {
      console.log("Recieved data from peer")
      conn.send({group: myGroup});
      console.log("Sent back data in return");
      peerGroup = data.group;

      myPeer.on('call', call => {
        console.log("Peer called");
        call.answer(stream);
    
        call.on('stream', userVideoStream => {
          injectVideoStream(video, userVideoStream);
          moveVideoStream(video, peerGroup);
        });
      })
    });
  });

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  });
})

socket.on('user-disconnected', userId => {
  //if (peers[userId]) peers[userId].call.close()
})

socket.on('move', msg => {
  moveVideoStream(peers[msg.userId].videoObj, msg.group);

  //document.getElementById(`room-${msg.group}-videos`).append(peers[msg.userId].videoObj);
});

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  let newPeer = new PeerInfo();
  const video = document.createElement('video');
  const conn = myPeer.connect(userId);

  newPeer.conn = conn;
  newPeer.videoObj = video;

  console.log(newPeer);
  let peerGroup;

  conn.on("open", () => {
    console.log("Sending group to peer")
    conn.send({group: myGroup});

    conn.on('data', data => {
      console.log("Received group from peer");
      peerGroup = data.group;

      const call = myPeer.call(userId, stream);
      newPeer.call = call;
      
      // Add the stream object to the video DOM object once sent
      call.on('stream', userVideoStream => {
        injectVideoStream(video, userVideoStream);
        moveVideoStream(video, peerGroup);
      })
      call.on('close', () => {
        video.remove()
      })
    
      peers[userId] = newPeer;
    });
  });

  
}

function moveVideoStream(video, group) {
  document.getElementById(`room-${group}-videos`).appendChild(video);
}

/**
 * Adds a stream to a video DOM object, and returns that object
 */
function injectVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  });
  
  return video;
}

document.getElementById('move-1').addEventListener('click', e => {
  moveVideoStream(myVideo, 1);
  myGroup = 1;

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});

document.getElementById('move-2').addEventListener('click', e => {
  moveVideoStream(myVideo, 2);
  myGroup = 2;

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});

document.getElementById('move-3').addEventListener('click', e => {
  moveVideoStream(myVideo, 3);
  myGroup = 3;

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});