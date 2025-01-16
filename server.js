const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuração inicial do servidor
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Conexão ao banco de dados MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
    .catch((error) => console.log('Erro ao conectar ao MongoDB:', error));

// Definição do esquema de usuário
const userSchema = new mongoose.Schema({
    username: String,
    color: String,
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
    from: { username: String, color: String },
    to: { type: String, default: null }, // 'null' for public, 'userId' for private messages
    message: String,
    timestamp: { type: Date, default: Date.now },
    private: Boolean,
});
const Message = mongoose.model('Message', messageSchema);

// Configurar arquivos estáticos
app.use(express.static('public'));

// Lista de usuários conectados na memória
let connectedUsers = {};

// Evento de conexão
io.on('connection', (socket) => {
    console.log('Novo usuário conectado:', socket.id);

    // Carregar mensagens anteriores ao conectar
    Message.find().sort({ timestamp: 1 }).exec((err, messages) => {
        if (err) {
            console.error(err);
            return;
        }
        socket.emit('loadMessages', messages); // Enviar mensagens salvas para o usuário
    });

    // Evento para registrar o nome do usuário
    socket.on('setUsername', ({ username, color }) => {
        if (!username || !color) {
            return;
        }
        connectedUsers[socket.id] = { username, color, socketId: socket.id };
        io.emit('updateUserList', Object.values(connectedUsers));
        console.log('Usuário registrado:', { username, color });
    });

    // Enviar mensagem
    socket.on('sendMessage', async ({ message, to }) => {
        if (!message || !connectedUsers[socket.id]) {
            return;
        }

        const messageData = {
            from: connectedUsers[socket.id],
            message,
            private: !!to,
            to: to || null, // store the user ID of the recipient for private messages
        };

        // Salvar mensagem no banco de dados
        const newMessage = new Message(messageData);
        await newMessage.save();

        // Se for uma mensagem privada
        if (to) {
            // Mensagem privada
            socket.to(to).emit('receivePrivateMessage', {
                message,
                from: connectedUsers[socket.id],
            });

            // Enviar notificação ao destinatário
            socket.to(to).emit('privateMessageNotification', {
                from: connectedUsers[socket.id],
            });

            // Confirmar envio ao remetente
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

    // Evento para recebimento de imagens
    socket.on('sendImage', async ({ image, to }) => {
        if (!image || !connectedUsers[socket.id]) {
            return;
        }

        if (to) {
            // Imagem enviada para um usuário específico
            socket.to(to).emit('receiveImage', {
                image,
                from: connectedUsers[socket.id],
            });

            // Notificação de imagem privada
            socket.to(to).emit('privateMessageNotification', {
                from: connectedUsers[socket.id],
            });

            // Confirmar envio ao remetente
            socket.emit('receiveImage', {
                image,
                from: connectedUsers[socket.id],
                self: true,
            });
        } else {
            // Imagem enviada publicamente
            io.emit('receiveImage', {
                image,
                from: connectedUsers[socket.id],
            });
        }
    });

    // Evento para desconexão
    socket.on('disconnect', () => {
        if (connectedUsers[socket.id]) {
            console.log('Usuário desconectado:', connectedUsers[socket.id].username);
            delete connectedUsers[socket.id];
            io.emit('updateUserList', Object.values(connectedUsers));
        }
    });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
