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

const portPath = '/dev/tty.usbmodem1201';  // or your actual port
const port = new SerialPort({ path: portPath, baudRate: 9600 });

port.on('error', (err) => {
    console.error('Serial port error:', err.message);
});

port.on('open', () => {
    console.log('Serial port opened successfully');
});

port.on('close', () => {
    console.log('Serial port closed');
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

let latestData = {
    dryBulb: 0,
    wetBulb: 0,
    relativeHumidity: 0,
    dewPoint: 0,
    absoluteHumidity: 0,
    partialPressure: 0,
    specificVolume: 0,
    enthalpy: 0,
    timestamp: new Date().toISOString()
};

parser.on('data', (data) => {
    try {
        // Trim whitespace and check if the data is not empty
        const trimmedData = data.trim();
        console.log('Raw data received:', trimmedData);
        
        if (trimmedData === '') {
            return; // Ignore empty lines
        }

        // Skip debug output lines
        if (trimmedData.includes('New Reading') || 
            trimmedData.includes('Requesting temperatures') ||
            trimmedData.includes('Raw Readings') ||
            trimmedData.includes('Calculated Values:') ||
            trimmedData.includes('Relative Humidity:') ||
            trimmedData.includes('Absolute Humidity:') ||
            trimmedData.includes('Dew Point:') ||
            trimmedData.includes('Partial Pressure:') ||
            trimmedData.includes('Specific Volume:') ||
            trimmedData.includes('Enthalpy:')) {
            return;
        }

        // Parse comma-separated values
        const values = trimmedData.split(',').map(Number);
        
        if (values.length !== 8 || values.some(isNaN)) {
            console.error('Invalid data values:', values);
            return;
        }

        const [dryBulb, wetBulb, relativeHumidity, dewPoint, absoluteHumidity, partialPressure, specificVolume, enthalpy] = values;
        
        // Validate ranges
        if (dryBulb < -50 || dryBulb > 100 || 
            wetBulb < -50 || wetBulb > 100 || 
            relativeHumidity < 0 || relativeHumidity > 1) {
            console.error('Data out of valid range:', values);
            return;
        }

        latestData = {
            dryBulb: parseFloat(dryBulb.toFixed(2)),
            wetBulb: parseFloat(wetBulb.toFixed(2)),
            relativeHumidity: parseFloat((relativeHumidity * 100).toFixed(2)), // Convert from fraction to percentage
            dewPoint: parseFloat(dewPoint.toFixed(2)),
            absoluteHumidity: parseFloat(absoluteHumidity.toFixed(5)), // Keep 5 decimal places for kg/kg
            partialPressure: parseFloat(partialPressure.toFixed(2)),
            specificVolume: parseFloat(specificVolume.toFixed(3)),
            enthalpy: parseFloat(enthalpy.toFixed(2)),
            timestamp: new Date().toISOString()
        };
        
        // Log successful data processing
        console.log('Processed data:', latestData);
        
        // Send to all connected clients
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
