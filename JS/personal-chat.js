document.addEventListener('DOMContentLoaded', function () {
  // Текущий пользователь и активный чат
  let currentUser = null;
  let activeChatId = null;
  let activePartnerId = null;
  let ws = null;
  let currentAttachment = null;

  // Элементы DOM
  const chatList = document.getElementById('chat-list');
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-message');
  const partnerName = document.getElementById('partner-name');
  const partnerAvatar = document.getElementById('partner-avatar');
  const partnerStatus = document.getElementById('partner-status');
  const profilePanel = document.getElementById('profile-panel');
  const viewProfileButton = document.getElementById('view-profile');
  const closeProfileButton = document.getElementById('close-profile');
  const profileName = document.getElementById('profile-name');
  const profilePosition = document.getElementById('profile-position');
  const profilePhone = document.getElementById('profile-phone');
  const profileTelegram = document.getElementById('profile-telegram');
  const profileAvatar = document.getElementById('profile-avatar');
  const mediaGrid = document.getElementById('media-grid');
  const minimizeSidebar = document.getElementById('minimize-sidebar');
  const chatSidebar = document.querySelector('.chat-sidebar');
  const attachFileButton = document.getElementById('attach-file');
  const fileInput = document.getElementById('file-input');

  // Проверяем существование элементов перед добавлением обработчиков
  if (sendButton) sendButton.addEventListener('click', sendMessage);
  if (viewProfileButton) viewProfileButton.addEventListener('click', () => {
      profilePanel.classList.add('active');
  });
  if (closeProfileButton) closeProfileButton.addEventListener('click', () => {
      profilePanel.classList.remove('active');
  });
  if (minimizeSidebar) minimizeSidebar.addEventListener('click', () => {
      chatSidebar.classList.toggle('minimized');
  });
  if (attachFileButton) attachFileButton.addEventListener('click', () => {
      fileInput.click();
  });
  if (fileInput) fileInput.addEventListener('change', handleFileUpload);

  // Инициализация приложения
  init();

  function init() {
    // Проверяем токен в localStorage (общий для чата с нейросетью и чата сотрудников)
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    
    loadCurrentUser();
    connectWebSocket();
  }

  // Загрузка данных текущего пользователя
  function loadCurrentUser() {
    const userData = localStorage.getItem('userData');
    if (userData) {
      currentUser = JSON.parse(userData);
      loadChats();
    } else {
      fetch('/api/user/profile', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      })
        .then((response) => {
          if (!response.ok) throw new Error('Ошибка загрузки профиля');
          return response.json();
        })
        .then((data) => {
          currentUser = data;
          localStorage.setItem('userData', JSON.stringify(data));
          loadChats();
        })
        .catch((error) => {
          console.error('Ошибка:', error);
          window.location.href = '/login';
        });
    }
  }
  
    // Загрузка списка чатов
    function loadChats() {
      fetch('/api/personal-chats', {
        credentials: 'include',
      })
        .then((response) => {
          if (!response.ok) throw new Error('Ошибка загрузки чатов');
          return response.json();
        })
        .then((chats) => {
          renderChatList(chats);
          // Если есть чаты, открываем первый
          if (chats.length > 0 && !activeChatId) {
            openChat(chats[0].chat_id, chats[0].partner_id);
          }
        })
        .catch((error) => {
          console.error('Ошибка:', error);
        });
    }
  
    // Отображение списка чатов
    function renderChatList(chats) {
      chatList.innerHTML = '';
      chats.forEach((chat) => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        if (chat.chat_id === activeChatId) {
          chatItem.classList.add('active');
        }
        chatItem.innerHTML = `
                  <img src="/api/user/avatar?id=${chat.partner_id}" alt="Аватар" class="chat-avatar" onerror="this.src='https://via.placeholder.com/50'">
                  <div class="chat-info">
                      <div class="chat-name">${chat.partner_name}</div>
                      <div class="chat-last-message">${chat.last_message || 'Нет сообщений'}</div>
                      <div class="chat-time">${formatTime(chat.last_message_time)}</div>
                  </div>
              `;
        chatItem.addEventListener('click', () => {
          openChat(chat.chat_id, chat.partner_id);
        });
        chatList.appendChild(chatItem);
      });
    }
  
    // Открытие чата
    function openChat(chatId, partnerId) {
      activeChatId = chatId;
      activePartnerId = partnerId;
      // Обновляем активный элемент в списке чатов
      document.querySelectorAll('.chat-item').forEach((item) => {
        item.classList.remove('active');
      });
      const activeItem = [...document.querySelectorAll('.chat-item')].find(
        (item) => item.dataset.chatId === chatId
      );
      if (activeItem) activeItem.classList.add('active');
  
      // Загружаем сообщения
      loadMessages(chatId);
      // Загружаем информацию о собеседнике
      loadPartnerInfo(partnerId);
    }
  
    // Загрузка сообщений чата
    function loadMessages(chatId) {
      fetch(`/api/personal-chats/${chatId}/messages`, {
        credentials: 'include',
      })
        .then((response) => {
          if (!response.ok) throw new Error('Ошибка загрузки сообщений');
          return response.json();
        })
        .then((messages) => {
          renderMessages(messages);
          scrollToBottom();
        })
        .catch((error) => {
          console.error('Ошибка:', error);
        });
    }
  
    // Отображение сообщений
    function renderMessages(messages) {
      chatMessages.innerHTML = '';
      messages.forEach((message) => {
        const isMyMessage = message.sender_id === currentUser.user_id;
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isMyMessage ? 'my-message' : ''}`;
        let contentHtml = `<div class="message-content">${escapeHtml(message.content)}</div>`;
  
        if (message.attachment_id) {
          if (message.file_type.startsWith('image/')) {
            contentHtml = `
                          <div class="attachment">
                              <img src="/api/attachments/${message.attachment_id}" alt="Вложение" onerror="this.src='https://via.placeholder.com/100x100?text=Ошибка';">
                          </div>
                          ${contentHtml}
                      `;
          } else {
            const fileIcon = getFileIcon(message.file_type);
            contentHtml = `
                          <div class="attachment-file">
                              <div class="attachment-icon">${fileIcon}</div>
                              <div class="file-info">
                                  <div class="file-name">${message.file_name}</div>
                                  <div class="file-size">${formatFileSize(message.file_size)}</div>
                              </div>
                          </div>
                          ${contentHtml}
                      `;
          }
        }
  
        messageElement.innerHTML = `
                  ${isMyMessage ? '' : `
                      <div class="message-with-avatar">
                          <img src="/api/user/avatar?id=${message.sender_id}" alt="Аватар" class="message-avatar" onerror="this.src='https://via.placeholder.com/30';">
                          <div>${contentHtml}</div>
                      </div>
                  `}
                  ${isMyMessage ? contentHtml : ''}
                  <div class="message-info">
                      ${formatTime(message.timestamp)}
                  </div>
              `;
        chatMessages.appendChild(messageElement);
      });
    }
  
    // Загрузка информации о собеседнике
    function loadPartnerInfo(partnerId) {
      fetch(`/api/user/profile?id=${partnerId}`, {
        credentials: 'include',
      })
        .then((response) => {
          if (!response.ok) throw new Error('Ошибка загрузки профиля');
          return response.json();
        })
        .then((profile) => {
          partnerName.textContent = profile.full_name;
          partnerAvatar.src = `/api/user/avatar?id=${partnerId}`;
          partnerAvatar.onerror = () => {
            partnerAvatar.src = 'https://via.placeholder.com/40';
          };
  
          // Для профиля
          profileName.textContent = profile.full_name;
          profilePosition.textContent = profile.position_name || 'Должность не указана';
          profilePhone.textContent = profile.phone || 'Телефон не указан';
          profileTelegram.textContent = profile.telegram_id ? `@${profile.telegram_id}` : 'Telegram не указан';
          profileAvatar.src = `/api/user/avatar?id=${partnerId}`;
          profileAvatar.onerror = () => {
            profileAvatar.src = 'https://via.placeholder.com/120';
          };
  
          // Загружаем медиафайлы чата
          loadChatMedia(partnerId);
        })
        .catch((error) => {
          console.error('Ошибка:', error);
        });
    }
  
    // Загрузка медиафайлов чата для профиля
    function loadChatMedia(partnerId) {
      fetch(`/api/personal-chats/media?chat_id=${activeChatId}&partner_id=${partnerId}`, {
        credentials: 'include',
      })
        .then((response) => {
          if (!response.ok) throw new Error('Ошибка загрузки медиа');
          return response.json();
        })
        .then((media) => {
          renderMediaGrid(media);
        })
        .catch((error) => {
          console.error('Ошибка:', error);
        });
    }
  
    // Отображение медиафайлов в профиле
    function renderMediaGrid(media) {
      mediaGrid.innerHTML = '';
      media.forEach((item) => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        if (item.file_type.startsWith('image/')) {
          mediaItem.innerHTML = `<img src="/api/attachments/${item.attachment_id}" alt="Медиа" onerror="this.src='https://via.placeholder.com/100x100?text=Ошибка';">`;
        } else {
          mediaItem.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">${getFileIcon(item.file_type)}</div>`;
        }
        mediaItem.addEventListener('click', () => {
          previewAttachment(item);
        });
        mediaGrid.appendChild(mediaItem);
      });
    }
  
    // Превью вложения
    function previewAttachment(attachment) {
      const previewWindow = window.open('', '_blank');
      if (attachment.file_type.startsWith('image/')) {
        previewWindow.document.write(`<img src="/api/attachments/${attachment.attachment_id}" style="width:100%; height:auto;">`);
      } else {
        previewWindow.document.write(`<p>Просмотр файла: ${attachment.file_name}</p><a href="/api/attachments/${attachment.attachment_id}" target="_blank">Скачать</a>`);
      }
    }
  
    // Отправка сообщения
    function sendMessage() {
      const content = messageInput.value.trim();
      if (!content && !currentAttachment) return;
  
      const messageData = {
        chat_id: activeChatId,
        content: content,
        attachment_id: currentAttachment?.id || null,
      };
  
      fetch('/api/personal-chats/messages', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      })
        .then((response) => {
          if (!response.ok) throw new Error('Ошибка отправки сообщения');
          return response.json();
        })
        .then((message) => {
          messageInput.value = '';
          currentAttachment = null;
          loadMessages(activeChatId);
        })
        .catch((error) => {
          console.error('Ошибка:', error);
          alert('Не удалось отправить сообщение');
        });
    }
  
    // Подключение WebSocket
    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      const wsUrl = protocol + window.location.host + '/ws';
      ws = new WebSocket(wsUrl);
  
      ws.onopen = () => {
        console.log('WebSocket connected');
        // Отправляем токен для аутентификации
        ws.send(
          JSON.stringify({
            type: 'auth',
            token: localStorage.getItem('authToken')
          })
        );
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          // Если сообщение для активного чата
          if (data.data.chat_id === activeChatId) {
            loadMessages(activeChatId);
          } else {
            // Обновляем список чатов
            loadChats();
          }
        }
      };
  
      ws.onclose = () => {
        console.log('WebSocket disconnected, trying to reconnect...');
        setTimeout(connectWebSocket, 5000);
      };
  
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    }
  
    // Настройка обработчиков событий
    function setupEventListeners() {
      // Отправка сообщения по кнопке
      sendButton.addEventListener('click', sendMessage);
  
      // Отправка сообщения по Enter
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
  
      // Просмотр профиля
      viewProfileButton.addEventListener('click', () => {
        profilePanel.classList.add('active');
      });
  
      // Закрытие профиля
      closeProfileButton.addEventListener('click', () => {
        profilePanel.classList.remove('active');
      });
  
      // Минимизация боковой панели
      minimizeSidebar.addEventListener('click', () => {
        chatSidebar.classList.toggle('minimized');
      });
  
      // Прикрепление файлов
      attachFileButton.addEventListener('click', () => {
        fileInput.click();
      });
  
      fileInput.addEventListener('change', handleFileUpload);
    }
  
    // Обработка загрузки файла
    function handleFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
  
      const formData = new FormData();
      formData.append('file', file);
  
      fetch('/api/attachments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData,
      })
        .then((response) => {
          if (!response.ok) throw new Error('Ошибка загрузки файла');
          return response.json();
        })
        .then((attachment) => {
          currentAttachment = attachment;
          alert(`Файл "${attachment.file_name}" готов к отправке`);
        })
        .catch((error) => {
          console.error('Ошибка:', error);
          alert('Не удалось загрузить файл');
        });
    }
  
    // Вспомогательные функции
  
    function formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  
    function getFileIcon(fileType) {
      if (fileType.includes('word')) return '<i class="fas fa-file-word"></i>';
      if (fileType.includes('excel') || fileType.includes('spreadsheet'))
        return '<i class="fas fa-file-excel"></i>';
      if (fileType.includes('powerpoint') || fileType.includes('presentation'))
        return '<i class="fas fa-file-powerpoint"></i>';
      if (fileType.includes('pdf')) return '<i class="fas fa-file-pdf"></i>';
      if (fileType.includes('zip') || fileType.includes('compressed'))
        return '<i class="fas fa-file-archive"></i>';
      return '<i class="fas fa-file"></i>';
    }
  
    function escapeHtml(unsafe) {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
    }
  
    function scrollToBottom() {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  
    // Инициализация кнопки открытия чата
    document.getElementById('open-chat-btn').addEventListener('click', function () {
      window.open('/personal-chat.html', '_blank');
    });
  });