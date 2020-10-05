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

    createGroupsSQL(values, columns /** For error-throwing purposes */, message) {
        let groupsSQL = ''

        if (Array.isArray(values)) {
            if (values.every(value => typeof value === 'string')) {
                if (columns.length > 1) {
                    if (columns.length === values.length) {
                        if (message === 'Why') console.log('WOW');
                        // Insert the two...
                        groupsSQL = this.createGroupSQL(values, /** isValues === */ true);
                    } else {
                        throw new Error('For inserts with more than one column, the array must contain arrays, or a number of strings equal to the number of the columns.');
                    }
                } else if (columns.length === 1) {
                    if (columns.length === values.length) {
                        groupsSQL += `('${values}')`;
                    } else {
                        values.forEach(value => groupsSQL += this.createGroupSQL(value, /** isValues === */ true) + ',');
                        // get rid of the last ,
                        groupsSQL = groupsSQL.substring(0, groupsSQL.length - 1);
                    }
                    
                } else {
                    throw new Error('Need to define a column. This error shouldn\'t be able to throw here though...');
                }
                
            } else if (values.every(value => Array.isArray(value))) {
                // Look at this monstrosity...
                for (let i = 0; i < values.length; i++) {
                    const value = values[i];
                    let rowSQL = '';
        
                    if(Array.isArray(value)) {
                        // I'm getting hungry...
                        if (columns.length > 0) {
                            if (columns.length === value.length) {
                                rowSQL = this.createGroupSQL(value, /** isValues === */ true);
                            } else if (columns.length > values.length){
                                throw new Error('More columns than values. Add more values or remove columns Shouldn\'t be able to throw here though.');
                            } else {
                                throw new Error('More values than than columns. Add more columns or remove values. Shouldn\'t be able to throw here though.');
                            }
                        } else {
                            throw new Error('Need to define a column. This error shouldn\'t be able to throw here though...');
                        }
                    } else {
                        if (columns.length > 1) {
                            throw new Error('For inserts with more than one column, the array must contain arrays, not strings.');
                        } else if (columns.length === 1) {
                            rowSQL += `('${value}')`;
                        } else {
                            throw new Error('Need to define a column. This error shouldn\'t be able to throw here though...');
                        }
                    }
        
                    if (!Array.isArray(value) && columns.length === 1) {
                        rowSQL += `('${value}')`;
                    } else if (Array.isArray(value)) {
                        rowSQL = this.createGroupSQL(value, /** isValues === */ true);
                    } else if (!Array.isArray(value) && columns.length === 1) {
                        throw new Error('For inserts with more than one column, the array must contain arrays, not strings.');
                    }
        
                    if (i < values.length - 1) {
                        groupsSQL += rowSQL + ', ';
                    } else {
                        groupsSQL += rowSQL; // It's the last one so close the sql;
                    }
        
                }
            } else {
                throw new Error('Make the values in your array identical in type and, if an array, identical in length');
            }
        } else {

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

    async insert(/** String */ table, /** String | String[] */ columns, /** String | String[] */ values, message){
        
        this.guardInsert(columns, values);

        while (Array.isArray(values) && values.length > 5000) {
            this.insertIteration(table, columns, values.splice(0, 5000), message);        
        }
        
        if (Array.isArray(values) && values.length > 0 || typeof values === 'string') {
            this.insertIteration(table, columns, values, message);        
        } 

        // I had bugs where the next query select didn't pick up on it.
        // for some reason a select query gives it time to populate the 
        // db. Idk why this fixes it.
        await this.query('SELECT 1+1;');

    }

    guardInsert(columns, values) {
        const hasColumns = (columns && (Array.isArray(columns) && columns.length > 0));
        const hasValues = (values && ((Array.isArray(values) && values.length > 0) || typeof values === 'string'));

        if (!hasColumns && !hasValues) {
            throw new Error('No columns nor values defined');
        } else if (!hasColumns && hasValues) {
            throw new Error('No columns defined');
        } else if (hasColumns && !hasValues) {
            throw new Error('No values defined');
        } else {
            if (columns.length > 1) {
                if (Array.isArray(values[0])) {
                    if (values[0].length > columns.length) {
                        throw new Error('You have more values than columns. Please add columns or remove values.');
                    } else if (values[0].length < columns.length) {
                        throw new Error('You have more columns than values. Please add values or remove columns.');
                    }
                }
            } else if (columns.length === 1) {
                // if (Array.isArray(values[0]) {}
            } else {
                throw new Error('Shouldn\'t be able to get to this branch... No columns defined...')
            }
        }
    }

    async insertIteration(table, columns, values, message) {
        let insertSQL = this.createIntroInsertSQL(table, columns);
        // a single value
        if (message) console.log('Message in this block:', message);
        
        if (Array.isArray(values)) {
            if (typeof columns === 'string') {
                if (Array.isArray(values[0])) {
                    if (values[0].length > 1) {
                        throw new Error('You can only use single values for single-column inserts, which is all you can do with a string as a column');
                    } else {
                        // Should add null if < 1;
                        insertSQL += this.createGroupsSQL(values, columns) + ';';
                    } 
                } else {
                    if (message) console.log('Message in this block:', message);
                    // Add all the strings
                    insertSQL += this.createGroupsSQL(values, columns, message) + ';'; // Is this how it works?
                }
            } else if (Array.isArray(columns)) {
                if (columns.length > 0) {
                    insertSQL += this.createGroupsSQL(values, columns, message) + ';';
                } else {
                    throw new Error('Must specify at least one column');
                }
            } else {
                throw new Error('The column needs to either be a string or an array')
            }
            
        } else {
            if (typeof columns === 'string') {
                insertSQL +=  `('${values}');`;  
                return this.query(insertSQL);
            } else if (Array.isArray(columns)) {
                if (columns.length > 1) {
                    throw new Error('String as values only works for single-column inserts');
                } else {
                    insertSQL +=  `('${values}');`;  
                    return this.query(insertSQL);
                }
            } else {
                throw new Error('The column needs to either be a string or an array'); 
            }
        }

        // Old
        // if (typeof values === 'string' && typeof columns === 'string' || 
        //     typeof values === 'string' && Array.isArray(columns) && columns.length === 1) {
        //     insertSQL +=  `('${values}');`;  
        //     return this.query(insertSQL);
            
        // } else if (Array.isArray(values)) {
        //     insertSQL += this.createGroupsSQL(values, columns) + ';';
        // } else {
        //     throw new Error('values argument must be of type Array if columns.length > 1.');
        // }

        if (message === 'Why') console.log(insertSQL);

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