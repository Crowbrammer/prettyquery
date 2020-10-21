const mysql = require('mysql');
const esc = require('sql-escape');
class PQuery {
    constructor(options = {}) {
        this.user = options.user || process.env.USER;
        this.password = options.password || process.env.PASSWORD;
        this.db = options.db;
        this.connection = mysql.createConnection({
            user: this.user,
            password: this.password,
            database: this.db
        });
        this.authErrorThrown = false;
        this.testConnection();
    }
    addMemberToGroupSQL(isValues, isEnd, groupSQL = '(', member) {
        if (isEnd) {
            if (isValues) {
                if (isSQLFunction(member)) {
                    groupSQL += `${member}` + ')';
                }
                else {
                    groupSQL += `'${esc(String(member))}'` + ')';
                }
            }
            else {
                groupSQL += member + ')';
            }
        }
        else {
            if (isValues) {
                if (isSQLFunction(member)) {
                    groupSQL += `${member}` + ', ';
                }
                else {
                    groupSQL += `'${esc(String(member))}'` + ', ';
                }
            }
            else {
                groupSQL += member + ', ';
            }
        }
        return groupSQL;
    }
    async createDb(dbName) {
        await this.query(`CREATE DATABASE IF NOT EXISTS ${dbName};`);
    }
    createIntroInsertSQL(table, columns, ignore) {
        let insertSQL;
        if (ignore) {
            insertSQL = `INSERT IGNORE INTO ${table}`;
        }
        else {
            insertSQL = `INSERT INTO ${table}`;
        }
        insertSQL += this.createGroupSQL(columns);
        return insertSQL += ' VALUES ';
    }
    createGroupsSQL(columns, values, message) {
        let groupsSQL = '';
        if (isArrayOfArrays(values)) {
            for (let i = 0; i < values.length; i++) {
                const value = values[i];
                let rowSQL = '';
                if (Array.isArray(value)) {
                    rowSQL = this.createGroupSQL(value, true);
                }
                else {
                    if (columns.length === 1) {
                        if (isSQLFunction(values)) {
                            rowSQL += `(${value})`;
                        }
                        else {
                            rowSQL += `('${esc(String(value))}')`;
                        }
                    }
                    else {
                        throw new Error('You shouldn\'t be able to get here...');
                    }
                }
                if (i < values.length - 1) {
                    groupsSQL += rowSQL + ', ';
                }
                else {
                    groupsSQL += rowSQL;
                }
            }
        }
        else {
            if (columns.length > 1) {
                if (columns.length === values.length) {
                    groupsSQL = this.createGroupSQL(values, true);
                }
                else {
                    throw new Error('For inserts with more than one column, the array must contain arrays, or a number of strings equal to the number of the columns.');
                }
            }
            else if (columns.length === 1) {
                if (columns.length === values.length) {
                    if (Array.isArray(values)) {
                        groupsSQL += `('${esc(String(values[0]))}')`;
                    }
                    else {
                        groupsSQL += `('${esc(String(values))}')`;
                    }
                }
                else {
                    values.forEach(value => groupsSQL += this.createGroupSQL(value, true) + ',');
                    groupsSQL = groupsSQL.substring(0, groupsSQL.length - 1);
                }
            }
            else {
                throw new Error('Need to define a column. This error shouldn\'t be able to throw here though...');
            }
        }
        return groupsSQL;
    }
    createGroupSQL(groupArray, isValues) {
        let groupSQL;
        if (Array.isArray(groupArray)) {
            for (let i = 0; i < groupArray.length; i++) {
                const member = groupArray[i];
                if (isTheEndOf(i, groupArray)) {
                    groupSQL = this.addMemberToGroupSQL(isValues, false, groupSQL, member);
                }
                else {
                    groupSQL = this.addMemberToGroupSQL(isValues, true, groupSQL, member);
                }
            }
        }
        else {
            groupSQL = this.addMemberToGroupSQL(isValues, true, groupSQL, groupArray);
        }
        return groupSQL;
    }
    async dropDb(dbName) {
        await this.query(`DROP DATABASE IF EXISTS ${dbName};`);
    }
    async dropTable(tableName) {
        await this.query(`DROP TABLE IF EXISTS ${tableName};`);
    }
    async insert(table, columns, values, ignore, message) {
        this.guardInsert(columns, values);
        const promises = [];
        while (Array.isArray(values) && values.length > 5000) {
            promises.push(this.insertIteration(table, columns, values.splice(0, 5000), ignore, message));
        }
        if (Array.isArray(values) && values.length > 0 || typeof values === 'string') {
            promises.push(this.insertIteration(table, columns, values, ignore, message));
        }
        await Promise.all(promises);
    }
    guardInsert(columns, values) {
        const hasColumns = (columns && (Array.isArray(columns) && columns.length > 0));
        const hasValues = (values && ((Array.isArray(values) && values.length > 0) || typeof values === 'string'));
        if (!hasColumns && !hasValues) {
            throw new Error('No columns nor values defined');
        }
        else if (!hasColumns && hasValues) {
            throw new Error('No columns defined');
        }
        else if (hasColumns && !hasValues) {
            throw new Error('No values defined');
        }
        else {
            if (columns.length > 1) {
                if (Array.isArray(values[0])) {
                    if (values[0].length > columns.length) {
                        throw new Error('You have more values than columns. Please add columns or remove values.');
                    }
                    else if (values[0].length < columns.length) {
                        throw new Error('You have more columns than values. Please add values or remove columns.');
                    }
                }
            }
            else if (columns.length === 1) {
            }
            else {
                throw new Error('Shouldn\'t be able to get to this branch... No columns defined...');
            }
        }
    }
    async insertIteration(table, columns, values, ignore, message) {
        let insertSQL = this.createIntroInsertSQL(table, columns, ignore);
        if (message)
            console.log('Message in this block:', message);
        if (Array.isArray(values)) {
            if (typeof columns === 'string') {
                if (Array.isArray(values[0])) {
                    if (values[0].length > 1) {
                        throw new Error('You can only use single values for single-column inserts, which is all you can do with a string as a column');
                    }
                    else {
                        insertSQL += this.createGroupsSQL(columns, values) + ';';
                    }
                }
                else {
                    if (message)
                        console.log('Message in this block:', message);
                    insertSQL += this.createGroupsSQL(columns, values, message) + ';';
                }
            }
            else if (Array.isArray(columns)) {
                if (columns.length > 0) {
                    insertSQL += this.createGroupsSQL(columns, values, message) + ';';
                }
                else {
                    throw new Error('Must specify at least one column');
                }
            }
            else {
                throw new Error('The column needs to either be a string or an array');
            }
        }
        else {
            if (typeof columns === 'string') {
                if (isSQLFunction(values)) {
                    insertSQL += `(${values});`;
                }
                else {
                    insertSQL += `('${values}');`;
                }
                return this.query(insertSQL);
            }
            else if (Array.isArray(columns)) {
                if (columns.length > 1) {
                    throw new Error('String as values only works for single-column inserts');
                }
                else {
                    if (isSQLFunction(values)) {
                        insertSQL += `(${values});`;
                    }
                    else {
                        insertSQL += `('${values}');`;
                    }
                    return this.query(insertSQL);
                }
            }
            else {
                throw new Error('The column needs to either be a string or an array');
            }
        }
        return this.query(insertSQL);
    }
    async listAvailableDbs() {
        let rawDbs = await this.query('SHOW DATABASES;');
        let dbs = rawDbs.map((row) => row.Database);
        return dbs;
    }
    query(query_string) {
        return new Promise((resolve, reject) => {
            this.connection.query(query_string, (err, results) => {
                if (err)
                    reject(err);
                resolve(results);
            });
        });
    }
    async select(selector, table, whereColumn, whereValue) {
        if (whereColumn && whereValue) {
            return this.query(`SELECT ${selector} FROM ${table} WHERE ${whereColumn} = '${whereValue}'`);
        }
        else if (whereColumn && !whereValue || !whereColumn && whereValue) {
            throw new Error('If a where argument is provided, both the cloumn and the value need to be provided');
        }
        else {
            return this.query(`SELECT ${selector} FROM ${table};`);
        }
    }
    ;
    async showCurrentDb() {
        let currentDb = await this.query('SELECT DATABASE()');
        currentDb = currentDb.map((res) => res['DATABASE()'])[0];
        return currentDb;
    }
    async showCurrentDbTables() {
        let rawTables = await this.query('SHOW TABLES;');
        let tables = rawTables.map((table) => table[`Tables_in_${this.db}`]);
        return tables;
    }
    async showTableColumns(tableName) {
        if (this.db && !this.authErrorThrown) {
            let tables = (await this.query(`DESCRIBE ${tableName};`)).map(row => row.Field);
            return tables;
        }
    }
    testConnection(endAfterTest, cb) {
        return this.query('SHOW DATABASES;')
            .then(() => {
            if (endAfterTest && !this.connection._protocol._quitSequence)
                this.connection.end();
            return 'Connection established';
        })
            .catch(() => {
            this.authErrorThrown = true;
            if (!this.connection._protocol._quitSequence)
                this.connection.end();
            throw new Error('Your credentials suck. Replace them.');
        })
            .catch(() => { });
    }
    ;
    async useDb(dbName) {
        this.db = dbName;
        this.query(`USE ${dbName};`);
    }
}
module.exports = PQuery;
function isTheEndOf(i, groupArray) {
    return i < groupArray.length - 1;
}
function isArrayOfArrays(values) {
    return values.every(value => Array.isArray(value));
}
function isSQLFunction(columns) {
    return /\w+\(\)/.test(columns);
}
//# sourceMappingURL=index.js.map