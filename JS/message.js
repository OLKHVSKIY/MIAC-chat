// Объявляем userInput здесь
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
window.chatWindow = document.getElementById('chat-window');


// Обработчик для кнопки отправки
sendBtn.addEventListener('click', sendMessage);

// Обработчик для клавиши Enter
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Предотвращаем стандартное поведение Enter
        sendMessage(); // Отправляем сообщение
    }
});

async function sendMessage() {
    const messageText = userInput.value.trim();
    if (messageText === '' || isWaitingForResponse) return;

    // Сброс флага остановки
    stopGeneration = false;
    
    // Сообщение пользователя
    const userMessage = document.createElement('div');
    userMessage.classList.add('message', 'user-message');
    userMessage.innerHTML = `
        ${messageText}
        <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
    `;
    chatWindow.appendChild(userMessage);

    userInput.value = '';
    chatWindow.scrollTop = chatWindow.scrollHeight;
    hasSentMessage = true;
    isWaitingForResponse = true;
    
    // Меняем кнопку на "Стоп"
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-stop"></i>';

    if (activeChat && activeChat.querySelector('span').textContent === 'Новый чат') {
        updateChatName(activeChat, messageText);
    }

    try {
        // Индикатор набора с аватаркой
        const typingContainer = document.createElement('div');
        typingContainer.classList.add('message-container');
        
        const typingAvatar = document.createElement('div');
        typingAvatar.classList.add('avatar', 'bot-avatar');
        
        const typingContent = document.createElement('div');
        typingContent.classList.add('message-content');
        
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'bot-message', 'typing');
        typingIndicator.innerHTML = `<div class="typing-dots"><div></div><div></div><div></div></div>`;
        
        typingContent.appendChild(typingIndicator);
        typingContainer.appendChild(typingAvatar);
        typingContainer.appendChild(typingContent);
        chatWindow.appendChild(typingContainer);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        const response = await fetch(`${API_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "codellama:7b", 
                prompt: messageText,
                stream: false
            })
        });

        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Unknown error');

        chatWindow.removeChild(typingContainer);

        // Сообщение бота с аватаркой
        const botContainer = document.createElement('div');
        botContainer.classList.add('message-container');
        
        const botAvatar = document.createElement('div');
        botAvatar.classList.add('avatar', 'bot-avatar');
        
        const botContent = document.createElement('div');
        botContent.classList.add('message-content');
        
        const botMessage = document.createElement('div');
        botMessage.classList.add('message', 'bot-message');
        
        // Добавляем кнопку копирования
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-icon');
        copyButton.title = 'Копировать';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        botMessage.appendChild(copyButton);
        
        // Эффект печатающегося сообщения
        const fullText = (data.response || '').replace(/\n/g, '<br>');
        let i = 0;
        const typingSpeed = 20;
        
        async function typeWriter() {
            if (i < fullText.length && !stopGeneration) {
                // Вставляем текст посимвольно перед кнопкой копирования
                botMessage.insertBefore(
                    document.createTextNode(fullText.charAt(i)), 
                    copyButton
                );
                i++;
                chatWindow.scrollTop = chatWindow.scrollHeight;
                await new Promise(resolve => setTimeout(resolve, typingSpeed));
                return typeWriter();
            }
        }
        
        botContent.appendChild(botMessage);
        botContainer.appendChild(botAvatar);
        botContainer.appendChild(botContent);
        chatWindow.appendChild(botContainer);
        
        await typeWriter();

    } catch (error) {
        const errorContainer = document.createElement('div');
        errorContainer.classList.add('message-container');
        
        const errorAvatar = document.createElement('div');
        errorAvatar.classList.add('avatar', 'bot-avatar');
        
        const errorContent = document.createElement('div');
        errorContent.classList.add('message-content');
        
        const errorMessage = document.createElement('div');
        errorMessage.classList.add('message', 'bot-message', 'error');
        errorMessage.textContent = `Ошибка: ${error.message}`;
        
        errorContent.appendChild(errorMessage);
        errorContainer.appendChild(errorAvatar);
        errorContainer.appendChild(errorContent);
        chatWindow.appendChild(errorContainer);
    } finally {
        isWaitingForResponse = false;
        // Возвращаем обычную кнопку
        document.getElementById('send-btn').innerHTML = '<i class="fas fa-arrow-up"></i>';
        chatWindow.scrollTop = chatWindow.scrollHeight;
        addCopyHandlers();
    }
}