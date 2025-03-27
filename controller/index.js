const { handleMessage } = require('./lib/Telegram');

async function handler(req, res) {
    const { body } = req;
    if (body) {
        const messageObj = body.message;
        if (messageObj) {
            await handleMessage(messageObj); 
            return res.status(200).send('Message processed'); // Add this line
        } else {
            console.error('Message object is undefined'); 
            return res.status(400).send('Message missing'); // Add this line
        }
    }
    return res.status(400).send('Bad request'); // Add this line
}

module.exports = { handler };
