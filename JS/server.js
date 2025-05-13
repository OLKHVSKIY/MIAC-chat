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
const wsClients = {};

// Функция аутентификации для WebSocket
const authenticateWSToken = (req, callback) => {
  let token = req.headers?.cookie?.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];
  
  if (!token) {
    return callback(new Error('Требуется авторизация'));
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
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

// Обработка подключений WebSocket
wss.on('connection', (ws, request) => {
  const userId = request.user.user_id;
  wsClients[userId] = ws;

  ws.on('close', () => {
    delete wsClients[userId];
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
         au.position as approved_position
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN positions p ON u.position_id = p.position_id
       LEFT JOIN approved_users au ON u.full_name = au.full_name
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];

    const tiffanyBlue = '\x1b[38;2;129;216;208m';
    const resetColor = '\x1b[0m'; // Сброс цвета
    
    console.log(`Найден пользователь: ${tiffanyBlue}${user.username}${resetColor}`);
    
    res.json({
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || 'Не указан',
      role_id: user.role_id,
      role_name: user.role_name || 'Неизвестная роль',
      position_id: user.position_id,
      position_name: user.position_name || user.approved_position || 'Не указана',
      telegram_id: user.telegram_id || 'Не указан'
    });
  } catch (err) {
    console.error('Ошибка при получении профиля:', err);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

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

app.delete('/api/user/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    await pool.query('BEGIN');

    const chatsResult = await pool.query(
      'SELECT chat_id FROM chats WHERE user_id = $1',
      [userId]
    );
    const chatIds = chatsResult.rows.map(row => row.chat_id);

    if (chatIds.length > 0) {
      await pool.query(
        `DELETE FROM messages WHERE chat_id = ANY($1)`,
        [chatIds]
      );
    }

    await pool.query(
      'DELETE FROM chats WHERE user_id = $1',
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

// API чатов
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

// API личных чатов
app.get('/api/personal-chats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pc.chat_id,
        u.user_id as partner_id,
        u.full_name as partner_name,
        u.avatar,
        (SELECT text FROM personal_messages 
         WHERE chat_id = pc.chat_id 
         ORDER BY sent_at DESC LIMIT 1) as last_message,
        (SELECT sent_at FROM personal_messages 
         WHERE chat_id = pc.chat_id 
         ORDER BY sent_at DESC LIMIT 1) as last_message_time
      FROM personal_chats pc
      JOIN chat_participants cp1 ON pc.chat_id = cp1.chat_id AND cp1.user_id = $1
      JOIN chat_participants cp2 ON pc.chat_id = cp2.chat_id AND cp2.user_id != $1
      JOIN users u ON cp2.user_id = u.user_id
      ORDER BY last_message_time DESC NULLS LAST
    `, [req.user.user_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения личных чатов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/personal-chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const participantCheck = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [req.params.chatId, req.user.user_id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const result = await pool.query(`
      SELECT 
        pm.message_id,
        pm.chat_id,
        pm.sender_id,
        u.full_name as sender_name,
        u.avatar as sender_avatar,
        pm.text as content,
        pm.sent_at as timestamp,
        pm.is_read,
        a.attachment_id,
        a.file_name,
        a.file_type,
        a.file_size
      FROM personal_messages pm
      JOIN users u ON pm.sender_id = u.user_id
      LEFT JOIN attachments a ON pm.attachment_id = a.attachment_id
      WHERE pm.chat_id = $1
      ORDER BY pm.sent_at ASC
    `, [req.params.chatId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/personal-chats/messages', authenticateToken, async (req, res) => {
  try {
    const { chat_id, content, attachment_id } = req.body;

    const participantCheck = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chat_id, req.user.user_id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const result = await pool.query(`
      INSERT INTO personal_messages (chat_id, sender_id, text, attachment_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [chat_id, req.user.user_id, content, attachment_id || null]);

    await pool.query(`
      UPDATE personal_chats 
      SET last_message_time = NOW() 
      WHERE chat_id = $1
    `, [chat_id]);

    const fullMessage = await pool.query(`
      SELECT 
        pm.message_id,
        pm.chat_id,
        pm.sender_id,
        u.full_name as sender_name,
        u.avatar as sender_avatar,
        pm.text as content,
        pm.sent_at as timestamp,
        pm.is_read,
        a.attachment_id,
        a.file_name,
        a.file_type,
        a.file_size
      FROM personal_messages pm
      JOIN users u ON pm.sender_id = u.user_id
      LEFT JOIN attachments a ON pm.attachment_id = a.attachment_id
      WHERE pm.message_id = $1
    `, [result.rows[0].message_id]);

    res.status(201).json(fullMessage.rows[0]);

    const participants = await pool.query(
      'SELECT user_id FROM chat_participants WHERE chat_id = $1 AND user_id != $2',
      [chat_id, req.user.user_id]
    );

    participants.rows.forEach(participant => {
      if (wsClients[participant.user_id]) {
        wsClients[participant.user_id].send(JSON.stringify({
          type: 'new_message',
          data: fullMessage.rows[0]
        }));
      }
    });
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/personal-chats/start', authenticateToken, async (req, res) => {
  try {
    const { partner_id } = req.body;

    if (req.user.user_id === partner_id) {
      return res.status(400).json({ error: 'Нельзя начать чат с самим собой' });
    }

    const existingChat = await pool.query(`
      SELECT pc.chat_id
      FROM personal_chats pc
      JOIN chat_participants cp1 ON pc.chat_id = cp1.chat_id AND cp1.user_id = $1
      JOIN chat_participants cp2 ON pc.chat_id = cp2.chat_id AND cp2.user_id = $2
    `, [req.user.user_id, partner_id]);

    if (existingChat.rows.length > 0) {
      return res.json({ chat_id: existingChat.rows[0].chat_id });
    }

    const chatResult = await pool.query(`
      INSERT INTO personal_chats (created_at, last_message_time)
      VALUES (NOW(), NOW())
      RETURNING chat_id
    `);

    const chatId = chatResult.rows[0].chat_id;

    await pool.query(`
      INSERT INTO chat_participants (chat_id, user_id)
      VALUES ($1, $2), ($1, $3)
    `, [chatId, req.user.user_id, partner_id]);

    res.status(201).json({ chat_id: chatId });
  } catch (err) {
    console.error('Ошибка создания чата:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API вложений
app.post('/api/attachments', authenticateToken, uploadAttachment.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const result = await pool.query(`
      INSERT INTO attachments (user_id, file_name, file_path, file_type, file_size)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      req.user.user_id,
      req.file.originalname,
      req.file.path,
      req.file.mimetype,
      req.file.size
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки вложения:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/attachments/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM attachments 
      WHERE attachment_id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    const attachment = result.rows[0];
    const accessCheck = await pool.query(`
      SELECT 1 FROM personal_messages pm
      JOIN chat_participants cp ON pm.chat_id = cp.chat_id
      WHERE pm.attachment_id = $1 AND cp.user_id = $2
    `, [attachment.attachment_id, req.user.user_id]);

    if (accessCheck.rows.length === 0 && attachment.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    res.sendFile(path.resolve(attachment.file_path));
  } catch (err) {
    console.error('Ошибка получения вложения:', err);
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
      `DELETE FROM messages 
       WHERE chat_id IN (SELECT chat_id FROM chats WHERE user_id = $1)`,
      [userId]
    );

    await pool.query(
      'DELETE FROM chats WHERE user_id = $1',
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

// Маршруты для личных чатов
app.get('/api/personal-chats', authenticateToken, async (req, res) => {
  try {
      const result = await pool.query(`
          SELECT 
              pc.chat_id,
              u.user_id as partner_id,
              u.full_name as partner_name,
              u.avatar,
              pm.content as last_message,
              pm.timestamp as last_message_time
          FROM personal_chats pc
          JOIN chat_participants cp1 ON pc.chat_id = cp1.chat_id AND cp1.user_id = $1
          JOIN chat_participants cp2 ON pc.chat_id = cp2.chat_id AND cp2.user_id != $1
          JOIN users u ON cp2.user_id = u.user_id
          LEFT JOIN LATERAL (
              SELECT content, timestamp 
              FROM personal_messages 
              WHERE chat_id = pc.chat_id 
              ORDER BY timestamp DESC 
              LIMIT 1
          ) pm ON true
          ORDER BY pm.timestamp DESC NULLS LAST
      `, [req.user.user_id]);

      res.json(result.rows);
  } catch (err) {
      console.error('Ошибка получения личных чатов:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/personal-chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
      // Проверяем, что пользователь является участником чата
      const participantCheck = await pool.query(
          'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
          [req.params.chatId, req.user.user_id]
      );

      if (participantCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Доступ запрещен' });
      }

      const result = await pool.query(`
          SELECT 
              pm.message_id,
              pm.chat_id,
              pm.sender_id,
              u.full_name as sender_name,
              u.avatar as sender_avatar,
              pm.text as content,
              pm.sent_at as timestamp,
              pm.is_read,
              a.attachment_id,
              a.file_name,
              a.file_type,
              a.file_size
          FROM personal_messages pm
          JOIN users u ON pm.sender_id = u.user_id
          LEFT JOIN attachments a ON pm.attachment_id = a.attachment_id
          WHERE pm.chat_id = $1
          ORDER BY pm.sent_at ASC
      `, [req.params.chatId]);

      res.json(result.rows);
  } catch (err) {
      console.error('Ошибка получения сообщений:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/personal-chats/messages', authenticateToken, async (req, res) => {
  try {
      const { chat_id, content, attachment_id } = req.body;

      // Проверяем, что пользователь является участником чата
      const participantCheck = await pool.query(
          'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
          [chat_id, req.user.user_id]
      );

      if (participantCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Доступ запрещен' });
      }

      const result = await pool.query(`
          INSERT INTO personal_messages (chat_id, sender_id, text, attachment_id)
          VALUES ($1, $2, $3, $4)
          RETURNING *
      `, [chat_id, req.user.user_id, content, attachment_id || null]);

      // Обновляем время последнего сообщения в чате
      await pool.query(`
          UPDATE personal_chats 
          SET last_message_time = NOW() 
          WHERE chat_id = $1
      `, [chat_id]);

      // Получаем полные данные сообщения для отправки через WebSocket
      const fullMessage = await pool.query(`
          SELECT 
              pm.message_id,
              pm.chat_id,
              pm.sender_id,
              u.full_name as sender_name,
              u.avatar as sender_avatar,
              pm.text as content,
              pm.sent_at as timestamp,
              pm.is_read,
              a.attachment_id,
              a.file_name,
              a.file_type,
              a.file_size
          FROM personal_messages pm
          JOIN users u ON pm.sender_id = u.user_id
          LEFT JOIN attachments a ON pm.attachment_id = a.attachment_id
          WHERE pm.message_id = $1
      `, [result.rows[0].message_id]);

      res.status(201).json(fullMessage.rows[0]);

      // Отправляем сообщение другим участникам чата через WebSocket
      const participants = await pool.query(
          'SELECT user_id FROM chat_participants WHERE chat_id = $1 AND user_id != $2',
          [chat_id, req.user.user_id]
      );

      participants.rows.forEach(participant => {
          if (wsClients[participant.user_id]) {
              wsClients[participant.user_id].send(JSON.stringify({
                  type: 'new_message',
                  data: fullMessage.rows[0]
              }));
          }
      });

  } catch (err) {
      console.error('Ошибка отправки сообщения:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/personal-chats/start', authenticateToken, async (req, res) => {
  try {
      const { partner_id } = req.body;

      if (req.user.user_id === partner_id) {
          return res.status(400).json({ error: 'Нельзя начать чат с самим собой' });
      }

      // Проверяем, существует ли уже чат между этими пользователями
      const existingChat = await pool.query(`
          SELECT pc.chat_id
          FROM personal_chats pc
          JOIN chat_participants cp1 ON pc.chat_id = cp1.chat_id AND cp1.user_id = $1
          JOIN chat_participants cp2 ON pc.chat_id = cp2.chat_id AND cp2.user_id = $2
      `, [req.user.user_id, partner_id]);

      if (existingChat.rows.length > 0) {
          return res.json({ chat_id: existingChat.rows[0].chat_id });
      }

      // Создаем новый чат
      const chatResult = await pool.query(`
          INSERT INTO personal_chats (created_at, last_message_time)
          VALUES (NOW(), NOW())
          RETURNING chat_id
      `);

      const chatId = chatResult.rows[0].chat_id;

      // Добавляем участников
      await pool.query(`
          INSERT INTO chat_participants (chat_id, user_id)
          VALUES ($1, $2), ($1, $3)
      `, [chatId, req.user.user_id, partner_id]);

      res.status(201).json({ chat_id: chatId });
  } catch (err) {
      console.error('Ошибка создания чата:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/attachments', authenticateToken, uploadAttachment.single('file'), async (req, res) => {
  try {
      if (!req.file) {
          return res.status(400).json({ error: 'Файл не загружен' });
      }

      const result = await pool.query(`
          INSERT INTO attachments (user_id, file_name, file_path, file_type, file_size)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
      `, [
          req.user.user_id,
          req.file.originalname,
          req.file.path,
          req.file.mimetype,
          req.file.size
      ]);

      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Ошибка загрузки вложения:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/attachments/:id', authenticateToken, async (req, res) => {
  try {
      const result = await pool.query(`
          SELECT * FROM attachments 
          WHERE attachment_id = $1
      `, [req.params.id]);

      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Вложение не найдено' });
      }

      const attachment = result.rows[0];

      // Проверяем, имеет ли пользователь доступ к этому вложению
      // (например, является ли он участником чата, где это вложение было отправлено)
      const accessCheck = await pool.query(`
          SELECT 1 FROM personal_messages pm
          JOIN chat_participants cp ON pm.chat_id = cp.chat_id
          WHERE pm.attachment_id = $1 AND cp.user_id = $2
      `, [attachment.attachment_id, req.user.user_id]);

      if (accessCheck.rows.length === 0 && attachment.user_id !== req.user.user_id) {
          return res.status(403).json({ error: 'Доступ запрещен' });
      }

      res.sendFile(path.resolve(attachment.file_path));
  } catch (err) {
      console.error('Ошибка получения вложения:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});



// Обработка апгрейда для WebSocket (должна быть после создания сервера)
server.on('upgrade', (request, socket, head) => {
  authenticateWSToken(request, (err, user) => {
    if (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    request.user = user;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (ws, request) => {
    const userId = request.user.user_id;
    wsClients[userId] = ws;

    ws.on('close', () => {
        delete wsClients[userId];
    });
});

// Функция для проверки занятости порта
function checkPort(port) {
    return new Promise((resolve) => {
        const tester = http.createServer()
            .once('error', () => resolve(false))
            .once('listening', () => {
                tester.once('close', () => resolve(true)).close();
            })
            .listen(port);
    });
}

// Запуск сервера с проверкой порта
async function startServer() {
    const port = PORT;
    const isPortAvailable = await checkPort(port);

    if (!isPortAvailable) {
        console.error(`\x1b[31mПорт ${port} уже занят. Попробуйте использовать другой порт.\x1b[0m`);
        console.log('Попытка найти свободный порт...');
        
        let newPort = port + 1;
        while (newPort < port + 100) {
            if (await checkPort(newPort)) {
                console.log(`Найден свободный порт: ${newPort}`);
                server.listen(newPort, '0.0.0.0', () => {
                    console.log(`\x1b[35mСервер запущен\x1b[0m на http://localhost:${newPort}`);
                    console.log(`Режим работы: ${process.env.NODE_ENV || 'development'}`);
                });
                return;
            }
            newPort++;
        }
        
        console.error('\x1b[31mНе удалось найти свободный порт\x1b[0m');
        process.exit(1);
    }

    server.listen(port, '0.0.0.0', () => {
        console.log(`\x1b[35mСервер запущен\x1b[0m на http://localhost:${port}`);
        console.log(`Режим работы: ${process.env.NODE_ENV || 'development'}`);
    });
}

// Обработка сигналов завершения
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

// Запускаем сервер
startServer().catch(err => {
    console.error('\x1b[31mОшибка при запуске сервера:\x1b[0m', err);
    process.exit(1);
});

// Маршруты для страниц
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

// API выхода из системы
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

