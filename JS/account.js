async function fetchUserProfile() {
    try {
        const response = await fetch('http://localhost:4000/api/user/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Токен недействителен - перенаправляем на страницу входа
                window.location.href = '/HTML/login.html';
                return null;
            }
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
        alert('Не удалось загрузить данные пользователя. Проверьте подключение к серверу.');
        return null;
    }
}

async function updateUserProfile(userData) {
    if (!userData) {
        console.warn('Данные пользователя не получены.');
        return;
    }

    // Обновляем имя пользователя в шапке
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.textContent = userData.username || 'Гость';
    }

    // Обновляем данные в модальном окне
    const elements = {
        'profile-full-name': userData.full_name || 'Имя не указано',
        'profile-phone': userData.phone || 'Телефон не указан',
        'profile-role': `Роль: ${userData.role_name || 'Неизвестная роль'}`,
        'profile-position': `Должность: ${userData.position_name || 'Не указана'}`,
        'profile-telegram': `Telegram: ${userData.telegram_id || 'Не указан'}`
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userData = await fetchUserProfile();
        if (userData) {
            await updateUserProfile(userData);
        }

        // Обработчики событий
        setupEventListeners();
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
});

function setupEventListeners() {
    const userProfileButton = document.getElementById('user-profile');
    const profileModal = document.getElementById('profile-modal');
    const modalCloseButton = document.getElementById('modal-close');

    if (userProfileButton && profileModal && modalCloseButton) {
        userProfileButton.addEventListener('click', () => {
            profileModal.style.display = 'flex';
        });

        modalCloseButton.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });

        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                profileModal.style.display = 'none';
            }
        });
    }

    // Обработчики для внешних ссылок
    const setupLink = (id, url) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', () => window.open(url, '_blank'));
        }
    };

    setupLink('documents', 'http://catalog.spbmiac.ru/?page_id=113');
    setupLink('guide', 'http://catalog.spbmiac.ru/?page_id=41');
}