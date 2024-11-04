const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server: server,
    path: '/ws'
});

const portPath = '/dev/tty.usbmodem11201';  // or your actual port
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
    try {
        const values = data.split(',').map(Number);
        if (values.length !== 5 || values.some(isNaN)) {
            console.error('Invalid data format received:', data);
            return;
        }

        const [dryBulb, wetBulb, relativeHumidity, dewPoint, absoluteHumidity] = values;
        
        // Validate ranges
        if (dryBulb < -50 || dryBulb > 100 || 
            wetBulb < -50 || wetBulb > 100 || 
            relativeHumidity < 0 || relativeHumidity > 100) {
            console.error('Data out of valid range:', values);
            return;
        }

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
    } catch (error) {
        console.error('Error processing sensor data:', error);
    }
});

// Serve static files from the 'static' directory
app.use('/static', express.static(path.join(__dirname, 'static')));

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
