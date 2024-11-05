let socket;
let temperatureChart;
let psychroChart;

const dataHistory = [];

const DEFAULT_VALUES = {
    dryBulb: 25,
    wetBulb: 18,
    relativeHumidity: 50,
    dewPoint: 15,
    absoluteHumidity: 12
};

let isManualMode = false;
let isConnected = false;

let lastDataTime = Date.now();
const CONNECTION_TIMEOUT = 5000; // 5 seconds timeout

const TIME_RANGES = {
    '1min': 1,
    '15min': 15,
    '1hr': 60,
    '10hr': 600,
    'custom': null
};

let currentTimeRange = 15; // Default to 15 minutes in minutes

let intentionalClose = false;  // Add this flag at the top with other globals

function initCharts() {
    // Destroy existing chart if it exists
    if (temperatureChart) {
        temperatureChart.destroy();
    }
    
    // Initialize temperature chart
    const tempCtx = document.getElementById('temperatureChart').getContext('2d');
    temperatureChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Dry Bulb',
                    data: [],
                    borderColor: 'red',
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Wet Bulb',
                    data: [],
                    borderColor: 'blue',
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });

    // Initialize psychrometric chart
    initPsychroChart();
}

function updateCharts(data) {
    if (!data) {
        console.warn('No data provided to updateCharts');
        return;
    }

    console.log('Updating charts with data:', data);

    const timestamp = new Date(data.timestamp || new Date());
    
    // Update temperature chart with the current data point
    temperatureChart.data.datasets[0].data.push({
        x: timestamp,
        y: Number(data.dryBulb)
    });
    temperatureChart.data.datasets[1].data.push({
        x: timestamp,
        y: Number(data.wetBulb)
    });

    // Keep only the last 1000 points in the chart
    if (temperatureChart.data.datasets[0].data.length > 1000) {
        temperatureChart.data.datasets[0].data.shift();
        temperatureChart.data.datasets[1].data.shift();
    }
    
    // Calculate dynamic y-axis range
    const temperatures = temperatureChart.data.datasets.flatMap(dataset => 
        dataset.data.map(point => point.y)
    );
    const maxTemp = Math.max(...temperatures);
    const minTemp = Math.min(...temperatures);
    const padding = 1;

    // Update temperature chart scales
    temperatureChart.options.scales.y.min = Math.floor(minTemp - padding);
    temperatureChart.options.scales.y.max = Math.ceil(maxTemp + padding);
    
    temperatureChart.update(); // Update without animation for real-time data

    // Update psychrometric chart
    if (window.viewModel) {
        try {
            window.viewModel.updateState({
                dryBulb: Number(data.dryBulb),
                wetBulb: Number(data.wetBulb),
                relativeHumidity: Number(data.relativeHumidity)
            });
        } catch (error) {
            console.error('Error updating psychrometric state:', error);
        }
    }

    // Update readings
    updateParameters(data);
}

function updateParameters(data) {
    if (!data) {
        console.warn('No data provided to updateParameters');
        return;
    }

    try {
        // Add input validation
        if (typeof data.dryBulb !== 'number' || typeof data.relativeHumidity !== 'number') {
            throw new Error('Invalid data types for calculations');
        }

        // Update display values with all parameters and more decimal places
        document.getElementById('dryBulb').textContent = 
            (data.dryBulb?.toFixed(2) ?? '---');
        document.getElementById('wetBulb').textContent = 
            (data.wetBulb?.toFixed(2) ?? '---');
        document.getElementById('relativeHumidity').textContent = 
            (data.relativeHumidity?.toFixed(2) ?? '---');
        document.getElementById('dewPoint').textContent = 
            (data.dewPoint?.toFixed(2) ?? '---');
        document.getElementById('absoluteHumidity').textContent = 
            (data.absoluteHumidity?.toFixed(5) ?? '---'); // 5 decimal places for kg/kg
        document.getElementById('partialPressure').textContent = 
            (data.partialPressure?.toFixed(2) ?? '---');
        document.getElementById('specificVolume').textContent = 
            (data.specificVolume?.toFixed(3) ?? '---');
        document.getElementById('enthalpy').textContent = 
            (data.enthalpy?.toFixed(2) ?? '---');
        
        if (data.timestamp) {
            document.getElementById('timestamp').textContent = 
                new Date(data.timestamp).toLocaleTimeString();
        }
    } catch (error) {
        console.error('Error updating parameters:', error.message);
        ['dryBulb', 'wetBulb', 'relativeHumidity', 'dewPoint', 
         'absoluteHumidity', 'partialPressure', 'specificVolume', 'enthalpy']
            .forEach(id => document.getElementById(id).textContent = '---');
    }
}

function initializeWebSocket() {
    if (socket) {
        intentionalClose = true;  // Set flag before closing
        socket.close();
        isConnected = false;
        updateConnectionStatus(false);
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${location.host}/ws`;
    
    try {
        socket = new WebSocket(wsUrl);
        intentionalClose = false;  // Reset flag after new connection attempt
        
        socket.onopen = function() {
            console.log('WebSocket connection established');
            lastDataTime = Date.now(); // Reset the timeout counter when connected
            isConnected = true;
            updateConnectionStatus(true);
        };

        socket.onmessage = function(event) {
            try {
                lastDataTime = Date.now();
                const message = JSON.parse(event.data);
                
                if (message.type === 'status') {
                    if (isConnected !== message.connected) {
                        isConnected = message.connected;
                        updateConnectionStatus(message.connected);
                    }
                    return;
                }
                
                // Handle data message
                if (message.type === 'data' && !isManualMode) {
                    // Only update display with sensor data when not in manual mode
                    if (dataHistory.length === 0 || message.timestamp) {
                        updateCharts(message);
                        updateParameters(message);
                    }
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        socket.onerror = function(error) {
            console.error('WebSocket error:', error);
            isConnected = false;
            updateConnectionStatus(false);
        };

        socket.onclose = function() {
            console.log('WebSocket connection closed');
            isConnected = false;
            updateConnectionStatus(false);
            
            // Only attempt to reconnect if the closure wasn't intentional
            // and we haven't received data recently
            if (!intentionalClose && (Date.now() - lastDataTime > CONNECTION_TIMEOUT)) {
                console.log('Connection lost, attempting to reconnect...');
                setTimeout(initializeWebSocket, 5000);
            }
        };
    } catch (error) {
        console.error('Error initializing WebSocket:', error);
        isConnected = false;
        updateConnectionStatus(false);
    }
}



function initPsychroChart() {
    try {
        // Remove any existing bindings
        if (window.viewModel) {
            ko.cleanNode(document.getElementById('vizcontainer'));
        }
        
        const container = document.getElementById('psychrometricChart');
        const svg = document.getElementById('chartsvg');
        
        // Important: Wait for container to be properly sized
        if (!container.clientWidth) {
            requestAnimationFrame(() => initPsychroChart());
            return;
        }
        
        // Calculate dimensions maintaining aspect ratio
        const width = container.clientWidth - 40;  // Account for padding
        const height = width * 0.75;  // 4:3 aspect ratio
        
        // Update SVG dimensions
        svg.style.width = `${width}px`;
        svg.style.height = `${height}px`;
        
        // Set viewBox to match the actual dimensions
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
        
        // Clear existing content
        svg.innerHTML = '';
        
        // Initialize the view model with the correct dimensions
        window.viewModel = new ViewModel(width, height);
        ko.applyBindings(window.viewModel, document.getElementById('vizcontainer'));
        
    } catch (error) {
        console.error('Error initializing psychrometric chart:', error);
    }
}

function initializeWithDefaults() {
    // Initialize charts first
    initCharts();
    
    // Only set default values if we're not connected to the sensor
    if (!isConnected) {
        const defaultData = {
            dryBulb: DEFAULT_VALUES.dryBulb,
            wetBulb: DEFAULT_VALUES.wetBulb,
            relativeHumidity: DEFAULT_VALUES.relativeHumidity,
            timestamp: new Date()
        };
        
        setTimeout(() => {
            updateCharts(defaultData);
            updateParameters(defaultData);
        }, 100);
    }
}

document.getElementById('input-toggle').addEventListener('change', function() {
    isManualMode = !this.checked;
    document.getElementById('manual-controls').style.display = isManualMode ? 'block' : 'none';
    document.getElementById('mode-text').textContent = isManualMode ? 'Manual Input' : 'Sensor Input';
    
    if (isManualMode) {
        const manualData = {
            dryBulb: parseFloat(document.getElementById('manual-dry-bulb').value),
            wetBulb: parseFloat(document.getElementById('manual-wet-bulb').value),
            relativeHumidity: parseFloat(document.getElementById('manual-rh').value),
            timestamp: new Date()
        };
        updateCharts(manualData);
        updateParameters(manualData);
    }
});



function updateConnectionStatus() {
    const indicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (isConnected) {
        indicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

// Initialize with defaults when page loads
window.addEventListener('load', function() {
    requestAnimationFrame(() => {
        initCharts();
        initializeManualControls();
        initializeWebSocket();
        // Wait a bit before initializing with defaults to allow WebSocket to connect
        setTimeout(() => {
            if (!isConnected) {
                initializeWithDefaults();
            }
        }, 1000);
        updateConnectionStatus();
    });
});

function calculateDewPoint(dryBulb, relativeHumidity) {
    // Magnus formula
    const a = 17.27;
    const b = 237.7;
    
    const rh = relativeHumidity / 100;
    const alpha = ((a * dryBulb) / (b + dryBulb)) + Math.log(rh);
    
    return (b * alpha) / (a - alpha);
}

function calculateAbsoluteHumidity(dryBulb, relativeHumidity) {
    // Constants
    const a = 6.112;
    const b = 17.67;
    const c = 243.5;
    
    // Calculate saturation vapor pressure
    const es = a * Math.exp((b * dryBulb) / (c + dryBulb));
    
    // Calculate actual vapor pressure
    const e = (relativeHumidity / 100) * es;
    
    // Calculate absolute humidity (kg/m³)
    return (0.622 * e) / (0.01 * (273.15 + dryBulb));
}

// Add resize handler
window.addEventListener('resize', debounce(() => {
    initPsychroChart();
}, 250));

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function initializeManualControls() {
    const inputToggle = document.getElementById('input-toggle');
    const manualControls = document.getElementById('manual-controls');
    const updateButton = document.getElementById('update-manual');

    inputToggle.addEventListener('change', function() {
        isManualMode = !this.checked;
        manualControls.style.display = isManualMode ? 'block' : 'none';
        document.getElementById('mode-text').textContent = 
            isManualMode ? 'Manual Input' : 'Sensor Input';
        
        if (isManualMode) {
            document.getElementById('manual-dry-bulb').value = DEFAULT_VALUES.dryBulb;
            document.getElementById('manual-wet-bulb').value = DEFAULT_VALUES.wetBulb;
            document.getElementById('manual-rh').value = DEFAULT_VALUES.relativeHumidity;
        }
    });

    updateButton.addEventListener('click', function() {
        if (isManualMode) {
            updateManualCalculations();
        }
    });

    // Add input event listeners for real-time updates
    document.getElementById('manual-dry-bulb').addEventListener('input', function() {
        if (isManualMode) {
            updateManualCalculations();
        }
    });

    document.getElementById('manual-wet-bulb').addEventListener('input', function() {
        if (isManualMode) {
            updateManualCalculations();
        }
    });
}

// Add this function to check connection status
function checkConnection() {
    if (isConnected && (Date.now() - lastDataTime > CONNECTION_TIMEOUT)) {
        console.log('Connection timeout - no data received');
        isConnected = false;
        updateConnectionStatus(false);
        // Don't close the socket here, let the WebSocket handle its own state
    }
}

// Start the connection checker
setInterval(checkConnection, 1000);

// Add psychrometric calculation functions
function calculateRelativeHumidity(dryBulb, wetBulb) {
    // Constants
    const P_atm = 101325; // Atmospheric pressure (Pa)
    
    // Calculate saturation vapor pressures
    const P_ws_dry = calculateSaturatedVaporPressure(dryBulb);
    const P_ws_wet = calculateSaturatedVaporPressure(wetBulb);
    
    // Calculate actual vapor pressure using wet bulb
    const W = 0.622 * (P_ws_wet - P_atm * (dryBulb - wetBulb) * 0.000662) / (P_atm - P_ws_wet);
    const P_w = (P_atm * W) / (0.622 + W);
    
    return (P_w / P_ws_dry);
}

function calculateSaturatedVaporPressure(T) {
    // Constants for T >= 0°C
    const C1 = -5800.2206;
    const C2 = 1.3914993;
    const C3 = -0.048640239;
    const C4 = 0.000041764768;
    const C5 = -0.000000014452093;
    const C7 = 6.5459673;
    
    const T_K = T + 273.15; // Convert to Kelvin
    
    return Math.exp(C1/T_K + C2 + C3*T_K + C4*Math.pow(T_K, 2) + 
                   C5*Math.pow(T_K, 3) + C7*Math.log(T_K));
}

function calculateDewPoint(dryBulb, wetBulb) {
    const rh = calculateRelativeHumidity(dryBulb, wetBulb);
    const P_ws = calculateSaturatedVaporPressure(dryBulb);
    const P_w = rh * P_ws;
    
    // Inverse of saturated vapor pressure calculation
    // Using approximation method
    let Td = dryBulb;
    const epsilon = 0.001;
    let delta = 1;
    
    while (Math.abs(delta) > epsilon) {
        const P_ws_d = calculateSaturatedVaporPressure(Td);
        delta = (P_ws_d - P_w) / 100;
        Td -= delta;
    }
    
    return Td;
}

function calculateAbsoluteHumidity(dryBulb, wetBulb) {
    const P_atm = 101325; // Atmospheric pressure (Pa)
    const rh = calculateRelativeHumidity(dryBulb, wetBulb);
    const P_ws = calculateSaturatedVaporPressure(dryBulb);
    const P_w = rh * P_ws;
    
    return 0.622 * P_w / (P_atm - P_w);
}

function calculatePartialPressure(dryBulb, wetBulb) {
    const rh = calculateRelativeHumidity(dryBulb, wetBulb);
    const P_ws = calculateSaturatedVaporPressure(dryBulb);
    return rh * P_ws;
}

function calculateSpecificVolume(dryBulb, absoluteHumidity) {
    const P_atm = 101325; // Pa
    const R = 287.055; // Gas constant for dry air (J/kg·K)
    return R * (dryBulb + 273.15) * (1 + 1.6078 * absoluteHumidity) / P_atm;
}

function calculateEnthalpy(dryBulb, absoluteHumidity) {
    return 1.006 * dryBulb + absoluteHumidity * (2501 + 1.805 * dryBulb);
}

// Modify the manual control update handler
function updateManualCalculations() {
    const dryBulb = parseFloat(document.getElementById('manual-dry-bulb').value);
    const wetBulb = parseFloat(document.getElementById('manual-wet-bulb').value);
    
    const relativeHumidity = calculateRelativeHumidity(dryBulb, wetBulb) * 100;
    const absoluteHumidity = calculateAbsoluteHumidity(dryBulb, wetBulb);
    const dewPoint = calculateDewPoint(dryBulb, wetBulb);
    const partialPressure = calculatePartialPressure(dryBulb, wetBulb);
    const specificVolume = calculateSpecificVolume(dryBulb, absoluteHumidity);
    const enthalpy = calculateEnthalpy(dryBulb, absoluteHumidity);

    const manualData = {
        timestamp: new Date().toISOString(),
        dryBulb: dryBulb,
        wetBulb: wetBulb,
        relativeHumidity: relativeHumidity,
        dewPoint: dewPoint,
        absoluteHumidity: absoluteHumidity,
        partialPressure: partialPressure,
        specificVolume: specificVolume,
        enthalpy: enthalpy
    };
    
    updateCharts(manualData);
    updateParameters(manualData);
}

async function loadDataByTimeRange(range) {
    if (range === 'custom') {
        currentTimeRange = parseInt(document.getElementById('customTimeInput').value) || 60;
    } else {
        currentTimeRange = TIME_RANGES[range];
    }
    
    try {
        console.log(`Loading data for duration: ${currentTimeRange} minutes`);
        const response = await fetch(`/api/history/${currentTimeRange}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        console.log(`Received ${data.length} records from database`);
        
        // Clear existing chart data
        temperatureChart.data.datasets[0].data = [];
        temperatureChart.data.datasets[1].data = [];
        
        // Set the time window
        const now = new Date();
        const cutoffTime = new Date(now - currentTimeRange * 60 * 1000);
        
        // Only add data points within the time window
        data.forEach(record => {
            const timestamp = new Date(record.timestamp);
            if (timestamp >= cutoffTime) {
                temperatureChart.data.datasets[0].data.push({
                    x: timestamp,
                    y: record.dry_bulb
                });
                temperatureChart.data.datasets[1].data.push({
                    x: timestamp,
                    y: record.wet_bulb
                });
            }
        });
        
        // Update chart scales
        temperatureChart.options.scales.x.min = cutoffTime;
        temperatureChart.options.scales.x.max = now;
        
        temperatureChart.update();
        
        // Update the latest values if we have data
        if (data.length > 0) {
            updateParameters(data[data.length - 1]);
        }
    } catch (error) {
        console.error('Error loading historical data:', error);
    }
}

// Add this function to verify database operation
async function checkDatabaseStatus() {
    try {
        const response = await fetch('/api/db/status');
        const data = await response.json();
        console.log('Database status:', data);
        
        // If we have records, load the last hour of data
        if (data.recordCount > 0) {
            await loadDataByTimeRange('1hr');
        }
    } catch (error) {
        console.error('Error checking database status:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts first
    initCharts();
    initializeManualControls();
    initializeWebSocket();

    const timeRange = document.getElementById('timeRange');
    const customTimeContainer = document.getElementById('customTimeContainer');
    const applyCustomTime = document.getElementById('applyCustomTime');

    // Check database status when page loads
    checkDatabaseStatus();

    timeRange.addEventListener('change', function(e) {
        if (e.target.value === 'custom') {
            customTimeContainer.style.display = 'block';
        } else {
            customTimeContainer.style.display = 'none';
            loadDataByTimeRange(e.target.value);
        }
    });

    applyCustomTime.addEventListener('click', function() {
        loadDataByTimeRange('custom');
    });
});

function handleManualUpdate() {
    if (!isManualMode) return;

    const dryBulb = parseFloat(document.getElementById('manual-dry-bulb').value);
    const wetBulb = parseFloat(document.getElementById('manual-wet-bulb').value);
    
    // Calculate other parameters...
    const data = {
        type: 'data',
        source: 'manual',  // Add this line to indicate manual input
        dryBulb: dryBulb,
        wetBulb: wetBulb,
        // ... other calculated values ...
        timestamp: new Date().toISOString()
    };

    // Update the display but don't save to database
    updateParameters(data);
    updateCharts(data);
}
