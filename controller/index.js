const { handleMessage } = require('./lib/Telegram');

async function handler(req, res) {
    try {
        const { body } = req;
        if (!body) {
            return res.status(400).send('Bad request');
        }

        const messageObj = body.message;
        if (!messageObj) {
            return res.status(400).send('Message missing');
        }

        await handleMessage(messageObj);
        return res.status(200).send('Message processed');
    } catch (error) {
        console.error('Handler Error:', error);
        return res.status(500).send('Internal server error');
    }
}

module.exports = { handler };