document.getElementById('loginForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  try {
      const response = await fetch('http://localhost:3000/api/user_login', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ошибка входа');
      }
      
      const data = await response.json();
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('username', data.username);
      localStorage.setItem('fullName', data.full_name);
      
      window.location.href = 'main.html';
  } catch (error) {
      console.error('Ошибка входа:', error);
      alert(error.message);
  }
});