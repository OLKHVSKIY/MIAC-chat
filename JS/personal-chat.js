document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM загружен. URL:', window.location.href);
  console.log('Элемент #empty-chat:', document.getElementById('empty-chat'));
  console.log('Элемент #chat-messages:', document.getElementById('chat-messages'));
  console.log('Элемент #chat-header:', document.getElementById('chat-header'));
  console.log('HTML документа:', document.documentElement.outerHTML.substring(0, 500)); 
  // DOM элементы
  const chatList = document.getElementById('chat-list');
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendMessageBtn = document.getElementById('send-message');
  const chatSearch = document.getElementById('chat-search');
  const searchResults = document.getElementById('search-results');
  const newChatBtn = document.getElementById('new-chat-btn');
  const newChatModal = document.getElementById('new-chat-modal');
  const userSearch = document.getElementById('user-search');
  const userSearchResults = document.getElementById('user-search-results');
  const groupChatOptions = document.getElementById('group-chat-options');
  const groupTitle = document.getElementById('group-title');
  const selectedUsers = document.getElementById('selected-users');
  const createGroupBtn = document.getElementById('create-group-btn');
  const profilePanel = document.getElementById('profile-panel');
  const viewProfileBtn = document.getElementById('view-profile');
  const closeProfileBtn = document.getElementById('close-profile');
  const minimizeSidebarBtn = document.getElementById('minimize-sidebar');
  const sidebar = document.querySelector('.chat-sidebar');
  const contextMenu = document.getElementById('context-menu');
  const replyInfo = document.getElementById('reply-info');
  const cancelReplyBtn = document.getElementById('cancel-reply');
  const attachFileBtn = document.getElementById('attach-file');
  const fileInput = document.getElementById('file-input');
  const scrollToBottomBtn = document.getElementById('scroll-to-bottom');
  const forwardModal = document.getElementById('forward-modal');
  const forwardSearch = document.getElementById('forward-search');
  const forwardSearchResults = document.getElementById('forward-search-results');
  const partnerAvatar = document.getElementById('partner-avatar');
  const partnerName = document.getElementById('partner-name');
  const partnerStatus = document.getElementById('partner-status');
  const mediaGrid = document.getElementById('media-grid');
  const searchInChatBtn = document.getElementById('search-in-chat');
  const searchChatModal = document.getElementById('search-chat-modal');
  const chatMessageSearch = document.getElementById('chat-message-search');
  const chatSearchResults = document.getElementById('chat-search-results');
  const closeSearchModalBtn = document.getElementById('close-search-modal');
  const chatMenuBtn = document.getElementById('chat-menu');
  const chatContextMenu = document.getElementById('chat-context-menu');
const BASE_URL = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000';

  let currentChatId = null;
  let currentUser = null;
  let selectedUsersForGroup = [];
  let replyToMessage = null;
  let ws = null;
  let isAtBottom = true;
  let isTyping = false;
  let typingTimeout = null;

  // Инициализация
  async function init() {
    try {
      const userData = JSON.parse(localStorage.getItem('userData'));
      if (!userData) {
        window.location.href = '/HTML/login.html';
        return;
      }
      currentUser = userData;
      initWebSocket();
      await loadChats();
      setupEventListeners();
    } catch (err) {
      console.error('Ошибка инициализации:', err);
      showAlert('Ошибка загрузки чатов', 'error');
    }
  }

  // WebSocket
function initWebSocket() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.error('Токен авторизации не найден');
    showAlert('Требуется авторизация', 'error');
    window.location.href = '/HTML/login.html';
    return;
  }
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    console.log('WebSocket успешно подключен');
  };
  ws.onerror = (err) => {
    console.error('Ошибка WebSocket:', err);
  };

ws.onmessage = async (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log('Получено WebSocket сообщение:', data); // Добавляем лог для отладки
    switch (data.type) {
      case 'new_message': // Исправлено с 'message' на 'new_message'
        handleNewMessage(data.message, data.chatId);
        break;
      case 'message_deleted':
        deleteMessage(data.messageId);
        break;
      case 'status':
        updateUserStatus(data.userId, data.isOnline);
        break;
      case 'typing':
        handleTypingStatus(data.chatId, data.userId, data.isTyping);
        break;
      case 'read':
        updateReadStatus(data.chatId, data.messageIds);
        break;
      case 'new_chat':
        await loadChats();
        if (data.chat.participant_ids.includes(currentUser.user_id)) {
          selectChat(data.chat.chat_id);
        }
        break;
      case 'chat_cleared':
        if (data.chatId === currentChatId) {
          chatMessages.innerHTML = '';
          showAlert('Чат очищен', 'success');
        }
        break;
      case 'chat_pinned':
        await loadChats();
        showAlert(data.pinned ? 'Чат закреплён' : 'Чат откреплён', 'success');
        break;
      default:
        console.warn('Неизвестный тип WebSocket сообщения:', data.type);
    }
  } catch (err) {
    console.error('Ошибка обработки WebSocket сообщения:', err);
  }
};

    ws.onclose = () => {
      console.log('WebSocket отключен. Попытка переподключения...');
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('Ошибка WebSocket:', err);
    };
  }

  // Загрузка чатов
async function loadChats() {
  try {
    const response = await fetch(`${BASE_URL}/api/personal-chats`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error || 'Unknown error'}`);
    }
    const chats = await response.json();

    chatList.innerHTML = '';
    chats.forEach(chat => {
      const chatItem = createChatItem(chat);
      chatList.appendChild(chatItem);
    });
  } catch (err) {
    console.error('Ошибка загрузки чатов:', err);
    showAlert(`Не удалось загрузить чаты: ${err.message}`, 'error');
  }
}

  // Создание элемента чата
  function createChatItem(chat) {
    const div = document.createElement('div');
    div.className = `chat-item ${chat.unread_count > 0 ? 'unread' : ''} ${chat.is_pinned ? 'pinned' : ''}`;
    div.dataset.chatId = chat.chat_id;

    const avatar = document.createElement('img');
    avatar.className = 'chat-avatar';
    avatar.src = chat.participant_avatar || '/IMG/user_default.png';

    const info = document.createElement('div');
    info.className = 'chat-info';

    const name = document.createElement('div');
    name.className = 'chat-name';
    name.textContent = chat.title || 'Чат';

    const lastMessage = document.createElement('div');
    lastMessage.className = 'chat-last-message';
    lastMessage.textContent = chat.last_message || '';

    const time = document.createElement('div');
    time.className = 'chat-time';
    time.textContent = formatTime(chat.last_message_at);

    const unread = document.createElement('div');
    unread.className = 'chat-unread-count';
    if (chat.unread_count > 0) {
      unread.textContent = chat.unread_count;
    }

    info.append(name, lastMessage, time, unread);
    div.append(avatar, info);

    div.addEventListener('click', () => selectChat(chat.chat_id));
    return div;
  }

  // Выбор чата
async function selectChat(chatId) {
  try {
    if (!chatId) {
      throw new Error('chatId не указан');
    }
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Токен авторизации отсутствует');
    }
    currentChatId = chatId;
    document.querySelectorAll('.chat-item').forEach(item => 
      item.classList.remove('active'));
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (chatItem) {
      chatItem.classList.add('active');
      chatItem.classList.remove('unread');
      chatItem.querySelector('.chat-unread-count').textContent = '';
    } else {
      console.warn(`Чат с chatId=${chatId} не найден в списке чатов`);
    }

    const chatInfo = await fetchChatInfo(chatId);
    updateChatHeader(chatInfo);
    await loadMessages(chatId);

    const emptyChat = document.getElementById('empty-chat');
    const chatHeader = document.getElementById('chat-header');
    if (!emptyChat) {
      console.error('Элемент #empty-chat не найден в DOM. URL:', window.location.href);
      console.log('HTML chat-messages:', document.getElementById('chat-messages')?.outerHTML);
    }
    if (!chatMessages) {
      console.error('Элемент #chat-messages не найден в DOM. URL:', window.location.href);
    }
    if (!chatHeader) {
      console.error('Элемент #chat-header не найден в DOM. URL:', window.location.href);
    }

    if (emptyChat) emptyChat.style.display = 'none';
    if (chatMessages) chatMessages.style.display = 'flex';
    if (chatHeader) chatHeader.style.display = 'flex';

    await fetch(`${BASE_URL}/api/personal-chats/${chatId}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (err) {
    console.error('Ошибка выбора чата:', err);
    showAlert('Не удалось загрузить чат: ' + err.message, 'error');
  }
}

  // Получение информации о чате
async function fetchChatInfo(chatId) {
  try {
    const response = await fetch(`${BASE_URL}/api/personal-chats/${chatId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка загрузки информации о чате: ${errorData.error}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Ошибка загрузки информации о чате:', err);
    throw err;
  }
}

  // Обновление заголовка чата
  async function updateChatHeader(chatInfo) {
    const otherUserId = chatInfo.participant_ids.find(id => id !== currentUser.user_id);
    partnerName.textContent = chatInfo.title || 'Чат';
    partnerAvatar.src = `/api/user/avatar?id=${otherUserId || currentUser.user_id}` || '/IMG/user_default.png';
    
    try {
      const userResponse = await fetch(`${BASE_URL}/api/users/${otherUserId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (userResponse.ok) {
        const user = await userResponse.json();
        partnerStatus.textContent = user.is_online ? 'онлайн' : 'оффлайн';
        partnerStatus.className = user.is_online ? 'online' : 'offline';
      }
    } catch (err) {
      console.error('Ошибка получения статуса пользователя:', err);
      partnerStatus.textContent = 'оффлайн';
      partnerStatus.className = 'offline';
    }
  }

  // Загрузка сообщений
async function loadMessages(chatId, page = 1) {
  try {
    const url = `${BASE_URL}/api/personal-chats/${chatId}/messages?page=${page}`;
    console.log('Полный URL запроса:', url);
    const token = localStorage.getItem('authToken');
    console.log('Токен авторизации:', token ? 'Присутствует' : 'Отсутствует');
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Ошибка ответа сервера:', errorData);
      throw new Error(`HTTP error! Status: ${response.status}, Сообщение: ${errorData.error || 'Неизвестная ошибка'}`);
    }
    const messages = await response.json();
    const messageContainer = document.querySelector('#chat-messages');
    if (!messageContainer) {
      console.error('Элемент #chat-messages не найден в DOM');
      throw new Error('Ошибка интерфейса: контейнер сообщений не найден');
    }
    if (page === 1) {
      messageContainer.innerHTML = '';
    }
    messages.forEach(message => {
      const messageElement = createMessageElement(message);
      messageContainer.appendChild(messageElement);
    });
    if (page === 1) {
      scrollToBottom();
    }
  } catch (err) {
    console.error('Ошибка загрузки сообщений:', err);
    showAlert('Не удалось загрузить сообщения: ' + err.message, 'error');
  }
}

  // Создание элемента сообщения
 function createMessageElement(message) {
  const div = document.createElement('div');
  div.className = `message ${message.sender_id === currentUser.user_id ? 'my-message' : ''}`;
  div.dataset.messageId = message.message_id;

  if (message.reply_to_message_id) {
    const reply = document.createElement('div');
    reply.className = 'message-reply';
    reply.textContent = 'Ответ на: ...'; // Можно загрузить текст оригинального сообщения
    div.appendChild(reply);
  }

  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = formatMessageText(message.text);

  if (message.attachment) {
    const attachment = document.createElement('div');
    attachment.className = 'attachment';
    if (message.attachment.file_type?.startsWith('image')) {
      const img = document.createElement('img');
      img.src = `/api/files/${message.attachment_id}`;
      attachment.appendChild(img);
    } else {
      const fileDiv = document.createElement('div');
      fileDiv.className = 'attachment-file';
      fileDiv.innerHTML = `
        <i class="fas fa-file attachment-icon"></i>
        <div class="file-info">
          <div class="file-name">${message.attachment.file_name || 'Файл'}</div>
          <div class="file-size">${formatFileSize(message.attachment.file_size)}</div>
        </div>
      `;
      attachment.appendChild(fileDiv);
    }
    content.appendChild(attachment);
  }

  const info = document.createElement('div');
  info.className = 'message-info';

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = formatTime(message.sent_at);

  if (message.sender_id === currentUser.user_id) {
    const status = document.createElement('span');
    status.className = `message-status ${message.is_read ? 'read' : 'sent'}`;
    info.append(status);
  }

  info.append(time);
  div.append(content, info);

  div.addEventListener('contextmenu', (e) => showContextMenu(e, message));
  return div;
}

  // Форматирование текста сообщения
  function formatMessageText(text) {
    return text
      .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
      .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
      .replace(/\n/g, '<br>');
  }

  // Отправка сообщения
async function sendMessage() {
  if (!currentChatId) {
    showAlert('Выберите чат', 'warning');
    return;
  }

  const text = messageInput.value.trim();
  const hasFile = fileInput.files.length > 0;

  if (!text && !hasFile) {
    showAlert('Введите сообщение или прикрепите файл', 'warning');
    return;
  }

  try {
    let attachment_id = null;

    // Загрузка файла, если он есть
    if (hasFile) {
      const fileForm = new FormData();
      fileForm.append('file', fileInput.files[0]);
      console.log('Загрузка файла:', fileInput.files[0].name);
      const fileResponse = await fetch(`${BASE_URL}/api/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
        body: fileForm
      });
      if (!fileResponse.ok) {
        const errorData = await fileResponse.json();
        throw new Error(`Ошибка загрузки файла: ${errorData.error}`);
      }
      const fileData = await fileResponse.json();
      console.log('Файл загружен, attachment_id:', fileData.attachment_id);
      attachment_id = fileData.attachment_id;
    }

    // Формирование JSON-объекта
    const messageData = {};
    if (text) messageData.text = text;
    if (replyToMessage) messageData.reply_to_message_id = replyToMessage.message_id;
    if (attachment_id) messageData.attachment_id = attachment_id;

    console.log('Отправка данных:', messageData);

    const response = await fetch(`${BASE_URL}/api/personal-chats/${currentChatId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка отправки сообщения: ${errorData.error}`);
    }

    const message = await response.json();
    console.log('Сообщение отправлено:', message);

    messageInput.value = '';
    replyToMessage = null;
    replyInfo.style.display = 'none';
    fileInput.value = '';
    scrollToBottom();
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    showAlert('Не удалось отправить сообщение: ' + err.message, 'error');
  }
}

  // Обработка нового сообщения
function handleNewMessage(message, chatId) {
  if (chatId === currentChatId) {
    const messageElement = createMessageElement(message);
    chatMessages.appendChild(messageElement);

    if (isAtBottom) {
      scrollToBottom();
    } else {
      scrollToBottomBtn.style.display = 'block';
    }

    if (message.sender_id !== currentUser.user_id) {
      fetch(`${BASE_URL}/api/personal-chats/${chatId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
    }
  }

  loadChats(); // Обновить список чатов
}

  // Контекстное меню сообщения
 function showContextMenu(e, message) {
  e.preventDefault();

  contextMenu.innerHTML = '';
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;

  const actions = [
    { action: 'reply', text: 'Ответить' },
    { action: 'delete', text: 'Удалить', condition: message.sender_id === currentUser.user_id }
  ];

  actions.forEach(({ action, text, condition = true }) => {
    if (!condition) return;
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.dataset.action = action;
    item.textContent = text;
    item.onclick = () => {
      handleContextMenuAction(action, message);
      contextMenu.style.display = 'none';
    };
    contextMenu.appendChild(item);
  });

  document.addEventListener('click', hideContextMenu, { once: true });
}

async function forwardMessage(chatId, message) {
  try {
    const response = await fetch(`${BASE_URL}/api/personal-chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: message.text,
        attachment_id: message.attachment_id
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка пересылки сообщения: ${errorData.error}`);
    }
    forwardModal.style.display = 'none';
    showAlert('Сообщение переслано', 'success');
  } catch (err) {
    console.error('Ошибка пересылки сообщения:', err);
    showAlert('Не удалось переслать сообщение: ' + err.message, 'error');
  }
}
  // Удаление сообщения
  async function deleteMessage(messageId) {
    try {
      const response = await fetch(
        `${BASE_URL}/api/personal-chats/${currentChatId}/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }
      );
      if (!response.ok) {
        throw new Error(`Ошибка удаления сообщения: ${response.status}`);
      }
      const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.remove();
      }
    } catch (err) {
      console.error('Ошибка удаления сообщения:', err);
      showAlert('Не удалось удалить сообщение', 'error');
    }
  }

  // Обновление статуса прочтения
  function updateReadStatus(chatId, messageIds) {
    if (chatId !== currentChatId) return;
    messageIds.forEach(messageId => {
      const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
      if (messageElement) {
        const status = messageElement.querySelector('.message-status');
        if (status) {
          status.className = 'message-status read';
          status.innerHTML = '<i class="fas fa-check-double"></i>';
        }
      }
    });
  }

// Обновляет статус партнёра в чате (например, "печатает..." или "онлайн")
function handleTypingStatus(chatId, userId, isTyping) {
  if (chatId !== currentChatId || userId === currentUser.user_id) return;
  partnerStatus.textContent = isTyping 
    ? 'печатает...' 
    : partnerStatus.className === 'online' 
      ? 'онлайн' 
      : 'оффлайн';
}

  // Обновление статуса пользователя
  async function updateUserStatus(userId, isOnline) {
    if (!currentChatId) return;
    const chatInfo = await fetchChatInfo(currentChatId);
    const otherUserId = chatInfo.participant_ids.find(id => id !== currentUser.user_id);
    if (userId === otherUserId) {
      partnerStatus.textContent = isOnline ? 'онлайн' : 'оффлайн';
      partnerStatus.className = isOnline ? 'online' : 'offline';
    }
    // Обновить аватарки и статус в списке чатов
    const chatItems = document.querySelectorAll(`.chat-item`);
    chatItems.forEach(item => {
      const chatId = item.dataset.chatId;
      fetchChatInfo(chatId).then(info => {
        const participantId = info.participant_ids.find(id => id !== currentUser.user_id);
        if (participantId === userId) {
          const avatar = item.querySelector('.chat-avatar');
          avatar.src = isOnline ? 
            `/api/user/avatar?id=${participantId}` : 
            '/IMG/user_default.png';
        }
      });
    });
  }

  // Поиск чатов
  async function searchChats(query) {
    try {
      const response = await fetch(
        `${BASE_URL}/api/personal-chats?query=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }
      );
      if (!response.ok) {
        throw new Error(`Ошибка поиска: ${response.status}`);
      }
      const chats = await response.json();
      searchResults.innerHTML = '';
      chats.forEach(chat => {
        const chatItem = createChatItem(chat);
        searchResults.appendChild(chatItem);
      });
      searchResults.style.display = chats.length > 0 ? 'block' : 'none';
    } catch (err) {
      console.error('Ошибка поиска чатов:', err);
      showAlert('Не удалось выполнить поиск', 'error');
    }
  }

  // Поиск пользователей для нового чата
  async function searchUsers(query) {
    try {
      const response = await fetch(
        `${BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }
      );
      if (!response.ok) {
        throw new Error(`Ошибка поиска пользователей: ${response.status}`);
      }
      const users = await response.json();
      userSearchResults.innerHTML = '';
      users.forEach(user => {
        if (user.user_id === currentUser.user_id) return;
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
          <img src="${user.has_avatar ? `/api/user/avatar?id=${user.user_id}` : '/IMG/user_default.png'}" 
               class="user-avatar">
          <div class="user-info">
            <div class="user-name">${user.full_name}</div>
            <div class="user-position">${user.position_name || ''}</div>
          </div>
        `;
        userItem.addEventListener('click', () => startNewChat(user.user_id));
        userSearchResults.appendChild(userItem);
      });
    } catch (err) {
      console.error('Ошибка поиска пользователей:', err);
      showAlert('Не удалось найти пользователей', 'error');
    }
  }

  // Создание нового чата
async function startNewChat(userId) {
  try {
    console.log('BASE_URL:', BASE_URL); // Логируем BASE_URL
    const response = await fetch(`${BASE_URL}/api/personal-chats`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ participant_id: userId })
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Ошибка ответа сервера:', errorData);
      throw new Error(`Ошибка создания чата: ${response.status}, Сообщение: ${errorData.error || 'Неизвестная ошибка'}`);
    }
    const { chat_id } = await response.json();
    newChatModal.style.display = 'none';
    userSearchResults.innerHTML = '';
    userSearch.value = '';
    await loadChats();
    selectChat(chat_id);
  } catch (err) {
    console.error('Ошибка создания чата:', err);
    showAlert('Не удалось создать чат: ' + err.message, 'error');
  }
}

  // Создание группового чата (заглушка)
  async function createGroupChat() {
    try {
      if (!groupTitle.value || selectedUsersForGroup.length < 1) {
        showAlert('Укажите название и выберите участников', 'warning');
        return;
      }
      showAlert('Групповые чаты пока не поддерживаются', 'info');
      newChatModal.style.display = 'none';
      groupTitle.value = '';
      selectedUsersForGroup = [];
      selectedUsers.innerHTML = '';
    } catch (err) {
      console.error('Ошибка создания группового чата:', err);
      showAlert('Не удалось создать групповой чат', 'error');
    }
  }

  // Прокрутка к последнему сообщению
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    scrollToBottomBtn.style.display = 'none';
    isAtBottom = true;
  }

  // Показ уведомлений
  function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    document.getElementById('alert-container').appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
  }

  // Форматирование времени
  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString();
  }

  // Форматирование размера файла
  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // Показ модального окна пересылки
  async function showForwardModal(message) {
    forwardModal.style.display = 'flex';
    forwardSearch.value = '';
    forwardSearchResults.innerHTML = '';
    await searchForwardChats('');
  }

  // Поиск чатов для пересылки
  async function searchForwardChats(query) {
    try {
      const response = await fetch(
        `${BASE_URL}/api/personal-chats?query=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }
      );
      if (!response.ok) {
        throw new Error(`Ошибка поиска чатов: ${response.status}`);
      }
      const chats = await response.json();
      forwardSearchResults.innerHTML = '';
      chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.innerHTML = `
          <img src="${chat.participant_avatar || '/IMG/user_default.png'}" class="chat-avatar">
          <div class="chat-info">
            <div class="chat-name">${chat.title}</div>
          </div>
        `;
        chatItem.addEventListener('click', () => forwardMessage(chat.chat_id, message));
        forwardSearchResults.appendChild(chatItem);
      });
    } catch (err) {
      console.error('Ошибка поиска чатов для пересылки:', err);
      showAlert('Не удалось найти чаты', 'error');
    }
  }

  // Пересылка сообщения
  async function forwardMessage(chatId, message) {
    try {
      const response = await fetch(`${BASE_URL}/api/personal-chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: message.content,
          forwarded_from: message.sender_id,
          attachment_id: message.attachment_id
        })
      });
      if (!response.ok) {
        throw new Error(`Ошибка пересылки сообщения: ${response.status}`);
      }
      forwardModal.style.display = 'none';
      showAlert('Сообщение переслано', 'success');
    } catch (err) {
      console.error('Ошибка пересылки сообщения:', err);
      showAlert('Не удалось переслать сообщение', 'error');
    }
  }

  // Загрузка медиа и документов
  async function loadMedia() {
    try {
      const response = await fetch(`${BASE_URL}/api/personal-chats/${currentChatId}/media`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (!response.ok) {
        throw new Error(`Ошибка загрузки медиа: ${response.status}`);
      }
      const media = await response.json();
      mediaGrid.innerHTML = '';
      media.forEach(item => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        if (item.file_type?.startsWith('image')) {
          mediaItem.innerHTML = `
            <img src="/api/files/${item.attachment_id}" alt="${item.file_name}">
          `;
        } else {
          mediaItem.innerHTML = `
            <i class="fas fa-file"></i>
            <div class="file-info">
              <div class="file-name">${item.file_name}</div>
              <div class="file-size">${formatFileSize(item.file_size)}</div>
            </div>
          `;
        }
        mediaItem.addEventListener('click', () => window.open(`/api/files/${item.attachment_id}`, '_blank'));
        mediaGrid.appendChild(mediaItem);
      });
      mediaGrid.style.display = 'grid';
    } catch (err) {
      console.error('Ошибка загрузки медиа:', err);
      showAlert('Не удалось загрузить медиа', 'error');
    }
  }

  // Поиск сообщений в чате
  async function searchMessagesInChat(query) {
    if (!currentChatId) {
      showAlert('Выберите чат для поиска', 'warning');
      return;
    }
    try {
      const response = await fetch(
        `${BASE_URL}/api/personal-chats/${currentChatId}/search?q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }
      );
      if (!response.ok) {
        throw new Error(`Ошибка поиска сообщений: ${response.status}`);
      }
      const messages = await response.json();
      chatSearchResults.innerHTML = '';
      messages.forEach(message => {
        const messageItem = document.createElement('div');
        messageItem.className = 'search-message-item';
        messageItem.innerHTML = `
          <div class="search-message-content">${formatMessageText(message.content)}</div>
          <div class="search-message-info">
            <span class="search-message-sender">${message.username}</span>
            <span class="search-message-time">${formatTime(message.sent_at)}</span>
          </div>
        `;
        messageItem.addEventListener('click', () => {
          // Прокрутить к сообщению в чате
          const messageElement = document.querySelector(`.message[data-message-id="${message.message_id}"]`);
          if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageElement.classList.add('highlight');
            setTimeout(() => messageElement.classList.remove('highlight'), 2000);
          }
          searchChatModal.style.display = 'none';
        });
        chatSearchResults.appendChild(messageItem);
      });
      chatSearchResults.style.display = messages.length > 0 ? 'block' : 'none';
    } catch (err) {
      console.error('Ошибка поиска сообщений:', err);
      showAlert('Не удалось найти сообщения', 'error');
    }
  }

  // Очистка чата
  async function clearChat() {
    if (!currentChatId) {
      showAlert('Выберите чат для очистки', 'warning');
      return;
    }
    if (!confirm('Вы уверены, что хотите очистить чат? Это действие нельзя отменить.')) {
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/api/personal-chats/${currentChatId}/clear`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (!response.ok) {
        throw new Error(`Ошибка очистки чата: ${response.status}`);
      }
      chatContextMenu.style.display = 'none';
    } catch (err) {
      console.error('Ошибка очистки чата:', err);
      showAlert('Не удалось очистить чат', 'error');
    }
  }

  // Закрепление/открепление чата
  async function pinChat() {
    if (!currentChatId) {
      showAlert('Выберите чат для закрепления', 'warning');
      return;
    }
    try {
      const chatItem = document.querySelector(`.chat-item[data-chat-id="${currentChatId}"]`);
      const isPinned = chatItem.classList.contains('pinned');
      const response = await fetch(`${BASE_URL}/api/personal-chats/${currentChatId}/pin`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pinned: !isPinned })
      });
      if (!response.ok) {
        throw new Error(`Ошибка закрепления чата: ${response.status}`);
      }
      chatContextMenu.style.display = 'none';
    } catch (err) {
      console.error('Ошибка закрепления чата:', err);
      showAlert('Не удалось закрепить чат', 'error');
    }
  }

  // Показ контекстного меню чата
  function showChatContextMenu(e) {
    e.preventDefault();
    chatContextMenu.style.display = 'block';
    chatContextMenu.style.left = `${e.pageX}px`;
    chatContextMenu.style.top = `${e.pageY}px`;

    // Обновить текст пункта "Закрепить чат"
    const pinItem = chatContextMenu.querySelector('[data-action="pin-chat"]');
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${currentChatId}"]`);
    pinItem.textContent = chatItem.classList.contains('pinned') ? 'Открепить чат' : 'Закрепить чат';

    document.addEventListener('click', hideChatContextMenu, { once: true });
  }

  function hideChatContextMenu() {
    chatContextMenu.style.display = 'none';
  }

  // Установка обработчиков событий
  function setupEventListeners() {
    // Отправка сообщения
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Набор текста
    messageInput.addEventListener('input', () => {
      if (!currentChatId) return;
      if (!isTyping) {
        isTyping = true;
        ws.send(JSON.stringify({
          type: 'typing',
          chatId: currentChatId,
          userId: currentUser.user_id,
          isTyping: true
        }));
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        ws.send(JSON.stringify({
          type: 'typing',
          chatId: currentChatId,
          userId: currentUser.user_id,
          isTyping: false
        }));
      }, 2000);
    });

    // Поиск чатов
    chatSearch.addEventListener('input', () => {
      searchChats(chatSearch.value);
    });

    // Новый чат
    newChatBtn.addEventListener('click', () => {
      newChatModal.style.display = 'flex';
      userSearch.focus();
    });

    // Закрытие модального окна нового чата
    document.getElementById('close-modal').addEventListener('click', () => {
      newChatModal.style.display = 'none';
      userSearchResults.innerHTML = '';
      userSearch.value = '';
    });

    // Поиск пользователей
    userSearch.addEventListener('input', () => {
      searchUsers(userSearch.value);
    });

    // Закрытие модального окна
    newChatModal.addEventListener('click', (e) => {
      if (e.target === newChatModal) {
        newChatModal.style.display = 'none';
        userSearchResults.innerHTML = '';
        userSearch.value = '';
      }
    });

    // Создание группового чата
    createGroupBtn.addEventListener('click', createGroupChat);

    // Просмотр профиля
    viewProfileBtn.addEventListener('click', async () => {
      if (!currentChatId) return;
      try {
        const chatInfo = await fetchChatInfo(currentChatId);
        const otherUserId = chatInfo.participant_ids.find(id => id !== currentUser.user_id);
        const response = await fetch(`${BASE_URL}/api/users/${otherUserId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки профиля');
        const user = await response.json();
        profilePanel.querySelector('#profile-avatar').src = 
          user.has_avatar ? `/api/user/avatar?id=${user.user_id}` : '/IMG/user_default.png';
        profilePanel.querySelector('#profile-full-name').textContent = user.full_name;
        profilePanel.querySelector('#profile-position').textContent = user.position_name || 'Не указана';
        profilePanel.querySelector('#profile-phone span').textContent = user.phone || 'Не указан';
        profilePanel.querySelector('#profile-telegram span').textContent = user.telegram_id || 'Не указан';
        profilePanel.querySelector('#profile-role span').textContent = user.role_name || 'Не указана';
        profilePanel.querySelector('#profile-status').className = 
          user.is_online ? 'status-online' : 'status-offline';
        profilePanel.style.display = 'block';
      } catch (err) {
        console.error('Ошибка загрузки профиля:', err);
        showAlert('Не удалось загрузить профиль', 'error');
      }
    });

    // Закрытие профиля
    closeProfileBtn.addEventListener('click', () => {
      profilePanel.style.display = 'none';
    });

    // Сворачивание боковой панели
    minimizeSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('minimized');
      minimizeSidebarBtn.querySelector('i').classList.toggle('fa-chevron-left');
      minimizeSidebarBtn.querySelector('i').classList.toggle('fa-chevron-right');
    });

    // Отмена ответа
    cancelReplyBtn.addEventListener('click', () => {
      replyToMessage = null;
      replyInfo.style.display = 'none';
    });

    // Прикрепление файла
    attachFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    // Прокрутка чата
    chatMessages.addEventListener('scroll', () => {
      const isNowAtBottom = chatMessages.scrollTop + chatMessages.clientHeight >= 
                           chatMessages.scrollHeight - 10;
      if (isNowAtBottom && !isAtBottom) {
        scrollToBottom();
      } else if (!isNowAtBottom && isAtBottom) {
        isAtBottom = false;
        scrollToBottomBtn.style.display = 'block';
      }
    });

    // Прокрутка к последнему сообщению
    scrollToBottomBtn.addEventListener('click', scrollToBottom);

    // Пересылка сообщения
    forwardModal.addEventListener('click', (e) => {
      if (e.target === forwardModal) {
        forwardModal.style.display = 'none';
      }
    });

    document.getElementById('close-forward-modal').addEventListener('click', () => {
      forwardModal.style.display = 'none';
    });

    forwardSearch.addEventListener('input', () => {
      searchForwardChats(forwardSearch.value);
    });

    // Загрузка медиа при открытии панели
    document.getElementById('view-media').addEventListener('click', () => {
      if (!currentChatId) {
        showAlert('Выберите чат для просмотра медиа', 'warning');
        return;
      }
      loadMedia();
    });

    // Поиск в чате
    searchInChatBtn.addEventListener('click', () => {
      if (!currentChatId) {
        showAlert('Выберите чат для поиска', 'warning');
        return;
      }
      searchChatModal.style.display = 'flex';
      chatMessageSearch.focus();
    });

    chatMessageSearch.addEventListener('input', () => {
      searchMessagesInChat(chatMessageSearch.value);
    });

    closeSearchModalBtn.addEventListener('click', () => {
      searchChatModal.style.display = 'none';
      chatMessageSearch.value = '';
      chatSearchResults.innerHTML = '';
    });

    searchChatModal.addEventListener('click', (e) => {
      if (e.target === searchChatModal) {
        searchChatModal.style.display = 'none';
        chatMessageSearch.value = '';
        chatSearchResults.innerHTML = '';
      }
    });

    // Контекстное меню чата
    chatMenuBtn.addEventListener('click', showChatContextMenu);

    chatContextMenu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'clear-chat') {
        clearChat();
      } else if (action === 'pin-chat') {
        pinChat();
      }
    });
  }

  // Инициализация приложения
  init();
});