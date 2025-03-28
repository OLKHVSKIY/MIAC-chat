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

// Убрали обработчик клика вне сайдбара, чтобы закрывался только по кнопке

// Обновить позицию поля ввода при изменении размера окна
window.addEventListener('resize', updateInputContainerPosition);

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

// Инициализация позиции при загрузке
updateInputContainerPosition();

