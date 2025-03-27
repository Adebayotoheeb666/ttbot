const { axiosInstance } = require('./axios');

function sendMessage(messageObj, messageText) {
    return axiosInstance.post('sendMessage', {

        chat_id: messageObj.chat_id,
        text: messageText,
    });
}

async function handleMessage(messageObj) {

    if (!messageObj) {
        console.error('Message object is undefined');
        return; // Early return if messageObj is undefined
    }
    
    const messageText = messageObj.text || '';


    if (messageText.charAt(0) === '/') {

        const command = messageText.substr(1);
        switch (command) {
            case 'start':
                //we want to send a welcome message to the user
                return sendMessage(
                    messageObj,
                    "Hi! I'm a bot. I can get you started."
                );
            default: 
                return sendMessage(messageObj,
                    "Hey hi, I don't recognize that command"
                );
        }
    } else {
        //we can send the same message back to the user
    try {
        return await sendMessage(messageObj, messageText);
    } catch (error) {
        console.error('Error sending message:', error);
    }

    }
}

module.exports = { handleMessage };


//https://api.telegram.org/bot token / setWebhook?url= method