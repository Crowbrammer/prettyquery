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

    async createDb(dbName) {
        await this.query(`CREATE DATABASE IF NOT EXISTS ${dbName};`);
    }

    createIntroInsertSQL(table, columns) {
        let insertSQL = `INSERT INTO ${table}`
        insertSQL += this.createGroupSQL(columns);
        return insertSQL += ' VALUES ';
    }

    createGroupsSQL(values, columns /** For error-throwing purposes */) {
        let groupsSQL = ''
        
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            let rowSQL = '';
            if (typeof value === 'string' && columns.length === 1) {
                rowSQL += `('${value}')`;
            } else if (Array.isArray(value)) {
                rowSQL = this.createGroupSQL(value, /** isValues === */ true);
            } else if (typeof value === 'string' && columns.length === 1) {
                throw new Error('For inserts with more than one column, the array must contain arrays, not strings.');
            }

            if (i < values.length - 1) {
                groupsSQL += rowSQL + ', ';
            } else {
                groupsSQL += rowSQL; // It's the last one so close the sql;
            }

        }
        return groupsSQL;
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

    async dropDb(dbName) {
        await this.query(`DROP DATABASE IF EXISTS ${dbName};`);
    }
	
    async dropTable(tableName) {
        await this.query(`DROP TABLE IF EXISTS ${tableName};`);
    }

    async insert(/** String */ table, /** String | String[] */ columns, /** String | String[] */ values){

        while (Array.isArray(values) && values.length > 5000) {
            this.insertIteration(table, columns, values.splice(0, 5000));        
        }
        
        if (Array.isArray(values) && values.length > 0 || typeof values === 'string') {
            this.insertIteration(table, columns, values);        
        } 

        // I had bugs where the next query select didn't pick up on it.
        // for some reason a select query gives it time to populate the 
        // db. Idk why this fixes it.
        await this.query('SELECT 1+1;');

    }

    async insertIteration(table, columns, values) {
        let insertSQL = this.createIntroInsertSQL(table, columns);
        // a single value
        if (typeof values === 'string' && typeof columns === 'string' || 
            typeof values === 'string' && Array.isArray(columns) && columns.length === 1) {
            insertSQL +=  `('${values}');`;  
            return this.query(insertSQL);
            
        } else if (Array.isArray(values)) {
            insertSQL += this.createGroupsSQL(values, columns) + ';';
        } else {
            throw new Error('values argument must be of type Array if columns.length > 1.');
        }

        await this.query(insertSQL);
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

    async useDb(dbName) {
        this.db = dbName; // Need typechecking.
        this.query(`USE ${dbName};`);
    }

    
}

new PQuery({user: 'foo', password: 'bar'});

module.exports = PQuery;