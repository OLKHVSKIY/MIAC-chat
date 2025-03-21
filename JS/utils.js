// Добавить обработчики копирования
function addCopyHandlers() {
    document.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageText = e.target.closest('.message').textContent.trim();
            navigator.clipboard.writeText(messageText).then(() => {
                showNotification('Сообщение скопировано!');
            });
        });
    });
}

document.getElementById('user-input').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        // Если нажат Shift + Enter, добавляем новую строку
        if (event.shiftKey) {
            event.preventDefault(); // Предотвращаем стандартное поведение (отправку формы)
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '\n' + this.value.substring(end); // Вставляем новую строку
            this.selectionStart = this.selectionEnd = start + 1; // Устанавливаем курсор после новой строки
        } else {
            // Если нажат только Enter, отправляем сообщение
            event.preventDefault(); // Предотвращаем стандартное поведение (отправку формы)
            sendMessage(); // Вызываем функцию отправки сообщения
        }
    }
});

// Функция отправки сообщения
function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim(); // Получаем текст и удаляем лишние пробелы

    if (message) {
        // Добавляем сообщение в чат (ваш код для добавления сообщения)
        console.log('Отправлено:', message);

        // Очищаем поле ввода
        userInput.value = '';
        userInput.style.height = 'auto'; // Сбрасываем высоту поля ввода
    }
}

document.getElementById('user-input').addEventListener('input', function () {
    this.style.height = 'auto'; // Сбрасываем высоту
    this.style.height = (this.scrollHeight) + 'px'; // Устанавливаем высоту по содержимому
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
            Это пример ответа нейросети.
            <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
        `;
        chatWindow.appendChild(botMessage);

        // Прокрутка вниз
        chatWindow.scrollTop = chatWindow.scrollHeight;

        // Добавление обработчика копирования для всех сообщений
        addCopyHandlers();
    }, 1000);
}