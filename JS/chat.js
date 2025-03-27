const API_URL = 'http://192.168.80.210:11434';
let isWaitingForResponse = false;
let currentModel = localStorage.getItem('selectedModel') || 'llama2'; // Модель по умолчанию

const chatList = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat');
window.chatWindow = document.getElementById('chat-window');
let activeChat = null;
let hasSentMessage = false;

// Обработчик изменения модели
document.addEventListener('modelChanged', (e) => {
    currentModel = e.detail;
    console.log('Текущая модель изменена на:', currentModel);
});

document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, есть ли чаты на странице
    const hasChats = chatList.children.length > 0;

    // Если чатов нет, создаем новый чат
    if (!hasChats) {
        createNewChat();
        localStorage.setItem('firstChatCreated', 'true');
    }
});

function createNewChat() {
    const chatId = 'chat_' + Date.now();
    const chatItem = document.createElement('div');
    chatItem.classList.add('chat-item');
    chatItem.dataset.id = chatId;
    chatItem.innerHTML = `
        <span>Новый чат</span>
        <div class="chat-actions">
            <button class="rename-chat" title="Переименовать"><i class="fas fa-edit"></i></button>
            <button class="delete-chat" title="Удалить"><i class="fas fa-trash"></i></button>
        </div>
    `;
    chatList.appendChild(chatItem);
    
    setActiveChat(chatItem);
    loadChat(chatId);

    const renameBtn = chatItem.querySelector('.rename-chat');
    const deleteBtn = chatItem.querySelector('.delete-chat');

    renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        renameChat(chatItem);
    });

    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(chatItem);
    });

    chatItem.addEventListener('click', () => {
        setActiveChat(chatItem);
        loadChat(chatId);
    });
}

function setActiveChat(chatItem) {
    if (activeChat) {
        activeChat.classList.remove('active');
    }
    chatItem.classList.add('active');
    activeChat = chatItem;
    
    document.getElementById('chat-title').textContent = chatItem.querySelector('span').textContent;
}

function loadChat(chatId) {
    chatWindow.innerHTML = '';
    
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message-container');
    
    const avatar = document.createElement('div');
    avatar.classList.add('avatar', 'bot-avatar');
    
    const content = document.createElement('div');
    content.classList.add('message-content');
    
    const message = document.createElement('div');
    message.classList.add('message', 'bot-message');
    message.innerHTML = `
        Чат создан. Начните общение!
        <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
    `;
    
    content.appendChild(message);
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(content);
    chatWindow.appendChild(messageContainer);
    
    addCopyHandlers();
    hasSentMessage = false;
}

newChatBtn.addEventListener('click', () => {
    if (!hasSentMessage) {
        alert('Пожалуйста, отправьте хотя бы одно сообщение в текущем чате, прежде чем создавать новый.');
        return;
    }
    createNewChat();
});

function renameChat(chatItem) {
    const chatName = chatItem.querySelector('span');
    const newName = prompt('Введите новое название чата:', chatName.textContent);
    if (newName) {
        chatName.textContent = newName;
    }
}

function deleteChat(chatItem) {
    if (confirm('Вы уверены, что хотите удалить этот чат?')) {
        chatItem.remove();
        if (activeChat === chatItem) {
            activeChat = null;
            chatWindow.innerHTML = '';
        }
    }
}

function addCopyHandlers() {
    document.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageText = e.target.closest('.message').textContent.trim();
            navigator.clipboard.writeText(messageText).then(() => {
            });
        });
    });
}

function updateChatName(chatItem, messageText) {
    const chatName = chatItem.querySelector('span');

    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.fontSize = window.getComputedStyle(chatName).fontSize;
    tempSpan.style.fontFamily = window.getComputedStyle(chatName).fontFamily;
    tempSpan.textContent = messageText;

    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);

    if (textWidth > 150) {
        let truncatedText = messageText;
        while (textWidth > 150 && truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1);
            tempSpan.textContent = truncatedText + '..';
            document.body.appendChild(tempSpan);
            const newWidth = tempSpan.offsetWidth;
            document.body.removeChild(tempSpan);

            if (newWidth <= 150) {
                break;
            }
        }
        chatName.textContent = truncatedText + '..';
    } else {
        chatName.textContent = messageText;
    }
}

let stopGeneration = false;

document.getElementById('send-btn').addEventListener('click', function() {
    if (isWaitingForResponse) {
        stopGeneration = true;
        this.innerHTML = '<i class="fas fa-arrow-up"></i>';
        isWaitingForResponse = false;
    } else {
        sendMessage();
    }
});

async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();
    
    if (!message) return;
    
    if (!activeChat) {
        createNewChat();
    }
    
    // Добавляем сообщение пользователя в чат
    addMessageToChat(message, 'user');
    userInput.value = '';
    hasSentMessage = true;
    
    // Показываем индикатор "печатает"
    const typingIndicator = addTypingIndicator();
    
    isWaitingForResponse = true;
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-stop"></i>';
    
    try {
        const response = await fetch(`${API_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: currentModel,
                prompt: message,
                stream: false // Можно изменить на true для потокового ответа
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Удаляем индикатор "печатает" и добавляем ответ
        chatWindow.removeChild(typingIndicator);
        addMessageToChat(data.response, 'bot');
        
        // Обновляем название чата по первому сообщению
        if (!hasSentMessage) {
            updateChatName(activeChat, message.substring(0, 30));
        }
        
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        chatWindow.removeChild(typingIndicator);
        addMessageToChat('Произошла ошибка при обработке вашего запроса.', 'bot');
    } finally {
        isWaitingForResponse = false;
        document.getElementById('send-btn').innerHTML = '<i class="fas fa-arrow-up"></i>';
    }
}

function addMessageToChat(message, sender) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message-container');
    
    const avatar = document.createElement('div');
    avatar.classList.add('avatar', sender === 'user' ? 'user-avatar' : 'bot-avatar');
    
    const content = document.createElement('div');
    content.classList.add('message-content');
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    
    // Форматируем сообщение (сохраняем переносы строк)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageElement.innerHTML = `
        ${formattedMessage}
        <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
    `;
    
    content.appendChild(messageElement);
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(content);
    chatWindow.appendChild(messageContainer);
    
    addCopyHandlers();
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addTypingIndicator() {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message-container');
    
    const avatar = document.createElement('div');
    avatar.classList.add('avatar', 'bot-avatar');
    
    const content = document.createElement('div');
    content.classList.add('message-content');
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'bot-message', 'typing');
    messageElement.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;
    
    content.appendChild(messageElement);
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(content);
    chatWindow.appendChild(messageContainer);
    
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return messageContainer;
}