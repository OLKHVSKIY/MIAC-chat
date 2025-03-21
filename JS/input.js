const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        displayImageInChat(file);
        uploadImageToServer(file); // Опционально: загрузка на сервер
    } else {
        alert('Пожалуйста, выберите изображение.');
    }
});

function displayImageInChat(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const imageUrl = e.target.result;
        const imageMessage = document.createElement('div');
        imageMessage.classList.add('message', 'user-message');
        imageMessage.innerHTML = `
            <img src="${imageUrl}" alt="Загруженное изображение" class="chat-image">
        `;
        window.chatWindow.appendChild(imageMessage);
        window.chatWindow.scrollTop = window.chatWindow.scrollHeight;
    };

    reader.readAsDataURL(file);
}

function uploadImageToServer(file) {
    const formData = new FormData();
    formData.append('image', file);

    fetch('/upload', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        console.log('Изображение успешно загружено:', data);
    })
    .catch(error => {
        console.error('Ошибка при загрузке изображения:', error);
    });
}

userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';

    const containerHeight = inputContainer.offsetHeight;
    const inputHeight = this.scrollHeight;
    const offset = inputHeight - containerHeight;

    if (offset > 0) {
        inputContainer.style.bottom = `${20 + offset}px`;
    } else {
        inputContainer.style.bottom = '20px';
    }
});

userInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        if (event.shiftKey) {
            event.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '\n' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 1;
        } else {
            event.preventDefault();
            sendMessage();
        }
    }
});

function sendMessage() {
    const message = userInput.value.trim();

    if (message) {
        console.log('Отправлено:', message);

        // Сохраняем переносы строки
        const formattedMessage = message.replace(/\n/g, '<br>'); // Заменяем \n на <br>

        // Добавляем сообщение в чат
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'user-message');
        messageElement.innerHTML = formattedMessage; // Используем innerHTML для поддержки <br>
        chatWindow.appendChild(messageElement);

        // Очищаем поле ввода
        userInput.value = '';
        userInput.style.height = '90px'; // Сбрасываем высоту до минимальной
        inputContainer.style.bottom = '20px'; // Возвращаем контейнер в исходное положение

        // Прокручиваем чат вниз
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}