document.getElementById('logoutButton').addEventListener('click', function(event) {
    event.preventDefault();

    // Показываем модальное окно
    const modal = document.getElementById('logoutModal');
    modal.style.display = 'flex';

    // Кнопка "Да, выйти"
    document.getElementById('confirmLogout').addEventListener('click', async function() {
        try {
            // Закрываем модальное окно
            modal.style.display = 'none';

            // Отправляем запрос на выход
            await fetch('http://localhost:4000/api/logout', {
                method: 'POST',
                credentials: 'include'
            });

            // Очищаем хранилище
            localStorage.removeItem('userData');

            // Показываем уведомление
            const notification = document.getElementById('logoutNotification');
            notification.classList.add('active');

            // Автоматически скрываем уведомление через 800 мс
            setTimeout(() => {
                notification.classList.remove('active');
            }, 800);

            // Перенаправляем на страницу входа через 700 мс
            setTimeout(() => {
                window.location.href = 'http://localhost:4000/HTML/login.html';
            }, 700); // Задержка для завершения анимации
        } catch (error) {
            console.error('Ошибка при выходе:', error);
            window.location.href = 'http://localhost:4000/HTML/login.html';
        }
    });

    // Кнопка "Отмена"
    document.getElementById('cancelLogout').addEventListener('click', function() {
        // Скрываем модальное окно
        modal.style.display = 'none';
    });
});