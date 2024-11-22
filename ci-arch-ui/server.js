// server.js

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

if (!fs.existsSync('./objects.json')) {
    console.error('Файл objects.json не найден. Сначала создайте его.');
    process.exit(1);
}

if (!fs.existsSync('./mapping.json')) {
    console.error('Файл mapping.json не найден. Сначала создайте его.');
    process.exit(1);
}

let eventLogs = [];

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src')));

app.get('/objects.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'objects.json'));
});

app.get('/mapping.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'mapping.json'));
});

app.post('/events', (req, res) => {
    const event = req.body;
    event.timestamp = Date.now();
    event.id = uuidv4();
    console.log('[info] Event received:', event);

    eventLogs.push(event);
    if (eventLogs.length > 100) eventLogs.shift();

    res.status(200).send({ message: 'Event received' });
});

app.get('/events', (req, res) => {
    res.status(200).json(eventLogs);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
});
