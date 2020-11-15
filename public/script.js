const socket = io('/')
var myPeer = null
myid = null
let localVideo = null;
var myVideo = null
var myAudio = null
var calls = []
let myGroup = 0
let muted = false;

let nextRoomId = 0;

let streams = [];

/**
 * Stores all the information about a peer, including access to the call object
 */
class PeerInfo {
  constructor(videoObj, call, conn, name) {
    this.videoObj = videoObj;
    this.call = call;
    this.conn = conn;
    this.name = name;
  }
}

const peers = {} // Dictionary of (userID, PeerInfo) pairs

const peerVideos = {}; // Stores video DOM objects, hashed by userID

let isHandlerDragging = false;
let MIN_WIDTH_MAIN_PANEL = 400;
let rooms = [];
let resizer = null;
let modal = null;
let currentUser = null;

//MODAL STUFF

// When the user clicks the button, open the modal
function launchModal(){
  modal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
function closeModal() {
  modal.style.display = "none";
}

//Thanks to https://htmldom.dev/create-resizable-split-views/ for the resizing script
function setUsername(){
  currentUser = document.getElementById("username").value;
  closeModal();
  setupSelf();
}

document.addEventListener('DOMContentLoaded', function() {
    modal = document.getElementById("myModal");

    socket.emit('get-rooms', ROOM_ID);
  
    socket.on('valid-rooms', rooms => {
      for (let i = 0; i < rooms.length; i++) {
        createRoomDOM(rooms[i]);
      }

      // Update the next roomId to be one higher than the last
      // THis works since rooms are always added in sequential order
      nextRoomId = rooms[rooms.length - 1] + 1;

      launchModal();
    });

    let videos = document.getElementsByClassName("videoContainer")
    Array.prototype.forEach.call(videos, videoScreen =>{
        makeElementDraggable(videoScreen);
    });
    // Query the element
    resizer = document.getElementById('panelDivider');
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
  this.isSelected = false;
  this.makeDomElement = function() {
      let roomElement = document.createElement("div");
      roomElement.id=`room-${roomID}`;
      roomElement.classList.add('room');

      let roomHeader = document.createElement("div");
      roomHeader.classList.add("roomHeader");

      let roomLabel = document.createElement("h2");
      roomLabel.innerText = `Bubble ${roomID}`;

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
 * Called by the "delete selected" button.
 * Deletes the DOM object and signals for the deletion of the room
 * across the server, as long as there is not video in that room
 */
function deleteSelectedRooms(){
  for (let i = 0; i < rooms.length; i++) {
    let room = rooms[i];

    if(room.isSelected){
      if (room.domElement.getElementsByClassName('roomVideos')[0].childNodes.length > 0) {
        console.log("Could not delete room: has person in it")
      } else {
        rooms.splice(rooms.indexOf(room), 1);
        i--;
        deleteRoom(room.id);
      }
    }
  }
}

function deleteRoom(roomId) {
  deleteRoomDOM(roomId);
  signalRoomDeleted(roomId);
}

function deleteRoomDOM(roomId) {
  document.getElementById(`room-${roomId}`).remove();
}

function signalRoomDeleted(roomId) {
  socket.emit('delete-room', roomId, ROOM_ID);
}

/**
 * Both creates a new room DOM object AND signals a new room has been created
 * Used when the "add new room" button is pressed
 */
function createNewRoom() {
  console.log(nextRoomId);
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
  newRoom.domElement.onmousedown = function(){
    if(!isHandlerDragging)
        newRoom.isSelected = !newRoom.isSelected;
    if(newRoom.isSelected){
        newRoom.domElement.style.background = "rgb(176,196,222)"
    }else{
        newRoom.domElement.style.background = "none"
    }
  }
  rooms.push(newRoom);
  roomContainer.append(newRoom.domElement);
}

function signalRoomCreated(roomId) {
  console.log(roomId);
  socket.emit('create-room', roomId, ROOM_ID, myid);
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
  let pos1 = 0, pos2 = 0, initialMouseX = 0, initialMouseY = 0, firstX = 0, firstY = 0;
  let img = elem.querySelector("video")
  let handle = elem.querySelector("p")
  let oldSize = 200;
  handle.onmousedown = dragMouseDown;
  function dragMouseDown(e) {
    isHandlerDragging = true;
      elem.style.pointerEvents = "none";
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      initialMouseX = e.clientX;
      initialMouseY = e.clientY;
      firstX = initialMouseX;
      firstY = initialMouseY;
      elem.style.position = "absolute"
      elem.style.top = firstY + "px";
      elem.style.left = firstX + "px";
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
      centerX = resizer.getBoundingClientRect().left;
      img.style.borderRadius = 50-((centerX-e.clientX)/10)+"%";
      img.style.zIndex = 99;
  }

  function closeDragElement(e) {
      e = e || window.event;
      e.preventDefault();
      if(inRoom()){
        moveGroupFromMain(myGroup);

        img.style.borderRadius = 50 +"%";

        let destination = getRoomDiv();

        myGroup = destination.roomObj.id; 

        moveVideoStream(localVideo, myGroup);
        moveGroupToMain(myGroup);

        socket.emit('move', {userId: myPeer.id, group: myGroup}, ROOM_ID, myid);
      } else {
        img.style.borderRadius = 0;
      }
      //else go back to before
      elem.style.position = "relative"
      elem.style.top =  0;
      elem.style.left = 0;
      img.style.zIndex = 0;

      /* stop moving when mouse button is released:*/
      elem.style.pointerEvents = "auto";
      document.onmouseup = null;
      document.onmousemove = null;
      isHandlerDragging = false;
  }
}

function setupSelf() {
  localVideo = makeVideoElement(false);
  localVideo.querySelector("video").muted = true;
  localVideo.querySelector("video").setAttribute('isLocal', true)

  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then(stream => {
    myAudio = stream.getAudioTracks()[0];
    myVideo = stream.getVideoTracks()[0];

    // Make own video draggable
    makeElementDraggable(localVideo);

    // Add own video stream to video object
    injectVideoStream(localVideo, stream, "Initial injection");

    // Move video stream to the default room

    moveVideoStream(localVideo, myGroup);
    moveGroupToMain(myGroup);

    let peerGroup;
    let peerUserId;

    console.log("About to Call new Peer()")
    // myPeer = new Peer(undefined, {})
    console.log("Called new Peer()")
    myPeer = new Peer(undefined, {
      host: 'bubblz.space',
      secure: true,
      debug: 0,
      port: '3001'
    })

    myPeer.on('open', id => {
      console.log('Joining')
      console.log(id)
      myid = id
      socket.emit('join-room', ROOM_ID, id);

      myPeer.on('connection', conn => {
        console.log("Peer establishing connection")
        let newPeer = new PeerInfo();
  
        newPeer.conn = conn;
        peerUserId = conn.peer;
  
        peers[peerUserId] = newPeer;

  
        conn.on('data', data => {
          console.log("Recieved data from peer")
          conn.send({group: myGroup, name: currentUser});
          console.log("Sent back data in return");
          peerGroup = data.group;
          newPeer.group = peerGroup;
          if (peers[conn.peer].videoObj) {
            moveVideoStream(peers[conn.peer].videoObj, peerGroup);
            peers[conn.peer].videoObj.querySelector("video").muted = data.muted || deafened
          } else {
            peers[conn.peer].muted = data.muted
          }

          peerName = data.name;
  
          newPeer.name = peerName;
        });
      });
    });

    myPeer.on('call', call => {
      peers[call.peer].call = call;

      calls.push(call);
      call.answer(stream);
      const video = makeVideoElement(call.peer)
      peers[call.peer].videoObj = video;
      // POSSIBLE
      if (peers[call.peer].muted) {
        peers[call.peer].videoObj.querySelector("video").muted = true
        peers[call.peer].videoObj.querySelector("video").setAttribute('hardmute', true)
      }
    
      call.on('stream', userVideoStream => {
        console.log(video.querySelector('video').srcObject);
        if(video.querySelector('video').srcObject === null) {
          streams.push(userVideoStream);
          injectVideoStream(video, userVideoStream, 'setupSelf injection');
          moveVideoStream(video, peers[call.peer].group);
        }
      });

      call.on('close', () => {
        video.remove()
      })
    })

    socket.on('user-connected', userId => {
      console.log("I am connecting to user " + userId);
      connectToNewUser(userId, stream)
    });
  })
}

setupDeviceSwitching()

socket.on('user-muted', userId => {
  console.log("Muting")
  peerVideos[userId].muted = true
  peerVideos[userId].setAttribute('hardmute', true)
})

socket.on('user-unmuted', userId => {
  console.log("unmuting")
  peerVideos[userId].muted = peerVideos[userId].getAttribute('notingroup') == "true" || deafened
  console.log(peerVideos[userId].muted)
  peerVideos[userId].setAttribute('hardmute', false)
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
});

socket.on('delete-room', roomId => {
  deleteRoomDOM(roomId);
});

function connectToNewUser(userId, stream) {
  let newPeer = new PeerInfo();

  peers[userId] = newPeer;

  const conn = myPeer.connect(userId);

  newPeer.conn = conn;

  console.log("Connecting to new peer");
  let peerGroup;

  conn.on("open", () => {
    console.log("Sending group to peer")
    conn.send({group: myGroup, name: currentUser, muted: muted});
  });

  conn.on('data', data => {
    console.log("Received group from peer");
    peerGroup = data.group;
    peerName = data.name;

    newPeer.name = peerName;

    const video = makeVideoElement(userId);
    newPeer.videoObj = video;

    console.log("Calling peer: " + userId);
    const call = myPeer.call(userId, stream);
    newPeer.call = call;
    calls.push(call)
    call.peerConnection.getSenders()[0].replaceTrack(myAudio)
    call.peerConnection.getSenders()[1].replaceTrack(myVideo)
    
    // Add the stream object to the video DOM object once sent
    call.on('stream', userVideoStream => {
      console.log(video.querySelector('video').srcObject);
      if(video.querySelector('video').srcObject === null) {
        injectVideoStream(video, userVideoStream, "connectNewUser Injection");
        moveVideoStream(video, peerGroup);
      }
    })
    call.on('close', () => {
      video.remove()
    })
  });
}

function moveGroupToMain(group) {
  console.log("Maybe muting!")
  const mainWrapper = document.getElementById('mainVideoContainer');
  let mainLabel = document.getElementById('main-label');
  let groupWrapper = document.getElementById(`room-${group}`);
  const videoGroup = document.getElementById(`room-${group}-videos`);

  mainWrapper.appendChild(videoGroup);
  mainLabel.innerText = `Bubble ${group}`;
  groupWrapper.style.display="none";

  for (video of mainWrapper.getElementsByTagName('video')) {
  }

  for (let i = 0; i < videoGroup.childNodes.length; i++) {
    let video = videoGroup.childNodes[i].querySelector('video');
    if (video != localVideo) {
      const vid = videoGroup.childNodes[i].querySelector('video')
      vid.muted = vid.getAttribute('hardmute') == 'true' || vid.getAttribute('isLocal') == 'true' || deafened
      vid.setAttribute('notingroup', false)
    }
  }
}

function moveGroupFromMain(group) {
  console.log("Maybe muting!")
  for (key in peerVideos) {
    video = peerVideos[key]
    video.muted = true
    video.setAttribute('notingroup', true)
  }
  let groupWrapper = document.getElementById(`room-${group}`);
  let videoGroup = document.getElementById(`room-${group}-videos`); 

  for (let i = 0; i < videoGroup.childNodes.length; i++) {
    videoGroup.childNodes[i].querySelector('video').muted = true;
  }

  groupWrapper.appendChild(videoGroup);
  groupWrapper.style.display="block";
}

function moveVideoStream(video, group) {
  console.log(group, myGroup);
  if (group != myGroup) {
    video.querySelector('video').muted = true;
    video.querySelector('video').setAttribute('notingroup', true)
  } else {
    var vid = video.querySelector('video')
    vid.muted = vid.getAttribute('hardmute') == 'true' || vid.getAttribute('isLocal') == 'true' || deafened
    vid.setAttribute('notingroup', false)
  }

  document.getElementById(`room-${group}-videos`).appendChild(video);
}

/**
 * Adds a stream to a video DOM object, and returns that object
 */
function injectVideoStream(elem, stream, special) {
  console.log('injecting into video stream')
  console.log(special, elem, stream)
  video = elem.querySelector('video');
  video.srcObject = stream
  
  video.play()
  console.log("Playing")

  video.addEventListener('click', (e) => {
    let target = e.target;
    if (!target.paused) {
      video.pause()
    } else {
      target.play()
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

  let nameLabel = document.createElement("p");
  nameLabel.classList.add("personNameHeader");
  
  if (userId) {
    console.log(userId);
    nameLabel.innerText = peers[userId].name;
  } else {
    nameLabel.innerText = currentUser + " (you)"
  }

  elem.append(nameLabel);

  var video = document.createElement('video')
  elem.append(video)

  var bottom = document.createElement('div')
  bottom.className = "bottom"

  if (!userId) {
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
      for (key in peerVideos) {
        video = peerVideos[key]
        video.muted = deafened || video.getAttribute('hardmute') == 'true' || video.getAttribute('notingroup') == 'true'
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
          injectVideoStream(localVideo, stream, 'makeVideoA');
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
          injectVideoStream(localVideo, stream, 'makeVideoB');
          for (peer of calls) {
            peer.peerConnection.getSenders()[1].replaceTrack(myVideo)
          }
        })
        sharing = false
      }
    }
    bottom.append(share)



  } else {
    peerVideos[userId] = video
  }

  var fullScreen = document.createElement('div')
  fullScreen.className = "icon-holder"
  var isFull = false
  var fullIcon = document.createElement('i')
  fullIcon.className = 'material-icons'
  fullIcon.textContent = 'open_in_full'
  fullScreen.append(fullIcon)
  fullScreen.onclick = () => {
    video.requestFullscreen()
    isFull = true
  }
  bottom.append(fullScreen)
  elem.append(bottom)

  return elem
}
