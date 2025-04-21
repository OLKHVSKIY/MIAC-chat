document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const profileAvatar = document.querySelector('.profile-avatar');
    const smallAvatar = document.querySelector('.user-avatar');
    const avatarOverlay = document.createElement('div');
    const editIcon = document.createElement('div');
    const fileInput = document.createElement('input');
    
    // Настройка элементов
    avatarOverlay.className = 'avatar-overlay';
    editIcon.className = 'avatar-edit-icon';
    editIcon.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    // Добавляем элементы
    profileAvatar.appendChild(avatarOverlay);
    avatarOverlay.appendChild(editIcon);
    document.body.appendChild(fileInput);
    
    // Показываем оверлей при наведении
    profileAvatar.addEventListener('mouseenter', () => {
        avatarOverlay.style.opacity = '1';
    });
    
    profileAvatar.addEventListener('mouseleave', () => {
        avatarOverlay.style.opacity = '0';
    });
    
    // Обработчик клика по иконке
    editIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    profileAvatar.addEventListener('dragover', (e) => {
        e.preventDefault();
        avatarOverlay.style.opacity = '1';
    });
    
    profileAvatar.addEventListener('drop', (e) => {
        e.preventDefault();
        avatarOverlay.style.opacity = '0';
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });

    // Обработчик выбора файла
    fileInput.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files[0]) {
            if (fileInput.files[0].size > 2 * 1024 * 1024) { // 2MB
                showAlert('Максимальный размер файла - 2MB', 'error');
                return;
            }
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

async function loadAvatar() {
    try {
        const profileAvatar = document.querySelector('.profile-avatar');
        const smallAvatar = document.querySelector('.user-avatar');
        const avatarImg = profileAvatar.querySelector('img');
        const defaultIcon = profileAvatar.querySelector('.fa-user');
        
        const response = await fetch('/api/user/avatar', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Обновляем аватар
            if (avatarImg) {
                avatarImg.src = imageUrl;
            } else {
                if (defaultIcon) defaultIcon.remove();
                const img = document.createElement('img');
                img.src = imageUrl;
                profileAvatar.insertBefore(img, profileAvatar.firstChild);
            }
            
            // Обновляем маленький аватар
            smallAvatar.innerHTML = '';
            const smallImg = document.createElement('img');
            smallImg.src = imageUrl;
            smallAvatar.appendChild(smallImg);
        }
    } catch (error) {
        console.error('Ошибка загрузки аватара:', error);
    }
}

function showAlert(message, type = 'success') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;
    document.body.appendChild(alertBox);
    
    setTimeout(() => {
        alertBox.classList.add('fade-out');
        setTimeout(() => alertBox.remove(), 100);
    }, 1000);
}