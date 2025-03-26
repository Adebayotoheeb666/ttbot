const { handleMessage } = require('./lib/Telegram');

async function handler(req, method) {
    const { body } = req;
    if (body) {
        const messageObj = body.message;
        if (messageObj) {
            await handleMessage(messageObj);
        } else {
            console.error('Message object is undefined');
            // Optionally, return a response indicating the message is missing
        }
    }
    return;
}


module.exports = { handler };
