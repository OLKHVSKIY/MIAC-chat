const API_URL = 'http://192.168.80.210:11434';
let isWaitingForResponse = false;
let currentModel = localStorage.getItem('selectedModel') || 'llama2';
let stopGeneration = false;
let hasSentMessage = false; // Tracks if a message has been sent in the current chat
const chatList = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat');
window.chatWindow = document.getElementById('chat-window');
let activeChat = null;

// Event listener for model change
document.addEventListener('modelChanged', (e) => {
    currentModel = e.detail;
    console.log('Текущая модель изменена на:', currentModel);
});

// Initialize chat
document.addEventListener('DOMContentLoaded', () => {
    const hasChats = chatList.children.length > 0;
    if (!hasChats) {
        createNewChat();
        localStorage.setItem('firstChatCreated', 'true');
    }
});

// Create a new chat
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

    // Reset the flag for the new chat
    hasSentMessage = false;

    // Event listeners for rename and delete
    chatItem.querySelector('.rename-chat').addEventListener('click', (e) => {
        e.stopPropagation();
        renameChat(chatItem);
    });

    chatItem.querySelector('.delete-chat').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(chatItem);
    });

    chatItem.addEventListener('click', () => {
        setActiveChat(chatItem);
        loadChat(chatId);
    });
}

// Set the active chat
function setActiveChat(chatItem) {
    if (activeChat) {
        activeChat.classList.remove('active');
    }
    chatItem.classList.add('active');
    activeChat = chatItem;
    document.getElementById('chat-title').textContent = chatItem.querySelector('span').textContent;
}

// Load chat content
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

    // Format date and time
    const now = new Date();
    const formattedDate = [
        String(now.getDate()).padStart(2, '0'),
        String(now.getMonth() + 1).padStart(2, '0'),
        now.getFullYear()
    ].join('.');
    const formattedTime = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
    ].join(':');

    message.innerHTML = `Чат создан: ${formattedDate} в ${formattedTime}`;
    content.appendChild(message);
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(content);
    chatWindow.appendChild(messageContainer);

    addCopyHandlers();
}

// New chat button handler
newChatBtn.addEventListener('click', () => {
    if (!hasSentMessage) {
        alert('Пожалуйста, отправьте хотя бы одно сообщение в текущем чате, прежде чем создавать новый.');
        return;
    }
    createNewChat();
});

// Rename chat
function renameChat(chatItem) {
    const chatName = chatItem.querySelector('span');
    const newName = prompt('Введите новое название чата:', chatName.textContent);
    if (newName) {
        chatName.textContent = newName;
    }
}

// Delete chat
function deleteChat(chatItem) {
    if (confirm('Вы уверены, что хотите удалить этот чат?')) {
        chatItem.remove();
        if (activeChat === chatItem) {
            activeChat = null;
            chatWindow.innerHTML = '';
        }
    }
}

// Update chat name based on the first message
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

    if (textWidth > 180) {
        let truncatedText = messageText;
        while (textWidth > 180 && truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1);
            tempSpan.textContent = truncatedText + '..';
            document.body.appendChild(tempSpan);
            const newWidth = tempSpan.offsetWidth;
            document.body.removeChild(tempSpan);
            if (newWidth <= 180) break;
        }
        chatName.textContent = truncatedText + '..';
    } else {
        chatName.textContent = messageText;
    }
}

// Send message
document.getElementById('send-btn').addEventListener('click', function () {
    if (isWaitingForResponse) {
        stopGeneration = true;
        this.innerHTML = '<i class="fas fa-arrow-up"></i>';
        isWaitingForResponse = false;
        return;
    }
    sendMessage();
});

async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();
    if (!message) return;

    if (!activeChat) {
        createNewChat();
    }

    // Add user's message without avatar
    const userMessageContainer = document.createElement('div');
    userMessageContainer.classList.add('message-container');
    userMessageContainer.innerHTML = `
        <div class="message-content">
            <div class="message user-message">
                ${message.replace(/\n/g, '<br>')}
                <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
            </div>
        </div>
    `;
    chatWindow.appendChild(userMessageContainer);
    userInput.value = '';

    // Show typing indicator
    const typingIndicator = addTypingIndicator();
    isWaitingForResponse = true;
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-stop"></i>';

    try {
        const response = await fetch(`${API_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: currentModel,
                prompt: message,
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
        const data = await response.json();

        chatWindow.removeChild(typingIndicator);

        // Add bot message with typing effect
        addBotMessageWithTypingEffect(data.response);

        // Update chat name if it's the first message
        if (!hasSentMessage) {
            updateChatName(activeChat, message.substring(0, 30));
            hasSentMessage = true; // Mark that a message has been sent in this chat
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        chatWindow.removeChild(typingIndicator);
        addErrorMessage(`Ошибка: ${error.message}`);
    } finally {
        isWaitingForResponse = false;
        document.getElementById('send-btn').innerHTML = '<i class="fas fa-arrow-up"></i>';
        chatWindow.scrollTop = chatWindow.scrollHeight;
        addCopyHandlers();
    }
}

// Add bot message with typing effect
function addBotMessageWithTypingEffect(text) {
    const botContainer = document.createElement('div');
    botContainer.classList.add('message-container');
    const avatar = document.createElement('div');
    avatar.classList.add('avatar', 'bot-avatar');
    const content = document.createElement('div');
    content.classList.add('message-content');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'bot-message');

    // Copy button
    const copyButton = document.createElement('button');
    copyButton.classList.add('copy-icon');
    copyButton.title = 'Копировать';
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    messageElement.appendChild(copyButton);

    content.appendChild(messageElement);
    botContainer.appendChild(avatar);
    botContainer.appendChild(content);
    chatWindow.appendChild(botContainer);

    // Typing effect
    let i = 0;
    const typingSpeed = 20;
    const fullText = text.replace(/\n/g, '<br>');
    function typeWriter() {
        if (i < fullText.length && !stopGeneration) {
            messageElement.insertBefore(
                document.createTextNode(fullText[i]),
                copyButton
            );
            i++;
            chatWindow.scrollTop = chatWindow.scrollHeight;
            setTimeout(typeWriter, typingSpeed);
        } else {
            addCopyHandlers();
        }
    }
    typeWriter();
}

// Add typing indicator
function addTypingIndicator() {
    const typingContainer = document.createElement('div');
    typingContainer.classList.add('message-container');
    const avatar = document.createElement('div');
    avatar.classList.add('avatar', 'bot-avatar');
    const content = document.createElement('div');
    content.classList.add('message-content');
    const typingElement = document.createElement('div');
    typingElement.classList.add('message', 'typing-message');
    typingElement.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;
    content.appendChild(typingElement);
    typingContainer.appendChild(avatar);
    typingContainer.appendChild(content);
    chatWindow.appendChild(typingContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return typingContainer;
}

// Add error message
function addErrorMessage(message) {
    const errorContainer = document.createElement('div');
    errorContainer.classList.add('message-container');
    errorContainer.innerHTML = `
        <div class="message-content">
            <div class="message error-message">
                ${message}
            </div>
        </div>
    `;
    chatWindow.appendChild(errorContainer);
}

// Add copy handlers
function addCopyHandlers() {
    document.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const messageText = e.target.closest('.message').textContent.trim();
            navigator.clipboard.writeText(messageText);
        });
    });
}

// Additional functions
async function loadUserChats() {
    try {
        const response = await fetch('http://localhost:3000/api/chats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        if (!response.ok) throw new Error('Ошибка загрузки чатов');
        const chats = await response.json();
        renderChatList(chats);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function saveMessage(chatId, userMessage, aiMessage) {
    try {
        const response = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ chat_id: chatId, user_message: userMessage, ai_message: aiMessage })
        });
        if (!response.ok) throw new Error('Ошибка сохранения сообщения');
    } catch (error) {
        console.error('Ошибка:', error);
    }
}