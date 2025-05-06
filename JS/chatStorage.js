const API_BASE_URL = 'http://localhost:4000/api'; // Базовый URL API

class ChatStorage {
    constructor() {
        this.currentChatId = null;
    }

    // Получить токен аутентификации
    getAuthToken() {
        return localStorage.getItem('authToken') || '';
    }

    // Форматирование даты чата (для отображения группировки)
    formatChatDate(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Сегодня';
        if (diffDays === 1) return 'Вчера';
        if (diffDays < 7) return '7 дней';
        if (diffDays < 30) return '30 дней';
        
        // Для более старых дат — месяц и год
        return date.toLocaleDateString('ru-RU', { 
            year: 'numeric', 
            month: 'long' 
        }).replace(' г.', '');
    }

    // Создать новый чат
    async createNewChat(title = 'Новый чат') {
        try {
            const response = await fetch(`${API_BASE_URL}/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({ title })
            });

            if (!response.ok) {
                throw new Error(`Ошибка при создании чата: ${response.status}`);
            }

            const data = await response.json();
            this.currentChatId = data.chat_id;
            return data;
        } catch (error) {
            console.error('ChatStorage.createNewChat error:', error);
            throw error;
        }
    }

    // Получить список чатов пользователя
    async getUserChats() {
        try {
            const response = await fetch(`${API_BASE_URL}/chats`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });
    
            if (!response.ok) {
                throw new Error('Ошибка при загрузке чатов');
            }
    
            const chats = await response.json();
            // Добавляем дату последней активности (если её нет в ответе сервера)
            return chats.map(chat => ({
                ...chat,
                last_activity: chat.last_activity || chat.created_at
            }));
        } catch (error) {
            console.error('ChatStorage.getUserChats error:', error);
            throw error;
        }
    }

    // Получить сообщения чата
    async getChatMessages(chatId) {
        try {
            const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка при загрузке сообщений: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('ChatStorage.getChatMessages error:', error);
            throw error;
        }
    }

    // Сохранить сообщение
    async saveMessage(chatId, sender, content) {
        try {
            const response = await fetch(`${API_BASE_URL}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    sender,
                    content
                })
            });

            if (!response.ok) {
                throw new Error(`Ошибка при сохранении сообщения: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('ChatStorage.saveMessage error:', error);
            throw error;
        }
    }

    // Обновить название чата
    async updateChatTitle(chatId, newTitle) {
        try {
            const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({ title: newTitle })
            });

            if (!response.ok) {
                throw new Error(`Ошибка при обновлении названия чата: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('ChatStorage.updateChatTitle error:', error);
            throw error;
        }
    }

    // Удалить чат
    async deleteChat(chatId) {
        try {
            const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка при удалении чата: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('ChatStorage.deleteChat error:', error);
            throw error;
        }
    }
}

// Экспортируем экземпляр класса
export const chatStorage = new ChatStorage();
export default chatStorage;