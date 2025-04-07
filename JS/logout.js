document.getElementById('logoutButton').addEventListener('click', async function(event) {
    event.preventDefault();
    
    if (confirm('Вы уверены, что хотите выйти?')) {
        try {
            await fetch('http://localhost:4000/api/logout', {
                method: 'POST',
                credentials: 'include'
            });

            // Очищаем хранилище
            localStorage.removeItem('userData');
            
            window.location.href = 'http://localhost:4000/HTML/login.html';
        } catch (error) {
            console.error('Ошибка при выходе:', error);
            window.location.href = 'http://localhost:4000/HTML/login.html';
        }
    }
});