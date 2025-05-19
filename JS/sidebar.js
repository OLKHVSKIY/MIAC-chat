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


// Функция для обновления высоты сайдбара
function updateSidebarHeight() {
    const sidebar = document.getElementById('sidebar');
    const windowHeight = window.innerHeight;
    const headerHeight = 95; // Высота вашего header
    
    // Если высота окна меньше (высота сайдбара + header + отступы)
    if (windowHeight < 840 + headerHeight + 30) {
        sidebar.classList.add('sidebar-compact');
    } else {
        sidebar.classList.remove('sidebar-compact');
    }
}

// Инициализация и обработка ресайза
document.addEventListener('DOMContentLoaded', function() {
    updateSidebarHeight();
    window.addEventListener('resize', updateSidebarHeight);
});

// Инициализация состояния при загрузке страницы
handleResize();