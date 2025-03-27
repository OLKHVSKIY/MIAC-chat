// input.js
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('file-input');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    if (!fileInput || !userInput || !sendBtn) {
        console.error('Не найдены необходимые элементы DOM');
        return;
    }

    fileInput.addEventListener('change', handleFileUpload);
    userInput.addEventListener('input', adjustTextareaHeight);
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', handleKeyDown);
});

document.getElementById('send-btn')?.addEventListener('click', function() {
    if (window.sendMessage) {
        window.sendMessage();
    }
});

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        displayImageInChat(file);
    } else {
        alert('Пожалуйста, выберите изображение.');
    }
}

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

function adjustTextareaHeight() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
}

function handleSendMessage() {
    if (window.sendMessage) {
        window.sendMessage();
    } else {
        console.error('Функция sendMessage не определена');
    }
}