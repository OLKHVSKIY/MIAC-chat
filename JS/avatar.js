document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const profileAvatar = document.querySelector('.profile-avatar');
    const smallAvatar = document.querySelector('.user-avatar');
    const avatarEditIcon = document.createElement('div');
    const fileInput = document.createElement('input');
    
    // Настройка элементов
    avatarEditIcon.className = 'avatar-edit-icon';
    avatarEditIcon.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    // Добавляем элементы на страницу
    profileAvatar.appendChild(avatarEditIcon);
    document.body.appendChild(fileInput);
    
    // Показываем иконку редактирования при наведении
    profileAvatar.addEventListener('mouseenter', () => {
        avatarEditIcon.style.opacity = '1';
    });
    
    profileAvatar.addEventListener('mouseleave', () => {
        avatarEditIcon.style.opacity = '0';
    });
    
    // Обработчик клика по иконке
    avatarEditIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    
    // Обработчик выбора файла
    fileInput.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files[0]) {
            try {
                const formData = new FormData();
                formData.append('avatar', fileInput.files[0]);
                
                const response = await fetch('/api/user/upload-avatar', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error('Ошибка загрузки аватара');
                }
                
                await loadAvatar();
                showAlert('Аватар успешно обновлен', 'success');
            } catch (error) {
                console.error('Ошибка:', error);
                showAlert(error.message, 'error');
            }
        }
    });
    
    // Загрузка аватара при открытии страницы
    loadAvatar();
});

// Функция загрузки и отображения аватара
async function loadAvatar() {
    try {
        const profileAvatar = document.querySelector('.profile-avatar');
        const smallAvatar = document.querySelector('.user-avatar');
        
        const response = await fetch('/api/user/avatar', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Обновляем больший аватар
            profileAvatar.innerHTML = '';
            const profileImg = document.createElement('img');
            profileImg.src = imageUrl;
            profileAvatar.appendChild(profileImg);
            
            // Обновляем маленький аватар
            smallAvatar.innerHTML = '';
            const smallImg = document.createElement('img');
            smallImg.src = imageUrl;
            smallAvatar.appendChild(smallImg);
            
            // Добавляем обратно иконку редактирования
            const avatarEditIcon = document.createElement('div');
            avatarEditIcon.className = 'avatar-edit-icon';
            avatarEditIcon.innerHTML = '<i class="fas fa-pencil-alt"></i>';
            profileAvatar.appendChild(avatarEditIcon);
        }
    } catch (error) {
        console.error('Ошибка загрузки аватара:', error);
    }
}

// Функция показа уведомлений
function showAlert(message, type = 'success') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;
    document.body.appendChild(alertBox);
    
    setTimeout(() => {
        alertBox.classList.add('fade-out');
        setTimeout(() => alertBox.remove(), 300);
    }, 3000);
}