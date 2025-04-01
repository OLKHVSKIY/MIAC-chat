document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    
    if (logoutButton) {
        logoutButton.addEventListener('click', async function(event) {
            event.preventDefault();
            
            if (confirm('Вы уверены, что хотите выйти?')) {
                try {
                    const response = await fetch('http://localhost:3000/api/drop_token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                        },
                        body: JSON.stringify({ 
                            token: localStorage.getItem('authToken')
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Ошибка при выходе');
                    }
                    
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('username');
                    localStorage.removeItem('fullName');
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Ошибка при выходе:', error);
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('username');
                    localStorage.removeItem('fullName');
                    window.location.href = 'login.html';
                }
            }
        });
    } else {
        console.warn('Элемент logoutButton не найден');
    }
});