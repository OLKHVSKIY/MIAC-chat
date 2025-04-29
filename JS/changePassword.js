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
                            <div class="password-wrapper">
                                <input type="password" id="current-password" required>
                                <i class="fas fa-eye password-toggle" id="toggle-current"></i>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="new-password">Новый пароль</label>
                            <div class="password-wrapper">
                                <input type="password" id="new-password" required minlength="6">
                                <i class="fas fa-eye password-toggle" id="toggle-new"></i>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="confirm-password">Подтвердите новый пароль</label>
                            <div class="password-wrapper">
                                <input type="password" id="confirm-password" required minlength="6">
                                <i class="fas fa-eye password-toggle" id="toggle-confirm"></i>
                            </div>
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

        // Переключение видимости пароля
        function setupPasswordToggle(icon, inputId) {
            const input = document.getElementById(inputId);
            icon.addEventListener('click', function() {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }

        // Назначаем обработчики для переключения видимости пароля
        setupPasswordToggle(document.getElementById('toggle-current'), 'current-password');
        setupPasswordToggle(document.getElementById('toggle-new'), 'new-password');
        setupPasswordToggle(document.getElementById('toggle-confirm'), 'confirm-password');

        // Функция закрытия модального окна
        const closeModal = () => {
            modal.style.display = 'none';
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
        };

        // Обработчики закрытия модального окна
        document.getElementById('change-password-close')?.addEventListener('click', closeModal);
        document.getElementById('cancel-change-password')?.addEventListener('click', closeModal);

        // Закрытие по Esc
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeModal();
            }
        });

        // Обработка отправки формы
        document.getElementById('change-password-form')?.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                showAlert('Новый пароль и подтверждение не совпадают', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showAlert('Пароль должен содержать минимум 6 символов', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/user/change-password', {
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
                    showAlert('Пароль успешно изменен', 'success');
                    closeModal();
                } else {
                    showAlert(data.error || 'Ошибка при смене пароля', 'error');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                showAlert('Произошла ошибка при смене пароля', 'error');
            }
        });
        
        return modal;
    };
    
    let changePasswordModal = null;

    // Обработчик клика по пункту меню "Сменить пароль"
    document.querySelector('.modal-nav')?.addEventListener('click', function(e) {
        if (e.target.textContent === 'Сменить пароль') {
            if (!changePasswordModal) {
                changePasswordModal = createChangePasswordModal();
            }
            changePasswordModal.style.display = 'flex';
        }
    });
});

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