document.addEventListener('DOMContentLoaded', function() {
    const modelSelector = document.getElementById('model-selector');
    const selectedModel = modelSelector.querySelector('.selected-model');
    const modelDropdown = modelSelector.querySelector('.model-dropdown');
    
    // Функция для получения текущей модели
    function getCurrentModel() {
        return localStorage.getItem('selectedModel') || 'llama2';
    }
    
    // Загрузка доступных моделей
    function loadAvailableModels() {
        fetch('http://192.168.80.210:11434/api/tags')
            .then(response => response.json())
            .then(data => {
                const models = data.models;
                populateModelDropdown(models);
                
                // Установка текущей модели
                const currentModelName = getCurrentModel();
                const modelToSelect = models.find(m => m.name === currentModelName) || models[0];
                if (modelToSelect) {
                    updateSelectedModel(modelToSelect);
                }
            })
            .catch(error => {
                console.error('Error loading models:', error);
                const fallbackModels = [
                    {name: 'llama2', details: 'Meta\'s versatile open model'},
                    {name: 'mistral', details: 'Efficient small model'},
                    {name: 'gemma', details: 'Lightweight Google model'}
                ];
                populateModelDropdown(fallbackModels);
                updateSelectedModel(fallbackModels[0]);
            });
    }
    
    // Заполнение выпадающего списка
    function populateModelDropdown(models) {
        modelDropdown.innerHTML = '';
        
        models.forEach(model => {
            const modelOption = document.createElement('div');
            modelOption.className = 'model-option';
            modelOption.innerHTML = `
                <div class="model-name">
                    ${model.name}
                    <i class="fas fa-check"></i>
                </div>
                <div class="model-details">${model.details || 'No description available'}</div>
            `;
            
            if (model.name === getCurrentModel()) {
                modelOption.classList.add('active');
            }
            
            modelOption.addEventListener('click', () => {
                updateSelectedModel(model);
                modelSelector.classList.remove('open');
                localStorage.setItem('selectedModel', model.name);
                document.dispatchEvent(new CustomEvent('modelChanged', { detail: model.name }));
                
                // Обновляем активное состояние в dropdown
                modelDropdown.querySelectorAll('.model-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                modelOption.classList.add('active');
            });
            
            modelDropdown.appendChild(modelOption);
        });
    }
    
    // Обновление выбранной модели
    function updateSelectedModel(model) {
        selectedModel.querySelector('.model-name').textContent = model.name;
    }
    
    // Открытие/закрытие dropdown
    selectedModel.addEventListener('click', (e) => {
        e.stopPropagation();
        modelSelector.classList.toggle('open');
    });
    
    // Закрытие при клике вне элемента
    document.addEventListener('click', (e) => {
        if (!modelSelector.contains(e.target)) {
            modelSelector.classList.remove('open');
        }
    });
    
    // Инициализация
    loadAvailableModels();
});