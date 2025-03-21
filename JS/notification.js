// Показать уведомление
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (notification) {
        console.log('Уведомление найдено:', notification); // Отладочное сообщение
        notification.textContent = message;
        notification.classList.add('notification-visible');
        setTimeout(() => {
            notification.classList.remove('notification-visible');
        }, 2000);
    } else {
        console.error('Элемент уведомления не найден!');
    }
}

// Добавление обработчиков копирования для всех сообщений
function addCopyHandlers() {
    document.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageText = e.target.closest('.message').textContent.trim(); // Получаем текст сообщения
            navigator.clipboard.writeText(messageText).then(() => {
                console.log('Текст скопирован:', messageText); // Отладочное сообщение
                showNotification('Сообщение скопировано!'); // Показываем уведомление
            }).catch(err => {
                console.error('Ошибка при копировании текста:', err);
            });
        });
    });
}