const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const session = require('express-session');

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Konfigurasi session
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
}));

let usersOnline = {}; // Menyimpan daftar pengguna online
let groups = {}; // Menyimpan daftar grup dan anggotanya

// Endpoint login sederhana
app.post('/login', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).send("Username diperlukan");
    req.session.username = username;
    res.redirect('/');
});

// Endpoint logout
app.get('/logout', (req, res) => {
    delete usersOnline[req.session.username];
    io.emit("user list", Object.keys(usersOnline));
    req.session.destroy();
    res.redirect('/');
});

// Mengelola koneksi WebSocket
io.on('connection', (socket) => {
    let username = socket.handshake.auth.username;
    if (username) {
        usersOnline[username] = socket.id;
        io.emit("user list", Object.keys(usersOnline));
    }

    // Handle pesan chat
    socket.on("chat message", (msg) => {
        const username = socket.handshake.auth.username;
        if (username && msg && msg.trim() !== "") {
            io.emit("chat message", `${username}: ${msg}`);
        }
    });

    socket.on("join group", (group) => {
        socket.join(group);
        if (!groups[group]) groups[group] = [];
        if (!groups[group].includes(username)) {
            groups[group].push(username);
        }
        io.to(group).emit("group users", groups[group]);
        io.to(group).emit("chat message", `<strong>${username}</strong> bergabung ke grup <em>${group}</em>`);
    });

    socket.on("send message", ({ group, message }) => {
        if (message && message.trim() !== "") {
            io.to(group).emit("chat message", `<strong>${username}</strong>: ${message}`);
        }
    });


    socket.on('disconnect', () => {
        if (username) {
            delete usersOnline[username];
            for (let group in groups) {
                groups[group] = groups[group].filter(user => user !== username);
                io.to(group).emit("group users", groups[group]);
            }
            io.emit("user list", Object.keys(usersOnline));
        }
    });

});

server.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});