const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const mainContent = document.querySelector('main');
const inputContainer = document.querySelector('.input-container');

// Скрыть/показать слайдбар
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    mainContent.classList.toggle('full-width');
    updateInputContainerPosition();
});

// Закрыть слайдбар при клике вне его области
document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggleSidebar.contains(e.target)) {
        sidebar.classList.add('hidden');
        mainContent.classList.add('full-width');
        updateInputContainerPosition();
    }
});

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