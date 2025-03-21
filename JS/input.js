const fileInput = document.getElementById('file-input');

// Используем inputContainer как глобальную переменную
// const inputContainer = document.querySelector('.input-container'); // Уберите эту строку

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

// Обработчик изменения высоты текстового поля
userInput.addEventListener('input', function () {
    this.style.height = 'auto'; // Сбрасываем высоту
    this.style.height = Math.min(this.scrollHeight, 200) + 'px'; // Ограничиваем максимальную высоту
});

// Обработчик нажатия клавиш
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