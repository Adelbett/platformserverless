const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname)));
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'dashboard' }));

app.listen(8080, () => console.log('dashboard listening on :8080'));
