const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const mainContent = document.querySelector('main');
const inputContainer = document.querySelector('.input-container');

// Скрыть/показать слайдбар только по клику на кнопку
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    mainContent.classList.toggle('full-width');
    updateInputContainerPosition();
});


function handleResize() {
    // Автоматически скрываем сайдбар при ширине экрана меньше 768px
    if (window.innerWidth <= 968) {
        sidebar.classList.add('hidden');
        mainContent.classList.add('full-width');
    } else {
        sidebar.classList.remove('hidden');
        mainContent.classList.remove('full-width');
    }
    updateInputContainerPosition();
}

function updateInputContainerPosition() {
    if (window.innerWidth <= 768) {
        inputContainer.style.left = '50%';
    } else {
        if (sidebar.classList.contains('hidden')) {
            inputContainer.style.left = '50%';
        } else {
            inputContainer.style.left = 'calc(50% + 125px)';
        }
    }
}

// Инициализация состояния при загрузке страницы
handleResize();