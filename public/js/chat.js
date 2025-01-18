const socket = io();

const usernameInput = document.getElementById('username');
const colorInput = document.getElementById('color');
const joinButton = document.getElementById('join-btn');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const usersList = document.getElementById('users');
const toggleSoundButton = document.getElementById('toggle-sound');
const soundIcon = document.getElementById('sound-icon');

// Elementos para chat privado
const privateChatContainer = document.getElementById('private-chat-container');
const privateChatHeader = document.getElementById('private-chat-username');
const privateMessagesContainer = document.getElementById('private-messages');
const privateMessageInput = document.getElementById('private-message-input');
const privateSendButton = document.getElementById('private-send-btn');
const closePrivateChatButton = document.getElementById('close-private-chat-btn');

// Variáveis globais
let soundEnabled = true;
let username = '';
let color = '';
let currentPrivateUserId = null;
let blockedUsers = []; // Armazena IDs dos usuários bloqueados

// Configuração do som de notificação
const notificationSound = new Audio('https://www.myinstants.com/media/sounds/discord-notification.mp3');
notificationSound.oncanplaythrough = () => console.log('Som carregado com sucesso!');
notificationSound.onerror = (error) => console.log('Erro ao carregar o som:', error);

// Alternar o estado do som
toggleSoundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
});

// Enviar configurações iniciais do usuário
joinButton.addEventListener('click', () => {
    username = usernameInput.value;
    color = colorInput.value;
    if (username.trim()) {
        socket.emit('setUsername', { username, color });
        document.getElementById('user-settings').style.display = 'none';
        document.getElementById('chat').style.display = 'block';
    }
});

// Enviar configurações iniciais do usuário ao pressionar Enter
usernameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        username = usernameInput.value;
        color = colorInput.value;
        if (username.trim()) {
            socket.emit('setUsername', { username, color });
            document.getElementById('user-settings').style.display = 'none';
            document.getElementById('chat').style.display = 'block';
        }
    }
});

// Enviar mensagem pública
sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message.trim()) {
        socket.emit('sendMessage', { message });
        messageInput.value = '';
    }
});

// Enviar mensagem pública ao pressionar Enter
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const message = messageInput.value;
        if (message.trim()) {
            socket.emit('sendMessage', { message });
            messageInput.value = ''; // Limpar campo de mensagem após enviar
        }
    }
});

// Receber e atualizar a lista de usuários conectados
socket.on('updateUserList', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username;
        li.style.color = user.color;
        li.dataset.userId = user.socketId;

        // Botão de abrir chat privado
        const privateChatButton = document.createElement('button');
        privateChatButton.textContent = 'Chat';
        privateChatButton.style.marginLeft = '10px';
        privateChatButton.addEventListener('click', () => openPrivateChat(user.username, user.socketId));

        // Botão de bloqueio
        const blockButton = document.createElement('button');
        blockButton.textContent = blockedUsers.includes(user.socketId) ? 'Desbloquear' : 'Bloquear';
        blockButton.style.marginLeft = '10px';
        blockButton.addEventListener('click', () => toggleBlockUser(user.socketId, user.username, blockButton));

        li.appendChild(privateChatButton);
        li.appendChild(blockButton);
        usersList.appendChild(li);
    });
});

// Notificação de mensagem privada
socket.on('privateMessageNotification', ({ from }) => {
    const userListItems = document.querySelectorAll('#users li');
    userListItems.forEach((item) => {
        if (item.dataset.userId === from.socketId) {
            // Adicionar indicador de nova mensagem
            if (!item.querySelector('.notification-dot')) {
                const dot = document.createElement('span');
                dot.className = 'notification-dot';
                dot.style.cssText = `
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    background-color: red;
                    border-radius: 50%;
                    margin-left: 5px;
                `;
                item.appendChild(dot);
            }
        }
    });
});

// Exibir mensagens públicas ou privadas
socket.on('receiveMessage', ({ message, from }) => {
    if (blockedUsers.includes(from.socketId)) return; // Ignorar mensagens de usuários bloqueados
    appendMessageToMessages(`${from.username}: ${message}`, from.color);

    if (soundEnabled) notificationSound.play();
});

// Enviar mensagem privada ao pressionar Enter
socket.on('receivePrivateMessage', ({ message, from }) => {
    if (blockedUsers.includes(from.socketId)) return; // Ignorar mensagens de usuários bloqueados
    if (from.socketId === currentPrivateUserId) {
        appendMessageToPrivateChat(`${from.username}: ${message}`, from.color);
    } else if (soundEnabled) {
        notificationSound.play();
    }
});

// Função para mensagens no chat principal
function appendMessageToMessages(content, color) {
    const messageElement = document.createElement('div');
    messageElement.style.color = 'black';  // A cor das mensagens será preta
    const usernameElement = document.createElement('span');
    usernameElement.style.color = color; // A cor do nome de usuário
    usernameElement.textContent = `${content.split(':')[0]}: `;
    messageElement.appendChild(usernameElement);
    messageElement.appendChild(document.createTextNode(content.split(':')[1]));
    messagesContainer.appendChild(messageElement);
}

function toggleBlockUser(userId, username, button) {
    if (blockedUsers.includes(userId)) {
        blockedUsers = blockedUsers.filter(id => id !== userId); // Remove da lista de bloqueio
        button.textContent = 'Bloquear';
        alert(`Você desbloqueou ${username}.`);
    } else {
        blockedUsers.push(userId); // Adiciona à lista de bloqueio
        button.textContent = 'Desbloquear';
        alert(`Você bloqueou ${username}.`);
    }
}

// Função para mensagens no chat privado
function appendMessageToPrivateChat(content, color) {
    const messageElement = document.createElement('div');
    messageElement.style.color = 'black';  // A cor das mensagens será preta
    const usernameElement = document.createElement('span');
    usernameElement.style.color = color; // A cor do nome de usuário
    usernameElement.textContent = `${content.split(':')[0]}: `;
    messageElement.appendChild(usernameElement);
    messageElement.appendChild(document.createTextNode(content.split(':')[1]));
    privateMessagesContainer.appendChild(messageElement);
}

// Abrir o chat privado
function openPrivateChat(username, socketId) {
    currentPrivateUserId = socketId;
    privateChatContainer.style.display = 'block';
    privateChatHeader.textContent = `Chat com ${username}`;

    // Remover indicador de notificação
    const userListItems = document.querySelectorAll('#users li');
    userListItems.forEach((item) => {
        if (item.dataset.userId === socketId) {
            const dot = item.querySelector('.notification-dot');
            if (dot) {
                dot.remove();
            }
        }
    });
}

// Fechar o chat privado
closePrivateChatButton.addEventListener('click', () => {
    privateChatContainer.style.display = 'none';
    currentPrivateUserId = null;
});

// Enviar mensagem privada
privateSendButton.addEventListener('click', () => {
    const privateMessage = privateMessageInput.value;
    if (privateMessage.trim() && currentPrivateUserId) {
        socket.emit('sendMessage', { message: privateMessage, to: currentPrivateUserId });
        appendMessageToPrivateChat(`Você: ${privateMessage}`, color);
        privateMessageInput.value = '';
    }
});

// Receber mensagens privadas
socket.on('receivePrivateMessage', ({ message, from }) => {
    if (from.socketId === currentPrivateUserId) {
        appendMessageToPrivateChat(`${from.username}: ${message}`, from.color);
    } else {
        if (soundEnabled) notificationSound.play();
    }
});

// Enviar imagem
document.getElementById('image-upload-btn').addEventListener('click', () => {
    document.getElementById('image-upload').click();
});

document.getElementById('image-upload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            socket.emit('sendImage', { image: reader.result });
        };
        reader.readAsDataURL(file);
    }else{
        console.log("Imagem não carregada")
    }
});

// Exibir imagens recebidas
socket.on('receiveImage', ({ image, from }) => {
    appendImageToMessages(image, `${from.username}`);
});

function appendImageToMessages(imageData, from) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>${from}:</strong> <img src="${imageData}" style="max-width: 300px; max-height: 300px;">`;
    messagesContainer.appendChild(messageElement);
}
