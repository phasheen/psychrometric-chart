const socket = new WebSocket('ws://' + location.host);
let temperatureChart, psychroChart;
const dataHistory = [];

function initCharts() {
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
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });

    const psychroCtx = document.getElementById('psychroChart').getContext('2d');
    psychroChart = new Chart(psychroCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Current State',
                data: [],
                pointBackgroundColor: 'green'
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Dry Bulb Temperature (°C)'
                    },
                    min: 0,
                    max: 50
                },
                y: {
                    title: {
                        display: true,
                        text: 'Humidity Ratio (g/kg)'
                    },
                    min: 0,
                    max: 30
                }
            }
        }
    });

    // Add psychrometric chart background lines here
    addPsychrometricLines();
}

function addPsychrometricLines() {
    // This is a simplified version. You may need to adjust these calculations for accuracy.
    const rhLines = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    rhLines.forEach(rh => {
        const lineData = [];
        for (let t = 0; t <= 50; t += 5) {
            const w = calculateHumidityRatio(t, rh);
            lineData.push({x: t, y: w});
        }
        psychroChart.data.datasets.push({
            label: `${rh}% RH`,
            data: lineData,
            showLine: true,
            fill: false,
            borderColor: 'rgba(200,200,200,0.5)',
            pointRadius: 0
        });
    });
    psychroChart.update();
}

function calculateHumidityRatio(dryBulb, rh) {
    // This is a simplified calculation. For more accuracy, use proper psychrometric formulas.
    const es = 6.112 * Math.exp((17.67 * dryBulb) / (dryBulb + 243.5));
    const e = (rh / 100) * es;
    return 0.622 * (e / (101.325 - e)) * 1000; // g/kg
}

function updateCharts(data) {
    const timestamp = new Date(data.timestamp);
    dataHistory.push({...data, timestamp});
    if (dataHistory.length > 1000) dataHistory.shift(); // Keep last 1000 points

    const timeRange = document.getElementById('timeRange').value;
    const filteredData = filterDataByTimeRange(timeRange);

    temperatureChart.data.datasets[0].data = filteredData.map(d => ({x: d.timestamp, y: d.dryBulb}));
    temperatureChart.data.datasets[1].data = filteredData.map(d => ({x: d.timestamp, y: d.wetBulb}));
    temperatureChart.update();

    psychroChart.data.datasets[0].data = [{
        x: data.dryBulb,
        y: calculateHumidityRatio(data.dryBulb, data.relativeHumidity)
    }];
    psychroChart.update();
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
    updateCharts(data);
    updateParameters(data);
};

document.getElementById('timeRange').addEventListener('change', function() {
    const filteredData = filterDataByTimeRange(this.value);
    temperatureChart.data.datasets[0].data = filteredData.map(d => ({x: d.timestamp, y: d.dryBulb}));
    temperatureChart.data.datasets[1].data = filteredData.map(d => ({x: d.timestamp, y: d.wetBulb}));
    temperatureChart.update();
});

window.onload = initCharts;
