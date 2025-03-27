
window.codeHighlight = {
    highlightCode: function(text) {
        const languages = {
            html: { pattern: /<[^>]+>|<\/[^>]+>/g, color: '#e34c26' },
            css: { pattern: /[{}\s][^{}\s]*\{[^}]*\}/g, color: '#2965f1' },
            javascript: { pattern: /(const|let|var|function|=>|\(\)|\{\})[^;]*[;]?/g, color: '#f0db4f' },
            python: { pattern: /(def|class|import|from|if|elif|else|for|while|try|except|with)[^\n]*/g, color: '#3572A5' },
            rust: { pattern: /(fn|let|mut|impl|struct|enum|trait|use|mod)[^;]*[;]?/g, color: '#dea584' },
            sql: { pattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|GROUP\sBY|HAVING|ORDER\sBY)[^;]*[;]?/gi, color: '#00758f' }
        };

        let hasCode = false;
        let processedText = text;

        for (const [lang, {pattern, color}] of Object.entries(languages)) {
            processedText = processedText.replace(pattern, match => {
                hasCode = true;
                return `<code class="language-${lang}" style="color: ${color}">${match}</code>`;
            });
        }

        return { text: processedText, hasCode };
    },

    addCopyButtonsToCodeBlocks: function() {
        document.querySelectorAll('code').forEach(codeBlock => {
            if (!codeBlock.querySelector('.copy-code-btn')) {
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-code-btn';
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                copyButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(codeBlock.textContent);
                });
                codeBlock.appendChild(copyButton);
            }
        });
    }
};