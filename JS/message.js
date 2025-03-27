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
                prompt: `Отвечай строго в markdown. SQL запросы оформляй в блоки кода с подсветкой синтаксиса:\n\n${messageText}`,
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
        
        // Обрабатываем текст с выделением кода
        const rawText = data.response || '';
        const { text: processedText, hasCode } = window.codeHighlight.highlightCode(rawText);
        
        // Добавляем кнопку копирования
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-icon');
        copyButton.title = 'Копировать';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        botMessage.appendChild(copyButton);
        
        // Эффект печатающегося сообщения
        let i = 0;
        const typingSpeed = 20; // Скорость печати (меньше = быстрее)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedText;
        
        // Создаем плоский список всех текстовых узлов и элементов
        const allNodes = this.flattenNodes(tempDiv.childNodes);
        
        async function typeWriter() {
            if (i < allNodes.length && !stopGeneration) {
                const node = allNodes[i];
                
                if (node.nodeType === Node.TEXT_NODE) {
                    // Для текстовых узлов добавляем по одному символу
                    let text = node.textContent;
                    for (let j = 0; j < text.length; j++) {
                        if (stopGeneration) break;
                        const char = text[j];
                        const textNode = document.createTextNode(char);
                        botMessage.insertBefore(textNode, copyButton);
                        chatWindow.scrollTop = chatWindow.scrollHeight;
                        await new Promise(resolve => setTimeout(resolve, typingSpeed));
                    }
                } else {
                    // Для элементов (блоков кода) добавляем сразу весь блок
                    const clone = node.cloneNode(true);
                    botMessage.insertBefore(clone, copyButton);
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                    // Небольшая пауза после блока кода
                    await new Promise(resolve => setTimeout(resolve, typingSpeed * 10));
                }
                
                i++;
                return typeWriter();
            } else if (i >= allNodes.length) {
                // После завершения печати добавляем обработку кнопок копирования
                if (hasCode) {
                    window.codeHighlight.addCopyButtons();
                }
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

// Вспомогательная функция для "выравнивания" DOM-узлов
function flattenNodes(nodes) {
    const result = [];
    nodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('code-block-wrapper')) {
            // Блоки кода добавляем как есть
            result.push(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Для других элементов рекурсивно обрабатываем их содержимое
            result.push(...this.flattenNodes(node.childNodes));
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            // Текстовые узлы добавляем как есть
            result.push(node);
        }
    });
    return result;
}