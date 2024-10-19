const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const portPath = '/dev/ttyACM0';  // or your actual port
const port = new SerialPort({ path: portPath, baudRate: 9600 });

port.on('error', (err) => {
    console.error('Serial port error:', err.message);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

let latestData = {
    dryBulb: 0,
    wetBulb: 0,
    relativeHumidity: 0,
    dewPoint: 0,
    absoluteHumidity: 0,
    timestamp: new Date().toISOString()
};

parser.on('data', (data) => {
    const [dryBulb, wetBulb, relativeHumidity, dewPoint, absoluteHumidity] = data.split(',').map(Number);
    latestData = {
        dryBulb,
        wetBulb,
        relativeHumidity,
        dewPoint,
        absoluteHumidity,
        timestamp: new Date().toISOString()
    };
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(latestData));
        }
    });
});

// Serve static files from the 'static' directory
app.use('/static', express.static(path.join(__dirname, 'static')));

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});