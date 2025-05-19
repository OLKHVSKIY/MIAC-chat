const http = require('http');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');
const multer = require('multer');
const net = require('net');

// Константы и конфигурация
const ADMIN_ROLE_ID = 1;
const PORT = 4000;
const SECRET_KEY = 'your-secret-key-123';

// Инициализация Express приложения
const app = express();

// Подключение к PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'miac_chat',
  password: 'postgres',
  port: 5432,
});

// Проверка схемы базы данных
async function checkDatabaseSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'personal_chats'
    `);
    const columns = result.rows.map(row => row.column_name);
    if (!columns.includes('participant_1_id') || !columns.includes('participant_2_id')) {
      console.error('Ошибка: Таблица personal_chats не содержит нужных столбцов participant_1_id или participant_2_id');
      process.exit(1);
    }
    console.log('Схема базы данных проверена успешно');
  } catch (err) {
    console.error('Ошибка проверки схемы базы данных:', err);
    process.exit(1);
  }
}

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../')));

// Настройка загрузки файлов
const upload = multer({ storage: multer.memoryStorage() });
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadAttachment = multer({ 
  storage: attachmentStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Middleware аутентификации для HTTP
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

// Создаем HTTP сервер
const server = http.createServer(app);

// Настройка WebSocket сервера
const wss = new WebSocket.Server({ noServer: true });
const wsClients = new Map();

// Функция аутентификации для WebSocket
const authenticateWSToken = (req, callback) => {
  let token = req.headers?.cookie?.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1] ||
              req.headers?.authorization?.split(' ')[1];
  
  if (!token) {
    console.error('WebSocket: Токен не найден в cookie или заголовке Authorization');
    return callback(new Error('Требуется авторизация'));
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error('WebSocket: Ошибка верификации токена:', err);
      return callback(new Error('Неверный токен'));
    }

    pool.query(
      'SELECT user_id, username, is_active FROM users WHERE user_id = $1',
      [decoded.id],
      (err, result) => {
        if (err || result.rows.length === 0 || !result.rows[0].is_active) {
          return callback(new Error('Пользователь не найден или неактивен'));
        }

        req.user = result.rows[0];
        callback(null, req.user);
      }
    );
  });
};

// Обработка WebSocket подключений
server.on('upgrade', (request, socket, head) => {
  authenticateWSToken(request, (err, user) => {
    if (err) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', async (ws, request) => {
  const userId = request.user.user_id;
  ws.userId = userId; // Set userId on ws
  wsClients.set(userId, ws);
  await pool.query('UPDATE users SET is_online = TRUE WHERE user_id = $1', [userId]);

  // Отправка статуса онлайна всем клиентам
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'status',
        userId,
        isOnline: true
      }));
    }
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'typing') {
        const chat = await pool.query(
          `SELECT participant_1_id, participant_2_id 
           FROM personal_chats 
           WHERE chat_id = $1 AND chat_type = 'personal'`,
          [message.chatId]
        );
        if (chat.rows.length > 0) {
          const otherUserId = chat.rows[0].participant_1_id === userId 
            ? chat.rows[0].participant_2_id 
            : chat.rows[0].participant_1_id;
          const otherClient = wsClients.get(otherUserId);
          if (otherClient && otherClient.readyState === WebSocket.OPEN) {
            otherClient.send(JSON.stringify({
              type: 'typing',
              chatId: message.chatId,
              userId,
              isTyping: message.isTyping
            }));
          }
        }
      }
    } catch (err) {
      console.error('Ошибка обработки WebSocket сообщения:', err);
    }
  });

  ws.on('close', async () => {
    wsClients.delete(userId);
    await pool.query('UPDATE users SET is_online = FALSE WHERE user_id = $1', [userId]);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'status',
          userId,
          isOnline: false
        }));
      }
    });
  });
});

// ==================== Маршруты API ====================

// Маршруты страниц
app.get(['/', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, '../HTML/login.html'));
});

app.get('/main', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../HTML/main.html'));
});

app.get('/admin/approved-users', authenticateToken, (req, res) => {
  if (req.user.role_id !== ADMIN_ROLE_ID) {
    return res.status(403).send('Доступ запрещен');
  }
  res.sendFile(path.join(__dirname, '../HTML/admin-approved-users.html'));
});

app.get('/HTML/approved.html', authenticateToken, (req, res) => {
  if (req.user.role_id !== ADMIN_ROLE_ID) {
    return res.status(403).send('Доступ запрещен');
  }
  res.sendFile(path.join(__dirname, '../HTML/approved.html'));
});

// API аутентификации
app.post('/api/user_login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Необходимо указать имя пользователя и пароль' });
  }

  try {
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

    res.json({ success: true, token, user: {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role_id: user.role_id,
      role_name: user.role_name,
      position_id: user.position_id,
      telegram_id: user.telegram_id
    }});
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// API пользователей
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         u.user_id, 
         u.username, 
         u.full_name, 
         u.phone, 
         u.telegram_id, 
         u.role_id,
         r.role_name, 
         u.position_id, 
         p.position_name,
         u.avatar IS NOT NULL as has_avatar,
         u.is_online
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN positions p ON u.position_id = p.position_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    res.json({
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || 'Не указан',
      role_id: user.role_id,
      role_name: user.role_name || 'Неизвестная роль',
      position_id: user.position_id,
      position_name: user.position_name || 'Не указана',
      telegram_id: user.telegram_id || 'Не указан',
      has_avatar: user.has_avatar,
      is_online: user.is_online
    });
  } catch (err) {
    console.error('Ошибка при получении профиля:', err);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Поиск пользователей
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q ? `%${req.query.q}%` : '%';
    const result = await pool.query(
      `SELECT 
         u.user_id, 
         u.username, 
         u.full_name, 
         u.phone, 
         u.telegram_id, 
         u.role_id,
         r.role_name, 
         u.position_id, 
         p.position_name,
         u.avatar IS NOT NULL as has_avatar,
         u.is_online
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN positions p ON u.position_id = p.position_id
       WHERE u.is_active = true 
         AND (u.username ILIKE $1 OR u.full_name ILIKE $1)
       ORDER BY u.full_name
       LIMIT 20`,
      [query]
    );

    res.json(result.rows.map(user => ({
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || 'Не указан',
      role_id: user.role_id,
      role_name: user.role_name || 'Неизвестная роль',
      position_id: user.position_id,
      position_name: user.position_name || 'Не указана',
      telegram_id: user.telegram_id || 'Не указан',
      has_avatar: user.has_avatar,
      is_online: user.is_online
    })));
  } catch (err) {
    console.error('Ошибка поиска пользователей:', err);
    res.status(500).json({ 
      error: 'Ошибка сервера при поиске пользователей',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Информация о пользователе по ID
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await pool.query(
      `SELECT 
         u.user_id, 
         u.username, 
         u.full_name, 
         u.phone, 
         u.telegram_id, 
         u.role_id,
         r.role_name, 
         u.position_id, 
         p.position_name,
         u.avatar IS NOT NULL as has_avatar,
         u.is_online
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN positions p ON u.position_id = p.position_id
       WHERE u.user_id = $1 AND u.is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    res.json({
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || 'Не указан',
      role_id: user.role_id,
      role_name: user.role_name || 'Неизвестная роль',
      position_id: user.position_id,
      position_name: user.position_name || 'Не указана',
      telegram_id: user.telegram_id || 'Не указан',
      has_avatar: user.has_avatar,
      is_online: user.is_online
    });
  } catch (err) {
    console.error('Ошибка получения профиля пользователя:', err);
    res.status(500).json({ 
      error: 'Ошибка сервера при получении профиля',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Загрузка аватара
app.post('/api/user/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    await pool.query(
      'UPDATE users SET avatar = $1, avatar_url = NULL WHERE user_id = $2',
      [req.file.buffer, req.user.user_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка загрузки аватара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/user/avatar', authenticateToken, async (req, res) => {
  try {
    const userId = req.query.id || req.user.user_id;
    const result = await pool.query(
      'SELECT avatar FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].avatar) {
      return res.status(404).json({ error: 'Аватар не найден' });
    }

    res.set('Content-Type', 'image/jpeg');
    res.send(result.rows[0].avatar);
  } catch (err) {
    console.error('Ошибка получения аватара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Смена пароля
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Необходимо указать текущий и новый пароль' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
  }

  try {
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const validPassword = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE user_id = $2',
      [newHash, req.user.user_id]
    );

    res.json({ success: true, message: 'Пароль успешно изменен' });
  } catch (err) {
    console.error('Ошибка смены пароля:', err);
    res.status(500).json({ 
      error: 'Ошибка сервера при смене пароля',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Удаление аккаунта
app.delete('/api/user/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    await pool.query('BEGIN');

    const chatsResult = await pool.query(
      'SELECT chat_id FROM personal_chats WHERE participant_1_id = $1 OR participant_2_id = $1',
      [userId]
    );
    const chatIds = chatsResult.rows.map(row => row.chat_id);

    if (chatIds.length > 0) {
      await pool.query(
        `DELETE FROM personal_messages WHERE chat_id = ANY($1)`,
        [chatIds]
      );
      await pool.query(
        `DELETE FROM personal_chats WHERE chat_id = ANY($1)`,
        [chatIds]
      );
    }

    const deleteResult = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, username',
      [userId]
    );

    if (deleteResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await pool.query('COMMIT');
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

// API регистрации
app.post('/api/register', async (req, res) => {
  const { username, password, fullName, email, phone, telegram } = req.body;

  try {
    const approvedUser = await pool.query(
      'SELECT role_id, position FROM approved_users WHERE full_name = $1',
      [fullName.trim()]
    );

    if (approvedUser.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Ваше ФИО не найдено в списке разрешенных пользователей' 
      });
    }

    const userExists = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Пользователь с таким логином или email уже существует' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    const newUser = await pool.query(
      `INSERT INTO users 
       (username, password_hash, full_name, email, phone, telegram_id, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING user_id, username, full_name, email`,
      [username, hashedPassword, fullName.trim(), email, cleanPhone, telegram || null, approvedUser.rows[0].role_id]
    );

    res.status(201).json({
      success: true,
      user: newUser.rows[0],
      position: approvedUser.rows[0].position
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// API чатов с нейросетью
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

// API чатов мессенджера
// Получение списка личных чатов
app.get('/api/personal-chats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         pc.chat_id,
         pc.participant_1_id,
         pc.participant_2_id,
         u1.full_name AS participant_1_name,
         u2.full_name AS participant_2_name,
         u1.avatar IS NOT NULL AS participant_1_has_avatar,
         u2.avatar IS NOT NULL AS participant_2_has_avatar,
         pm.text AS last_message,  -- Исправлено: pm.content -> pm.text
         pm.sent_at AS last_message_at,
         pm.sender_id AS last_message_sender,
         pc.is_pinned,
         pc.pinned_at,
         (SELECT COUNT(*) 
          FROM personal_messages pm2 
          WHERE pm2.chat_id = pc.chat_id 
            AND pm2.is_read = FALSE 
            AND pm2.sender_id != $1) AS unread_count
       FROM personal_chats pc
       LEFT JOIN users u1 ON pc.participant_1_id = u1.user_id
       LEFT JOIN users u2 ON pc.participant_2_id = u2.user_id
       LEFT JOIN personal_messages pm ON pm.message_id = (
         SELECT message_id 
         FROM personal_messages 
         WHERE chat_id = pc.chat_id 
         ORDER BY sent_at DESC 
         LIMIT 1
       )
       WHERE pc.chat_type = 'personal'
         AND (pc.participant_1_id = $1 OR pc.participant_2_id = $1)
       ORDER BY pc.is_pinned DESC, pc.pinned_at DESC, pm.sent_at DESC NULLS LAST`,
      [req.user.user_id]
    );

    res.json(result.rows.map(row => ({
      chat_id: row.chat_id,
      title: row.participant_1_id === req.user.user_id 
        ? row.participant_2_name 
        : row.participant_1_name,
      participant_ids: [row.participant_1_id, row.participant_2_id],
      participant_avatar: row.participant_1_id === req.user.user_id 
        ? (row.participant_2_has_avatar ? `/api/user/avatar?id=${row.participant_2_id}` : '/IMG/user_default.png')
        : (row.participant_1_has_avatar ? `/api/user/avatar?id=${row.participant_1_id}` : '/IMG/user_default.png'),
      last_message: row.last_message,
      last_message_at: row.last_message_at,
      last_message_sender: row.last_message_sender,
      unread_count: parseInt(row.unread_count, 10),
      is_pinned: row.is_pinned
    })));
  } catch (err) {
    console.error('Ошибка получения личных чатов:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});

// Создание личного чата
app.post('/api/personal-chats', authenticateToken, async (req, res) => {
  try {
    const { participant_id } = req.body;
    if (!participant_id || participant_id === req.user.user_id) {
      return res.status(400).json({ error: 'Неверный ID участника' });
    }

    const userExists = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 AND is_active = TRUE',
      [participant_id]
    );
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existingChat = await pool.query(
      `SELECT chat_id 
       FROM personal_chats 
       WHERE chat_type = 'personal'
         AND ((participant_1_id = $1 AND participant_2_id = $2) 
           OR (participant_1_id = $2 AND participant_2_id = $1))`,
      [req.user.user_id, participant_id]
    );

    if (existingChat.rows.length > 0) {
      return res.json({ chat_id: existingChat.rows[0].chat_id });
    }

    const result = await pool.query(
      `INSERT INTO personal_chats (participant_1_id, participant_2_id, chat_type, created_by)
       VALUES ($1, $2, 'personal', $3)
       RETURNING chat_id`,
      [Math.min(req.user.user_id, participant_id), Math.max(req.user.user_id, participant_id), req.user.user_id]
    );

    const chatId = result.rows[0].chat_id;

    const chatInfo = await pool.query(
      `SELECT 
         pc.chat_id,
         pc.participant_1_id,
         pc.participant_2_id,
         u1.full_name AS participant_1_name,
         u2.full_name AS participant_2_name
       FROM personal_chats pc
       LEFT JOIN users u1 ON pc.participant_1_id = u1.user_id
       LEFT JOIN users u2 ON pc.participant_2_id = u2.user_id
       WHERE pc.chat_id = $1`,
      [chatId]
    );

    const chatData = {
      chat_id: chatId,
      title: chatInfo.rows[0].participant_1_id === req.user.user_id 
        ? chatInfo.rows[0].participant_2_name 
        : chatInfo.rows[0].participant_1_name,
      participant_ids: [chatInfo.rows[0].participant_1_id, chatInfo.rows[0].participant_2_id]
    };

    [req.user.user_id, participant_id].forEach(userId => {
      const client = wsClients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'new_chat',
          chat: chatData
        }));
      }
    });

    res.status(201).json({ chat_id: chatId });
  } catch (err) {
    console.error('Ошибка создания личного чата:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение информации о чате
app.get('/api/personal-chats/:chatId', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const result = await pool.query(
      `SELECT 
         pc.chat_id,
         pc.participant_1_id,
         pc.participant_2_id,
         u1.full_name AS participant_1_name,
         u2.full_name AS participant_2_name
       FROM personal_chats pc
       LEFT JOIN users u1 ON pc.participant_1_id = u1.user_id
       LEFT JOIN users u2 ON pc.participant_2_id = u2.user_id
       WHERE pc.chat_id = $1 
         AND pc.chat_type = 'personal'
         AND (pc.participant_1_id = $2 OR pc.participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Чат не найден или доступ запрещён' });
    }

    const row = result.rows[0];
    res.json({
      chat_id: row.chat_id,
      title: row.participant_1_id === req.user.user_id 
        ? row.participant_2_name 
        : row.participant_1_name,
      participant_ids: [row.participant_1_id, row.participant_2_id]
    });
  } catch (err) {
    console.error('Ошибка получения информации о чате:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение сообщений чата
app.get('/api/personal-chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1 } = req.query;

    // Проверка формата chatId
    if (!/^\d+$/.test(chatId)) {
      console.log('Неверный формат chatId:', chatId);
      return res.status(400).json({ error: 'Неверный формат chatId' });
    }

    // Проверка существования чата и доступа
    const chatCheck = await pool.query(
      `SELECT chat_id 
       FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      console.log('Чат не найден или доступ запрещён для user_id:', req.user.user_id, 'chatId:', chatId);
      return res.status(403).json({ error: 'Чат не найден или доступ запрещён' });
    }

    const limit = 50;
    const offset = (page - 1) * limit;

    console.log('Получение сообщений для chatId:', chatId, 'Страница:', page, 'user_id:', req.user.user_id);

    const result = await pool.query(
      `SELECT 
         pm.message_id,
         pm.chat_id,
         pm.sender_id,
         u.username,
         pm.text,
         pm.sent_at,
         pm.is_read,
         pm.reply_to_message_id,
         pm.attachment_id,
         a.file_path AS attachment_path,
         a.file_type AS attachment_type,
         a.file_name AS attachment_name,
         a.file_size AS attachment_size
       FROM personal_messages pm
       LEFT JOIN users u ON pm.sender_id = u.user_id
       LEFT JOIN attachments a ON pm.attachment_id = a.attachment_id
       WHERE pm.chat_id = $1
       ORDER BY pm.sent_at DESC
       LIMIT $2 OFFSET $3`,
      [chatId, limit, offset]
    );

    console.log('Сообщения получены, количество:', result.rows.length);

    res.json(result.rows.map(row => ({
      message_id: row.message_id,
      chat_id: row.chat_id,
      sender_id: row.sender_id,
      username: row.username,
      text: row.text,
      sent_at: row.sent_at,
      is_read: row.is_read,
      reply_to_message_id: row.reply_to_message_id,
      attachment_id: row.attachment_id,
      attachment: row.attachment_id ? {
        file_path: row.attachment_path,
        file_type: row.attachment_type,
        file_name: row.attachment_name,
        file_size: row.attachment_size
      } : null
    })));
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});

// Отправка сообщения
app.post('/api/personal-chats/:chatId/messages', authenticateToken, uploadAttachment.none(), async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text, reply_to_message_id, attachment_id } = req.body;

    console.log('Получен запрос на отправку сообщения:', { chatId, text, reply_to_message_id, attachment_id, user_id: req.user.user_id });

    const chatCheck = await pool.query(
      `SELECT 1 FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      console.log('Доступ к чату запрещён:', { chatId, user_id: req.user.user_id });
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    if (!text && !attachment_id) {
      console.log('Сообщение или вложение отсутствует:', { text, attachment_id });
      return res.status(400).json({ error: 'Сообщение или вложение обязательно' });
    }

    const result = await pool.query(
      `INSERT INTO personal_messages 
       (chat_id, sender_id, text, reply_to_message_id, attachment_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *,
       (SELECT username FROM users WHERE user_id = $2) AS username`,
      [chatId, req.user.user_id, text || '', reply_to_message_id || null, attachment_id || null]
    );

    const message = {
      message_id: result.rows[0].message_id,
      chat_id: result.rows[0].chat_id,
      sender_id: result.rows[0].sender_id,
      username: result.rows[0].username,
      text: result.rows[0].text,
      sent_at: result.rows[0].sent_at,
      is_read: result.rows[0].is_read,
      reply_to_message_id: result.rows[0].reply_to_message_id,
      attachment_id: result.rows[0].attachment_id,
      attachment: result.rows[0].attachment_id ? await getAttachmentDetails(result.rows[0].attachment_id) : null
    };

    console.log('Сообщение сохранено:', message);

    const chat = await pool.query(
      `SELECT participant_1_id, participant_2_id 
       FROM personal_chats 
       WHERE chat_id = $1`,
      [chatId]
    );

    [chat.rows[0].participant_1_id, chat.rows[0].participant_2_id].forEach(userId => {
      const client = wsClients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'new_message', message, chatId }));
      }
    });

    res.json(message);
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});

async function getAttachmentDetails(attachmentId) {
  const result = await pool.query(
    `SELECT file_path, file_type, file_name, file_size 
     FROM attachments 
     WHERE attachment_id = $1`,
    [attachmentId]
  );
  if (result.rows.length === 0) return null;
  return {
    file_path: result.rows[0].file_path,
    file_type: result.rows[0].file_type,
    file_name: result.rows[0].file_name,
    file_size: result.rows[0].file_size
  };
}

app.post('/api/personal-chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text, reply_to_message_id, attachment_id } = req.body;

    console.log('Получен запрос на отправку сообщения:', { chatId, text, reply_to_message_id, attachment_id });

    const chatCheck = await pool.query(
      `SELECT 1 FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      console.log('Доступ к чату запрещён:', { chatId, user_id: req.user.user_id });
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    if (!text && !attachment_id) {
      console.log('Сообщение или вложение отсутствует:', { text, attachment_id });
      return res.status(400).json({ error: 'Сообщение или вложение обязательно' });
    }

    const result = await pool.query(
      `INSERT INTO personal_messages 
       (chat_id, sender_id, text, reply_to_message_id, attachment_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *,
       (SELECT username FROM users WHERE user_id = $2) AS username`,
      [chatId, req.user.user_id, text || '', reply_to_message_id || null, attachment_id || null]
    );

    const message = {
      message_id: result.rows[0].message_id,
      chat_id: result.rows[0].chat_id,
      sender_id: result.rows[0].sender_id,
      username: result.rows[0].username,
      text: result.rows[0].text,
      sent_at: result.rows[0].sent_at,
      is_read: result.rows[0].is_read,
      reply_to_message_id: result.rows[0].reply_to_message_id,
      attachment_id: result.rows[0].attachment_id,
      attachment: result.rows[0].attachment_id ? await getAttachmentDetails(result.rows[0].attachment_id) : null
    };

    console.log('Сообщение сохранено:', message);

    const chat = await pool.query(
      `SELECT participant_1_id, participant_2_id 
       FROM personal_chats 
       WHERE chat_id = $1`,
      [chatId]
    );

    [chat.rows[0].participant_1_id, chat.rows[0].participant_2_id].forEach(userId => {
      const client = wsClients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'new_message', message, chatId }));
      }
    });

    res.json(message);
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});

// Отметка сообщений как прочитанных
app.post('/api/personal-chats/:chatId/read', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.chatId;

    // Проверяем доступ к чату
    const chatCheck = await pool.query(
      `SELECT participant_1_id, participant_2_id 
       FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    const updatedMessages = await pool.query(
      `UPDATE personal_messages 
       SET is_read = TRUE 
       WHERE chat_id = $1 AND sender_id != $2 AND is_read = FALSE
       RETURNING message_id`,
      [chatId, req.user.user_id]
    );

    if (updatedMessages.rows.length > 0) {
      const otherUserId = chatCheck.rows[0].participant_1_id === req.user.user_id 
        ? chatCheck.rows[0].participant_2_id 
        : chatCheck.rows[0].participant_1_id;

      const client = wsClients.get(otherUserId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'read',
          chatId,
          messageIds: updatedMessages.rows.map(row => row.message_id),
          userId: req.user.user_id
        }));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отметки сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление сообщения
app.delete('/api/personal-chats/:chatId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    // Проверяем доступ к чату
    const chatCheck = await pool.query(
      `SELECT participant_1_id, participant_2_id 
       FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    const result = await pool.query(
      `DELETE FROM personal_messages 
       WHERE message_id = $1 AND chat_id = $2 AND sender_id = $3
       RETURNING message_id`,
      [messageId, chatId, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено или доступ запрещён' });
    }

    // Уведомление через WebSocket
    const otherUserId = chatCheck.rows[0].participant_1_id === req.user.user_id 
      ? chatCheck.rows[0].participant_2_id 
      : chatCheck.rows[0].participant_1_id;

    [req.user.user_id, otherUserId].forEach(userId => {
      const client = wsClients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'message_deleted',
          chatId,
          messageId
        }));
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение общих медиа и документов
app.get('/api/personal-chats/:chatId/media', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.chatId;

    // Проверяем доступ к чату
    const chatCheck = await pool.query(
      `SELECT chat_id 
       FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    const result = await pool.query(
      `SELECT 
         a.attachment_id,
         a.file_type,
         a.file_name,
         a.file_size,
         pm.sent_at
       FROM personal_messages pm
       JOIN attachments a ON pm.attachment_id = a.attachment_id
       WHERE pm.chat_id = $1 
         AND pm.attachment_id IS NOT NULL
       ORDER BY pm.sent_at DESC`,
      [chatId]
    );

    res.json(result.rows.map(row => ({
      attachment_id: row.attachment_id,
      file_type: row.file_type,
      file_name: row.file_name,
      file_size: row.file_size,
      sent_at: row.sent_at
    })));
  } catch (err) {
    console.error('Ошибка получения медиа:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});

// Поиск сообщений в чате
app.get('/api/personal-chats/:chatId/search', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const query = req.query.q ? `%${req.query.q}%` : '%';

    // Проверяем доступ к чату
    const chatCheck = await pool.query(
      `SELECT chat_id 
       FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    const result = await pool.query(
      `SELECT 
         pm.message_id,
         pm.chat_id,
         pm.sender_id,
         u.username,
         pm.text,
         pm.sent_at,
         pm.is_read,
         pm.attachment_id,
         pm.reply_to_message_id,
         a.file_type AS attachment_type,
         a.file_name AS attachment_name,
         a.file_size AS attachment_size
       FROM personal_messages pm
       JOIN users u ON pm.sender_id = u.user_id
       LEFT JOIN attachments a ON pm.attachment_id = a.attachment_id
       WHERE pm.chat_id = $1
         AND pm.text ILIKE $2
       ORDER BY pm.sent_at DESC
       LIMIT 50`,
      [chatId, query]
    );

    res.json(result.rows.map(row => ({
      message_id: row.message_id,
      chat_id: row.chat_id,
      sender_id: row.sender_id,
      username: row.username,
      text: row.text,
      sent_at: row.sent_at,
      is_read: row.is_read,
      attachment_id: row.attachment_id,
      reply_to_message_id: row.reply_to_message_id,
      attachment: row.attachment_id ? {
        file_type: row.attachment_type,
        file_name: row.attachment_name,
        file_size: row.attachment_size
      } : null
    })));
  } catch (err) {
    console.error('Ошибка поиска сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});

// Очистка чата
app.delete('/api/personal-chats/:chatId/clear', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.chatId;

    // Проверяем доступ к чату
    const chatCheck = await pool.query(
      `SELECT participant_1_id, participant_2_id 
       FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    await pool.query('DELETE FROM personal_messages WHERE chat_id = $1', [chatId]);

    // Уведомление через WebSocket
    const otherUserId = chatCheck.rows[0].participant_1_id === req.user.user_id 
      ? chatCheck.rows[0].participant_2_id 
      : chatCheck.rows[0].participant_1_id;

    [req.user.user_id, otherUserId].forEach(userId => {
      const client = wsClients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'chat_cleared',
          chatId
        }));
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка очистки чата:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Закрепление/открепление чата
app.patch('/api/personal-chats/:chatId/pin', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { pinned } = req.body;

    // Проверяем доступ к чату
    const chatCheck = await pool.query(
      `SELECT participant_1_id, participant_2_id 
       FROM personal_chats 
       WHERE chat_id = $1 
         AND (participant_1_id = $2 OR participant_2_id = $2)`,
      [chatId, req.user.user_id]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ к чату запрещён' });
    }

    const result = await pool.query(
      `UPDATE personal_chats 
       SET is_pinned = $1, pinned_at = $2 
       WHERE chat_id = $3 
       RETURNING chat_id, is_pinned`,
      [pinned, pinned ? new Date() : null, chatId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    // Уведомление через WebSocket
    const otherUserId = chatCheck.rows[0].participant_1_id === req.user.user_id 
      ? chatCheck.rows[0].participant_2_id 
      : chatCheck.rows[0].participant_1_id;

    [req.user.user_id, otherUserId].forEach(userId => {
      const client = wsClients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'chat_pinned',
          chatId,
          pinned
        }));
      }
    });

    res.json({ success: true, is_pinned: result.rows[0].is_pinned });
  } catch (err) {
    console.error('Ошибка закрепления чата:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление маршрута получения чатов для поддержки сортировки по pinned_at
app.get('/api/personal-chats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         pc.chat_id,
         pc.participant_1_id,
         pc.participant_2_id,
         u1.full_name AS participant_1_name,
         u2.full_name AS participant_2_name,
         u1.avatar IS NOT NULL AS participant_1_has_avatar,
         u2.avatar IS NOT NULL AS participant_2_has_avatar,
         pm.text AS last_message,
         pm.sent_at AS last_message_at,
         pm.sender_id AS last_message_sender,
         pc.is_pinned,
         pc.pinned_at,
         (SELECT COUNT(*) 
          FROM personal_messages pm2 
          WHERE pm2.chat_id = pc.chat_id 
            AND pm2.is_read = FALSE 
            AND pm2.sender_id != $1) AS unread_count
       FROM personal_chats pc
       LEFT JOIN users u1 ON pc.participant_1_id = u1.user_id
       LEFT JOIN users u2 ON pc.participant_2_id = u2.user_id
       LEFT JOIN personal_messages pm ON pm.message_id = (
         SELECT message_id 
         FROM personal_messages 
         WHERE chat_id = pc.chat_id 
         ORDER BY sent_at DESC 
         LIMIT 1
       )
       WHERE pc.chat_type = 'personal'
         AND (pc.participant_1_id = $1 OR pc.participant_2_id = $1)
       ORDER BY pc.is_pinned DESC, pc.pinned_at DESC, pm.sent_at DESC NULLS LAST`,
      [req.user.user_id]
    );
    res.json(result.rows.map(row => ({
      chat_id: row.chat_id,
      title: row.participant_1_id === req.user.user_id 
        ? row.participant_2_name 
        : row.participant_1_name,
      participant_ids: [row.participant_1_id, row.participant_2_id],
      participant_avatar: row.participant_1_id === req.user.user_id 
        ? (row.participant_2_has_avatar ? `/api/user/avatar?id=${row.participant_2_id}` : '/IMG/user_default.png')
        : (row.participant_1_has_avatar ? `/api/user/avatar?id=${row.participant_1_id}` : '/IMG/user_default.png'),
      last_message: row.last_message,
      last_message_at: row.last_message_at,
      last_message_sender: row.last_message_sender,
      unread_count: parseInt(row.unread_count, 10),
      is_pinned: row.is_pinned
    })));
  } catch (err) {
    console.error('Ошибка получения личных чатов:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});

// Загрузка файла
app.post('/api/files', authenticateToken, uploadAttachment.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const result = await pool.query(
      `INSERT INTO attachments 
       (file_name, file_type, file_size, file_path, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING attachment_id`,
      [req.file.originalname, req.file.mimetype, req.file.size, req.file.path, req.user.user_id]
    );

    res.json({ attachment_id: result.rows[0].attachment_id });
  } catch (err) {
    console.error('Ошибка загрузки файла:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение файла
app.get('/api/files/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT file_path, file_type, file_name 
       FROM attachments 
       WHERE attachment_id = $1`,
      [req.params.attachmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    res.sendFile(path.resolve(result.rows[0].file_path), {
      headers: {
        'Content-Type': result.rows[0].file_type,
        'Content-Disposition': `attachment; filename="${result.rows[0].file_name}"`
      }
    });
  } catch (err) {
    console.error('Ошибка получения файла:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API администратора
app.get('/api/approved-users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const result = await pool.query(`
      SELECT 
        au.id, au.full_name, au.position, au.role_id, 
        r.role_name, au.created_at, au.updated_at,
        u.user_id
      FROM approved_users au
      JOIN roles r ON au.role_id = r.role_id
      LEFT JOIN users u ON au.user_id = u.user_id
      ORDER BY au.full_name`
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения списка одобренных пользователей:', err);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.post('/api/approved-users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { full_name, position, role_id } = req.body;

    if (!full_name || !role_id) {
      return res.status(400).json({ error: 'Необходимо указать ФИО и роль' });
    }

    const result = await pool.query(`
      INSERT INTO approved_users (full_name, position, role_id)
      VALUES ($1, $2, $3)
      RETURNING *`,
      [full_name.trim(), position?.trim(), role_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Пользователь с таким ФИО уже существует' });
    }
    
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.delete('/api/approved-users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const result = await pool.query(
      'DELETE FROM approved_users WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ 
      success: true,
      message: 'Пользователь удален из списка одобренных',
      deletedUser: result.rows[0]
    });
  } catch (err) {
    console.error('Ошибка удаления одобренного пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const result = await pool.query(`
      SELECT 
        u.user_id, u.username, u.full_name, u.email,
        u.phone, u.telegram_id, u.role_id, u.is_active,
        r.role_name, u.position_id, p.position_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN positions p ON u.position_id = p.position_id
      ORDER BY u.full_name`
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения списка пользователей:', err);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.delete('/api/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role_id !== ADMIN_ROLE_ID) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const userId = req.params.userId;

    if (userId == req.user.user_id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    await pool.query('BEGIN');
    await pool.query(
      `DELETE FROM personal_messages 
       WHERE chat_id IN (
         SELECT chat_id FROM personal_chats 
         WHERE participant_1_id = $1 OR participant_2_id = $1
       )`,
      [userId]
    );

    await pool.query(
      'DELETE FROM personal_chats WHERE participant_1_id = $1 OR participant_2_id = $1',
      [userId]
    );

    const deleteResult = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, username',
      [userId]
    );

    if (deleteResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await pool.query('COMMIT');

    res.json({ 
      success: true,
      message: `Пользователь ${deleteResult.rows[0].username} успешно удален`,
      deletedUserId: deleteResult.rows[0].user_id
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Ошибка удаления пользователя:', err);
    res.status(500).json({ 
      error: 'Ошибка при удалении пользователя',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Функция для проверки порта
function checkPort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err) => {
      tester.close();
      if (err.code === 'EADDRINUSE') {
        console.log(`Порт ${port} занят`);
        resolve(false);
      } else {
        console.error(`Ошибка проверки порта ${port}:`, err);
        resolve(false);
      }
    });
    tester.once('listening', () => {
      tester.close(() => {
        console.log(`Порт ${port} свободен`);
        resolve(true);
      });
    });
    tester.listen(port, '0.0.0.0');
  });
}

// Переменная для отслеживания состояния запуска
let isServerStarting = false;

// Запуск сервера
async function startServer() {
  if (isServerStarting) {
    console.log('\x1b[33mСервер уже запускается, пропуск повторного запуска\x1b[0m');
    return;
  }

  isServerStarting = true;

  let port = PORT;
  let maxAttempts = 10;

  if (server.listening) {
    console.error('\x1b[31mСервер уже слушает порт. Закрытие...\x1b[0m');
    await new Promise((resolve) => server.close(resolve));
  }

  while (maxAttempts > 0) {
    console.log(`Проверка порта ${port}...`);
    const isPortAvailable = await checkPort(port);
    if (isPortAvailable) {
      break;
    }
    port++;
    maxAttempts--;
  }

  if (maxAttempts === 0) {
    isServerStarting = false;
    throw new Error('Не удалось найти свободный порт');
  }

  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`\x1b[35mСервер запущен\x1b[0m на http://localhost:${port}`);
      console.log(`Режим работы: ${process.env.NODE_ENV || 'development'}`);
      isServerStarting = false;
      resolve();
    });
    server.on('error', (err) => {
      isServerStarting = false;
      reject(err);
    });
  });
}

// Обработка завершения работы
process.on('SIGINT', () => {
  console.log('\n\x1b[33mЗавершение работы сервера...\x1b[0m');
  server.close(() => {
    console.log('\x1b[32mСервер успешно остановлен\x1b[0m');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\x1b[33mПолучен сигнал SIGTERM. Завершение работы сервера...\x1b[0m');
  server.close(() => {
    console.log('\x1b[32mСервер успешно остановлен\x1b[0m');
    process.exit(0);
  });
});

// Запуск сервера и проверка схемы
startServer().then(checkDatabaseSchema).catch((err) => {
  console.error('\x1b[31mОшибка при запуске сервера:\x1b[0m', err);
  process.exit(1);
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