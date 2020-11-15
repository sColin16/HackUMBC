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
let myGroup = 0
let muted = false;

let nextRoomId = 0;

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

let isHandlerDragging = false;
let MIN_WIDTH_MAIN_PANEL = 400;
let rooms = [];

//Thanks to https://htmldom.dev/create-resizable-split-views/ for the resizing script
document.addEventListener('DOMContentLoaded', function() {
    let videos = document.getElementsByClassName("videoContainer")
    Array.prototype.forEach.call(videos, videoScreen =>{
        makeElementDraggable(videoScreen);
    });
        // Query the element
    const resizer = document.getElementById('panelDivider');
    const leftSide = resizer.previousElementSibling;
    const rightSide = resizer.nextElementSibling;

    // The current position of mouse
    let mouseX = 0;
    let mouseY = 0;
    let leftWidth = 0;

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = function(e) {
        // Get the current mouse position
        mouseX = e.clientX;
        mouseY = e.clientY;
        leftWidth = leftSide.getBoundingClientRect().width;

        // Attach the listeners to `document`
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        // How far the mouse has been moved
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;

        const newLeftWidth = (leftWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
        leftSide.style.width = `${newLeftWidth}%`;

        resizer.style.cursor = 'col-resize';
        document.body.style.cursor = 'col-resize';

        leftSide.style.userSelect = 'none';
        leftSide.style.pointerEvents = 'none';

        rightSide.style.userSelect = 'none';
        rightSide.style.pointerEvents = 'none';
    };

    const mouseUpHandler = function() {
        resizer.style.removeProperty('cursor');
        document.body.style.removeProperty('cursor');

        leftSide.style.removeProperty('user-select');
        leftSide.style.removeProperty('pointer-events');

        rightSide.style.removeProperty('user-select');
        rightSide.style.removeProperty('pointer-events');
        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);
});

//ROOM OBJECT
function Room(roomID){
  this.id = roomID;
  this.isMousedOver = false;
  this.makeDomElement = function() {
      let roomElement = document.createElement("div");
      roomElement.id=`room-${roomID}`;
      roomElement.classList.add('room');

      let roomHeader = document.createElement("div");
      roomHeader.classList.add("roomHeader");

      let roomLabel = document.createElement("h2");
      roomLabel.innerText = `Room ${roomID}`;

      roomHeader.appendChild(roomLabel);

      roomElement.append(roomHeader);

      let videoContainer = document.createElement("div");
      videoContainer.classList.add("roomVideos");
      videoContainer.id = `room-${roomID}-videos`;

      roomElement.appendChild(videoContainer);
      roomElement.roomObj = this;

      this.domElement = roomElement;
  };

  this.domElement = null;
}

/**
 * Both creates a new room DOM object AND signals a new room has been created
 * Used when the "add new room" button is pressed
 */
function createNewRoom() {
  createRoomDOM(nextRoomId);
  signalRoomCreated(nextRoomId);

  nextRoomId++;
}

function createRoomDOM(roomId){
  let roomContainer = document.getElementById('roomContainer')
  let newRoom = new Room(roomId, null)

  newRoom.makeDomElement();
  newRoom.domElement.onmouseover = function(){
      newRoom.isMousedOver = true;
  }
  newRoom.domElement.onmouseleave = function(){
      newRoom.isMousedOver = false;
  }
  rooms.push(newRoom);
  roomContainer.appendChild(newRoom.domElement);
}

function signalRoomCreated(roomId) {
  socket.emit('create-room', roomId);
}

function inRoom(){
  let out = false;
  rooms.forEach(room =>{
      if(room.isMousedOver){
          out = true;
      }
  });
  return out;
}
function getRoomDiv(){
  let out = null
  rooms.forEach(room =>{
      if(room.isMousedOver){
          out = room.domElement;
      }
  });
  return out;
}

function makeElementDraggable(elem) {
  let pos1 = 0, pos2 = 0, initialMouseX = 0, initialMouseY = 0;
  elem.onmousedown = dragMouseDown;
  function dragMouseDown(e) {
      elem.style.pointerEvents = "none";
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      initialMouseX = e.clientX;
      initialMouseY = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      let topPos = elem.getBoundingClientRect().top
      let leftPos = elem.getBoundingClientRect().left
      pos1 = initialMouseX - e.clientX;
      pos2 = initialMouseY - e.clientY;
      initialMouseX = e.clientX;
      initialMouseY = e.clientY;
      // set the element's new position:
      elem.style.position = "absolute"
      elem.style.top = (topPos - pos2) + "px";
      elem.style.left =(leftPos - pos1) + "px";
  }

  function closeDragElement(e) {
      e = e || window.event;
      e.preventDefault();
      if(inRoom()){
        moveGroupFromMain(myGroup);

        let destination = getRoomDiv();

        myGroup = destination.roomObj.id; 

        moveVideoStream(localVideo, myGroup);
        moveGroupToMain(myGroup);

        socket.emit('move', {userId: myPeer.id, group: myGroup});

        /*
          let destination = getRoomDiv()
          destination.appendChild(elem);
          */

      }
      //else go back to before
      elem.style.position = "relative"
      elem.style.top =  0;
      elem.style.left = 0;

      /* stop moving when mouse button is released:*/
      elem.style.pointerEvents = "auto";
      document.onmouseup = null;
      document.onmousemove = null;
  }
}

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myAudio = stream.getAudioTracks()[0];
  myVideo = stream.getVideoTracks()[0];

  socket.emit('get-rooms', null);

  socket.on('valid-rooms', rooms => {
    for (let i = 0; i < rooms.length; i++) {
      createRoomDOM(rooms[i]);
    }

    // Update the next roomId to be one higher than the last
    // THis works since rooms are always added in sequential order
    nextRoomId = rooms[rooms.length - 1] + 1;

  // Make own video draggable
  makeElementDraggable(localVideo);

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

socket.on('create-room', roomId => {
  createRoomDOM(roomId);

  nextRoomId++;
})

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
  const mainWrapper = document.getElementById('mainVideoContainer');
  let mainLabel = document.getElementById('main-label');
  let groupWrapper = document.getElementById(`room-${group}`);
  const videoGroup = document.getElementById(`room-${group}-videos`);

  mainWrapper.appendChild(videoGroup);
  mainLabel.innerText = `Room ${group}`;
  groupWrapper.style.display="none";
}

function moveGroupFromMain(group) {
  let groupWrapper = document.getElementById(`room-${group}`);
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

/*
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
*/

function shareScreen() {
  console.log("IN SHARE")
}
