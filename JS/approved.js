// admin-approved-users.js
document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.querySelector('#approvedUsersTable tbody');
    const addForm = document.getElementById('addApprovedUserForm');

    // Загружаем список одобренных пользователей
    async function loadApprovedUsers() {
        try {
            const response = await fetch('/api/approved-users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Ошибка загрузки списка');
            }
            
            const users = await response.json();
            renderUsersList(users);
        } catch (error) {
            console.error('Ошибка:', error);
            alert(error.message);
        }
    }

    // Отображаем список пользователей
    function renderUsersList(users) {
        tableBody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.full_name}</td>
                <td>${user.position || '-'}</td>
                <td>${user.role_name}</td>
                <td>
                    <button class="delete-btn" data-id="${user.id}">Удалить</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Добавляем обработчики для кнопок удаления
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Вы уверены, что хотите удалить этого пользователя из списка одобренных?')) {
                    try {
                        const response = await fetch(`/api/approved-users/${btn.dataset.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error('Ошибка удаления');
                        }
                        
                        await loadApprovedUsers();
                    } catch (error) {
                        console.error('Ошибка:', error);
                        alert(error.message);
                    }
                }
            });
        });
    }

    // Обработчик формы добавления
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            full_name: document.getElementById('fullName').value.trim(),
            position: document.getElementById('position').value.trim(),
            role_id: parseInt(document.getElementById('roleId').value)
        };
        
        try {
            const response = await fetch('/api/approved-users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                throw new Error('Ошибка добавления');
            }
            
            // Очищаем форму и обновляем список
            addForm.reset();
            await loadApprovedUsers();
        } catch (error) {
            console.error('Ошибка:', error);
            alert(error.message);
        }
    });

    // Первоначальная загрузка списка
    await loadApprovedUsers();
});