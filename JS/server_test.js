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
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const { createProxyMiddleware } = require('http-proxy-middleware');


// Константы и конфигурация
const ADMIN_ROLE_ID = 1;
const PORT = 4000;
const SECRET_KEY = 'your-secret-key-123';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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



// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  }
});

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../')));

// Middleware аутентификации
const authenticateToken = async (req, res, next) => {
  let token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    
    const result = await pool.query(
      'SELECT user_id, username, is_active, role_id FROM users WHERE user_id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(403).json({ error: 'Пользователь не найден или неактивен' });
    }

    req.user = result.rows[0];
    next();
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
const typingUsers = new Map();

// WebSocket аутентификация
const authenticateWSToken = async (req, callback) => {
  const cookies = req.headers?.cookie;
  let token;

  if (cookies) {
    const cookieArray = cookies.split(';');
    const tokenCookie = cookieArray.find(c => c.trim().startsWith('token='));
    token = tokenCookie ? tokenCookie.split('=')[1] : null;
  }

  if (!token) {
    return callback(new Error('Требуется авторизация: токен не найден'));
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const result = await pool.query(
      'SELECT user_id, username, is_active FROM users WHERE user_id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return callback(new Error('Пользователь не найден или неактивен'));
    }

    req.user = result.rows[0];
    callback(null, req.user);
  } catch (err) {
    callback(new Error('Неверный токен: ' + err.message));
  }
};

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  authenticateWSToken(request, (err, user) => {
    if (err) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n', 'utf8', () => {
        socket.destroy();
      });
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

// Обработка WebSocket подключений
wss.on('connection', (ws, request) => {
  const userId = request.user.user_id;
  wsClients.set(userId, ws);

  // Отправка статуса онлайн
  broadcastStatus(userId, true);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'typing':
          handleTyping(userId, message.chatId, message.isTyping);
          break;
        case 'message':
          await handleMessage(userId, message);
          break;
        case 'read':
          await handleRead(userId, message.chatId);
          break;
      }
    } catch (err) {
      console.error('Ошибка обработки WebSocket сообщения:', err);
    }
  });

  ws.on('close', () => {
    wsClients.delete(userId);
    broadcastStatus(userId, false);
  });
});

// Функции обработки WebSocket событий
const broadcastStatus = async (userId, isOnline) => {
  const statusMessage = {
    type: 'status',
    userId,
    isOnline
  };

  for (const [clientId, client] of wsClients) {
    if (clientId !== userId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(statusMessage));
    }
  }
};

const handleTyping = (userId, chatId, isTyping) => {
  if (isTyping) {
    typingUsers.set(`${chatId}:${userId}`, Date.now());
  } else {
    typingUsers.delete(`${chatId}:${userId}`);
  }

  const typingMessage = {
    type: 'typing',
    chatId,
    userId,
    isTyping
  };

  for (const [clientId, client] of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(typingMessage));
    }
  }
};

const handleMessage = async (userId, message) => {
  const { chatId, content, replyTo, forwardedFrom, attachments } = message;
  const sanitizedContent = sanitizeHtml(content, {
    allowedTags: ['b', 'i', 'u', 's', 'a'],
    allowedAttributes: { 'a': ['href'] }
  });

  const result = await pool.query(
    `INSERT INTO personal_messages 
     (chat_id, sender_id, text, reply_to_message_id, forwarded_from, attachment_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [chatId, userId, sanitizedContent, replyTo || null, forwardedFrom || null, attachments?.[0] || null]
  );

  const newMessage = result.rows[0];
  
  // Обновление времени последнего сообщения
  await pool.query(
    'UPDATE personal_chats SET last_message_at = NOW() WHERE chat_id = $1',
    [chatId]
  );

  const messageData = {
    type: 'message',
    message: newMessage,
    chatId
  };

  const participants = await pool.query(
    'SELECT user_id FROM chat_participants WHERE chat_id = $1',
    [chatId]
  );

  for (const participant of participants.rows) {
    const client = wsClients.get(participant.user_id);
    if (client?.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(messageData));
    }
  }
};

const handleRead = async (userId, chatId) => {
  await pool.query(
    `UPDATE personal_messages 
     SET is_read = true 
     WHERE chat_id = $1 AND sender_id != $2 AND is_read = false`,
    [chatId, userId]
  );

  await pool.query(
    'UPDATE chat_participants SET last_read_at = NOW() WHERE chat_id = $1 AND user_id = $2',
    [chatId, userId]
  );

  const readMessage = {
    type: 'read',
    chatId,
    userId
  };

  for (const [clientId, client] of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(readMessage));
    }
  }
};



// ==================== API Endpoints ====================

// Аутентификация и профили
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
         r.role_name, u.position_id, u.telegram_id,
         u.phone, u.email, u.avatar
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

    res.json({ 
      success: true, 
      token, 
      user: {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role_id: user.role_id,
        role_name: user.role_name,
        position_id: user.position_id,
        telegram_id: user.telegram_id,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar ? true : false
      }
    });

  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         u.user_id, u.username, u.full_name, u.phone, 
         u.email, u.telegram_id, u.role_id, u.avatar,
         r.role_name, u.position_id, p.position_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN positions p ON u.position_id = p.position_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      user_id: result.rows[0].user_id,
      username: result.rows[0].username,
      full_name: result.rows[0].full_name,
      phone: result.rows[0].phone || 'Не указан',
      email: result.rows[0].email || 'Не указан',
      telegram_id: result.rows[0].telegram_id || 'Не указан',
      position_name: result.rows[0].position_name || 'Не указана',
      avatar: result.rows[0].avatar ? true : false
    });
  } catch (err) {
    console.error('Ошибка получения профиля:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { full_name, phone, email, telegram_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, phone = $2, email = $3, telegram_id = $4
       WHERE user_id = $5
       RETURNING *`,
      [full_name, phone, email, telegram_id, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Ошибка обновления профиля:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/user/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const avatarBuffer = req.file.buffer;
    await pool.query(
      'UPDATE users SET avatar = $1 WHERE user_id = $2',
      [avatarBuffer, req.user.user_id]
    );

    res.json({ message: 'Аватар успешно загружен' });
  } catch (err) {
    console.error('Ошибка загрузки аватара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/user/avatar/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT avatar FROM users WHERE user_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0 || !result.rows[0].avatar) {
      return res.sendFile(path.join(__dirname, '../IMG/user_default.png'));
    }

    res.set('Content-Type', 'image/jpeg');
    res.send(result.rows[0].avatar);
  } catch (err) {
    console.error('Ошибка получения аватара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Работа с чатами
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
const result = await pool.query(
  `SELECT pc.chat_id, pc.title, pc.is_group, pc.created_at,
          pm.text as last_message, pm.sender_id as last_message_sender,
          pm.sent_at as last_message_at,
          COUNT(CASE WHEN pm2.is_read = false AND pm2.sender_id != $1 THEN 1 END) as unread_count
   FROM personal_chats pc
   JOIN chat_participants cp ON pc.chat_id = cp.chat_id
   LEFT JOIN (
       SELECT DISTINCT ON (chat_id) chat_id, text, sender_id, sent_at
       FROM personal_messages
       ORDER BY chat_id, sent_at DESC
   ) pm ON pm.chat_id = pc.chat_id
   LEFT JOIN personal_messages pm2 ON pm2.chat_id = pc.chat_id
   WHERE cp.user_id = $1
   GROUP BY pc.chat_id, pc.title, pc.is_group, pc.created_at, pm.text, pm.sender_id, pm.sent_at
   ORDER BY pm.sent_at DESC NULLS LAST`,
  [req.user.user_id]
);

    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения чатов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/chats', authenticateToken, async (req, res) => {
  const { participant_id, title, is_group, participants } = req.body;
  
  try {
    await pool.query('BEGIN');

    const chatResult = await pool.query(
      `INSERT INTO personal_chats (is_group, title, created_at, last_message_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [is_group || false, title || null]
    );

    const chatId = chatResult.rows[0].chat_id;

    // Добавление участников
    const participantIds = is_group ? participants : [req.user.user_id, participant_id];
    
    for (const userId of participantIds) {
      await pool.query(
        'INSERT INTO chat_participants (chat_id, user_id, joined_at) VALUES ($1, $2, NOW())',
        [chatId, userId]
      );
    }

    await pool.query('COMMIT');
    
    const newChat = await pool.query(
      `SELECT pc.*, COUNT(cp.user_id) as participant_count
       FROM personal_chats pc
       JOIN chat_participants cp ON pc.chat_id = cp.chat_id
       WHERE pc.chat_id = $1
       GROUP BY pc.chat_id`,
      [chatId]
    );

    res.status(201).json(newChat.rows[0]);

    // Уведомление участников через WebSocket
    const notification = {
      type: 'new_chat',
      chat: newChat.rows[0]
    };

    for (const userId of participantIds) {
      const client = wsClients.get(userId);
      if (client?.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(notification));
      }
    }
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Ошибка создания чата:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/chats/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pc.*, 
              ARRAY_AGG(cp.user_id) as participant_ids,
              ARRAY_AGG(u.username) as participant_names
       FROM personal_chats pc
       JOIN chat_participants cp ON pc.chat_id = cp.chat_id
       JOIN users u ON cp.user_id = u.user_id
       WHERE pc.chat_id = $1 AND cp.user_id = $2
       GROUP BY pc.chat_id`,
      [req.params.id, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения информации о чате:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT pm.*, u.username, u.avatar
       FROM personal_messages pm
       JOIN users u ON pm.sender_id = u.user_id
       WHERE pm.chat_id = $1
       ORDER BY pm.sent_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );

    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM personal_messages WHERE chat_id = $1',
      [req.params.id]
    );

    res.json({
      messages: result.rows,
      total: parseInt(totalResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  const { text, reply_to_message_id, forwarded_from, attachment_id } = req.body;

  try {
    const sanitizedText = sanitizeHtml(text, {
      allowedTags: ['b', 'i', 'u', 's', 'a'],
      allowedAttributes: { 'a': ['href'] }
    });

    const result = await pool.query(
      `INSERT INTO personal_messages 
       (chat_id, sender_id, text, reply_to_message_id, forwarded_from, attachment_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [req.params.id, req.user.user_id, sanitizedText, reply_to_message_id || null, 
       forwarded_from || null, attachment_id || null]
    );

    await pool.query(
      'UPDATE personal_chats SET last_message_at = NOW() WHERE chat_id = $1',
      [req.params.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/chats/:id/messages/:messageId', authenticateToken, async (req, res) => {
  const { text } = req.body;

  try {
    const sanitizedText = sanitizeHtml(text, {
      allowedTags: ['b', 'i', 'u', 's', 'a'],
      allowedAttributes: { 'a': ['href'] }
    });

    const result = await pool.query(
      `UPDATE personal_messages 
       SET text = $1, edited_at = NOW()
       WHERE message_id = $2 AND chat_id = $3 AND sender_id = $4
       RETURNING *`,
      [sanitizedText, req.params.messageId, req.params.id, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено или нет прав' });
    }

    const updateMessage = {
      type: 'message_updated',
      message: result.rows[0],
      chatId: req.params.id
    };

    const participants = await pool.query(
      'SELECT user_id FROM chat_participants WHERE chat_id = $1',
      [req.params.id]
    );

    for (const participant of participants.rows) {
      const client = wsClients.get(participant.user_id);
      if (client?.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(updateMessage));
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка редактирования сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/chats/:id/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM personal_messages 
       WHERE message_id = $1 AND chat_id = $2 AND sender_id = $3
       RETURNING *`,
      [req.params.messageId, req.params.id, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено или нет прав' });
    }

    const deleteMessage = {
      type: 'message_deleted',
      messageId: req.params.messageId,
      chatId: req.params.id
    };

    const participants = await pool.query(
      'SELECT user_id FROM chat_participants WHERE chat_id = $1',
      [req.params.id]
    );

    for (const participant of participants.rows) {
      const client = wsClients.get(participant.user_id);
      if (client?.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(deleteMessage));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/chats/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE personal_messages 
       SET is_read = true 
       WHERE chat_id = $1 AND sender_id != $2 AND is_read = false`,
      [req.params.id, req.user.user_id]
    );

    await pool.query(
      'UPDATE chat_participants SET last_read_at = NOW() WHERE chat_id = $1 AND user_id = $2',
      [req.params.id, req.user.user_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отметки прочитанных сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Работа с пользователями
app.get('/api/users/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Не указан поисковый запрос' });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, username, full_name, avatar
       FROM users 
       WHERE (username ILIKE $1 OR full_name ILIKE $1) AND is_active = true
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json(result.rows.map(user => ({
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      avatar: user.avatar ? true : false
    })));
  } catch (err) {
    console.error('Ошибка поиска пользователей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.full_name, u.phone, 
              u.email, u.telegram_id, u.avatar, p.position_name
       FROM users u
       LEFT JOIN positions p ON u.position_id = p.position_id
       WHERE u.user_id = $1 AND u.is_active = true`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      user_id: result.rows[0].user_id,
      username: result.rows[0].username,
      full_name: result.rows[0].full_name,
      phone: result.rows[0].phone || 'Не указан',
      email: result.rows[0].email || 'Не указан',
      telegram_id: result.rows[0].telegram_id || 'Не указан',
      position_name: result.rows[0].position_name || 'Не указана',
      avatar: result.rows[0].avatar ? true : false
    });
  } catch (err) {
    console.error('Ошибка получения профиля пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/:id/chats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pc.*
       FROM personal_chats pc
       JOIN chat_participants cp1 ON pc.chat_id = cp1.chat_id
       JOIN chat_participants cp2 ON pc.chat_id = cp2.chat_id
       WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND pc.is_group = false`,
      [req.user.user_id, req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения общих чатов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Работа с файлами
app.post('/api/files', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const result = await pool.query(
      `INSERT INTO attachments (file_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [req.file.originalname, req.file.path, req.file.mimetype, req.file.size, req.user.user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки файла:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/files/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_path, file_name, file_type FROM attachments WHERE attachment_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    res.set({
      'Content-Type': result.rows[0].file_type,
      'Content-Disposition': `attachment; filename="${result.rows[0].file_name}"`
    });
    res.sendFile(path.resolve(result.rows[0].file_path));
  } catch (err) {
    console.error('Ошибка скачивания файла:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Запуск сервера
async function startServer() {
  const port = PORT;
  const isPortAvailable = await checkPort(port);

  if (!isPortAvailable) {
    console.error(`Порт ${port} занят`);
    process.exit(1);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
  });
}

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

startServer().catch(err => {
  console.error('Ошибка при запуске сервера:', err);
  process.exit(1);
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Глобальная ошибка:', err.stack);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});