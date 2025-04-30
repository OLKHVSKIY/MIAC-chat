
// message-styling.js

const LANGUAGES = {
    js: { name: 'JavaScript', extensions: ['js', 'javascript'] },
    html: { name: 'HTML', extensions: ['html'] },
    css: { name: 'CSS', extensions: ['css'] },
    python: { name: 'Python', extensions: ['py', 'python'] },
    rust: { name: 'Rust', extensions: ['rs', 'rust'] },
    sql: { name: 'SQL', extensions: ['sql'] },
    bash: { name: 'Shell', extensions: ['sh', 'bash', 'shell'] },
    json: { name: 'JSON', extensions: ['json'] },
    markdown: { name: 'Markdown', extensions: ['md', 'markdown'] }
};

const SYNTAX_RULES = {
    common: {
        comments: /(\/\/.*|\/\*[\s\S]*?\*\/|#.*|<!--[\s\S]*?-->|--.*)/g,
        strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g
    },
    js: {
        name: 'JavaScript',
        keywords: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'export', 'import', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined'],
        types: ['string', 'number', 'boolean', 'object', 'array'],
        builtins: ['console', 'Promise', 'Array', 'Object', 'String', 'Number', 'Date', 'Math', 'JSON', 'Set', 'Map'],
        strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
        comments: /\/\/.*|\/\*[\s\S]*?\*\//g
    },
    javascript: { alias: 'js' },
    html: {
        name: 'HTML',
        tags: ['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'form', 'input', 'button', 'script', 'style', 'link', 'meta', 'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        attributes: ['class', 'id', 'href', 'src', 'alt', 'type', 'value', 'name', 'placeholder', 'style'],
        strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
        comments: /<!--[\s\S]*?-->/g
    },
    css: {
        name: 'CSS',
        properties: ['color', 'background', 'font-size', 'margin', 'padding', 'border', 'width', 'height', 'display', 'position', 'flex', 'grid'],
        values: ['none', 'block', 'inline', 'flex', 'grid', 'absolute', 'relative', 'fixed', 'static', 'center', 'left', 'right', 'inherit', 'initial', 'unset'],
        units: ['px', 'em', 'rem', '%', 'vh', 'vw', 'vmin', 'vmax'],
        strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
        comments: /\/\*[\s\S]*?\*\//g
    },
    python: {
        name: 'Python',
        keywords: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'import', 'from', 'as', 'return', 'yield', 'lambda', 'and', 'or', 'not', 'is', 'in', 'None', 'True', 'False'],
        builtins: ['print', 'range', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'open', 'super', 'self'],
        strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
        comments: /#.*|'''[\s\S]*?'''|"""[\s\S]*?"""/g
    },
    py: { alias: 'python' },
    rust: {
        name: 'Rust',
        keywords: ['fn', 'let', 'mut', 'const', 'pub', 'struct', 'enum', 'impl', 'trait', 'where', 'if', 'else', 'match', 'loop', 'while', 'for', 'in', 'return', 'break', 'continue', 'use', 'mod', 'as', 'unsafe', 'async', 'await', 'dyn'],
        types: ['i32', 'i64', 'u32', 'u64', 'f32', 'f64', 'bool', 'char', 'str', 'String', 'Vec', 'Option', 'Result', 'Box'],
        macros: ['println!', 'vec!', 'format!', 'panic!', 'assert!', 'assert_eq!'],
        strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
        comments: /\/\/.*|\/\*[\s\S]*?\*\//g
    },
    rs: { alias: 'rust' },
    sql: {
        name: 'SQL',
        keywords: ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'JOIN', 'INNER', 'OUTER', 'LEFT', 'RIGHT', 'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'TRIGGER', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK', 'DEFAULT'],
        functions: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT'],
        types: ['INTEGER', 'VARCHAR', 'CHAR', 'TEXT', 'BOOLEAN', 'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'DECIMAL', 'FLOAT', 'BLOB'],
        strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
        comments: /--.*|\/\*[\s\S]*?\*\//g
    }
};

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getLanguage(lang) {
    if (!lang) return { name: 'TEXT', extensions: ['text'] };
    lang = lang.toLowerCase();
    const found = Object.values(LANGUAGES).find(l => 
        l.extensions.includes(lang)
    );
    return found || { name: lang.toUpperCase(), extensions: [lang] };
}

function highlightSyntax(code, lang) {
    const language = getLanguage(lang);
    const config = SYNTAX_RULES[language.extensions[0]] || {};
    const common = SYNTAX_RULES.common;
    
    let highlighted = escapeHtml(code);
    
    // Подсветка комментариев
    highlighted = highlighted.replace(common.comments, '<span class="ds-comment">$&</span>');
    
    // Подсветка строк
    highlighted = highlighted.replace(common.strings, '<span class="ds-string">$&</span>');
    
    // Подсветка ключевых слов
    if (config.keywords) {
        const keywordsRegex = new RegExp(`\\b(${config.keywords.join('|')})\\b`, 'g');
        highlighted = highlighted.replace(keywordsRegex, '<span class="ds-keyword">$1</span>');
    }

// Подсветка типов
if (config.types) {
    const typesRegex = new RegExp(`\\b(${config.types.join('|')})\\b`, 'g');
    highlighted = highlighted.replace(typesRegex, '<span class="ds-type">$1</span>');
}

// Подсветка функций
if (config.builtins || config.functions) {
    const funcs = [...(config.builtins || []), ...(config.functions || [])];
    const funcsRegex = new RegExp(`\\b(${funcs.join('|')})\\b`, 'g');
    highlighted = highlighted.replace(funcsRegex, '<span class="ds-function">$1</span>');
}

// Специфичные правила
if (lang === 'html' && config.tags) {
    const tagsRegex = new RegExp(`&lt;\/?(${config.tags.join('|')})(?=\\s|&gt;)`, 'g');
    highlighted = highlighted.replace(tagsRegex, '<span class="ds-tag">$&</span>');
}

if (lang === 'css') {
    if (config.properties) {
        const propsRegex = new RegExp(`(${config.properties.join('|')})(?=\\s*:)`, 'g');
        highlighted = highlighted.replace(propsRegex, '<span class="ds-property">$1</span>');
    }
    if (config.values) {
        const valuesRegex = new RegExp(`:\\s*(${config.values.join('|')})(?=\\s*[;!])`, 'g');
        highlighted = highlighted.replace(valuesRegex, ': <span class="ds-value">$1</span>');
    }
}

return highlighted;
}

function createCodeBlock(lang, code, caption = '') {
    const language = getLanguage(lang);
    // Генерируем HTML для номеров строк (каждая строка в отдельном div)
    const lineNumbers = code.split('\n').map((_, i) => 
        `<div class="dsc-line-number">${i + 1}</div>`
    ).join('');
    
    return `
    <div class="dsc-code-container">
        <div class="dsc-code-header">
            <span class="dsc-language-badge">${language.name}</span>
            ${caption ? `<span class="dsc-code-caption">${escapeHtml(caption)}</span>` : ''}
            <button class="dsc-copy-button" title="Copy code">
                <svg class="dsc-copy-icon" viewBox="0 0 24 24">
                    <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
                </svg>
                <span class="dsc-copy-tooltip">Copied!</span>
            </button>
        </div>
        <div class="dsc-code-wrapper">
            <div class="dsc-line-numbers" aria-hidden="true">${lineNumbers}</div>
            <pre class="dsc-code"><code>${highlightSyntax(code, lang)}</code></pre>
        </div>
    </div>
    `;
}

function processCodeBlocks(text) {
    return text.replace(/```(\w*)(?::([^\n]*))?\n([\s\S]*?)```/g, (match, lang, caption, code) => {
        return createCodeBlock(lang, code, caption);
    });
}

function initCopyButtons() {
    document.querySelectorAll('.dsc-copy-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            const codeBlock = e.currentTarget.closest('.dsc-code-container');
            const code = codeBlock.querySelector('.dsc-code code').textContent;
            
            try {
                await navigator.clipboard.writeText(code);
                const tooltip = e.currentTarget.querySelector('.dsc-copy-tooltip');
                tooltip.style.visibility = 'visible';
                setTimeout(() => {
                    tooltip.style.visibility = 'hidden';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy code:', err);
            }
        });
    });
}

window.messageStyling = {
    processMessageContent(text) {
        const processed = processCodeBlocks(text);
        setTimeout(initCopyButtons, 0);
        return processed;
    }
};