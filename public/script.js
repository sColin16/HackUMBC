const socket = io('/')
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001'
})
const myVideo = document.createElement('video')
myVideo.muted = true;

const myGroup = 2;

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

  myPeer.on('connection', conn => {
    console.log("Peer establishing connection")
    const newPeer = new PeerInfo();
    const video = document.createElement('video');

    newPeer.conn = conn;
    newPeer.videoObj = video;

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
  if (peers[userId]) peers[userId].call.close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const newPeer = new PeerInfo();
  const video = document.createElement('video');
  const conn = myPeer.connect(userId);

  newPeer.conn = conn;
  newPeer.videoObj = video;

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
    
      peers[userId] = PeerInfo;
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
  document.getElementById('room-1-videos').appendChild(myVideo);
});

document.getElementById('move-2').addEventListener('click', e => {
  document.getElementById('room-2-videos').appendChild(myVideo);
});

document.getElementById('move-3').addEventListener('click', e => {
  document.getElementById('room-3-videos').appendChild(myVideo);
});