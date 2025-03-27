// codeHighlights.js
window.codeHighlight = {
    highlightCode: function(text) {
        if (!text) return { text: '', hasCode: false };

        // Улучшенные регулярки для определения блоков кода
        const codeBlockRegex = /```(\w+)?([\s\S]+?)```/g;
        const inlineCodeRegex = /`([^`]+)`/g;
        let hasCode = false;
        let processedText = text;

        // Улучшенная обработка блоков кода ```
        processedText = processedText.replace(codeBlockRegex, (match, lang, code) => {
            hasCode = true;
            lang = (lang || 'plaintext').trim();
            code = code.trim();
            const formattedCode = this.formatCode(code, lang);
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

        // Дополнительная обработка для SQL, если не было блоков кода
        if (!hasCode && text.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i)) {
            const sqlFormatted = this.formatCode(text, 'sql');
            processedText = `<div class="code-block-wrapper" data-lang="sql">
                              <div class="code-header">
                                <span class="language-label">sql</span>
                                <button class="copy-code-btn"><i class="fas fa-copy"></i></button>
                              </div>
                              <pre class="code-block">${sqlFormatted}</pre>
                            </div>`;
            hasCode = true;
        }

        return { text: processedText, hasCode };
    },

    formatCode: function(code, lang) {
        // Сохраняем все табуляции и пробелы
        code = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                   .replace(/^\s+/gm, match => '&nbsp;'.repeat(match.length));
        
        // Дополнительная подсветка для разных языков
        switch (lang.toLowerCase()) {
            case 'html':
                return this.highlightHTML(code);
            case 'css':
                return this.highlightCSS(code);
            case 'javascript':
            case 'js':
                return this.highlightJS(code);
            case 'python':
            case 'py':
                return this.highlightPython(code);
            case 'rust':
            case 'rs':
                return this.highlightRust(code);
            case 'sql':
                return this.highlightSQL(code);
            default:
                return code;
        }
    },

    highlightSQL: function(code) {
        // Улучшенная подсветка SQL
        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'OUTER', 'LEFT', 'RIGHT',
            'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'AS', 'DISTINCT',
            'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'TRUNCATE',
            'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'DATABASE',
            'ADD', 'COLUMN', 'CONSTRAINT', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES',
            'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
            'UNION', 'ALL', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
        ];

        // Подсветка ключевых слов
        keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            code = code.replace(regex, `<span class="sql-keyword">${kw}</span>`);
        });

        // Подсветка комментариев
        code = code.replace(/(--.*?)(?=<|$)/g, '<span class="sql-comment">$1</span>')
                   .replace(/\/\*[\s\S]*?\*\//g, '<span class="sql-comment">$&</span>');

        // Подсветка строк
        code = code.replace(/('.*?'|".*?")/g, '<span class="sql-string">$1</span>');

        // Подсветка чисел
        code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="sql-number">$1</span>');

        return code;
    },

    // ... остальные методы highlightHTML, highlightCSS и т.д. остаются без изменений ...

    addCopyButtons: function() {
        document.querySelectorAll('.code-block-wrapper').forEach(wrapper => {
            const btn = wrapper.querySelector('.copy-code-btn');
            if (!btn.hasAttribute('data-listener')) {
                btn.setAttribute('data-listener', 'true');
                btn.addEventListener('click', () => {
                    const code = wrapper.querySelector('.code-block').textContent;
                    navigator.clipboard.writeText(code).then(() => {
                        btn.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            btn.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 2000);
                    });
                });
            }
        });
    }
};

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.codeHighlight.addCopyButtons();
});