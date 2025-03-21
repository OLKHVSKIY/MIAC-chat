// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    addCopyHandlers(); // Инициализация обработчиков копирования
});

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

// Функция для показа уведомлений
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('notification-hidden');
    notification.classList.add('notification-visible');

    setTimeout(() => {
        notification.classList.remove('notification-visible');
        notification.classList.add('notification-hidden');
    }, 3000);
}