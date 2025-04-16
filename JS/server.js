const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const ADMIN_ROLE_ID = 1;

const app = express();
const PORT = 4000;
const SECRET_KEY = 'your-secret-key-123';


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
      'SELECT user_id, username, is_active, role_id FROM users WHERE user_id = $1',
      [decoded.id],
      (err, result) => {
        if (err) {
          console.error('Ошибка БД:', err);
          return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (result.rows.length === 0 || !result.rows[0].is_active) {
          return res.status(403).json({ error: 'Пользователь не найден или неактивен' });
        }

        // Запрещаем удаление администраторов
        if (req.method === 'DELETE' && req.path === '/api/user/delete-account' && 
            result.rows[0].role_id === ADMIN_ROLE_ID) {
          return res.status(403).json({ error: 'Администраторы не могут удалять свои аккаунты через интерфейс' });
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

// API для работы с чатами
app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
      const { title } = req.body;
      const result = await pool.query(
          'INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING *',
          [req.user.user_id, title || 'Новый чат']
      );
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Ошибка создания чата:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
      const result = await pool.query(
          'SELECT * FROM chats WHERE user_id = $1 ORDER BY created_at DESC',
          [req.user.user_id]
      );
      res.json(result.rows);
  } catch (err) {
      console.error('Ошибка получения чатов:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
      const result = await pool.query(
          `SELECT * FROM messages 
           WHERE chat_id = $1 
           ORDER BY timestamp ASC`,
          [req.params.chatId]
      );
      res.json(result.rows);
  } catch (err) {
      console.error('Ошибка получения сообщений:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
      const { chat_id, sender, content } = req.body;
      const result = await pool.query(
          `INSERT INTO messages (chat_id, sender, content)
           VALUES ($1, $2, $3) RETURNING *`,
          [chat_id, sender, content]
      );
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Ошибка сохранения сообщения:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.patch('/api/chats/:chatId', authenticateToken, async (req, res) => {
  try {
      const { title } = req.body;
      const result = await pool.query(
          `UPDATE chats SET title = $1 
           WHERE chat_id = $2 AND user_id = $3
           RETURNING *`,
          [title, req.params.chatId, req.user.user_id]
      );
      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Чат не найден' });
      }
      res.json(result.rows[0]);
  } catch (err) {
      console.error('Ошибка обновления чата:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/chats/:chatId', authenticateToken, async (req, res) => {
  try {
      // Удаляем сначала сообщения, потом чат
      await pool.query('DELETE FROM messages WHERE chat_id = $1', [req.params.chatId]);
      const result = await pool.query(
          'DELETE FROM chats WHERE chat_id = $1 AND user_id = $2 RETURNING *',
          [req.params.chatId, req.user.user_id]
      );
      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Чат не найден' });
      }
      res.json({ success: true });
  } catch (err) {
      console.error('Ошибка удаления чата:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Удаление аккаунта пользователя
app.delete('/api/user/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Начинаем транзакцию
    await pool.query('BEGIN');

    // 1. Получаем все чаты пользователя
    const chatsResult = await pool.query(
      'SELECT chat_id FROM chats WHERE user_id = $1',
      [userId]
    );
    const chatIds = chatsResult.rows.map(row => row.chat_id);

    // 2. Удаляем все сообщения пользователя
    if (chatIds.length > 0) {
      await pool.query(
        `DELETE FROM messages WHERE chat_id = ANY($1)`,
        [chatIds]
      );
    }

    // 3. Удаляем все чаты пользователя
    await pool.query(
      'DELETE FROM chats WHERE user_id = $1',
      [userId]
    );

    // 4. Удаляем самого пользователя
    const deleteResult = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, username',
      [userId]
    );

    if (deleteResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Фиксируем транзакцию
    await pool.query('COMMIT');

    // Очищаем куки
    res.clearCookie('token');

    res.json({ 
      success: true,
      message: `Аккаунт ${deleteResult.rows[0].username} и все связанные данные успешно удалены`,
      deletedUserId: deleteResult.rows[0].user_id
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Ошибка удаления аккаунта:', err);
    res.status(500).json({ 
      error: 'Ошибка при удалении аккаунта',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// API: Регистрация нового пользователя
app.post('/api/register', async (req, res) => {
  const { username, password, fullName, email, phone, telegram } = req.body;

  try {
      // 1. Проверяем, есть ли пользователь в списке одобренных
      const approvedUser = await pool.query(
          'SELECT role_id FROM approved_users WHERE full_name = $1',
          [fullName]
      );

      if (approvedUser.rows.length === 0) {
          return res.status(403).json({ 
              error: 'Ваше ФИО не найдено в списке разрешенных пользователей' 
          });
      }

      const roleId = approvedUser.rows[0].role_id;

      // 2. Проверяем существование пользователя
      const userExists = await pool.query(
          'SELECT * FROM users WHERE username = $1 OR email = $2',
          [username, email]
      );

      if (userExists.rows.length > 0) {
          return res.status(400).json({ 
              error: 'Пользователь с таким логином или email уже существует' 
          });
      }

      // 3. Хешируем пароль
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 4. Очищаем телефон от форматирования
      const cleanPhone = phone.replace(/[^\d+]/g, '');

      // 5. Создаем пользователя с ролью из approved_users
      const newUser = await pool.query(
          `INSERT INTO users 
           (username, password_hash, full_name, email, phone, telegram_id, role_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           RETURNING user_id, username, full_name, email`,
          [username, hashedPassword, fullName, email, cleanPhone, telegram || null, roleId]
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

// API: Получить список одобренных пользователей (только для админов)
app.get('/api/approved-users', authenticateToken, async (req, res) => {
  if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
  }

  try {
      const result = await pool.query(
          `SELECT au.id, au.full_name, au.position, au.role_id, r.role_name, 
           au.created_at, au.updated_at
           FROM approved_users au
           JOIN roles r ON au.role_id = r.role_id`
      );
      res.json(result.rows);
  } catch (err) {
      console.error('Ошибка получения списка:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Добавить одобренного пользователя (только для админов)
app.post('/api/approved-users', authenticateToken, async (req, res) => {
  if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const { full_name, position, role_id } = req.body;

  try {
      const result = await pool.query(
          `INSERT INTO approved_users (full_name, position, role_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [full_name, position, role_id]
      );
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Ошибка добавления:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// API: Получить список одобренных пользователей с фильтрацией
app.get('/api/approved-users', authenticateToken, async (req, res) => {
  if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
  }

  try {
      let query = `
          SELECT au.id, au.full_name, au.position, au.role_id, r.role_name, 
                 au.created_at, au.updated_at
          FROM approved_users au
          JOIN roles r ON au.role_id = r.role_id
      `;

      const params = [];
      const conditions = [];

      // Фильтрация по роли, если указана
      if (req.query.role_id) {
          conditions.push(`au.role_id = $${params.length + 1}`);
          params.push(req.query.role_id);
      }

      // Поиск по ФИО, если указан
      if (req.query.search) {
          conditions.push(`au.full_name ILIKE $${params.length + 1}`);
          params.push(`%${req.query.search}%`);
      }

      if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY au.full_name';

      const result = await pool.query(query, params);
      res.json(result.rows);
  } catch (err) {
      console.error('Ошибка получения списка:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/admin/approved-users', authenticateToken, (req, res) => {
  if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).send('Доступ запрещен');
  }
  res.sendFile(path.join(__dirname, '../HTML/admin-approved-users.html'));
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