document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('http://localhost:4000/api/check_auth', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Требуется авторизация');
        }

        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = 'http://localhost:4000/HTML/login.html';
        } else {
            // Обновляем интерфейс с данными пользователя
            const userData = JSON.parse(localStorage.getItem('userData')) || {}; // Исправлено здесь
            updateUserProfile({...data.user, ...userData});
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        window.location.href = 'http://localhost:4000/HTML/login.html';
    }
});

function updateUserProfile(user) {
    // Обновляем данные в профиле
    document.querySelectorAll('.user-name').forEach(el => {
        el.textContent = user.full_name || user.username;
    });
    
    // Обновляем модальное окно профиля
    const profileInfo = document.querySelector('.profile-info');
    if (profileInfo) {
        profileInfo.innerHTML = `
            <h3>${user.full_name || user.username}</h3>
            <p>${user.phone || 'Телефон не указан'}</p>
            <p>${user.position || 'Должность не указана'}</p>
            <p>${user.role || 'Роль не указана'}</p>
        `;
    }
}