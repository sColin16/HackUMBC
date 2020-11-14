const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001'
})
myid = null
const localVideo = makeVideoElement(false)
var myVideo = null
var myAudio = null
localVideo.firstElementChild.muted = true
const peers = {}
var calls = []
var videos = {}

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  addVideoStream(localVideo, stream)
  myAudio = stream.getAudioTracks()[0]
  myVideo = stream.getVideoTracks()[0]

  myPeer.on('call', call => {
    calls.push(call)
    call.answer(stream)
    const video = makeVideoElement(call.peer)
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
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
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  myid = id
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  calls.push(call)
  call.peerConnection.getSenders()[0].replaceTrack(myAudio)
  call.peerConnection.getSenders()[0].replaceTrack(myVideo)
  const video = makeVideoElement(userId)
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(elem, stream) {
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
  videoGrid.append(elem)
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
