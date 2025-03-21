document.getElementById('logoutButton').addEventListener('click', function(event) {
  event.preventDefault(); // Предотвращаем стандартное действие кнопки

  if (confirm('Вы уверены, что хотите выйти?')) {
      // Если пользователь нажал "ОК"
      console.log('Выход из системы');

      // Отправляем запрос на сервер для удаления токена
      fetch(`api/drop_token`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
              token: localStorage.getItem('authToken')
          })
      })
      .then(response => {
          if (!response.ok) {
              throw new Error('Ответ сети был неудовлетворительным');
          }
          localStorage.removeItem('authToken'); // Удаляем токен из localStorage
          window.location.href = 'login.html'; // Перенаправляем на страницу входа
      })
      .catch(error => {
          console.error('Возникла проблема с операцией выборки:', error);
      });
  } else {
      // Если пользователь нажал "Отменить", ничего не происходит
      console.log('Отмена выхода');
  }
});

document.getElementById('logoutButton').addEventListener('click', function () {
    // Перенаправляем на страницу login.html
    window.location.href = 'login.html';
});