const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')

let openRooms = {}; // Stores arrays of open roomIds in each room 

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}`)
})

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room })
})

io.on('connection', socket => {
  socket.on('mute', (roomId, userId) => {
    console.log("MUTE")
    socket.to(roomId).broadcast.emit('user-muted', userId)
  })
  socket.on('unmute', (roomId, userId) => {
    socket.to(roomId).broadcast.emit('user-unmuted', userId)
  })
  socket.on('join-room', (roomId, userId) => {
    if (!openRooms[roomId]) {
      openRooms[roomId] = [0];
    }

    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', userId)

    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    });

    socket.on('join-group', msg => {
      socket.to(roomId).broadcast.emit('join-group', msg);
    });

    socket.on('move', msg => {
      console.log(`User with id ${msg.userId} requesting move to ${msg.group}`);

      socket.to(roomId).broadcast.emit('move', msg);
    });

    socket.on('get-rooms', () => {
      console.log("Client requesting valid rooms");
      socket.emit('valid-rooms', openRooms[roomId]);
    });

    socket.on('create-room', msg => {
      console.log("Client created new room with id: " + msg);
      openRooms[roomId].push(msg);
      console.log("New valid rooms: " + openRooms[roomId]);

      socket.to(roomId).broadcast.emit('create-room', msg)
    });

    socket.on('delete-room', msg => {
      console.log("Client deleted room with id: " + msg);
      const removalIndex = openRooms[roomId].indexOf(msg);
      openRooms[roomId].splice(removalIndex, 1);
      console.log("New valid rooms: " + openRooms[roomId]);

      socket.to(roomId).broadcast.emit('delete-room', msg);
    })
  });
});

server.listen(3000)
