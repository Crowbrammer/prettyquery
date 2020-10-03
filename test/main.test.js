require('dotenv').config();
const expect = require('chai').expect;
const PQuery = require('../index');
const sinon  = require('sinon');

describe('PQuery for MySQL', function () {

    it('Shows an error if the creds are wrong', function (done) {
        const pQuery = new PQuery({user: 'foo', password: 'bar'});
        let intervals = 0;
        const interval = setInterval(done => {
            if (pQuery.authErrorThrown) {
                done();
                clearInterval(interval);
            } else {
                intervals++;
            }
            if (intervals > 30) {
                expect('authError').to.equal('Never thrown');
            }
        }, 3, done);
    });

    it('Returns a list of Dbs', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.query('CREATE DATABASE IF NOT EXISTS test_db;');
        let dbs = await pQuery.listAvailableDbs();
        pQuery.connection.end();
        expect(dbs).to.include('test_db');
    })
    
    it('Creates a DB', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        expect(await pQuery.listAvailableDbs()).to.include('test_db');
        pQuery.connection.end();
    })
    
    it('Drops a DB', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.createDb('test_db');
        expect(await pQuery.listAvailableDbs()).to.include('test_db');
        await pQuery.dropDb('test_db');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        pQuery.connection.end();
    })

    it('Shows the currently selected db', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.createDb('test_db');
        expect(await pQuery.showCurrentDb()).be.null;
        await pQuery.useDb('test_db');
        expect(await pQuery.showCurrentDb()).equal('test_db');
        pQuery.connection.end();
    })

    it('Shows the tables', async function () {
        const pQuery = await createPQuery();
        // If no db used;
        expect(await pQuery.showCurrentDbTables()).to.deep.equal([]);
        await pQuery.query('CREATE TABLE test1 (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
        await pQuery.query('CREATE TABLE test2 (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
        expect(await pQuery.showCurrentDbTables()).to.deep.equal(['test1', 'test2']);
        pQuery.connection.end();
    });

    it('Drops a table', async function() {
        const pQuery = await createPQuery();
        await pQuery.query('CREATE TABLE wow (id INTEGER PRIMARY KEY);');
        expect((await pQuery.showCurrentDbTables()).length).to.equal(1)
        await pQuery.dropTable('wow');
        expect((await pQuery.showCurrentDbTables()).length).to.equal(0);
        pQuery.connection.end();
    });

    it('Uses the database given to it on initialization', async function () {
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        expect(await pQuery.listAvailableDbs()).to.include('test_db');
        pQuery.connection.end();

        const pQueryWithDb = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD, db: 'test_db'})
        expect(await pQueryWithDb.showCurrentDb()).to.equal('test_db');
        pQueryWithDb.connection.end();
    })

    it('Creates a SQL-ready group substring from columns', function () {
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        // If: ['test', 'this', 'out']
        // and: this.createColumnsSQL
        // then: '(test, this, out)'
        expect(pQuery.createGroupSQL(['test', 'this', 'out'])).to.equal('(test, this, out)');
        // If: ['test']
        // and: this.createColumnsSQL
        // then: '(test)'
        expect(pQuery.createGroupSQL(['test'])).to.equal('(test)');
        // If: 'test'
        // and: this.createColumnsSQL
        // then: '(test)'
        expect(pQuery.createGroupSQL('test')).to.equal('(test)');
        pQuery.connection.end();
    })

    it('Creates a SQL-ready group substring from values', function () {
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        // If: ['test', 'this', 'out']
        // and: this.createColumnsSQL
        // then: '(test, this, out)'
        expect(pQuery.createGroupSQL(['test', 'this', 'out'])).to.equal('(test, this, out)');
        // If: ['test']
        // and: this.createColumnsSQL
        // then: '(test)'
        expect(pQuery.createGroupSQL(['test'])).to.equal('(test)');
        // If: 'test'
        // and: this.createColumnsSQL
        // then: '(test)'
        expect(pQuery.createGroupSQL('test')).to.equal('(test)');
        pQuery.connection.end();
    })

    it('Creates a SQL-ready substring from groups', function () {
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        // If: I intend to insert into a single column 
        // and: I have two values [['foo'], ['hello']]
        // and: the values are in array or arrays format
        // and: pQuery.createGroupsSQL(values)
        // then: ('foo'), ('hello');
        expect(pQuery.createGroupsSQL([['foo'], ['hello']], ['col_one'])).to.equal('(\'foo\'), (\'hello\')');
        
        // If: I intend to insert into a two columns 
        // and: I have two values [['foo', 'bar'], ['hello', 'world']]
        // and: the values are in array or arrays format
        // and: pQuery.createGroupsSQL(values)
        // then: ('foo', 'bar'), ('hello', 'world');
        expect(pQuery.createGroupsSQL([['foo', 'bar'], ['hello', 'world']], ['col_one', 'col_two'])).to.equal('(\'foo\', \'bar\'), (\'hello\', \'world\')');
        pQuery.connection.end();
    })

    it('Inserts one thing into the moaning, ready-for-it DB', async function () {
        // Set up
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        await pQuery.useDb('test_db');
        await pQuery.query('CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT, foo VARCHAR(20));');

        // Test single inserts.
        await pQuery.insert('test', ['foo'], 'Wow');
        let testValues = await pQuery.query('SELECT * FROM test;');
        expect(testValues[0].foo).to.equal('Wow');
        await pQuery.insert('test', ['foo'], ['Amazing']);
        testValues = await pQuery.query('SELECT * FROM test;');
        expect(testValues[1].foo).to.equal('Amazing');
        pQuery.connection.end();
    })

    it('Mass inserts into the DB', async function () {
        // Set up
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        await pQuery.useDb('test_db');
        await pQuery.query('CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT, foo VARCHAR(20), bar VARCHAR(20));')

        // Test mass inserts.
        // Array of strings
        await pQuery.insert('test', ['foo'], ['Wow', 'Amazing', 'Incredible']);
        let testValues = await pQuery.query('SELECT * FROM test;');
        testValues = testValues.map(value => value.foo);
        expect(testValues).to.include.members(['Wow', 'Amazing', 'Incredible']);
        
        // Array of arrays
        await pQuery.insert('test', ['foo'], [['Segoi'], ['Incroyable'], ['Ii desu ka?']]);
        testValues = await pQuery.query('SELECT * FROM test;');
        testValues = testValues.map(value => value.foo);
        expect(testValues).to.include.members(['Wow', 'Amazing', 'Incredible']);
        
        await pQuery.insert(['test'], ['foo'], [['Segoi'], ['Incroyable'], ['Ii desu ka?']]);
        testValues = await pQuery.query('SELECT * FROM test;');
        testValues = testValues.map(value => value.foo);
        expect(testValues).to.include.members(['Wow', 'Amazing', 'Incredible']);
        
        // Multiple columns, array of arrays
        await pQuery.insert(['test'], ['foo', 'bar'], [['Fuck', 'you'], ['Without', 'me'], ['Bye', 'bye']]);
        testValues = await pQuery.query('SELECT * FROM test;');
        testValues = testValues.map(value => [value.foo, value.bar]);
        expect(testValues).to.deep.include.members([['Fuck', 'you'], ['Without', 'me'], ['Bye', 'bye']]);
        pQuery.connection.end();
    })

    /**
        [X] I don't know how to go about this -> Take a deep breath and try enclosing things
        in contexts... ask what should repeat... consider recursion... 
    */
    it('Inserts 5,000 records at a time', async function () {
        // If: I have 999 records to insert
        // and: have a valid PQuery instance
        // and: I put the records into the insert function
        // and: ...
        // then: the query should be called once
        
        // Set up
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        await pQuery.useDb('test_db');
        await pQuery.query('CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT, foo VARCHAR(20), bar VARCHAR(20));')
        
        pQuery.query = sinon.fake();
        let arr = [];
        for (let i = 0; i < 4999; i++) {
            arr.push(`value-${i}`);
        }
        await pQuery.insert('test', ['foo'], arr);
        expect(pQuery.query.callCount).to.equal(1);
        
        // Reset the fake
        pQuery.query = sinon.fake();
        arr = [];
        for (let i = 0; i < 5001; i++) {
            arr.push(`value-${i}`);
        }
        await pQuery.insert('test', ['foo'], arr);
        expect(pQuery.query.callCount).to.equal(2);
        pQuery.connection.end();
        

    })

    it('Can handle hundreds of thousands of inserts', async function () {
        // If: There's an array of 100,000 strings
        // and: There's an authenticated PQuery
        // and: a db for use
        // and: pQuery.insert(...)
        // then: it inserts the 100K things in the array.

        // Set up
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        await pQuery.useDb('test_db');
        await pQuery.query('CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT, foo VARCHAR(20), bar VARCHAR(20));')

        const arr = [];
        for (let i = 0; i < 190000; i++) {
            arr.push(`value-${i}`);
        }
        expect(arr.length).to.equal(190000);
        await pQuery.insert('test', ['foo'], arr);
        const values = await pQuery.query('SELECT * FROM test');
        expect(values.length).to.equal(190000);
        pQuery.connection.end();

    }).timeout(10000)

})


async function createPQuery() {
    const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
    await pQuery.dropDb('test_db');
    await pQuery.createDb('test_db');
    await pQuery.useDb('test_db');
    return pQuery;
}

