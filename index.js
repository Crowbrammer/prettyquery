mysql    = require('mysql');
class PQuery {
    constructor(options) {
        this.user       = options.user     || process.env.USER;
        this.password   = options.password || process.env.PASSWORD;
        this.db         = options.db       || process.env.DATABASE;
        this.connection = mysql.createConnection({
            user:     this.user,
            password: this.password,
            db:       this.db
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