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
    const chatId = Date.now();
    const chatItem = document.createElement('div');
    chatItem.classList.add('chat-item');
    chatItem.innerHTML = `
        <span>Новый чат</span>
        <div class="chat-actions">
            <button class="rename-chat" title="Переименовать"><i class="fas fa-edit"></i></button>
            <button class="delete-chat" title="Удалить"><i class="fas fa-trash"></i></button>
        </div>
    `;
    chatList.appendChild(chatItem);
    setActiveChat(chatItem);

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

function loadChat(chatId) {
    chatWindow.innerHTML = '';
    const message = document.createElement('div');
    message.classList.add('message', 'bot-message');
    message.innerHTML = `
        Загружен чат ${chatId}.
        <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
    `;
    chatWindow.appendChild(message);
    addCopyHandlers();
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