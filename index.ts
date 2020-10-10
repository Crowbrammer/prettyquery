const mysql = require('mysql');

class PQuery {
    user: string;
    password: string;
    db: string | void;
    connection: any;
    authErrorThrown: boolean;
    constructor(options: { user?: any; password?: any; db?: any; } = {}) {
        this.user       = options.user     || process.env.USER;
        this.password   = options.password || process.env.PASSWORD;
        this.db         = options.db     
        this.connection = mysql.createConnection({
            user:     this.user,
            password: this.password,
            database: this.db
        })
        this.authErrorThrown = false;
        this.testConnection();
    }

    addMemberToGroupSQL(isValues: any, isEnd: boolean, /** String */ groupSQL: string = '(', /** String */ member: string) {

        if (isEnd) {
            if (isValues) {
                if (isSQLFunction(member)) { // Don't use ' ' for functions.
                    groupSQL += `${member}` + ')';
                } else {
                    groupSQL += `'${member}'` + ')';
                }
            } else {
                groupSQL += member + ')';
            }
        } else {
            // SQL syntax requires values (but not column) to have quotes (')
            if (isValues) {
                if (isSQLFunction(member)) { // Don't use ' ' for functions.
                    groupSQL += `${member}` + ', ';
                } else {
                    groupSQL += `'${member}'` + ', ';
                }
                
            } else {
                groupSQL += member + ', ';
            }
        }
        return /** String */ groupSQL;
    }

    async createDb(dbName: any) {
        await this.query(`CREATE DATABASE IF NOT EXISTS ${dbName};`);
    }

    createIntroInsertSQL(table: any, columns: any) {
        let insertSQL = `INSERT INTO ${table}`
        insertSQL += this.createGroupSQL(columns);
        return insertSQL += ' VALUES ';
    }

    /**
     * Values can be interpreted four ways:
     *  - A string, for a single column, single row insert
     *  - An array of strings, for a single-to-multi column, single row insert--Must be equal to column width
     *  - An array of strings, for a single column, multi-row insert
     *  - An array of arrays of strings, for a single-to-multi-column, single-to-many-row insert
     * 
     * I tried to appease everyone here. I should be more 
     * opinionated on how this should work. "There should be
     * only one right way to do this" will be my mantra from now on.
     * 
     * @param columns An Array[string[]], string[], or string for values
     * @param values An Array[string[]], string[], or string for values
     * @param message A message for debugging
     */
    createGroupsSQL(columns: string | any[], values: string | any[], /** For error-throwing purposes */ message?: string) {

        let groupsSQL = '';

        if (isArrayOfArrays(values as any[])) {
            for (let i = 0; i < values.length; i++) {
                const value = values[i];
                let rowSQL = '';
    
                if(Array.isArray(value)) {
                    rowSQL = this.createGroupSQL(value, /** isValues === */ true);
                } else {
                    if (columns.length === 1) {
                        if (isSQLFunction(values as string)) { // Don't use ' ' for functions.
                            rowSQL += `(${value})`;
                        } else {
                            rowSQL += `('${value}')`;
                       }
                    } else {
                        throw new Error('You shouldn\'t be able to get here...')
                    }
                }
    
                if (i < values.length - 1) {
                    groupsSQL += rowSQL + ', ';
                } else {
                    groupsSQL += rowSQL; // It's the last one so close the sql;
                }
            }
        } else {
            if (columns.length > 1) {
                if (columns.length === values.length) {
                    // Insert the two...
                    groupsSQL = this.createGroupSQL(values, /** isValues === */ true);
                } else {
                    throw new Error('For inserts with more than one column, the array must contain arrays, or a number of strings equal to the number of the columns.');
                }
            } else if (columns.length === 1) {
                if (columns.length === values.length) {
                    groupsSQL += `('${values}')`;
                } else {
                    (values as any[]).forEach(value => groupsSQL += this.createGroupSQL(value, /** isValues === */ true) + ',');
                    // get rid of the last ,
                    groupsSQL = groupsSQL.substring(0, groupsSQL.length - 1);
                }
                
            } else {
                throw new Error('Need to define a column. This error shouldn\'t be able to throw here though...');
            }
        }

        return groupsSQL;
    }

    createGroupSQL(groupArray: string | any[], isValues?: boolean) {
        let groupSQL;
        if (Array.isArray(groupArray)) {
            for (let i = 0; i < groupArray.length; i++) {
                const member = groupArray[i];
                if (isTheEndOf(i, groupArray)) {
                    groupSQL = this.addMemberToGroupSQL(isValues, /** isEnd === */ false, groupSQL, member);
                } else {
                    groupSQL = this.addMemberToGroupSQL(isValues, /** isEnd === */ true, groupSQL, member);
                }
            }
        } else {
            groupSQL = this.addMemberToGroupSQL(isValues, /** isEnd === */ true, groupSQL, /** member === */ groupArray);
        } 
        return groupSQL;
    }

    async dropDb(dbName: any) {
        await this.query(`DROP DATABASE IF EXISTS ${dbName};`);
    }
	
    async dropTable(tableName: any) {
        await this.query(`DROP TABLE IF EXISTS ${tableName};`);
    }

    async insert(/** String */ table: any, /** String | String[] */ columns: any, /** String | String[] */ values: any[], message: any){
        
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

    guardInsert(columns: string | any[], values: string | any[]) {
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

    async insertIteration(table: any, columns: string | any[], values: string | any[], message: string) {
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
                        insertSQL += this.createGroupsSQL(columns, values) + ';';
                    } 
                } else {
                    if (message) console.log('Message in this block:', message);
                    // Add all the strings
                    insertSQL += this.createGroupsSQL(columns, values, message) + ';'; // Is this how it works?
                }
            } else if (Array.isArray(columns)) {
                if (columns.length > 0) {
                    insertSQL += this.createGroupsSQL(columns, values, message) + ';';
                } else {
                    throw new Error('Must specify at least one column');
                }
            } else {
                throw new Error('The column needs to either be a string or an array')
            }
            
        } else {
            if (typeof columns === 'string') {
                if (isSQLFunction(values)) { // Don't use ' ' for functions.
                    insertSQL +=  `(${values});`;  
                } else {
                    insertSQL +=  `('${values}');`;  
                }
                return this.query(insertSQL);
            } else if (Array.isArray(columns)) {
                if (columns.length > 1) {
                    throw new Error('String as values only works for single-column inserts');
                } else {
                    if (isSQLFunction(values)) { // Don't use ' ' for functions.
                        insertSQL +=  `(${values});`;  
                    } else {
                        insertSQL +=  `('${values}');`;  
                    }
                    return this.query(insertSQL);
                }
            } else {
                throw new Error('The column needs to either be a string or an array'); 
            }
        }

        await this.query(insertSQL);
    }

    async listAvailableDbs() {
        let rawDbs = await this.query('SHOW DATABASES;');
        let dbs = rawDbs.map((row: { Database: any; }) => row.Database);
        return dbs;
    }

    query(query_string: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(query_string, (err: any, results: any) => {
                if (err) reject(err);
                resolve(results);
            })
        });
    }

    async select(selector: string, table: string, whereColumn: string, whereValue: string): Promise<any> {
        if (whereColumn && whereValue) {
            return this.query(`SELECT ${selector} FROM ${table} WHERE ${whereColumn} = ${whereValue}`);
        } else if (whereColumn && !whereValue || !whereColumn && whereValue) {
            throw new Error('If a where argument is provided, both the cloumn and the value need to be provided');
        } else {
            return this.query(`SELECT ${selector} FROM ${table};`);
        }
    };

    async showCurrentDb() {
        let currentDb = await this.query('SELECT DATABASE()');
        currentDb = currentDb.map((res: { [x: string]: any; }) => res['DATABASE()'])[0];
        return currentDb;
    }

    async showCurrentDbTables() {
        let rawTables  = await this.query('SHOW TABLES;');
        let tables     = rawTables.map((table: { [x: string]: any; }) => table[`Tables_in_${this.db}`]);
        return tables;
    }
    
    async testConnection(endAfterTest?: boolean, cb?: undefined) {
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

    async useDb(dbName: string) {
        this.db = dbName; 
        this.query(`USE ${dbName};`);
    }

    
}

module.exports = PQuery;

function isTheEndOf(i: number, groupArray: any[]) {
    return i < groupArray.length - 1;
}

function isArrayOfArrays(values: any[]) {
    return values.every(value => Array.isArray(value));
}

function isSQLFunction(columns: string) {
    return /\w+\(\)/.test(columns);
}
