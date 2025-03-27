const API_URL = 'http://192.168.80.210:11434';
let isWaitingForResponse = false;

const chatList = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat');
window.chatWindow = document.getElementById('chat-window');
let activeChat = null;
let hasSentMessage = false;

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
    chatItem.dataset.id = chatId; // Добавляем ID чата
    chatItem.innerHTML = `
        <span>Новый чат</span>
        <div class="chat-actions">
            <button class="rename-chat" title="Переименовать"><i class="fas fa-edit"></i></button>
            <button class="delete-chat" title="Удалить"><i class="fas fa-trash"></i></button>
        </div>
    `;
    chatList.appendChild(chatItem);
    
    // Сразу делаем новый чат активным и загружаем его
    setActiveChat(chatItem);
    loadChat(chatId);

    // Обработчики для кнопок удаления и переименования
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
    
    // Обновляем заголовок чата
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

function setActiveChat(chatItem) {
    if (activeChat) {
        activeChat.classList.remove('active');
    }
    chatItem.classList.add('active');
    activeChat = chatItem;
}

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
                console.log('Уведомление должно появиться'); // Проверка
                showNotification('Сообщение скопировано!'); // Вызов функции
            });
        });
    });
}

// Функция для обновления названия чата по первому сообщению
function updateChatName(chatItem, messageText) {
    const chatName = chatItem.querySelector('span');

    // Создаем временный элемент для измерения длины текста
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden'; // Скрываем элемент
    tempSpan.style.whiteSpace = 'nowrap'; // Запрещаем перенос строк
    tempSpan.style.fontSize = window.getComputedStyle(chatName).fontSize; // Используем тот же шрифт
    tempSpan.style.fontFamily = window.getComputedStyle(chatName).fontFamily; // Используем тот же шрифт
    tempSpan.textContent = messageText;

    // Добавляем временный элемент в DOM
    document.body.appendChild(tempSpan);

    // Измеряем ширину текста
    const textWidth = tempSpan.offsetWidth;

    // Удаляем временный элемент
    document.body.removeChild(tempSpan);

    // Если текст превышает 150 пикселей, обрезаем его
    if (textWidth > 150) {
        let truncatedText = messageText;
        while (textWidth > 150 && truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1); // Удаляем последний символ
            tempSpan.textContent = truncatedText + '..'; // Добавляем многоточие
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

// Глобальная переменная для контроля генерации
let stopGeneration = false;



// Обработчик кнопки отправки/остановки
document.getElementById('send-btn').addEventListener('click', function() {
    if (isWaitingForResponse) {
        stopGeneration = true;
    } else {
        sendMessage();
    }
});
