const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')

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
    })
  });
});

server.listen(3000)
