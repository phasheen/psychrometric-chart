let socket;
let temperatureChart;
let psychroChart;

if (location.protocol === 'https:') {
    socket = new WebSocket('wss://' + location.host);
} else {
    socket = new WebSocket('ws://' + location.host);
}
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
                    fill: false
                },
                {
                    label: 'Wet Bulb',
                    data: [],
                    borderColor: 'blue',
                    fill: false
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
                        unit: 'minute'
                    }
                },
                y: {
                    // beginAtZero: false,
                    // suggestedMin: 20,
                    // suggestedMax: 30,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });

    // Initialize psychrometric chart
    initPsychroChart();
}

function updateCharts(data) {
    // Add null check at the start
    if (!data) {
        console.warn('No data provided to updateCharts');
        return;
    }

    // Add validation and logging
    if (!data || typeof data.dryBulb !== 'number' || typeof data.relativeHumidity !== 'number') {
        console.warn('Invalid data received:', data);
        return;
    }

    console.log('Updating charts with data:', data);

    const timestamp = new Date(data.timestamp);
    dataHistory.push({...data, timestamp});
    if (dataHistory.length > 1000) dataHistory.shift();

    // Update temperature chart (in Celsius)
    const timeRange = document.getElementById('timeRange').value;
    const filteredData = filterDataByTimeRange(timeRange);
    
    // Calculate dynamic y-axis range
    const temperatures = filteredData.flatMap(d => [d.dryBulb, d.wetBulb]);
    const maxTemp = Math.max(...temperatures, data.dryBulb, data.wetBulb);
    const minTemp = Math.min(...temperatures, data.dryBulb, data.wetBulb);
    const padding = 1;
    
    // Update temperature chart
    temperatureChart.options.scales.y.min = Math.floor(minTemp - padding);
    temperatureChart.options.scales.y.max = Math.ceil(maxTemp + padding);
    temperatureChart.data.datasets[0].data = filteredData.map(d => ({x: d.timestamp, y: d.dryBulb}));
    temperatureChart.data.datasets[1].data = filteredData.map(d => ({x: d.timestamp, y: d.wetBulb}));
    temperatureChart.update();

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
    } else {
        console.warn('viewModel not initialized');
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
    document.getElementById('dryBulb').textContent = data.dryBulb.toFixed(2);
    document.getElementById('wetBulb').textContent = data.wetBulb.toFixed(2);
    document.getElementById('relativeHumidity').textContent = data.relativeHumidity.toFixed(2);
    document.getElementById('dewPoint').textContent = data.dewPoint.toFixed(2);
    document.getElementById('absoluteHumidity').textContent = data.absoluteHumidity.toFixed(2);
    document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();
}

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (!isManualMode) {
        updateCharts(data);
        updateReadings(data);
    }
};

socket.onerror = function(error) {
    console.error('WebSocket Error:', error);
    isConnected = false;
    updateConnectionStatus();
};

socket.onclose = function(event) {
    console.log('WebSocket connection closed:', event.code, event.reason);
    isConnected = false;
    updateConnectionStatus();
    
    // Implement reconnection logic
    setTimeout(function() {
        console.log('Attempting to reconnect...');
        initializeWebSocket(); // Create a function to handle WebSocket initialization
    }, 5000);
};

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
    updateParameters(DEFAULT_VALUES);
    updateCharts(DEFAULT_VALUES);
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

// Update WebSocket handlers
socket.onopen = function() {
    isConnected = true;
    updateConnectionStatus();
};

socket.onclose = function() {
    isConnected = false;
    updateConnectionStatus();
};

function updateConnectionStatus() {
    const indicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('status-text');
    
    indicator.classList.toggle('connected', isConnected);
    statusText.textContent = isConnected ? 'Connected to Sensor' : 'Disconnected';
}

// Initialize with defaults when page loads
window.addEventListener('load', function() {
    // Make sure DOM is fully loaded and sized before initialization
    requestAnimationFrame(() => {
        initCharts();
        initializeManualControls();
        initializeWithDefaults();
        updateConnectionStatus();
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const inputToggle = document.getElementById('input-toggle');
    const manualControls = document.getElementById('manual-controls');
    const updateButton = document.getElementById('update-manual');

    inputToggle.addEventListener('change', function() {
        isManualMode = !this.checked;
        manualControls.style.display = isManualMode ? 'block' : 'none';
        document.getElementById('mode-text').textContent = isManualMode ? 'Manual Input' : 'Sensor Input';
        
        if (isManualMode) {
            // Set initial manual values
            document.getElementById('manual-dry-bulb').value = DEFAULT_VALUES.dryBulb;
            document.getElementById('manual-wet-bulb').value = DEFAULT_VALUES.wetBulb;
            document.getElementById('manual-rh').value = DEFAULT_VALUES.relativeHumidity;
        }
    });

    updateButton.addEventListener('click', function() {
        if (isManualMode) {
            const manualData = {
                timestamp: new Date(),
                dryBulb: parseFloat(document.getElementById('manual-dry-bulb').value),
                wetBulb: parseFloat(document.getElementById('manual-wet-bulb').value),
                relativeHumidity: parseFloat(document.getElementById('manual-rh').value)
            };
            updateCharts(manualData);
            updateReadings(manualData);
        }
    });
});

function updateReadings(data) {
    document.getElementById('dryBulb').textContent = data.dryBulb.toFixed(1);
    document.getElementById('wetBulb').textContent = data.wetBulb.toFixed(1);
    document.getElementById('relativeHumidity').textContent = data.relativeHumidity.toFixed(1);
    document.getElementById('dewPoint').textContent = calculateDewPoint(data.dryBulb, data.relativeHumidity).toFixed(1);
    document.getElementById('absoluteHumidity').textContent = calculateAbsoluteHumidity(data.dryBulb, data.relativeHumidity).toFixed(1);
    document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleTimeString();
}

function initializeManualControls() {
    const manualInputs = ['manual-dry-bulb', 'manual-wet-bulb', 'manual-rh'];
    
    manualInputs.forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', function() {
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
    });
}

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

// Update WebSocket connection code
function initializeWebSocket() {
    if (location.protocol === 'https:') {
        socket = new WebSocket('wss://' + location.host + '/ws');
    } else {
        socket = new WebSocket('ws://' + location.host + '/ws');
    }

    socket.onopen = function() {
        console.log('WebSocket connected');
        isConnected = true;
        updateConnectionStatus();
    };

    socket.onclose = function(event) {
        console.log('WebSocket disconnected:', event.code, event.reason);
        isConnected = false;
        updateConnectionStatus();
        
        // Attempt to reconnect
        setTimeout(initializeWebSocket, 5000);
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        isConnected = false;
        updateConnectionStatus();
    };
}

// Initialize WebSocket connection
initializeWebSocket();

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
