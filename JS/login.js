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
        const loginBtn = document.getElementById('loginBtn');

        // Отключаем кнопку входа, чтобы предотвратить повторные нажатия
        if (loginBtn) loginBtn.disabled = true;

        try {
            // Отправляем запрос на сервер для авторизации
            const response = await fetch('http://localhost:4000/api/user_login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Включаем cookies
                body: JSON.stringify({ username, password }),
            });

            // Получаем данные ответа
            const data = await response.json();

            // Проверяем статус ответа
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка входа');
            }

            // Сохраняем токен в localStorage
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }

            // Сохраняем данные пользователя
            if (data.user) {
                localStorage.setItem('userData', JSON.stringify(data.user));
            }

            // Перенаправляем пользователя на главную страницу
            window.location.href = 'http://localhost:4000/HTML/main.html';

        } catch (error) {
            // Обрабатываем ошибки
            console.error('Ошибка входа:', error);
            alert(error.message || 'Не удалось войти. Проверьте логин и пароль.');
        } finally {
            // Включаем кнопку входа обратно
            if (loginBtn) loginBtn.disabled = false;
        }
    });

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
            alert('Регистрация прошла успешно!');
            toggleForms(registerForm, loginForm, 'none', 'block', '60vh');

        } catch (error) {
            // Обрабатываем ошибки
            console.error('Ошибка регистрации:', error);
            alert(error.message || 'Не удалось зарегистрироваться. Проверьте введенные данные.');
        }
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

// Функция для валидации ФИО
function validateFullName(e) {
    const words = e.target.value.trim().split(/\s+/);
    if (words.length < 3 || words.length > 3) {
        e.target.setCustomValidity('Введите ФИО из трёх слов');
    } else {
        e.target.setCustomValidity('');
    }
}