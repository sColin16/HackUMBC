const socket = io('/')
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001'
})
myid = null
const localVideo = makeVideoElement(false)
var myVideo = null
var myAudio = null
localVideo.firstElementChild.muted = true
var calls = []
var videos = {}
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
  myAudio = stream.getAudioTracks()[0]
  myVideo = stream.getVideoTracks()[0]

  // Add own video stream to video object
  injectVideoStream(localVideo, stream);

  // Move video stream to the default room
  moveVideoStream(localVideo, myGroup);

  let peerGroup;
  let peerUserId;

  myPeer.on('connection', conn => {
    console.log("Peer establishing connection")
    let newPeer = new PeerInfo();
    const video = makeVideoElement(conn.peer)

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
        newPeer.call = call;

        calls.push(call)
        call.answer(stream);
    
        call.on('stream', userVideoStream => {
          injectVideoStream(video, userVideoStream);
          moveVideoStream(video, peerGroup);
        });

        call.on('close', () => {
          video.remove()
        })
      })
    });
  });

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  });
})

setupDeviceSwitching()

socket.on('user-muted', userId => {
  videos[userId].muted = true
})

socket.on('user-unmuted', userId => {
  videos[userId].muted = false
})

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].call.close()
})

socket.on('move', msg => {
  moveVideoStream(peers[msg.userId].videoObj, msg.group);
});

myPeer.on('open', id => {
  myid = id
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  let newPeer = new PeerInfo();
  const video = makeVideoElement(userId)
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
      calls.push(call)
      call.peerConnection.getSenders()[0].replaceTrack(myAudio)
      call.peerConnection.getSenders()[0].replaceTrack(myVideo)
      
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
function injectVideoStream(elem, stream) {
  video = elem.firstElementChild
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
    var playing = true

    video.onclick = () => {
      if (playing) {
        video.pause()
        playing = false
      } else {
        video.play()
        playing = true
      }
    }
  })
  return elem;
}

function setupDeviceSwitching() {
  var ms = document.getElementById('microphone-select')
  var vs = document.getElementById('camera-select')

  ms.addEventListener('change', (event) => {
    console.log(event.target.value)
    navigator.mediaDevices.getUserMedia({
      audio: {deviceId: event.target.value}
    }).then(stream => {
      myAudio = stream.getAudioTracks()[0]
      for (peer of calls) {
        peer.peerConnection.getSenders()[0].replaceTrack(stream.getAudioTracks()[0])
      }
    })
  })

  vs.addEventListener('change', (event) => {
    console.log(event.target.value)
    navigator.mediaDevices.getUserMedia({
      video: {deviceId: event.target.value}
    }).then(stream => {
      myVideo = stream.getVideoTracks()[0]
      for (peer of calls) {
        peer.peerConnection.getSenders()[0].replaceTrack(stream.getVideoTracks()[0])
      }
    })
  })

  navigator.mediaDevices.enumerateDevices()
  .then(function(devices) {
    devices.forEach(function(device) {
      var dev = document.createElement('option')
      dev.text = device.label
      dev.value = device.deviceId
      if (device.kind == "audioinput") {
        ms.add(dev)
      } else if (device.kind == "videoinput") {
        vs.add(dev)
      }
    });
  })
}

function makeVideoElement(userId) {
  var elem = document.createElement("div")
  elem.className = "video-container"
  var video = document.createElement('video')
  elem.append(video)

  if (!userId) {
    video.muted = true
    var mute = document.createElement('button')
    mute.textContent = "Mute"
    mute.className = "mute-button"

    mute.onclick = () => {
      if (mute.textContent === "Mute") {
        socket.emit('mute', ROOM_ID, myid)
        mute.textContent = "Unmute"
      } else {
        socket.emit('unmute', ROOM_ID, myid)
        mute.textContent = "Mute"
      }
    }
    elem.append(mute)

    var deafen = document.createElement('button')
    deafen.textContent = "Deafen"
    deafen.className = "deafen-button"

    deafened = false
    deafen.onclick = () => {
      deafened = !deafened
      for (key in videos) {
        video = videos[key]
        video.muted = deafened
      }
      deafen.textContent = deafened ? "Un-deafen" : "Deafen"
    }
    elem.append(deafen)
  } else {
    videos[userId] = video
  }

  return elem
}

document.getElementById('move-1').addEventListener('click', e => {
  moveVideoStream(localVideo, 1);
  myGroup = 1;

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});

document.getElementById('move-2').addEventListener('click', e => {
  moveVideoStream(localVideo, 2);
  myGroup = 2;

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});

document.getElementById('move-3').addEventListener('click', e => {
  moveVideoStream(localVideo, 3);
  myGroup = 3;

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});
