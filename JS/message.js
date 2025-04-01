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
                model: "qwen2.5:1.5b",
                prompt: `You are an AI assistant. Answer in Russian, except for the code. Strictly follow the rules:
                        1. Answer general questions (planets, weather, facts) with text WITHOUT code
                        2. Show the code (SQL/Python/HTML/CSS/Rust/JS/PHP) only when explicitly asked about code.
                        3. Format your answers using Markdown (**bold**, *cursive*).
                        4. Use numbering or markdowns for lists
                        Current question: ${messageText}`,
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
    let isScrolling = false;
    
    // Обработчик ручного скролла пользователем
    chatWindow.addEventListener('scroll', () => {
        isScrolling = true;
    });

    if (i < allNodes.length && !stopGeneration) {
        const node = allNodes[i];
        
        if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent;
            for (let j = 0; j < text.length; j++) {
                if (stopGeneration) break;
                
                const char = text[j];
                const textNode = document.createTextNode(char);
                botMessage.insertBefore(textNode, copyButton);
                
                // Прокручиваем только если пользователь не скроллит вручную
                if (!isScrolling) {
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                }
                
                await new Promise(resolve => setTimeout(resolve, typingSpeed));
            }
        } else {
            const clone = node.cloneNode(true);
            botMessage.insertBefore(clone, copyButton);
            
            if (!isScrolling) {
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
            
            await new Promise(resolve => setTimeout(resolve, typingSpeed * 10));
        }
        
        i++;
        isScrolling = false; // Сбрасываем флаг после обработки узла
        return typeWriter();
    } else if (i >= allNodes.length) {
        // После завершения всегда прокручиваем вниз
        chatWindow.scrollTop = chatWindow.scrollHeight;
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