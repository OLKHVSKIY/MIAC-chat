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

function addCopyHandlers() {
    document.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageText = e.target.closest('.message').textContent.trim();
            navigator.clipboard.writeText(messageText).then(() => {
                showNotification('Сообщение скопировано!'); // Показываем уведомление
            }).catch(err => {
                console.error('Ошибка при копировании текста:', err);
            });
        });
    });
}
