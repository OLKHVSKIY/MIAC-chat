window.codeHighlight = {
    highlightCode: function(text) {
        if (!text) return { text: '', hasCode: false };

        // Обработка заголовков (### -> <strong>)
        text = text.replace(/^###\s+(.*$)/gm, '<strong>$1</strong>');

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
                        <button class="copy-code-btn"><i class="fas fa-copy"></i></button>
                      </div>
                      <pre class="code-block">${formattedCode}</pre>
                    </div>`;
        });

        // Обработка inline кода `code`
        processedText = processedText.replace(inlineCodeRegex, (match, code) => {
            return `<code class="inline-code">${code}</code>`;
        });

        return { text: processedText, hasCode };
    },

    formatCode: function(code, lang) {
        // Экранируем HTML-теги и сохраняем пробелы
        code = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                   .replace(/ /g, '&nbsp;').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
                   .replace(/\n/g, '<br>');

        // Вызываем соответствующий метод подсветки
        const highlightMethod = this[`highlight_${lang}`] || this.highlight_generic;
        return highlightMethod.call(this, code);
    },

    // Подсветка Python
    highlight_python: function(code) {
        const keywords = ['def', 'class', 'import', 'from', 'if', 'elif', 'else', 
                        'for', 'while', 'try', 'except', 'with', 'return', 'and', 
                        'or', 'not', 'in', 'is', 'None', 'True', 'False', 'async', 'await'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="py-keyword">${kw}</span>`);
        });
        
        // Комментарии и строки
        code = code.replace(/#.*?(?=<br>|$)/g, '<span class="py-comment">$&</span>')
                  .replace(/('.*?'|""".*?"""|".*?")/g, '<span class="py-string">$&</span>');
        
        return code;
    },

    // Подсветка HTML
    highlight_html: function(code) {
        // Теги
        code = code.replace(/&lt;(\/?[\w\-]+)/g, '&lt;<span class="html-tag">$1</span>')
                  .replace(/&lt;\/?([\w\-]+)([^&]*)&gt;/g, '&lt;/$1<span class="html-attr">$2</span>&gt;');
        
        // Атрибуты
        code = code.replace(/(\s[\w\-]+)=/g, '<span class="html-attr">$1</span>=');
        
        return code;
    },

    // Подсветка CSS
    highlight_css: function(code) {
        // Селекторы
        code = code.replace(/([^{}]+)\{/g, '<span class="css-selector">$1</span>{')
                  // Свойства
                  .replace(/([\w\-]+)\s*:/g, '<span class="css-prop">$1</span>:')
                  // Значения
                  .replace(/:\s*([^;}]+)/g, ': <span class="css-value">$1</span>');
        
        return code;
    },

    // Подсветка JavaScript
    highlight_javascript: function(code) {
        const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 
                        'while', 'try', 'catch', 'class', 'import', 'export', 'new', 
                        'this', 'async', 'await', 'return', 'true', 'false', 'null'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="js-keyword">${kw}</span>`);
        });
        
        // Комментарии и строки
        code = code.replace(/\/\/.*?(?=<br>|$)/g, '<span class="js-comment">$&</span>')
                  .replace(/\/\*[\s\S]*?\*\//g, '<span class="js-comment">$&</span>')
                  .replace(/('.*?'|".*?"|`.*?`)/g, '<span class="js-string">$&</span>');
        
        return code;
    },

    // Подсветка SQL
    highlight_sql: function(code) {
        const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'OUTER', 
                         'LEFT', 'RIGHT', 'GROUP BY', 'HAVING', 'ORDER BY', 
                         'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'gi'), `<span class="sql-keyword">${kw}</span>`);
        });
        
        // Комментарии
        code = code.replace(/--.*?(?=<br>|$)/g, '<span class="sql-comment">$&</span>');
        
        return code;
    },

    // Подсветка Rust
    highlight_rust: function(code) {
        const keywords = ['fn', 'let', 'mut', 'impl', 'struct', 'enum', 'trait', 
                        'use', 'mod', 'pub', 'match', 'if', 'else', 'loop', 
                        'while', 'for', 'in', 'return'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="rs-keyword">${kw}</span>`);
        });
        
        // Комментарии
        code = code.replace(/\/\/.*?(?=<br>|$)/g, '<span class="rs-comment">$&</span>');
        
        return code;
    },

    // Подсветка PHP
    highlight_php: function(code) {
        // Теги PHP
        code = code.replace(/&lt;\?php/g, '<span class="php-tag">&lt;?php</span>')
                  .replace(/\?&gt;/g, '<span class="php-tag">?&gt;</span>');
        
        // Ключевые слова
        const keywords = ['function', 'class', 'if', 'else', 'foreach', 'while', 
                         'do', 'for', 'switch', 'case', 'return', 'echo', 'print'];
        
        keywords.forEach(kw => {
            code = code.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="php-keyword">${kw}</span>`);
        });
        
        // Переменные
        code = code.replace(/\$[\w]+/g, '<span class="php-var">$&</span>');
        
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
                btn.addEventListener('click', () => {
                    const codeBlock = wrapper.querySelector('.code-block');
                    let code = '';
    
                    const extractText = (node) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            code += node.textContent;
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'BR') {
                                code += '\n';
                            } else if (node.classList.contains('code-block')) {
                                Array.from(node.childNodes).forEach(extractText);
                            } else {
                                code += node.textContent;
                            }
                        }
                    };
    
                    extractText(codeBlock);
    
                    // Декодирование HTML-сущностей
                    code = code
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&');
    
                    navigator.clipboard.writeText(code).then(() => {
                        btn.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            btn.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 2000);
                    }).catch(err => {
                        console.error('Ошибка копирования:', err);
                    });
                });
            }
        });
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    if (window.codeHighlight && window.codeHighlight.addCopyButtons) {
        window.codeHighlight.addCopyButtons();
    }
});