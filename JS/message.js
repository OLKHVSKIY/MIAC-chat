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
    const messageText = userInput.value.trim();
    if (messageText === '' || chatState.isWaitingForResponse) return;

    // Сброс предыдущего состояния
    if (chatState.abortController) {
        chatState.abortController.abort();
    }
    chatState.abortController = new AbortController();
    chatState.isWaitingForResponse = true;
    
    // Создаем сообщение пользователя
    createUserMessage(messageText);
    userInput.value = '';
    
    // Меняем кнопку на "Стоп"
    sendBtn.innerHTML = '<i class="fas fa-stop"></i>';
    sendBtn.onclick = stopGeneration;

    try {
        // Показываем индикатор набора
        const typingIndicator = createTypingIndicator();
        
        // Отправляем запрос
        const response = await fetch(`${API_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "qwen2.5:1.5b",
                prompt: messageText,
                stream: true
            }),
            signal: chatState.abortController.signal
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        // Убираем индикатор набора
        chatWindow.removeChild(typingIndicator);
        
        // Создаем контейнер для сообщения бота
        const botMessage = createBotMessageContainer();
        
        // Обрабатываем потоковые данные
        chatState.currentStreamReader = response.body.getReader();
        await streamResponse(botMessage);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error:', error);
            showErrorMessage(error.message);
        }
    } finally {
        resetChatState();
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
            
            // Обрабатываем новые данные
            const { text: processedText } = window.codeHighlight.highlightCode(accumulatedText);
            
            // Создаем временный элемент для разбора HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = processedText;
            
            // Полностью заменяем содержимое сообщения
            const newContent = extractContent(tempDiv);
            message.innerHTML = '';
            message.appendChild(newContent);
            message.appendChild(copyButton);
            
            // Прокручиваем чат
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    } finally {
        chatState.isTyping = false;
        // Добавляем обработчики копирования
        addCopyHandlers();
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
            const message = e.target.closest('.message');
            const textToCopy = message.textContent.replace('Копировать', '').trim();
            
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