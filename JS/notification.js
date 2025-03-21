// Показать уведомление
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.classList.add('notification-visible');
        setTimeout(() => {
            notification.classList.remove('notification-visible');
        }, 2000); // Уведомление исчезнет через 2 секунды
    } else {
        console.error('Элемент уведомления не найден!');
    }
}