window.codeHighlight = {
    highlightCode: function(text) {
        if (!text) return { text: '', hasCode: false };

        // Обработка Markdown
        text = this.processMarkdown(text);

        // Регулярки для блоков кода
        const codeBlockRegex = /```(\w+)?\n([\s\S]+?)\n```/g;
        const inlineCodeRegex = /`([^`]+)`/g;
        let hasCode = false;
        let processedText = text;

        // Обработка блоков кода ```
        processedText = processedText.replace(codeBlockRegex, (match, lang, code) => {
            hasCode = true;
            lang = (lang || 'plaintext').toLowerCase().trim();
            const formattedCode = this.formatCode(code.trim(), lang);
            return `<div class="code-block-wrapper" data-lang="${lang}">
                      <div class="code-header">
                        <span class="language-label">${lang}</span>
                        <button class="copy-code-btn" title="Copy code">
                          <span class="copy-text">Copy</span>
                          <span class="check-icon" style="display:none;">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                            </svg>
                            Copied!
                          </span>
                        </button>
                      </div>
                      <pre class="code-block language-${lang}">${formattedCode}</pre>
                    </div>`;
        });

        // Обработка inline кода
        processedText = processedText.replace(inlineCodeRegex, '<code class="inline-code">$1</code>');

        return { text: processedText, hasCode };
    },

    processMarkdown: function(text) {
        // Заголовки
        text = text.replace(/^#\s+(.*$)/gm, '<h1>$1</h1>')
                  .replace(/^##\s+(.*$)/gm, '<h2>$1</h2>')
                  .replace(/^###\s+(.*$)/gm, '<h3>$1</h3>');
        
        // Жирный текст
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Курсив
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Списки
        text = text.replace(/^\-\s+(.*$)/gm, '<li>$1</li>')
                  .replace(/^\*\s+(.*$)/gm, '<li>$1</li>')
                  .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>');
        
        // Блоки цитат
        text = text.replace(/^\>\s+(.*$)/gm, '<blockquote>$1</blockquote>');
        
        return text;
    },

    formatCode: function(code, lang) {
        // Экранирование HTML
        code = code.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#39;');

        // Замена пробелов и табов
        code = code.replace(/ /g, '&nbsp;')
                  .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
                  .replace(/\n/g, '<br>');

        // Подсветка в зависимости от языка
        const highlightMethod = this[`highlight_${lang}`] || this.highlight_generic;
        return highlightMethod.call(this, code);
    },

    // Python подсветка
    highlight_python: function(code) {
        const keywords = ['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
                        'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
                        'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
                        'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
                        'try', 'while', 'with', 'yield'];
        
        // Ключевые слова
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="keyword">${kw}</span>`);
        });
        
        // Декораторы
        code = code.replace(/@[\w.]+/g, '<span class="decorator">$&</span>');
        
        // Строки
        code = code.replace(/(['"])(.*?)\1/g, '<span class="string">$&</span>');
        
        // Числа
        code = code.replace(/\b\d+(\.\d+)?\b/g, '<span class="number">$&</span>');
        
        // Комментарии
        code = code.replace(/#.*?(?=<br>|$)/g, '<span class="comment">$&</span>');
        
        return code;
    },

    // JavaScript подсветка
    highlight_javascript: function(code) {
        const keywords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
                        'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
                        'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
                        'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
                        'var', 'void', 'while', 'with', 'yield', 'let', 'await'];
        
        // Ключевые слова
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="keyword">${kw}</span>`);
        });
        
        // Константы
        code = code.replace(/\b(true|false|null|undefined)\b/g, '<span class="constant">$&</span>');
        
        // Функции
        code = code.replace(/(\w+)(?=\()/g, '<span class="function">$1</span>');
        
        // Строки
        code = code.replace(/(['"`])(.*?)\1/g, '<span class="string">$&</span>');
        
        // Комментарии
        code = code.replace(/\/\/.*?(?=<br>|$)/g, '<span class="comment">$&</span>')
                  .replace(/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>');
        
        return code;
    },

    // HTML подсветка
    highlight_html: function(code) {
        // Теги
        code = code.replace(/&lt;\/?(\w+)/g, '&lt;<span class="tag">$1</span>')
                  .replace(/&lt;\/\w+&gt;/g, '<span class="tag">$&</span>');
        
        // Атрибуты
        code = code.replace(/(\s\w+)=/g, '<span class="attribute">$1</span>=');
        
        // Значения атрибутов
        code = code.replace(/=([\"\'])(.*?)\1/g, '=<span class="value">$1$2$1</span>');
        
        // Комментарии
        code = code.replace(/&lt;!--[\s\S]*?--&gt;/g, '<span class="comment">$&</span>');
        
        return code;
    },

    // CSS подсветка
    highlight_css: function(code) {
        // Свойства
        code = code.replace(/([\w-]+)\s*:/g, '<span class="property">$1</span>:');
        
        // Значения
        code = code.replace(/:\s*([^;}]+)/g, ': <span class="value">$1</span>');
        
        // Селекторы
        code = code.replace(/([^{}]+)\{/g, '<span class="selector">$1</span>{');
        
        // !important
        code = code.replace(/\!important/g, '<span class="important">$&</span>');
        
        return code;
    },

    // SQL подсветка
    highlight_sql: function(code) {
        const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'OUTER', 
                         'LEFT', 'RIGHT', 'GROUP BY', 'HAVING', 'ORDER BY', 
                         'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'gi'), `<span class="keyword">${kw}</span>`);
        });
        
        // Комментарии
        code = code.replace(/--.*?(?=<br>|$)/g, '<span class="comment">$&</span>');
        
        return code;
    },

    // Rust подсветка
    highlight_rust: function(code) {
        const keywords = ['fn', 'let', 'mut', 'impl', 'struct', 'enum', 'trait', 
                        'use', 'mod', 'pub', 'match', 'if', 'else', 'loop', 
                        'while', 'for', 'in', 'return'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="keyword">${kw}</span>`);
        });
        
        // Комментарии
        code = code.replace(/\/\/.*?(?=<br>|$)/g, '<span class="comment">$&</span>');
        
        return code;
    },

    // PHP подсветка
    highlight_php: function(code) {
        // Теги PHP
        code = code.replace(/&lt;\?php/g, '<span class="php-tag">&lt;?php</span>')
                  .replace(/\?&gt;/g, '<span class="php-tag">?&gt;</span>');
        
        // Ключевые слова
        const keywords = ['function', 'class', 'if', 'else', 'foreach', 'while', 
                         'do', 'for', 'switch', 'case', 'return', 'echo', 'print'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="keyword">${kw}</span>`);
        });
        
        // Переменные
        code = code.replace(/\$[\w]+/g, '<span class="variable">$&</span>');
        
        return code;
    },

    // Общая подсветка (если язык не распознан)
    highlight_generic: function(code) {
        return code;
    },

    addCopyButtons: function() {
        document.querySelectorAll('.code-block-wrapper').forEach(wrapper => {
            const btn = wrapper.querySelector('.copy-code-btn');
            if (!btn.hasAttribute('data-listener')) {
                btn.setAttribute('data-listener', 'true');
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    const codeBlock = wrapper.querySelector('.code-block');
                    const range = document.createRange();
                    range.selectNode(codeBlock);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);
                    
                    try {
                        const successful = document.execCommand('copy');
                        if (successful) {
                            const copyIcon = btn.querySelector('.copy-icon');
                            const checkIcon = btn.querySelector('.check-icon');
                            copyIcon.style.display = 'none';
                            checkIcon.style.display = 'block';
                            
                            setTimeout(() => {
                                copyIcon.style.display = 'block';
                                checkIcon.style.display = 'none';
                            }, 2000);
                        }
                    } catch (err) {
                        console.error('Ошибка копирования:', err);
                    }
                    
                    window.getSelection().removeAllRanges();
                });
            }
        });
    },

    init: function() {
        this.addCopyButtons();
        
        // Наблюдатель за изменениями DOM для новых блоков кода
        if (!this.observer) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length) {
                        this.addCopyButtons();
                    }
                });
            });
            
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    },

    // Инициализация копирования при добавлении новых элементов
    addCopyButtons: function() {
        document.querySelectorAll('.code-block-wrapper').forEach(wrapper => {
            const btn = wrapper.querySelector('.copy-code-btn');
            if (!btn.hasAttribute('data-listener')) {
                btn.setAttribute('data-listener', 'true');
                
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const codeBlock = wrapper.querySelector('.code-block');
                    const codeText = codeBlock.textContent;
                    
                    try {
                        await navigator.clipboard.writeText(codeText);
                        
                        // Показываем галочку
                        const copyText = btn.querySelector('.copy-text');
                        const checkIcon = btn.querySelector('.check-icon');
                        
                        copyText.style.display = 'none';
                        checkIcon.style.display = 'inline-flex';
                        checkIcon.style.alignItems = 'center';
                        checkIcon.style.gap = '4px';
                        
                        // Возвращаем обратно через 2 секунды
                        setTimeout(() => {
                            copyText.style.display = 'inline';
                            checkIcon.style.display = 'none';
                        }, 2000);
                        
                    } catch (err) {
                        console.error('Failed to copy: ', err);
                        btn.textContent = 'Error';
                        setTimeout(() => {
                            btn.innerHTML = '<span class="copy-text">Copy</span><span class="check-icon" style="display:none;">✓</span>';
                        }, 2000);
                    }
                });
            }
        });
    }
};

// Инициализация при загрузке страницы (удаляем дублирующийся вызов)
document.addEventListener('DOMContentLoaded', () => {
    if (window.codeHighlight && typeof window.codeHighlight.init === 'function') {
        window.codeHighlight.init();
    }
});