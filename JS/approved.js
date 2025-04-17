document.addEventListener('DOMContentLoaded', async () => {
    // Проверка аутентификации
    if (!localStorage.getItem('authToken')) {
        window.location.href = '/login';
        return;
    }

    // DOM элементы
    const tableBody = document.querySelector('#approvedUsersTable tbody');
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    const roleFilter = document.getElementById('roleFilter');
    const addUserBtn = document.getElementById('addUserBtn');
    const modal = document.getElementById('addUserModal');
    const closeModal = document.getElementById('closeModal');
    const cancelAddUser = document.getElementById('cancelAddUser');
    const addUserForm = document.getElementById('addUserForm');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInput = document.getElementById('pageNumber');
    const API_BASE_URL = 'http://localhost:4000';
    const ADMIN_PANEL = true;

    // Состояние
    let currentPage = 1;
    const itemsPerPage = 10;
    let allUsers = [];
    let filteredUsers = [];

    async function loadApprovedUsers() {
        try {
            const approvedResponse = await fetch(`${API_BASE_URL}/api/approved-users`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!approvedResponse.ok) {
                // Пытаемся получить JSON с ошибкой, если есть
                let errorData;
                try {
                    errorData = await approvedResponse.json();
                } catch {
                    errorData = { error: approvedResponse.statusText };
                }
                throw new Error(errorData.error || 'Ошибка загрузки данных');
            }
    
            allUsers = await approvedResponse.json();
            console.log('Загружено одобренных пользователей:', allUsers.length);
            
            applyFilters();
            renderUsersList();
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            showAlert(`Ошибка: ${error.message}`, 'error');
        }
    }


   // Фильтрация и поиск
   function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const roleFilterValue = roleFilter.value;
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = user.full_name.toLowerCase().includes(searchTerm);
        const matchesRole = !roleFilterValue || user.role_id.toString() === roleFilterValue;
        return matchesSearch && matchesRole;
    });
    
    currentPage = 1;
    renderUsersList();
}

    // Отображение данных
    function renderUsersList() {
        tableBody.innerHTML = '';
        
        if (filteredUsers.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="4" class="no-data">Нет данных для отображения</td>`;
            tableBody.appendChild(row);
            updatePagination();
            return;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);
        
        paginatedUsers.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.full_name || 'Не указано'}</td>
                <td>${user.position || '-'}</td>
                <td>${user.role_name || 'Не указана'}</td>
                <td class="actions-column">
                    ${user.user_id ? `
                        <button class="action-button delete-user" data-id="${user.user_id}">
                            Удалить из системы
                        </button>
                    ` : ''}
                    <button class="action-button delete" data-id="${user.id}">
                        Удалить
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        updatePagination();
        setupDeleteButtons();
        setupDeleteUserButtons();
    }

    // Пагинация
    function updatePagination() {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
        pageInput.value = currentPage;
        pageInput.max = totalPages;
        
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // Обработчики кнопок удаления
    function setupDeleteButtons() {
        document.querySelectorAll('.action-button.delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const row = btn.closest('tr');
                const fullName = row.querySelector('td:first-child').textContent;
                
                if (confirm(`Вы уверены, что хотите удалить ${fullName} из списка одобренных?`)) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/approved-users/${btn.dataset.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                                'Content-Type': 'application/json'
                            },
                            credentials: 'include'
                        });

                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.error || 'Ошибка удаления');
                        }

                        await loadApprovedUsers();
                        showAlert('Пользователь удалён из списка одобренных', 'success');
                    } catch (error) {
                        console.error('Ошибка:', error);
                        showAlert(error.message, 'error');
                    }
                }
            });
        });
    }

    // Обработчики событий
    searchInput.addEventListener('input', applyFilters);
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        applyFilters();
    });
    roleFilter.addEventListener('change', applyFilters);

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderUsersList();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderUsersList();
        }
    });

    pageInput.addEventListener('change', (e) => {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        const newPage = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1));
        currentPage = newPage;
        renderUsersList();
    });

    // Модальное окно
    addUserBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    closeModal.addEventListener('click', closeModalHandler);
    cancelAddUser.addEventListener('click', closeModalHandler);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalHandler();
        }
    });

    function setupDeleteUserButtons() {
        document.querySelectorAll('.action-button.delete-user').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // Находим строку таблицы, в которой была нажата кнопка
                const row = e.target.closest('tr');
                const fullName = row.querySelector('td:first-child').textContent;
                
                if (confirm(`Вы уверены, что хотите полностью удалить пользователя ${fullName}? Это действие нельзя отменить!`)) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/users/${btn.dataset.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                                'Content-Type': 'application/json'
                            },
                            credentials: 'include'
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Ошибка удаления');
                        }
                        
                        await loadApprovedUsers();
                        showAlert('Пользователь полностью удален из системы', 'success');
                    } catch (error) {
                        console.error('Ошибка:', error);
                        showAlert(error.message, 'error');
                    }
                }
            });
        });
    }

    function closeModalHandler() {
        modal.style.display = 'none';
        addUserForm.reset();
    }

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            full_name: document.getElementById('modalFullName').value.trim(),
            position: document.getElementById('modalPosition').value.trim(),
            role_id: parseInt(document.getElementById('modalRoleId').value)
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/approved-users`, {
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
            
            closeModalHandler();
            await loadApprovedUsers();
            showAlert('Пользователь добавлен в список', 'success');
        } catch (error) {
            console.error('Ошибка:', error);
            showAlert(error.message, 'error');
        }
    });

    // Уведомления
    function showAlert(message, type = 'success') {
        const alertBox = document.createElement('div');
        alertBox.className = `alert ${type}`;
        alertBox.textContent = message;
        document.body.appendChild(alertBox);
        setTimeout(() => {
            alertBox.classList.add('fade-out');
            setTimeout(() => alertBox.remove(), 300);
        }, 3000);
    }

    // Инициализация
    await loadApprovedUsers();
});