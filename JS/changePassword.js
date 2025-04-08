document.addEventListener('DOMContentLoaded', function() {
    // Создаем модальное окно для смены пароля
    const createChangePasswordModal = () => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'change-password-modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: 500px; height: auto;">
                <div class="modal-header">
                    <div class="modal-title">Смена пароля</div>
                    <button class="modal-close" id="change-password-close">&times;</button>
                </div>
                <div class="modal-body" style="flex-direction: column; padding: 20px;">
                    <form id="change-password-form">
                        <div class="form-group">
                            <label for="current-password">Текущий пароль</label>
                            <input type="password" id="current-password" required>
                        </div>
                        <div class="form-group">
                            <label for="new-password">Новый пароль</label>
                            <input type="password" id="new-password" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label for="confirm-password">Подтвердите новый пароль</label>
                            <input type="password" id="confirm-password" required minlength="6">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="submit-btn">Сменить пароль</button>
                            <button type="button" id="cancel-change-password" class="cancel-btn">Отмена</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Закрытие модального окна
        const closeModal = () => {
            modal.style.display = 'none';
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
        };
        
        document.getElementById('change-password-close')?.addEventListener('click', closeModal);
        document.getElementById('cancel-change-password')?.addEventListener('click', closeModal);
        
        // Обработка отправки формы
        document.getElementById('change-password-form')?.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                alert('Новый пароль и подтверждение не совпадают');
                return;
            }
            
            if (newPassword.length < 6) {
                alert('Пароль должен содержать минимум 6 символов');
                return;
            }
            
            try {
                const response = await fetch('/api/users/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('Пароль успешно изменен');
                    closeModal();
                } else {
                    alert(data.message || 'Ошибка при смене пароля');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Произошла ошибка при смене пароля');
            }
        });
        
        return modal;
    };
    
    let changePasswordModal = null;
    
    document.querySelector('.modal-nav')?.addEventListener('click', function(e) {
        if (e.target.textContent === 'Сменить пароль') {
            if (!changePasswordModal) {
                changePasswordModal = createChangePasswordModal();
            }
            changePasswordModal.style.display = 'flex';
        }
    });
    
    document.addEventListener('click', function(e) {
        if (changePasswordModal && e.target === changePasswordModal) {
            changePasswordModal.style.display = 'none';
        }
    });
});