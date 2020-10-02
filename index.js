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
        let startingSQL = `INSERT INTO ${table} `; // Note the space
        let sql = ''
        sql += startingSQL;
        sql += this.createGroupSQL(columns);
        
        // Add the values
        sql += ' VALUES '

        // a single value
        if (typeof values === 'string') {
            sql +=  `('${values}')`;  
        // multiple value
        } else if (Array.isArray(values)) {
            for (let i = 0; i < values.length; i++) {
                const value = values[i];
                let rowSQL = '';
                if (typeof value === 'string' && columns.length === 1) {
                    rowSQL += `('${value}')`;
                } else if (Array.isArray(value)) {
                    rowSQL = this.createGroupSQL(value, /** isValues === */ true); 
                } else if (typeof value === 'string' && columns.length === 1) {
                    throw new Error('For inserts with more than one column, the array must contain arrays, not strings.')
                } 
                
                if (i < values.length - 1) {
                    sql += rowSQL + ', '
                } else {
                    sql += rowSQL + ';' // It's the last one so close the sql;
                }
                
            }
        } else {
            throw new Error('values argument must be of type Array.');
        }
        this.query(sql);

    }

    createGroupSQL(groupArray, isValues) {
        let groupSQL = '(';
        if (Array.isArray(groupArray)) {
            for (let i = 0; i < groupArray.length; i++) {
                const member = groupArray[i];
                if (i < groupArray.length - 1) {
                    
                    groupSQL = this.addMemberToGroupSQL(isValues, /** isEnd === */ false, groupSQL, member);
                } else {
                    groupSQL = this.addMemberToGroupSQL(isValues, /** isEnd === */ true, groupSQL, member);
                }
            }
        } else if (typeof groupArray === 'string') {
            groupSQL = this.addMemberToGroupSQL(isValues, /** isEnd === */ true, groupSQL, /** member === */ groupArray);
        } else {
            throw new Error('Under construction...');
        }
        return groupSQL;
    }

    addMemberToGroupSQL(isValues, isEnd, /** String */ groupSQL, /** String */ member) {
        if (!isEnd) {
            // SQL syntax requires values (but not column) to have quotes (')
            if (isValues) {
                groupSQL += `'${member}'` + ', ';
            } else {
                groupSQL += member + ', ';
            }
        } else {
            if (isValues) {
                groupSQL += `'${member}'` + ')';
            } else {
                groupSQL += member + ')';
            }
        }
        return /** String */ groupSQL;
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