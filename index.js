const mysql = require('mysql');

class PQuery {
    constructor(options) {
        this.user       = options.user     || process.env.USER;
        this.password   = options.password || process.env.PASSWORD;
        this.db         = options.db       || process.env.DATABASE;
        this.connection = mysql.createConnection({
            user:     this.user,
            password: this.password,
            database: this.db
        })
        this.authErrorThrown = false;

        this.testConnection();
    }
    
    testConnection(endAfterTest, cb) {
        return this.query('SHOW DATABASES;')
        .then( () => {
            if (endAfterTest && !this.connection._protocol._quitSequence) this.connection.end();
            return 'Connection established';
        })
        .catch(() => { 
            this.authErrorThrown = true;
            if (!this.connection._protocol._quitSequence) this.connection.end();
            throw new Error('Your credentials suck. Replace them.');
        })
        .catch(() => {})

    }; 

    async createDb(dbName) {
        await this.query(`CREATE DATABASE IF NOT EXISTS ${dbName};`);
    }

    async dropDb(dbName) {
        await this.query(`DROP DATABASE IF EXISTS ${dbName};`);
    }

    insert(table, columns, values){
        let sql = ''
        let startingSQL = `INSERT INTO ${table} (`;
        sql += startingSQL;
        
        // Add the columns
        if (Array.isArray(columns)) {
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                if (i < columns.length - 1) {
                    sql += col + ', '
                } else {
                    sql += col + ')'
                }
            }
        } else {
            throw new Error('Under construction...')
        }
        
        // Add the values
        sql += ' VALUES '

        // a single value
        if (typeof values === 'string') {
            sql +=  `('${values}')`;  
        // multiple value
        } else if (Array.isArray(values)) {
            for (let i = 0; i < values.length; i++) {
                const value = values[i];
                // Iterate over the values...
                // If it's an array of strings...
                // esp. if there's only one column...
                let newStr = '(';
                if (typeof value === 'string' && columns.length === 1) {
                    newStr += `'${value}')`;
                } else if (typeof value === 'string' && columns.length === 1) {
                    throw new Error('For inserts with more than one column, the array must contain arrays, not strings.')
                } else if (Array.isArray(value)) {
                    // Add each...
                    for (let i = 0; i < value.length; i++) {
                        const innerValue = value[i];
                        if (i < value.length - 1) {
                            newStr += `'${innerValue}'`  + ','
                        } else {
                            newStr += `'${innerValue}'` + ')'
                        }
                    }
                }
                
                if (i < values.length - 1) {
                    sql += newStr + ', '
                } else {
                    sql += newStr + ';' // It's the last one so clase the sql;
                }
                
            }
        } else {
            throw new Error('values argument must be of type Array.');
        }
        return this.query(sql);

    }

    async listAvailableDbs() {
        let rawDbs = await this.query('SHOW DATABASES;');
        let dbs = rawDbs.map(row => row.Database);
        return dbs;
    }

    query(query_string) {
        return new Promise((resolve, reject) => {
            this.connection.query(query_string, (err, results) => {
                if (err) reject(err);
                resolve(results);
            })
        });
    }

    async showCurrentDb() {
        let currentDb = await this.query('SELECT DATABASE()');
        currentDb = currentDb.map(res => res['DATABASE()'])[0];
        return currentDb;
    }

    async showCurrentDbTables() {
        let rawTables  = await this.query('SHOW TABLES;');
        let tables     = rawTables.map(table => table[`Tables_in_${this.db}`]);
        return tables;
    }

    async useDb(dbName) {
        this.db = dbName; // Need typechecking.
        this.query(`USE ${dbName};`);
    }

    
}

new PQuery({user: 'foo', password: 'bar'});


module.exports = PQuery;