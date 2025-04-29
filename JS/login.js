document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const phoneInput = document.getElementById('phone');
    const telegramInput = document.getElementById('telegram');

    // Обработчик для кнопки "Зарегистрироваться"
    showRegisterBtn.addEventListener('click', function () {
        toggleForms(loginForm, registerForm, 'none', 'block', 'auto');
    });

    // Обработчик для кнопки "Войти" (в форме регистрации)
    backToLoginBtn.addEventListener('click', function () {
        toggleForms(registerForm, loginForm, 'none', 'block', '60vh');
    });

    // Форматирование номера телефона
    phoneInput.addEventListener('input', function (e) {
        formatPhoneNumber(e);
    });

    // Автоматическое добавление "@" для Telegram
    telegramInput.addEventListener('input', function (e) {
        formatTelegramUsername(e);
    });

    // Валидация ФИО
    document.getElementById('fullName').addEventListener('input', function (e) {
        validateFullName(e);
    });

    // Обработчик формы входа
    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginButton');
        if (loginBtn) loginBtn.disabled = true;
        
        try {
            const response = await fetch('http://localhost:4000/api/user_login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка входа');
            }
            
            const data = await response.json();
            
            // Сохраняем данные
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }
            if (data.user) {
                localStorage.setItem('userData', JSON.stringify(data.user));
            }
            
            // Показываем анимацию перед перенаправлением
            showLoginAnimation(() => {
                window.location.href = 'http://localhost:4000/HTML/main.html';
            });
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            showAlert(error.message || 'Не удалось войти. Проверьте логин и пароль.', 'error');
        } finally {
            if (loginBtn) loginBtn.disabled = false;
        }
    });

    function showLoginAnimation(callback) {

            // Подключаем шрифт Magistral
    const fontStyle = document.createElement('style');
    fontStyle.textContent = `
        @font-face {
            font-family: 'Magistral-ExtraBold';
            src: url('/fonts/Magistral-ExtraBold.woff2') format('woff2'),
                 url('/fonts/Magistral-ExtraBold.woff') format('woff');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
        }
    `;
    document.head.appendChild(fontStyle);
        // Создаем элементы анимации
        const overlay = document.createElement('div');
        overlay.className = 'login-animation-overlay';
        
        const logoContainer = document.createElement('div');
        logoContainer.className = 'login-animation-logo';
        
        const letters = ['М', 'И', 'А', 'Ц'];
        letters.forEach(letter => {
            const span = document.createElement('span');
            span.className = 'login-animation-letter';
            span.textContent = letter;
            logoContainer.appendChild(span);
        });
        
        const divider = document.createElement('div');
        divider.className = 'login-animation-divider';
        
        const location = document.createElement('div');
        location.className = 'login-animation-location';
        location.textContent = 'САНКТ-ПЕТЕРБУРГ';
        
        overlay.appendChild(logoContainer);
        overlay.appendChild(divider);
        overlay.appendChild(location);
        document.body.appendChild(overlay);
        
        const style = document.createElement('style');
        style.textContent = `


            .login-animation-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 1); 
                display: flex;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                z-index: 2000;
                opacity: 0;
                animation: loginFadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            
            .login-animation-logo {
                display: flex;
                justify-content: center;
                align-items: flex-end; /* Изменено с center на flex-end */
                height: 80px; /* Фиксированная высота контейнера */
                margin-bottom: 10px;
            }
            
            .login-animation-letter {
                font-family: 'Magistral-ExtraBold', 'Arial Black', sans-serif;
                font-size: 80px; /* Уменьшен размер шрифта */
                line-height: 60px; /* Фиксированный line-height */
                color: #fff;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin: 0 2px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                opacity: 0;
            }
            
        /* Анимации для Magistral */
            @keyframes magistralAppear {
                0% {
                    opacity: 0;
                    transform: scale(0.8) translateY(20px);
                }
                100% {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
    
            .login-animation-letter:nth-child(1) {
                animation: magistralAppear 0.7s 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .login-animation-letter:nth-child(2) {
                animation: magistralAppear 0.7s 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .login-animation-letter:nth-child(3) {
                animation: magistralAppear 0.7s 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .login-animation-letter:nth-child(4) {
                animation: magistralAppear 0.7s 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            
            .login-animation-divider {
                width: 150px;
                height: 1px;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%);
                margin: 10px 0; /* Уменьшен отступ */
                opacity: 0;
                animation: loginFadeIn 0.6s 0.8s ease-out forwards;
            }
            
            .login-animation-location {
                font-size: 16px;
                font-weight: 300;
                color: rgba(255, 255, 255, 0.7);
                letter-spacing: 0.5px;
                text-transform: uppercase;
                opacity: 0;
                margin-top: 5px;
                font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                animation: loginFadeIn 0.6s 0.9s ease-out forwards;
            }
            
            @keyframes loginFadeIn {
                to { opacity: 1; }
            }
            
            @keyframes loginFadeOut {
                to { opacity: 0; }
            }
            
            @keyframes loginLetterAppear {
                0% { 
                    opacity: 0; 
                    transform: translateY(15px);
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
                }
                100% { 
                    opacity: 1; 
                    transform: translateY(0);
                    text-shadow: 0 0 0 rgba(255, 255, 255, 0);
                }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            overlay.style.animation = 'loginFadeOut 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards';
            setTimeout(() => {
                document.body.removeChild(overlay);
                document.head.removeChild(style);
                if (callback) callback();
            }, 300);
        }, 2200);
    }
    


    // Обработчик формы регистрации
    registerForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const formData = {
            username: document.getElementById('regUsername').value,
            password: document.getElementById('regPassword').value,
            fullName: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            telegram: document.getElementById('telegram').value,
        };
        try {
            // Отправляем запрос на сервер для регистрации
            const response = await fetch('http://localhost:4000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            // Получаем данные ответа
            const data = await response.json();
            // Проверяем статус ответа
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка регистрации');
            }
            // Успешная регистрация
            showAlert('Регистрация прошла успешно!', 'success');
            toggleForms(registerForm, loginForm, 'none', 'block', '60vh');
        } catch (error) {
            // Показываем уведомление об ошибке
            showAlert(error.message || 'Не удалось зарегистрироваться. Проверьте введенные данные.', 'error');
        }
    });

    // Добавление функционала показа/скрытия пароля
    document.querySelectorAll('.password-toggle').forEach(icon => {
        icon.addEventListener('click', function () {
            const passwordField = this.previousElementSibling;
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                this.classList.remove('ri-eye-line');
                this.classList.add('ri-eye-off-line');
            } else {
                passwordField.type = 'password';
                this.classList.remove('ri-eye-off-line');
                this.classList.add('ri-eye-line');
            }
        });
    });
});



// Функция для переключения форм
function toggleForms(hideForm, showForm, hideDisplay, showDisplay, height) {
    hideForm.classList.remove('active-form');
    hideForm.classList.add('fade-out');
    setTimeout(() => {
        hideForm.style.display = hideDisplay;
        showForm.style.display = showDisplay;
        showForm.classList.add('active-form');
        document.querySelector('.container').style.height = height;
    }, 300);
}

// Функция для форматирования номера телефона
function formatPhoneNumber(e) {
    let value = e.target.value;
    const cursorPos = e.target.selectionStart;
    // Удаляем все нецифровые символы, кроме "+"
    let cleanValue = value.replace(/[^\d+]/g, '');
    // Заменяем начальную "8" на "+7"
    if (cleanValue.startsWith('8')) {
        cleanValue = '+7' + cleanValue.slice(1);
    }
    // Обеспечиваем начало с "+7"
    if (!cleanValue.startsWith('+7') && cleanValue.startsWith('7')) {
        cleanValue = '+7' + cleanValue.slice(1);
    } else if (!cleanValue.startsWith('+7')) {
        cleanValue = '+7' + cleanValue;
    }
    // Ограничиваем длину номера (11 цифр после "+7")
    if (cleanValue.length > 12) {
        cleanValue = cleanValue.slice(0, 12);
    }
    // Форматируем номер
    let formattedValue = '';
    const digits = cleanValue.slice(2); // цифры после "+7"
    formattedValue = '+7';
    if (digits.length > 0) {
        formattedValue += ' (' + digits.slice(0, 3);
    }
    if (digits.length > 3) {
        formattedValue += ') ' + digits.slice(3, 6);
    }
    if (digits.length > 6) {
        formattedValue += ' ' + digits.slice(6, 8);
    }
    if (digits.length > 8) {
        formattedValue += ' ' + digits.slice(8, 10);
    }
    // Устанавливаем новое значение
    e.target.value = formattedValue;
    // Корректируем позицию курсора
    let newCursorPos = cursorPos;
    const addedChars = formattedValue.length - value.length;
    if (addedChars > 0 && cursorPos > 0) {
        newCursorPos = cursorPos + addedChars;
    }
    setTimeout(() => {
        e.target.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
}

// Функция для форматирования имени пользователя Telegram
function formatTelegramUsername(e) {
    let value = e.target.value;
    // Удаляем все "@" в начале
    value = value.replace(/^@+/, '');
    // Добавляем "@" если его нет
    if (value.length > 0 && value[0] !== '@') {
        value = '@' + value;
    }
    e.target.value = value;
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

// Функция для валидации ФИО
function validateFullName(e) {
    const words = e.target.value.trim().split(/\s+/);
    if (words.length < 3 || words.length > 3) {
        e.target.setCustomValidity('Введите ФИО из трёх слов');
    } else {
        e.target.setCustomValidity('');
    }
}