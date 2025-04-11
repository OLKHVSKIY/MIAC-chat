import { chatStorage } from './chatStorage.js';

const API_URL = 'http://192.168.80.210:11434';
let isWaitingForResponse = false;
let currentModel = localStorage.getItem('selectedModel') || 'llama2';
let stopGeneration = false;
let hasSentMessage = false;
const chatList = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat');
window.chatWindow = document.getElementById('chat-window');
let activeChat = null;

// Обработчик Enter для отправки сообщений
userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && !isWaitingForResponse) {
        e.preventDefault();
        sendMessage();
    }
});

// Event listener for model change
document.addEventListener('modelChanged', (e) => {
    currentModel = e.detail;
    console.log('Текущая модель изменена на:', currentModel);
});

// Initialize chat
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const chats = await chatStorage.getUserChats();
        
        if (chats.length === 0) {
            await createNewChat();
        } else {
            renderChatList(chats);
            setActiveChatById(chats[0].chat_id);
            await loadChat(chats[0].chat_id);
        }
    } catch (error) {
        console.error('Ошибка инициализации чатов:', error);
        await createNewChat();
    }
});

// Create a new chat
async function createNewChat() {
    try {
        const chatData = await chatStorage.createNewChat();
        const chatId = chatData.chat_id;
        
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
        await loadChat(chatId);
        hasSentMessage = false;

        // Event listeners
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

    } catch (error) {
        console.error('Ошибка при создании чата:', error);
        showAlert('Не удалось создать новый чат', 'error');
    }
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
async function loadChat(chatId) {
    try {
        const messages = await chatStorage.getChatMessages(chatId);
        chatWindow.innerHTML = '';
        
        if (messages.length === 0) {
            const welcomeMsg = createMessageElement(
                'bot', 
                'Чат создан. Задайте ваш вопрос...',
                new Date().toISOString()
            );
            chatWindow.appendChild(welcomeMsg);
        } else {
            messages.forEach(msg => {
                const messageElement = createMessageElement(
                    msg.sender,
                    msg.content,
                    msg.timestamp
                );
                chatWindow.appendChild(messageElement);
            });
        }
        
        chatWindow.scrollTop = chatWindow.scrollHeight;
        addCopyHandlers();
        
    } catch (error) {
        console.error('Ошибка при загрузке чата:', error);
        showAlert('Не удалось загрузить историю чата', 'error');
    }
}

// New chat button handler
newChatBtn.addEventListener('click', async () => {
    if (!hasSentMessage) {
        alert('Пожалуйста, отправьте хотя бы одно сообщение в текущем чате, прежде чем создавать новый.');
        return;
    }
    await createNewChat();
});

// Rename chat
async function renameChat(chatItem) {
    const chatId = chatItem.dataset.id;
    const chatName = chatItem.querySelector('span');
    const newName = prompt('Введите новое название чата:', chatName.textContent);
    
    if (newName) {
        try {
            await chatStorage.updateChatTitle(chatId, newName);
            chatName.textContent = newName;
        } catch (error) {
            console.error('Ошибка при переименовании чата:', error);
            showAlert('Не удалось переименовать чат', 'error');
        }
    }
}

// Delete chat
async function deleteChat(chatItem) {
    if (!confirm('Вы уверены, что хотите удалить этот чат?')) return;
    
    const chatId = chatItem.dataset.id;
    try {
        await chatStorage.deleteChat(chatId);
        chatItem.remove();
        
        if (activeChat === chatItem) {
            activeChat = null;
            chatWindow.innerHTML = '';
            if (chatList.children.length === 0) {
                await createNewChat();
            }
        }
    } catch (error) {
        console.error('Ошибка при удалении чата:', error);
        showAlert('Не удалось удалить чат', 'error');
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
document.getElementById('send-btn').addEventListener('click', function() {
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
        await createNewChat();
        return;
    }

    const chatId = activeChat.dataset.id;
    
    // Add user message to UI
    const userMessageElement = createMessageElement('user', message);
    chatWindow.appendChild(userMessageElement);
    userInput.value = '';

    // Save user message
    try {
        await chatStorage.saveMessage(chatId, 'user', message);
    } catch (error) {
        console.error('Ошибка при сохранении сообщения:', error);
    }

    // Show typing indicator
    const typingIndicator = addTypingIndicator();
    isWaitingForResponse = true;
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-stop"></i>';

    try {
        // Get AI response
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

        // Add AI response to UI
        const botMessageElement = createMessageElement('bot', data.response);
        chatWindow.appendChild(botMessageElement);

        // Save AI response
        try {
            await chatStorage.saveMessage(chatId, 'bot', data.response);
        } catch (error) {
            console.error('Ошибка при сохранении ответа:', error);
        }

        // Update chat title if first message
        if (!hasSentMessage) {
            try {
                const shortTitle = message.substring(0, 30);
                await chatStorage.updateChatTitle(chatId, shortTitle);
                updateChatName(activeChat, shortTitle);
            } catch (error) {
                console.error('Ошибка при обновлении названия чата:', error);
            }
            hasSentMessage = true;
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

// Helper functions
function createMessageElement(sender, content, timestamp = null) {
    const container = document.createElement('div');
    container.classList.add('message-container');
    
    if (sender === 'bot') {
        container.innerHTML = `
            <div class="avatar bot-avatar"></div>
            <div class="message-content">
                <div class="message bot-message">
                    ${content.replace(/\n/g, '<br>')}
                    <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="message-content">
                <div class="message user-message">
                    ${content.replace(/\n/g, '<br>')}
                    <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
                </div>
            </div>
        `;
    }
    
    return container;
}

function renderChatList(chats) {
    chatList.innerHTML = '';
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.classList.add('chat-item');
        chatItem.dataset.id = chat.chat_id;
        chatItem.innerHTML = `
            <span>${chat.title}</span>
            <div class="chat-actions">
                <button class="rename-chat" title="Переименовать"><i class="fas fa-edit"></i></button>
                <button class="delete-chat" title="Удалить"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Event handlers
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
            loadChat(chat.chat_id);
        });
        
        chatList.appendChild(chatItem);
    });
}

function setActiveChatById(chatId) {
    const chatItem = document.querySelector(`.chat-item[data-id="${chatId}"]`);
    if (chatItem) {
        setActiveChat(chatItem);
    }
}

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

function addCopyHandlers() {
    document.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const messageText = e.target.closest('.message').textContent.trim();
            navigator.clipboard.writeText(messageText);
        });
    });
}

function showAlert(message, type = 'error') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;
    document.body.appendChild(alertBox);
    setTimeout(() => {
        alertBox.classList.add('fade-out');
        setTimeout(() => alertBox.remove(), 300);
    }, 3000);
}

