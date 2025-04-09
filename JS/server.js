const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 4000;
const SECRET_KEY = 'your-secret-key-123'; // В продакшене используйте переменные окружения

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'miac_chat',
  password: 'postgres',
  port: 5432,
});

// Настройки CORS
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:4000',
  'http://127.0.0.1:4000'
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../')));

// Улучшенный middleware аутентификации
const authenticateToken = (req, res, next) => {
  let token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    
    pool.query(
      'SELECT user_id, username, is_active FROM users WHERE user_id = $1',
      [decoded.id],
      (err, result) => {
        if (err) {
          console.error('Ошибка БД:', err);
          return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (result.rows.length === 0 || !result.rows[0].is_active) {
          return res.status(403).json({ error: 'Пользователь не найден или неактивен' });
        }

        req.user = result.rows[0];
        next();
      }
    );
  } catch (err) {
    console.error('Ошибка верификации токена:', err);
    
    // Очищаем невалидный токен
    res.clearCookie('token');
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Срок действия токена истек' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    
    return res.status(401).json({ error: 'Не удалось аутентифицировать' });
  }
};

// Маршруты
app.get(['/', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, '../HTML/login.html'));
});

app.get('/main', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../HTML/main.html'));
});

// API: Вход в систему
app.post('/api/user_login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Необходимо указать имя пользователя и пароль' });
  }

  try {
    // Находим пользователя
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

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Неверные учетные данные',
        details: 'Пользователь не найден'
      });
    }

    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Аккаунт деактивирован' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      SECRET_KEY,
      { expiresIn: '2h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 2 * 60 * 60 * 1000,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });

    res.json({ success: true, token });

  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
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

// API: Регистрация нового пользователя
app.post('/api/register', async (req, res) => {
    const { username, password, fullName, email, phone, telegram } = req.body;

    try {
        // Проверяем существование пользователя
        const userExists = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ 
                error: 'Пользователь с таким логином или email уже существует' 
            });
        }

        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Очищаем телефон от форматирования
        const cleanPhone = phone.replace(/[^\d+]/g, '');

        // Создаем пользователя
        const newUser = await pool.query(
            `INSERT INTO users 
             (username, password_hash, full_name, email, phone, telegram_id, role_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, 2, true)
             RETURNING user_id, username, full_name, email`,
            [username, hashedPassword, fullName, email, cleanPhone, telegram || null]
        );

        res.status(201).json({
            success: true,
            user: newUser.rows[0]
        });

    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
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