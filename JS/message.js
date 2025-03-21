// Объявляем userInput здесь
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Обработчик для кнопки отправки
sendBtn.addEventListener('click', sendMessage);

// Обработчик для клавиши Enter
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Предотвращаем стандартное поведение Enter
        sendMessage(); // Отправляем сообщение
    }
});