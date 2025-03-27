// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    addCopyHandlers(); // Инициализация обработчиков копирования
});

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