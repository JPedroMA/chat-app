const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Conexão com o MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/chatApp')
    .then(() => console.log('Conectado ao MongoDB com sucesso'))
    .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

// Esquema e modelo de usuário
const userSchema = new mongoose.Schema({
    username: String,
    color: String,
});

const User = mongoose.model('User', userSchema);

app.use(express.static('public'));

let connectedUsers = {};

// Gerenciamento de conexões com sockets
io.on('connection', (socket) => {
    console.log('Novo usuário conectado:', socket.id);

    // Registro do usuário
    socket.on('setUsername', async ({ username, color }) => {
        if (!username || !color) return;

        connectedUsers[socket.id] = { username, color, socketId: socket.id };

        // Salvando no banco, caso seja necessário manter históricos de login
        const newUser = new User({ username, color });
        await newUser.save().catch(err => console.error('Erro ao salvar usuário:', err));

        io.emit('updateUserList', Object.values(connectedUsers));
        console.log('Usuário registrado:', { username, color });
    });

    // Gerenciamento de mensagens públicas e privadas
    socket.on('sendMessage', ({ message, to }) => {
        if (!message || !connectedUsers[socket.id]) return;

        if (to) {
            // Mensagem privada
            socket.to(to).emit('receivePrivateMessage', {
                message,
                from: connectedUsers[socket.id],
            });
            socket.to(to).emit('privateMessageNotification', {
                from: connectedUsers[socket.id],
            });
            socket.emit('receivePrivateMessage', {
                message,
                from: connectedUsers[socket.id],
                self: true,
            });
        } else {
            // Mensagem pública
            io.emit('receiveMessage', {
                message,
                from: connectedUsers[socket.id],
                private: false,
            });
        }
    });

    // Gerenciamento de envio de imagens
    socket.on('sendImage', ({ image, to }) => {
        if (!image || !connectedUsers[socket.id]) return;

        if (to) {
            // Imagem em chat privado
            socket.to(to).emit('receiveImage', {
                image,
                from: connectedUsers[socket.id],
            });
            socket.to(to).emit('privateMessageNotification', {
                from: connectedUsers[socket.id],
            });
            socket.emit('receiveImage', {
                image,
                from: connectedUsers[socket.id],
                self: true,
            });
        } else {
            // Imagem em chat público
            io.emit('receiveImage', {
                image,
                from: connectedUsers[socket.id],
            });
        }
    });

    // Desconexão do usuário
    socket.on('disconnect', () => {
        if (connectedUsers[socket.id]) {
            console.log('Usuário desconectado:', connectedUsers[socket.id].username);
            delete connectedUsers[socket.id];
            io.emit('updateUserList', Object.values(connectedUsers));
        }
    });
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
