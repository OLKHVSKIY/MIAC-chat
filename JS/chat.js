// Добавьте в начало файла chat.js
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

// Проверка и fallback для messageStyling
if (!window.messageStyling) {
    window.messageStyling = {
        processMessageContent: (content) => content.replace(/\n/g, '<br>')
    };
    console.warn('messageStyling not loaded, using fallback');
}

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
    if (!activeChat) {
        await createNewChat();
        return;
    }

    const chatId = activeChat.dataset.id;
    try {
        const messages = await chatStorage.getChatMessages(chatId);
        const hasUserMessage = messages.some(msg => msg.sender === 'user');
        
        if (!hasUserMessage) {
            showAlert('Пожалуйста, отправьте хотя бы одно сообщение в текущем чате, прежде чем создавать новый.', 'error');
            return;
        }
        
        await createNewChat();
    } catch (error) {
        console.error('Ошибка при проверке сообщений чата:', error);
        showAlert('Не удалось проверить историю чата', 'error');
    }
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
        // получение AI запроса
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

        // aI response to uI
        const botMessageElement = createMessageElement('bot', data.response);
        chatWindow.appendChild(botMessageElement);

       
        try {
            await chatStorage.saveMessage(chatId, 'bot', data.response);
        } catch (error) {
            console.error('Ошибка при сохранении ответа:', error);
        }

        if (!hasSentMessage) {
            try {
                const messages = await chatStorage.getChatMessages(chatId);
                // Проверяем, что в чате только 2 сообщения (наше только что отправленное и ответ)
                if (messages.length === 2) {
                    const shortTitle = message.substring(0, 30);
                    await chatStorage.updateChatTitle(chatId, shortTitle);
                    updateChatName(activeChat, shortTitle);
                }
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
    container.classList.add('message-container', `${sender}-message-container`);
    
    if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.classList.add('avatar', 'bot-avatar');
        avatar.innerHTML = '<img src="/IMG/miac_short.png" alt="AI Avatar">';
        container.appendChild(avatar);
    }
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    
    try {
        // Обрабатываем содержимое с учетом markdown и подсветки кода
        const processedContent = window.messageStyling.processMessageContent(content);
        messageElement.innerHTML = processedContent;
    } catch (error) {
        console.error('Error processing message content:', error);
        messageElement.innerHTML = content.replace(/\n/g, '<br>');
    }
    
    // Добавляем кнопку копирования
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-icon';
    copyButton.title = 'Копировать';
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    messageElement.appendChild(copyButton);
    
    // Добавляем временную метку, если она есть
    if (timestamp) {
        const timeElement = document.createElement('div');
        timeElement.classList.add('message-time');
        timeElement.textContent = formatTime(timestamp);
        messageElement.appendChild(timeElement);
    }
    
    messageContent.appendChild(messageElement);
    container.appendChild(messageContent);
    
    // После добавления сообщения в DOM
    setTimeout(() => {
        if (window.messageStyling && window.messageStyling.initCopyButtons) {
            window.messageStyling.initCopyButtons();
        }
    }, 0);
        
    return container;
}

// Вспомогательная функция для форматирования времени
function formatTime(timestamp) {
    const date = new Date(timestamp);
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month} ${hours}:${minutes}`;
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
    avatar.innerHTML = '<img src="/IMG/miac_short.png" alt="AI Avatar">';
    
    const content = document.createElement('div');
    content.classList.add('message-content');
    
    const typingElement = document.createElement('div');
    typingElement.classList.add('message', 'typing-message');
    typingElement.innerHTML = `
        <div class="typing-dots">
            <div></div>
            <div></div>
            <div></div>
        </div>
    `;
    
    content.appendChild(typingElement);
    typingContainer.appendChild(avatar);
    typingContainer.appendChild(content);
    chatWindow.appendChild(typingContainer);
    
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return typingContainer;
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