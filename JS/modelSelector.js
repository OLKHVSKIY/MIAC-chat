document.addEventListener('DOMContentLoaded', function() {
    const modelSelector = document.getElementById('model-selector');
    const selectedModel = modelSelector.querySelector('.selected-model');
    const modelDropdown = modelSelector.querySelector('.model-dropdown');

    // Маппинг оригинальных имен на отображаемые
    const MODEL_DISPLAY_NAMES = {
        'qwen2.5:1.5b': 'Qwen 1.5B',
        'fotiecodes/jarvis:latest': 'Jarvis',
        'hf.co/Aleteian/Pathfinder-RP-12B-RU-Q8_0-GGUF:latest': 'Pathfinder 12B',
        'codellama:7b': 'CodeLlama 7B',
        'codellama:13b': 'CodeLlama 13B', 
        'codellama:34b': 'CodeLlama 34B'
    };

    // Уникальные описания для конкретных моделей
    const MODEL_DESCRIPTIONS = {
        'qwen2.5:1.5b': 'Компактная китайская модель с хорошим пониманием контекста',
        'fotiecodes/jarvis:latest': 'Специализированный ассистент для разработчиков',
        'hf.co/Aleteian/Pathfinder-RP-12B-RU-Q8_0-GGUF:latest': 'Русскоязычная RPG-оптимизированная модель',
        'codellama:7b': 'Базовая модель для программирования',
        'codellama:13b': 'Улучшенная поддержка кода с большим контекстом',
        'codellama:34b': 'Максимальная мощность для сложных задач разработки'
    };

    function getCurrentModel() {
        return localStorage.getItem('selectedModel') || 'codellama:7b';
    }

    function loadAvailableModels() {
        fetch('http://192.168.80.210:11434/api/tags')
            .then(response => response.json())
            .then(data => {
                const filteredModels = data.models
                    .filter(model => Object.keys(MODEL_DESCRIPTIONS).includes(model.name))
                    .map(model => ({
                        originalName: model.name, // Сохраняем оригинальное имя для API
                        displayName: MODEL_DISPLAY_NAMES[model.name] || model.name,
                        details: MODEL_DESCRIPTIONS[model.name]
                    }));
                
                const models = filteredModels.length > 0 ? filteredModels : 
                    Object.keys(MODEL_DESCRIPTIONS).map(name => ({
                        originalName: name,
                        displayName: MODEL_DISPLAY_NAMES[name] || name,
                        details: MODEL_DESCRIPTIONS[name]
                    }));
                
                populateModelDropdown(models);

                const currentModelName = getCurrentModel();
                const modelToSelect = models.find(m => m.originalName === currentModelName) || models[0];
                if (modelToSelect) {
                    updateSelectedModel(modelToSelect);
                }
            })
            .catch(error => {
                console.error('Error loading models:', error);
                const fallbackModels = Object.keys(MODEL_DESCRIPTIONS).map(name => ({
                    originalName: name,
                    displayName: MODEL_DISPLAY_NAMES[name] || name,
                    details: MODEL_DESCRIPTIONS[name]
                }));
                populateModelDropdown(fallbackModels);
                updateSelectedModel(fallbackModels[0]);
            });
    }

    function populateModelDropdown(models) {
        modelDropdown.innerHTML = '';
        
        models.forEach(model => {
            const modelOption = document.createElement('div');
            modelOption.className = 'model-option';
            modelOption.innerHTML = `
                <div class="model-name">
                    ${model.displayName}
                    <i class="fas fa-check"></i>
                </div>
                <div class="model-details">${model.details}</div>
            `;
            
            if (model.originalName === getCurrentModel()) {
                modelOption.classList.add('active');
            }
            
            modelOption.addEventListener('click', () => {
                updateSelectedModel(model);
                modelSelector.classList.remove('open');
                localStorage.setItem('selectedModel', model.originalName);
                document.dispatchEvent(new CustomEvent('modelChanged', { 
                    detail: model.originalName 
                }));
                
                modelDropdown.querySelectorAll('.model-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                modelOption.classList.add('active');
            });
            
            modelDropdown.appendChild(modelOption);
        });
    }

    function updateSelectedModel(model) {
        selectedModel.querySelector('.model-name').textContent = model.displayName;
    }

    selectedModel.addEventListener('click', (e) => {
        e.stopPropagation();
        modelSelector.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!modelSelector.contains(e.target)) {
            modelSelector.classList.remove('open');
        }
    });

    loadAvailableModels();
});