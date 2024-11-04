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
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${location.host}/ws`;
    
    try {
        socket = new WebSocket(wsUrl);
        
        socket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (!isManualMode) {
                    updateCharts(data);
                    updateParameters(data);
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        socket.onopen = function() {
            console.log('WebSocket connected');
            isConnected = true;
            updateConnectionStatus();
        };

        socket.onerror = function(error) {
            console.error('WebSocket Error:', error);
            isConnected = false;
            updateConnectionStatus();
        };

        socket.onclose = function() {
            console.log('WebSocket connection closed');
            isConnected = false;
            updateConnectionStatus();
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
    const defaultData = {
        dryBulb: DEFAULT_VALUES.dryBulb,
        wetBulb: DEFAULT_VALUES.wetBulb,
        relativeHumidity: DEFAULT_VALUES.relativeHumidity,
        timestamp: new Date()
    };

    // Initialize charts first
    initCharts();
    
    // Then update with default values
    setTimeout(() => {
        updateCharts(defaultData);
        updateParameters(defaultData);
    }, 100);
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
        initializeWithDefaults();
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
            const manualData = {
                timestamp: new Date(),
                dryBulb: parseFloat(document.getElementById('manual-dry-bulb').value),
                wetBulb: parseFloat(document.getElementById('manual-wet-bulb').value),
                relativeHumidity: parseFloat(document.getElementById('manual-rh').value)
            };
            updateCharts(manualData);
            updateParameters(manualData);
        }
    });
}
