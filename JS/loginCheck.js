document.addEventListener('DOMContentLoaded', async () => {
  const authToken = localStorage.getItem('authToken');
  
  if (!authToken) {
      window.location.href = 'login.html';
      return;
  }
  
  try {
      const response = await fetch('http://localhost:3000/api/check_token', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: authToken })
      });
      
      const data = await response.json();
      
      if (!data.token_valid) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('username');
          localStorage.removeItem('fullName');
          window.location.href = 'login.html';
      }
  } catch (error) {
      console.error('Ошибка проверки токена:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      localStorage.removeItem('fullName');
      window.location.href = 'login.html';
  }
});