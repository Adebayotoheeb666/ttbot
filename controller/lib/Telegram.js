const axios = require('axios');
const MY_TOKEN = '7808380299:AAEQlUTmLAfEJ5wFVWCp1e5-_mRa5j-xkAg';
const BASE_URL = `https://api.telegram.org/bot${MY_TOKEN}`;

function getAxiosInstance() {
    return {
        get(method, params) {
            return axios.get(`/${method}`, { baseURL: BASE_URL, params });
        },
        post(method, data) {
            return axios.post(`/${method}`, data, { baseURL: BASE_URL });
        },
    };
}

const axiosInstance = getAxiosInstance(); // ✅ Initialize here

async function sendMessage(messageObj, messageText) {
    try {
        return await axiosInstance.post('sendMessage', {
            chat_id: messageObj.chat.id, // ✅ Fix: Use `messageObj.chat.id`
            text: messageText,
        });
    } catch (error) {
        console.error('Telegram API Error:', error.response?.data);
        throw error;
    }
}

async function handleMessage(messageObj) {
    if (!messageObj) {
        console.error('Message object is undefined');
        return;
    }

    const messageText = messageObj.text || '';
    if (messageText.startsWith('/')) {
        const command = messageText.substring(1);
        switch (command) {
            case 'start':
                return sendMessage(messageObj, "Hi! I'm a bot. I can get you started.");
            default:
                return sendMessage(messageObj, "I don't recognize that command.");
        }
    } else {
        return sendMessage(messageObj, `You said: "${messageText}"`);
    }
}

module.exports = { handleMessage };

//https://api.telegram.org/bot token / setWebhook?url= method