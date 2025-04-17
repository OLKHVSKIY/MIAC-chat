async function fetchUserProfile() {
  try {
      const response = await fetch('http://localhost:4000/api/user/profile', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
          },
          credentials: 'include'
      });

      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 401) {
              // Токен недействителен - перенаправляем на страницу входа
              localStorage.removeItem('authToken');
              window.location.href = '/HTML/login.html';
              return null;
          }
          
          throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
      }

      return await response.json();
  } catch (error) {
      console.error('Ошибка при загрузке профиля:', error);
      
      // Показываем пользователю понятное сообщение
      const errorMessage = error.message.includes('Failed to fetch') 
          ? 'Нет соединения с сервером' 
          : error.message;
      
      showAlert(errorMessage, 'error');
      return null;
  }
}

async function deleteUserAccount() {
    // Показываем модальное окно
    const modal = document.getElementById('delete-account-modal');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const cancelBtn = document.getElementById('cancel-delete-btn');
    const notification = document.getElementById('delete-notification');
    const errorAlert = document.getElementById('error-alert');
  
    modal.style.display = 'flex';
  
    // Ожидаем решения пользователя
    return new Promise((resolve) => {
      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        resolve(false);
      };
  
      confirmBtn.onclick = async () => {
        try {
          modal.style.display = 'none';
          
          const response = await fetch('http://localhost:4000/api/user/delete-account', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
  
          const result = await response.json();
  
          if (!response.ok) {
            throw new Error(result.error || 'Не удалось удалить аккаунт');
          }
  
          // Показываем уведомление об успехе
          notification.classList.add('active');
          
          // Очищаем локальное хранилище
          localStorage.removeItem('authToken');
          
          // Закрываем модальное окно профиля
          const profileModal = document.getElementById('profile-modal');
          if (profileModal) profileModal.style.display = 'none';
  
          // Через 3 секунды перенаправляем на страницу входа
          setTimeout(() => {
            notification.classList.remove('active');
            window.location.href = '/HTML/login.html';
          }, 1000);
  
        } catch (error) {
          console.error('Ошибка удаления аккаунта:', error);
          
          // Показываем ошибку
          errorAlert.textContent = error.message;
          errorAlert.style.display = 'block';
          
          setTimeout(() => {
            errorAlert.classList.add('fade-out');
            setTimeout(() => {
              errorAlert.style.display = 'none';
              errorAlert.classList.remove('fade-out');
            }, 100);
          }, 1000);
        }
      };
    });
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
        'profile-position': `Должность: ${userData.position_name || 'Не указана'}`, // Будет отображаться либо из positions, либо из approved_users
        'profile-telegram': `Telegram: ${userData.telegram_id || 'Не указан'}`
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    // Показываем пункт "Управление пользователями" только для администраторов
    const manageUsersItem = document.querySelector('.nav-item.manage-users');
    if (manageUsersItem) {
        manageUsersItem.style.display = userData.role_id === 1 ? 'block' : 'none';
    }
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
    
    // Находим кнопку удаления аккаунта в навигации
    const navItems = document.querySelectorAll('.nav-item');
  const deleteAccountBtn = Array.from(navItems).find(item => 
    item.textContent.includes('Удалить аккаунт')
  );
  
    if (userProfileButton && profileModal && modalCloseButton) {
      userProfileButton.addEventListener('click', () => {
        profileModal.style.display = 'flex';
      });

      if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', (e) => {
          e.preventDefault();
          deleteUserAccount();
        });
      }
  
      modalCloseButton.addEventListener('click', () => {
        profileModal.style.display = 'none';
      });
  
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
          profileModal.style.display = 'none';
        }
      });
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteUserAccount);
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