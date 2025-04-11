// Обработка загрузки файла
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        displayImageInChat(file);
    } else {
        alert('Пожалуйста, выберите изображение.');
    }
    e.target.value = ''; // Сброс значения input
}

// Отображение изображения в чате
function displayImageInChat(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageUrl = e.target.result;
        const imageContainer = document.createElement('div');
        imageContainer.className = 'message-container user-message-container';
        
        const imageContent = document.createElement('div');
        imageContent.className = 'message-content';
        
        const imageElement = document.createElement('div');
        imageElement.className = 'message user-message';
        imageElement.innerHTML = `
            <img src="${imageUrl}" alt="Загруженное изображение" class="chat-image">
        `;
        
        imageContent.appendChild(imageElement);
        imageContainer.appendChild(imageContent);
        chatWindow.appendChild(imageContainer);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };
    reader.readAsDataURL(file);
}

// Автоматическая подстройка высоты текстового поля
function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto'; // Сначала сбрасываем высоту
    textarea.style.height = `${textarea.scrollHeight}px`; // Устанавливаем высоту в зависимости от содержимого
}

// Отправка сообщения
function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();

    if (message === '') {
        return; // Не отправляем пустое сообщение
    }

    // Создаем контейнер для сообщения
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container user-message-container';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const messageElement = document.createElement('div');
    messageElement.className = 'message user-message';
    messageElement.textContent = message;

    messageContent.appendChild(messageElement);
    messageContainer.appendChild(messageContent);
    chatWindow.appendChild(messageContainer);

    // Очищаем поле ввода и сбрасываем высоту
    userInput.value = '';
    adjustTextareaHeight(userInput);

    // Прокручиваем чат вниз
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Инициализация input
function initInput() {
    const fileInput = document.getElementById('file-input');
    const userInput = document.getElementById('user-input');

    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    if (userInput) {
        userInput.addEventListener('input', () => adjustTextareaHeight(userInput));
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    initInput();
});