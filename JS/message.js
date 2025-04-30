// Глобальные переменные для управления состоянием чата
window.chatState = {
    isWaitingForResponse: false,
    abortController: null,
    currentStreamReader: null,
    isTyping: false
};

const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const chatWindow = document.getElementById('chat-window');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();
    if (!message) return;

    if (!activeChat) {
        await createNewChat();
        return;
    }

    const chatId = activeChat.dataset.id;
    
    // Add user message to UI
    const userMessageElement = createMessageElement('user', message);
    chatWindow.appendChild(userMessageElement);
    userInput.value = '';

    // Save user message
    try {
        await chatStorage.saveMessage(chatId, 'user', message);
    } catch (error) {
        console.error('Ошибка при сохранении сообщения:', error);
    }

    // Show typing indicator
    const typingIndicator = addTypingIndicator();
    isWaitingForResponse = true;
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-stop"></i>';

    try {
        // Get AI response
        const response = await fetch(`${API_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: currentModel,
                prompt: message,
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
        const data = await response.json();

        chatWindow.removeChild(typingIndicator);

        // Add AI response to UI
        const botMessageElement = createMessageElement('bot', data.response);
        chatWindow.appendChild(botMessageElement);

        // Save AI response
        try {
            await chatStorage.saveMessage(chatId, 'bot', data.response);
        } catch (error) {
            console.error('Ошибка при сохранении ответа:', error);
        }

        // Update chat title ONLY if it's the first message in chat
        if (!hasSentMessage) {
            try {
                const messages = await chatStorage.getChatMessages(chatId);
                // Проверяем, что в чате только 2 сообщения (наше только что отправленное и ответ)
                if (messages.length === 2) {
                    const shortTitle = message.substring(0, 30);
                    await chatStorage.updateChatTitle(chatId, shortTitle);
                    updateChatName(activeChat, shortTitle);
                }
            } catch (error) {
                console.error('Ошибка при обновлении названия чата:', error);
            }
            hasSentMessage = true;
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        chatWindow.removeChild(typingIndicator);
        addErrorMessage(`Ошибка: ${error.message}`);
    } finally {
        isWaitingForResponse = false;
        document.getElementById('send-btn').innerHTML = '<i class="fas fa-arrow-up"></i>';
        chatWindow.scrollTop = chatWindow.scrollHeight;
        addCopyHandlers();
    }
}

function stopGeneration() {
    if (chatState.abortController) {
        chatState.abortController.abort();
    }
    resetChatState();
}

function resetChatState() {
    chatState.isWaitingForResponse = false;
    chatState.isTyping = false;
    chatState.abortController = null;
    chatState.currentStreamReader = null;
    
    // Возвращаем обычную кнопку
    sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    sendBtn.onclick = sendMessage;
}

function createUserMessage(text) {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container user-message-container';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message user-message';
    messageElement.innerHTML = `
        ${escapeHtml(text)}
        <button class="copy-icon" title="Копировать"><i class="fas fa-copy"></i></button>
    `;
    
    messageContent.appendChild(messageElement);
    messageContainer.appendChild(messageContent);
    chatWindow.appendChild(messageContainer);
    
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return messageContainer;
}

function createTypingIndicator() {
    const typingContainer = document.createElement('div');
    typingContainer.className = 'message-container bot-message-container';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';
    
    const typingElement = document.createElement('div');
    typingElement.className = 'message bot-message typing';
    typingElement.innerHTML = '<div class="typing-dots"><div></div><div></div><div></div></div>';
    
    typingContent.appendChild(typingElement);
    typingContainer.appendChild(typingContent);
    chatWindow.appendChild(typingContainer);
    
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return typingContainer;
}

function createBotMessageContainer() {
    const container = document.createElement('div');
    container.className = 'message-container bot-message-container';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const message = document.createElement('div');
    message.className = 'message bot-message';
    
    // Добавляем кнопку копирования
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-icon';
    copyButton.title = 'Копировать';
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    message.appendChild(copyButton);
    
    content.appendChild(message);
    container.appendChild(content);
    chatWindow.appendChild(container);
    
    return { container, message, copyButton };
}

async function streamResponse({ container, message, copyButton }) {
    const decoder = new TextDecoder();
    let accumulatedText = '';
    chatState.isTyping = true;
    
    try {
        while (true) {
            const { done, value } = await chatState.currentStreamReader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            accumulatedText += chunk;
            
            // Используем message-styling вместо codeHighlight
            const processedHtml = window.messageStyling.processMessageContent(accumulatedText);
            
            // Создаём временный контейнер
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = processedHtml;
            
            // Полностью заменяем содержимое
            message.innerHTML = '';
            message.append(...tempDiv.childNodes);
            
            // Сохраняем кнопку копирования (теперь она в message-styling)
            window.messageStyling.initCopyButtons();

            // Внутри цикла while:
            if (chunk.length > 1000) {
            message.innerHTML = processedHtml + '<div class="message-streaming">...</div>';
            }
            
            // Прокручиваем чат
            chatWindow.scrollTop = chatWindow.scrollHeight;
            
            // Оптимизация: пропускаем рендеринг при быстром потоке
            await new Promise(r => setTimeout(r, 50)); 
        }
    } finally {
        chatState.isTyping = false;
        // Финализируем Markdown-разметку
        const finalHtml = window.messageStyling.processMessageContent(accumulatedText);
        message.innerHTML = finalHtml;
        window.messageStyling.initCopyButtons();
    }
}

function extractContent(element) {
    const fragment = document.createDocumentFragment();
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
            fragment.appendChild(document.createTextNode(node.textContent));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const clone = node.cloneNode(true);
            fragment.appendChild(clone);
        }
    }
    
    return fragment;
}

function showErrorMessage(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'message-container bot-message-container';
    
    const errorContent = document.createElement('div');
    errorContent.className = 'message-content';
    
    const errorElement = document.createElement('div');
    errorElement.className = 'message bot-message error';
    errorElement.textContent = `Ошибка: ${message}`;
    
    errorContent.appendChild(errorElement);
    errorContainer.appendChild(errorContent);
    chatWindow.appendChild(errorContainer);
    
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addCopyHandlers() {
    document.querySelectorAll('.copy-icon').forEach(button => {
        button.addEventListener('click', async (e) => {
            const messageElement = e.target.closest('.message');
            
            // Создаем временный элемент для извлечения текста без времени
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = messageElement.innerHTML;
            
            // Удаляем элемент с временем, если он есть
            const timeElement = tempDiv.querySelector('.message-time');
            if (timeElement) {
                timeElement.remove();
            }
            
            // Удаляем кнопку копирования из текста
            const copyButton = tempDiv.querySelector('.copy-icon');
            if (copyButton) {
                copyButton.remove();
            }
            
            // Получаем чистый текст без времени и кнопки
            const textToCopy = tempDiv.textContent.trim();
            
            try {
                await navigator.clipboard.writeText(textToCopy);
                const icon = button.querySelector('i');
                icon.classList.replace('fa-copy', 'fa-check');
                
                setTimeout(() => {
                    icon.classList.replace('fa-check', 'fa-copy');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}