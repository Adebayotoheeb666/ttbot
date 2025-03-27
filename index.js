const express = require('express');
const { handler } = require('./controller');
const PORT = process.env.PORT || 4040;

const app = express();
app.use(express.json());

app.post('*', async (req, res) => {
    console.log('Incoming Update:', req.body);
    await handler(req, res); // ✅ Pass `res` to handler
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});