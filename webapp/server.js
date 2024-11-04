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
let port;
let parser;
let reconnectTimer;
const RECONNECT_INTERVAL = 5000; // 5 seconds

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

function initializeSerialPort() {
    try {
        // Only try to close if port exists and is open
        if (port && port.isOpen) {
            try {
                parser.removeAllListeners('data');
                port.removeAllListeners();
                port.close((err) => {
                    if (err) {
                        console.error('Error closing port:', err);
                    }
                });
            } catch (error) {
                console.error('Error cleaning up existing port:', error);
            }
        }

        // Create new port instance
        port = new SerialPort({ 
            path: portPath, 
            baudRate: 9600,
            autoOpen: false  // Don't open automatically
        });

        // Set up error handler first
        port.on('error', (err) => {
            console.error('Serial port error:', err.message);
            scheduleReconnect();
        });

        port.on('open', () => {
            console.log('Serial port opened successfully');
            clearTimeout(reconnectTimer);
            
            // Create and attach parser after successful open
            parser = new ReadlineParser({ delimiter: '\n' });
            port.pipe(parser);

            // Set up the data parser
            parser.on('data', (data) => {
                try {
                    const trimmedData = data.trim();
                    console.log('Raw data received:', trimmedData);
                    
                    if (trimmedData === '') return;

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

                    // Process data and send to clients
                    processAndSendData(trimmedData);
                } catch (error) {
                    console.error('Error processing sensor data:', error);
                }
            });

            // Notify all connected clients about the connection status
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'status', connected: true }));
                }
            });
        });

        port.on('close', () => {
            console.log('Serial port closed');
            
            // Notify all connected clients about the connection status
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'status', connected: false }));
                }
            });
            
            scheduleReconnect();
        });

        // Now open the port
        port.open((err) => {
            if (err) {
                console.error('Error opening port:', err);
                scheduleReconnect();
            }
        });

    } catch (error) {
        console.error('Error initializing serial port:', error);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect to serial port...');
        initializeSerialPort();
    }, RECONNECT_INTERVAL);
}

function processAndSendData(trimmedData) {
    const values = trimmedData.split(',').map(Number);
    
    if (values.length !== 8 || values.some(isNaN)) {
        console.error('Invalid data values:', values);
        return;
    }

    const [dryBulb, wetBulb, relativeHumidity, dewPoint, absoluteHumidity, 
           partialPressure, specificVolume, enthalpy] = values;
    
    // Validate ranges
    if (dryBulb < -50 || dryBulb > 100 || 
        wetBulb < -50 || wetBulb > 100 || 
        relativeHumidity < 0 || relativeHumidity > 1) {
        console.error('Data out of valid range:', values);
        return;
    }

    latestData = {
        type: 'data',
        dryBulb: parseFloat(dryBulb.toFixed(2)),
        wetBulb: parseFloat(wetBulb.toFixed(2)),
        relativeHumidity: parseFloat((relativeHumidity * 100).toFixed(2)),
        dewPoint: parseFloat(dewPoint.toFixed(2)),
        absoluteHumidity: parseFloat(absoluteHumidity.toFixed(5)),
        partialPressure: parseFloat(partialPressure.toFixed(2)),
        specificVolume: parseFloat(specificVolume.toFixed(3)),
        enthalpy: parseFloat(enthalpy.toFixed(2)),
        timestamp: new Date().toISOString()
    };
    
    console.log('Processed data:', latestData);
    
    // Send to all connected clients
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(latestData));
        }
    });
}

// Initialize the serial port when the server starts
initializeSerialPort();

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
