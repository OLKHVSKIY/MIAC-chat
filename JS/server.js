const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');

// Инициализация приложения
const app = express();
const PORT = 4000;
const SECRET_KEY = 'your-secret-key-123'; // В продакшене используйте переменные окружения

// Конфигурация базы данных
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'miac_chat',
  password: 'postgres',
  port: 5432,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Для корректного парсинга форм
app.use(cookieParser());
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Статические файлы
app.use(express.static(path.join(__dirname, '../')));

// Middleware аутентификации
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  jwt.verify(token, SECRET_KEY, async (err, decoded) => {
    if (err) {
      console.error('Ошибка верификации токена:', err);
      return res.status(403).json({ error: 'Недействительный токен' });
    }

    try {
      const user = await pool.query(
        'SELECT user_id, username, is_active FROM users WHERE user_id = $1',
        [decoded.id]
      );

      if (user.rows.length === 0 || !user.rows[0].is_active) {
        return res.status(403).json({ error: 'Пользователь не найден или неактивен' });
      }

      req.user = user.rows[0];
      next();
    } catch (dbErr) {
      console.error('Ошибка БД:', dbErr);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
};

// Маршруты HTML
app.get(['/', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, '../HTML/login.html'));
});

app.get('/main', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../HTML/main.html'));
});

// API: Вход в систему (улучшенная версия)
app.post('/api/user_login', async (req, res) => {
  const { username, password } = req.body;

  // Валидация входных данных
  if (!username || !password) {
    return res.status(400).json({ error: 'Необходимо указать имя пользователя и пароль' });
  }

  try {
    // 1. Находим пользователя с полной информацией
    const result = await pool.query(
      `SELECT 
         u.user_id, u.username, u.password_hash, 
         u.is_active, u.full_name, u.role_id,
         r.role_name, u.position_id, u.telegram_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE username = $1`,
      [username]
    );

    // 2. Если пользователь не найден
    if (result.rows.length === 0) {
      console.log(`Попытка входа несуществующего пользователя: ${username}`);
      return res.status(401).json({ 
        error: 'Неверные учетные данные',
        details: 'Пользователь не найден'
      });
    }

    const user = result.rows[0];
    
    // 3. Проверяем активность аккаунта
    if (!user.is_active) {
      console.log(`Попытка входа в деактивированный аккаунт: ${username}`);
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        details: 'Аккаунт деактивирован'
      });
    }

    // 4. Проверяем пароль с подробным логированием
    console.log(`Попытка входа пользователя: ${username}`);
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      console.log(`Неверный пароль для пользователя: ${username}`);
      return res.status(401).json({ 
        error: 'Неверные учетные данные',
        details: 'Неправильный пароль'
      });
    }

    // 5. Генерируем JWT токен
    const tokenPayload = {
      id: user.user_id,
      username: user.username,
      role: user.role_name
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '2h' });

    // 6. Устанавливаем безопасные cookies
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 2 * 60 * 60 * 1000, // 2 часа
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production' // Включить в продакшене
    });

    // 7. Отправляем успешный ответ с полными данными пользователя
    res.json({
      success: true,
      user: {
        id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role_name,
        role_id: user.role_id,
        position_id: user.position_id,
        telegram_id: user.telegram_id
      }
    });

  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: err.message 
    });
  }
});

// API: Получение полного профиля пользователя
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         u.user_id, u.username, u.full_name, 
         u.phone, u.telegram_id, u.role_id,
         r.role_name, u.position_id, p.position_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN positions p ON u.position_id = p.position_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    
    res.json({
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || 'Не указан',
      role_id: user.role_id,
      role_name: user.role_name || 'Неизвестная роль',
      position_id: user.position_id,
      position_name: user.position_name || 'Не указана',
      telegram_id: user.telegram_id || 'Не указан'
    });
  } catch (err) {
    console.error('Ошибка при получении профиля:', err);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: err.message 
    });
  }
});

// API: Выход из системы
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Глобальная ошибка:', err.stack);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\x1b[35mСервер запущен\x1b[0m на http://localhost:${PORT}`);
  console.log(`Режим работы: ${process.env.NODE_ENV || 'development'}`);
});