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
let myGroup = 2
let muted = false

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
  moveGroupToMain(myGroup);

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
      video.firstElementChild.muted = data.muted

      myPeer.on('call', call => {
        newPeer.call = call;

        calls.push(call);
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
    conn.send({group: myGroup, muted: muted});

    conn.on('data', data => {
      console.log("Received group from peer");
      peerGroup = data.group;

      const call = myPeer.call(userId, stream);
      newPeer.call = call;
      calls.push(call)
      call.peerConnection.getSenders()[0].replaceTrack(myAudio)
      call.peerConnection.getSenders()[1].replaceTrack(myVideo)
      
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

function moveGroupToMain(group) {
  const mainWrapper = document.getElementById('main-videos');
  let mainLabel = document.getElementById('main-label');
  let groupWrapper = document.getElementById(`room-${group}-wrapper`);
  const videoGroup = document.getElementById(`room-${group}-videos`);

  mainWrapper.appendChild(videoGroup);
  mainLabel.innerText = `Room ${group}`;
  groupWrapper.style.display="none";
}

function moveGroupFromMain(group) {
  let groupWrapper = document.getElementById(`room-${group}-wrapper`);
  let videoGroup = document.getElementById(`room-${group}-videos`); 

  groupWrapper.appendChild(videoGroup);
  groupWrapper.style.display="block";
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
    var bottom = document.createElement('div')
    bottom.className = "bottom"
    video.muted = true
    var mute = document.createElement('div')
    mute.className = "icon-holder"
    var mutIcon = document.createElement('i')
    mutIcon.className = 'material-icons'
    mutIcon.textContent = 'mic'
    mute.append(mutIcon)

    mute.className = "mute-button"

    mute.onclick = () => {
      if (!muted) {
        mutIcon.textContent = 'mic_off'
        socket.emit('mute', ROOM_ID, myid)
        muted = true
      } else {
        mutIcon.textContent = 'mic'
        socket.emit('unmute', ROOM_ID, myid)
        muted = false
      }
    }
    bottom.append(mute)

    var deafen = document.createElement('div')
    deafen.className = "icon-holder"
    deafen.className = "deafen-button"
    var deafIcon = document.createElement('i')
    deafIcon.className = 'material-icons'
    deafIcon.textContent = 'volume_up'
    deafen.append(deafIcon)

    deafened = false
    deafen.onclick = () => {
      deafened = !deafened
      if (deafened) {
        deafIcon.textContent = 'volume_off'
      } else {
        deafIcon.textContent = 'volume_up'
      }
      for (key in videos) {
        video = videos[key]
        video.muted = deafened
      }
    }
    bottom.append(deafen)

    var share = document.createElement('div')
    share.className = "icon-holder"
    var sharing = false
    var shareIcon = document.createElement('i')
    shareIcon.className = 'material-icons'
    shareIcon.textContent = 'stop_screen_share'
    share.append(shareIcon)
    share.onclick = () => {
      if (!sharing) {
        shareIcon.textContent = 'screen_share'
        navigator.mediaDevices.getDisplayMedia().then(stream => {
          myVideo = stream.getVideoTracks()[0]
          injectVideoStream(localVideo, stream)
          for (peer of calls) {
            peer.peerConnection.getSenders()[1].replaceTrack(myVideo)
          }
        })
        sharing = true
      } else {
        shareIcon.textContent = 'stop_screen_share'
        navigator.mediaDevices.getUserMedia({
          video: true
        }).then(stream => {
          myVideo = stream.getVideoTracks()[0]
          injectVideoStream(localVideo, stream)
          for (peer of calls) {
            peer.peerConnection.getSenders()[1].replaceTrack(myVideo)
          }
        })
        sharing = false
      }
    }
    bottom.append(share)
    elem.append(bottom)
  } else {
    videos[userId] = video
  }

  return elem
}

document.getElementById('move-1').addEventListener('click', e => {
  moveGroupFromMain(myGroup);

  myGroup = 1;

  moveVideoStream(localVideo, myGroup);
  moveGroupToMain(myGroup);

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});

document.getElementById('move-2').addEventListener('click', e => {
  moveGroupFromMain(myGroup);

  myGroup = 2;

  moveVideoStream(localVideo, myGroup);
  moveGroupToMain(myGroup);

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});

document.getElementById('move-3').addEventListener('click', e => {
  moveGroupFromMain(myGroup);

  myGroup = 3;

  moveVideoStream(localVideo, 3);
  moveGroupToMain(myGroup);

  socket.emit('move', {userId: myPeer.id, group: myGroup});
});

function shareScreen() {
  console.log("IN SHARE")
}
