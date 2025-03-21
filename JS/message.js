const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const messageText = userInput.value.trim();
    if (messageText === '') return;

    // Сообщение пользователя
    const userMessage = document.createElement('div');
    userMessage.classList.add('message', 'user-message');
    userMessage.innerHTML = `
        ${messageText}
        <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
    `;
    chatWindow.appendChild(userMessage);

    // Очистка поля ввода
    userInput.value = '';

    // Прокрутка вниз
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Установка флага, что сообщение отправлено
    hasSentMessage = true;

    // Если это первое сообщение в чате, обновляем название чата
    if (activeChat && activeChat.querySelector('span').textContent === 'Новый чат') {
        const chatName = messageText.length > 190 ? messageText.substring(0, 190) + '...' : messageText;
        activeChat.querySelector('span').textContent = chatName;
    }

    // Имитация ответа нейросети
    setTimeout(() => {
        const botMessage = document.createElement('div');
        botMessage.classList.add('message', 'bot-message');
        botMessage.innerHTML = `
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, 
            sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
            Ut enim ad minim veniam, quis nostrud exercitation ullamco 
            laboris nisi ut aliquip ex ea commodo consequat.
            <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
        `;
        chatWindow.appendChild(botMessage);

        // Прокрутка вниз
        chatWindow.scrollTop = chatWindow.scrollHeight;

        // Добавление обработчика копирования для всех сообщений
        addCopyHandlers();
    }, 1000);
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