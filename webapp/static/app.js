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
    dataHistory.push({...data, timestamp});
    
    // Limit history size
    if (dataHistory.length > 1000) dataHistory.shift();

    // Update temperature chart
    const timeRange = document.getElementById('timeRange').value;
    const filteredData = filterDataByTimeRange(timeRange);
    
    // Calculate dynamic y-axis range
    const temperatures = filteredData.flatMap(d => [d.dryBulb, d.wetBulb]);
    const maxTemp = Math.max(...temperatures, data.dryBulb, data.wetBulb);
    const minTemp = Math.min(...temperatures, data.dryBulb, data.wetBulb);
    const padding = 1;

    // Update temperature chart scales
    temperatureChart.options.scales.y.min = Math.floor(minTemp - padding);
    temperatureChart.options.scales.y.max = Math.ceil(maxTemp + padding);
    
    // Update datasets
    temperatureChart.data.datasets[0].data = filteredData.map(d => ({
        x: d.timestamp,
        y: Number(d.dryBulb)
    }));
    temperatureChart.data.datasets[1].data = filteredData.map(d => ({
        x: d.timestamp,
        y: Number(d.wetBulb)
    }));
    
    temperatureChart.update(); // Update with default animation

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

function filterDataByTimeRange(range) {
    const now = new Date();
    let threshold;
    switch(range) {
        case '1h': threshold = new Date(now - 60 * 60 * 1000); break;
        case '6h': threshold = new Date(now - 6 * 60 * 60 * 1000); break;
        case '24h': threshold = new Date(now - 24 * 60 * 60 * 1000); break;
        case '7d': threshold = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
        default: return dataHistory;
    }
    return dataHistory.filter(d => d.timestamp >= threshold);
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
        socket.close();
        isConnected = false;
        updateConnectionStatus();
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${location.host}/ws`;
    
    try {
        socket = new WebSocket(wsUrl);
        
        socket.onopen = function() {
            console.log('WebSocket connection established');
            isConnected = true;
            updateConnectionStatus();
        };

        socket.onmessage = function(event) {
            try {
                lastDataTime = Date.now();
                const message = JSON.parse(event.data);
                
                // Handle different message types
                if (message.type === 'status') {
                    isConnected = message.connected;
                    updateConnectionStatus();
                    if (!isConnected) {
                        // Clear the current readings when disconnected
                        ['dryBulb', 'wetBulb', 'relativeHumidity', 'dewPoint', 
                         'absoluteHumidity', 'partialPressure', 'specificVolume', 'enthalpy']
                            .forEach(id => document.getElementById(id).textContent = '---');
                    }
                } else if (message.type === 'data' && !isManualMode) {
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
            updateConnectionStatus();
        };

        socket.onclose = function() {
            console.log('WebSocket connection closed');
            isConnected = false;
            updateConnectionStatus();
            // Try to reconnect after 5 seconds
            setTimeout(initializeWebSocket, 5000);
        };
    } catch (error) {
        console.error('Error initializing WebSocket:', error);
        isConnected = false;
        updateConnectionStatus();
    }
}

document.getElementById('timeRange').addEventListener('change', function() {
    const filteredData = filterDataByTimeRange(this.value);
    temperatureChart.data.datasets[0].data = filteredData.map(d => ({x: d.timestamp, y: d.dryBulb}));
    temperatureChart.data.datasets[1].data = filteredData.map(d => ({x: d.timestamp, y: d.wetBulb}));
    temperatureChart.update();
});

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
        updateConnectionStatus();
        // Try to reconnect
        socket.close();
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
        timestamp: new Date(),
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
