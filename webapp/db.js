// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        const dbPath = path.join(__dirname, 'measurements.db');
        console.log('Creating/Opening database at:', dbPath);
        
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Successfully connected to database');
                this.init();
            }
        });
    }

    init() {
        console.log('Initializing database table...');
        this.db.run(`
            CREATE TABLE IF NOT EXISTS measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                dry_bulb REAL,
                wet_bulb REAL,
                relative_humidity REAL,
                dew_point REAL,
                absolute_humidity REAL,
                partial_pressure REAL,
                specific_volume REAL,
                enthalpy REAL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            } else {
                console.log('Table created/verified successfully');
            }
        });
    }

    insertMeasurement(data) {
        const stmt = this.db.prepare(`
            INSERT INTO measurements (
                timestamp, dry_bulb, wet_bulb, relative_humidity,
                dew_point, absolute_humidity, partial_pressure,
                specific_volume, enthalpy
            ) VALUES (datetime('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
            data.dryBulb,
            data.wetBulb,
            data.relativeHumidity,
            data.dewPoint,
            data.absoluteHumidity,
            data.partialPressure,
            data.specificVolume,
            data.enthalpy
        ]);
        
        stmt.finalize();
    }

    async getMeasurements(duration) {
        return new Promise((resolve, reject) => {
            console.log('Querying database with duration:', duration);
            
            const sql = `
                SELECT * FROM measurements 
                WHERE timestamp >= datetime('now', '-' || ? || ' minutes', 'localtime')
                AND timestamp <= datetime('now', 'localtime')
                ORDER BY timestamp ASC
            `;
            
            this.db.all(sql, [duration], (err, rows) => {
                if (err) {
                    console.error('Database query error:', err);
                    reject(err);
                } else {
                    console.log(`Query results:
                        - Duration requested: ${duration} minutes
                        - Records found: ${rows.length}
                        - Time range: ${rows.length > 0 ? 
                            `${rows[0].timestamp} to ${rows[rows.length-1].timestamp}` 
                            : 'no data'}`);
                    resolve(rows);
                }
            });
        });
    }

    async checkDatabase() {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT COUNT(*) as count FROM measurements", (err, row) => {
                if (err) {
                    console.error('Error checking database:', err);
                    reject(err);
                } else {
                    console.log('Current number of measurements:', row.count);
                    resolve(row.count);
                }
            });
        });
    }
}

module.exports = new Database();