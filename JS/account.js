document.addEventListener('DOMContentLoaded', () => {
    // Обновляем имя пользователя в сайдбаре
    const username = localStorage.getItem('username');
    const fullName = localStorage.getItem('fullName');
    
    if (username) {
        const userElements = document.querySelectorAll('.user-name, .profile-info h3');
        userElements.forEach(el => {
            if (el.classList.contains('user-name')) {
                el.textContent = username;
            } else {
                el.textContent = fullName || username;
            }
        });
    }
    
    document.getElementById('documents').addEventListener('click', function() {
        window.open('http://catalog.spbmiac.ru/?page_id=113', '_blank');
    });
    
    document.getElementById('guide').addEventListener('click', function() {
        window.open('http://catalog.spbmiac.ru/?page_id=41', '_blank');
    });
    
    // Остальные обработчики...
    document.getElementById('user-profile').addEventListener('click', function() {
        document.getElementById('profile-modal').style.display = 'flex';
    });
    
    document.getElementById('modal-close').addEventListener('click', function() {
        document.getElementById('profile-modal').style.display = 'none';
    });
    
    document.getElementById('profile-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
});


