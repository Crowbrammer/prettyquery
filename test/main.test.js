require('dotenv').config();
require('chai').use(require('chai-as-promised'));
const expect = require('chai').expect;
const PQuery = require('../index');
const sinon  = require('sinon');

describe('PQuery for MySQL', function () {

    describe('Convenience Methods', function() {
        let pQuery;
        before(async function () {
            pQuery = await createPQuery();
        })

        after(async function () {
            pQuery.connection.end();
        })

        it('Pulls a single value', async function () {
            await pQuery.query('DROP TABLE IF EXISTS convenience_test;');
            await pQuery.query('CREATE TABLE IF NOT EXISTS convenience_test (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255));');
            await pQuery.insert('convenience_test', ['name'], [['wow'], ['how'], ['pow']]);
            const fastSelect = await pQuery.select('*', 'convenience_test', 'id', '1');
            expect(fastSelect.length).to.equal(1);
            expect(fastSelect[0].name).to.equal('wow');
        })

        it('Pulls many values', async function () {
            await pQuery.query('DROP TABLE IF EXISTS convenience_test;');
            await pQuery.query('CREATE TABLE IF NOT EXISTS convenience_test (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255));');
            await pQuery.insert('convenience_test', ['name'], [['wow'], ['how'], ['pow']]);
            const fastSelect = await pQuery.select('*', 'convenience_test');
            expect(fastSelect.length).to.equal(3);
            expect(fastSelect[2].name).to.equal('pow');
        })

        describe('Shows the columns of a table', function () {
            let sqlString = 'CREATE TABLE convenience_test (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255))';
            before(async function () {
                pQuery = await createPQuery();
                await pQuery.query(sqlString);
            })

            after(async function () {
                // await pQuery.connection.end();
            });

            it('Has the convenience_test table', async function () {
                expect(await pQuery.showCurrentDbTables()).to.include('convenience_test');
            })

            it('Makes sure the string used to create the table has \'id\' and \'name\' in it', function () {
                expect(sqlString).to.include('id');
                expect(sqlString).to.include('name');
            })

            it('Shows the columns', async function () {
                expect(await pQuery.showTableColumns('convenience_test')).to.include.members(['id', 'name']);
            })
        })
    });

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
        const pQuery = await createPQuery();
        await pQuery.query('CREATE DATABASE IF NOT EXISTS test_db;');
        let dbs = await pQuery.listAvailableDbs();
        pQuery.connection.end();
        expect(dbs).to.include('test_db');
    })
    
    it('Creates a DB', async function () {
        const pQuery = await createPQuery();
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        expect(await pQuery.listAvailableDbs()).to.include('test_db');
        pQuery.connection.end();
    })
    
    it('Drops a DB', async function () {
        const pQuery = await createPQuery();
        await pQuery.createDb('test_db');
        expect(await pQuery.listAvailableDbs()).to.include('test_db');
        await pQuery.dropDb('test_db');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        pQuery.connection.end();
    })

    it('Shows the currently selected db', async function () {
        const pQuery = await createPQuery();
        await pQuery.dropDb('test_db');
        expect(await pQuery.showCurrentDb()).be.null;
        await pQuery.createDb('test_db');
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

    describe('SQL-ready groups', function () {
        let pQuery;
        before(function () {
            pQuery = new PQuery();
        })

        after(function () {
            pQuery.connection.end();
        })

        describe('SQL-ready group', function () {
            describe('SQL-ready group member', function () {

                it('Stiches together one columns member', function () {
                    expect(pQuery.addMemberToGroupSQL(false, true, '(', 'foo')).to.equal('(foo)');
                })
                
                it('Stiches together one values member', function () {
                    expect(pQuery.addMemberToGroupSQL(true, true, '(', 'foo')).to.equal('(\'foo\')');
                })

                it('Stiches together two columns member', function () {
                    expect(pQuery.addMemberToGroupSQL(false, true, '(foo, ', 'bar')).to.equal('(foo, bar)');
                })

                it('Stiches together two values member', function () {
                    expect(pQuery.addMemberToGroupSQL(true, true, '(\'foo\', ', 'bar')).to.equal('(\'foo\', \'bar\')');
                })
            })

            it('Handles an array of two values', function () {
                expect(pQuery.createGroupSQL([ 'foo', 'bar' ], true)).to.equal('(\'foo\', \'bar\')');
            })
        })

        it('Works with a single column, single value, both represented with arrays', function () {
            expect(pQuery.createGroupsSQL(['col_one'], [['foo'], ['hello']])).to.equal('(\'foo\'), (\'hello\')');
        })

        it('Works with two column, two values, both represented with arrays', function () {
            expect(pQuery.createGroupsSQL(['col_one', 'col_two'], [['foo', 'bar'], ['hello', 'world']])).to.equal('(\'foo\', \'bar\'), (\'hello\', \'world\')');
        })
    })

    describe('Can insert Dates', function () {
        let pQuery;
        beforeEach(async function () {
            pQuery = await createPQuery();
            await pQuery.query('DROP TABLE IF EXISTS test;');
            await pQuery.query('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTO_INCREMENT, foo DATETIME, bar DATETIME);');
        });

        afterEach(function () {
            pQuery.connection.end();
        });

        xit('Is set up', async function () {
            // Test single inserts.
            await pQuery.insert('test', ['foo'], 'NOW()');
            let testValues = await pQuery.query('SELECT * FROM test;');
            expect(testValues.length).to.equal(1);
        })

        it('Lets me use the NOW function in for a single column, single insert', async function () {
            await pQuery.insert('test', ['foo'], 'NOW()');
            const date = (await pQuery.query('SELECT * FROM test'))[0].foo;
            console.log(date);
            expect(date).to.be.a('date');
        })

        it('Lets me use the NOW function in for a double column, single insert', async function () {
            await pQuery.insert('test', ['foo'], 'NOW()');
            const date = (await pQuery.query('SELECT * FROM test'))[0].foo;
            expect(date).to.be.a('date');
        })
    })


    describe('Returns info', function () {
        let pQuery;
        beforeEach(async function () {
            pQuery = await createPQuery();
            await pQuery.query('DROP TABLE IF EXISTS test;');
            await pQuery.query('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTO_INCREMENT, foo VARCHAR(255));');
        });

        afterEach(function () {
            pQuery.connection.end();
        });

        xit('Is set up', async function () {
            // Test single inserts.
            await pQuery.insert('test', ['foo'], 'Hello');
            let testValues = await pQuery.query('SELECT * FROM test;');
            expect(testValues.length).to.equal(1);
        })

        it('With query, it shows the last insert id', async function () {
            let lastInsert = await pQuery.query('INSERT INTO test (foo) VALUES (\'bar\'), (\'wow\'), (\'la\')');
            console.log(lastInsert);
            expect(lastInsert.insertId).to.be.equal(1);
            lastInsert = await pQuery.query('INSERT INTO test (foo) VALUES (\'bar\'), (\'wow\'), (\'la\')');
            console.log(lastInsert);
            expect(lastInsert.insertId).to.be.equal(4);
        })
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

    it('Should check that the table exists before inserting');
    it('Should check that the columns are in the table before inserting');
    describe('Inserting with quotes', function () {
        let pQuery;
        before(async function () {
            pQuery = await createPQuery();
            await pQuery.query('CREATE TABLE fhqwhagads (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(1000))');
        });
    
        after(async function () {
            await pQuery.query('DROP TABLE fhqwhagads');
            pQuery.connection.end();
        });
    
        it('Is set up', async function () {
            expect(await pQuery.showCurrentDbTables()).to.include('fhqwhagads');
        })
    
        it('Doesn\'t error when inserting quoted strings', async function () {
            const myOldErroredScript = `Schedule templates require tasks. Tasks need input from the user. The user needs to put the name and task. There should probably be validation. I'd like to say "add task -n blah -t 20" and it adds it to the current set of tasks. I'd rather stay out of a loop and have myself be free.`;
            const insert = await pQuery.insert('fhqwhagads', ['name'], [myOldErroredScript]).catch(err => err);
            expect(insert).to.not.be.an('error');
        })
    
    })

    it('Robust to different inserts', async function() {
        // Set up
        const pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD})
        await pQuery.query('DROP DATABASE IF EXISTS test_db;');
        expect(await pQuery.listAvailableDbs()).to.not.include('test_db');
        await pQuery.createDb('test_db');
        await pQuery.useDb('test_db');
        await pQuery.query('CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT, foo VARCHAR(20), bar VARCHAR(20));')


        // Have every branch covered
        // a columns type: array | string | (!string || array)
        // b columns: column.length === 0 | column.length === 1 | column.length > 1 | 
        // c values: array | !array
        // d typeof values members: array | string
        // e values: values.length < columns.length | values.length > columns.length | values.length === columns.length
        let columns;
        let values;



        // columns type: array,column.length === 0,values type: array,values members type: array,values.length < columns.length
        columns = undefined;
        values = undefined;
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'No columns nor values defined', 1);
        
        columns = [];
        values = undefined;
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'No columns nor values defined', 2);
        
        // columns type: array,column.length === 0,values type: array,values members type: array,values.length > columns.length
        
        columns = [];
        values = [['blah']];
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'No columns defined', 3);
        
        // columns type: array,column.length === 0,values type: array,values members type: array,values.length === columns.length
        
        columns = [];
        values = [];
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'No columns nor values defined', 4);
        
        // columns type: array,column.length === 0,values type: array,values members type: string,values.length < columns.length
        
        columns = [];
        values = undefined;
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'No columns nor values defined', 5);
        
        // columns type: array,column.length === 0,values type: array,values members type: string,values.length > columns.length
        
        columns = [];
        values = ['Test'];
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'No columns defined', 6);
        
        // columns type: array,column.length === 0,values type: array,values members type: string,values.length === columns.length
        
        columns = [];
        values = [];
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'No columns nor values defined', 7);
        
        // === Possibly not necessary to test...
        
        // columns type: array,column.length === 0,values type: !array,values members type: array,values.length < columns.length
        // columns type: array,column.length === 0,values type: !array,values members type: array,values.length > columns.length
        // columns type: array,column.length === 0,values type: !array,values members type: array,values.length === columns.length
        // columns type: array,column.length === 0,values type: !array,values members type: string,values.length < columns.length
        // columns type: array,column.length === 0,values type: !array,values members type: string,values.length > columns.length
        // columns type: array,column.length === 0,values type: !array,values members type: string,values.length === columns.length
        
        // ===

        // columns type: array,column.length === 1,values type: array,values members type: array,values.length < columns.length
        
        await expect(pQuery.insert('test', columns = ['test'], values = [])).to.be.rejectedWith(Error, 'No values defined');
        
        // columns type: array,column.length === 1,values type: array,values members type: array,values.length > columns.length

        columns = ['foo'];
        values = [['test'], ['wow']];
        await expect(pQuery.insert('test', columns, values)).to.eventually.not.be.rejected;
        
        // columns type: array,column.length === 1,values type: array,values members type: array,values.length === columns.length
        
        columns = ['foo'];
        values = [['test']];
        await expect(pQuery.insert('test', columns, values)).to.eventually.not.be.rejected;
                
        // columns type: array,column.length === 1,values type: array,values members type: string,values.length < columns.length
        
        columns = ['foo'];
        values = [['test']];
        await expect(pQuery.insert('test', columns, values)).to.eventually.not.be.rejected;
        
        // columns type: array,column.length === 1,values type: array,values members type: string,values.length > columns.length
        
        columns = ['foo'];
        values = ['test', 'this'];
        await expect(pQuery.insert('test', columns, values)).to.eventually.not.be.rejected;
        
        // columns type: array,column.length === 1,values type: array,values members type: string,values.length === columns.length
        
        columns = ['foo'];
        values = ['test'];
        await expect(pQuery.insert('test', columns, values)).to.eventually.not.be.rejected;
        
        // columns type: array,column.length === 1,values type: !array,values members type: array,values.length < columns.length
        // columns type: array,column.length === 1,values type: !array,values members type: array,values.length > columns.length
        // columns type: array,column.length === 1,values type: !array,values members type: array,values.length === columns.length
        // columns type: array,column.length === 1,values type: !array,values members type: string,values.length < columns.length
        // columns type: array,column.length === 1,values type: !array,values members type: string,values.length > columns.length
        // columns type: array,column.length === 1,values type: !array,values members type: string,values.length === columns.length
        // columns type: array,column.length > 1,values type: array,values members type: array,values.length < columns.length
        
        columns = ['foo', 'bar'];
        values = [['test']];
        await expect(pQuery.insert('test', columns, values)).to.be.rejectedWith(Error, 'You have more columns than values. Please add values or remove columns.');
        // columns type: array,column.length > 1,values type: array,values members type: array,values.length > columns.length
        // columns type: array,column.length > 1,values type: array,values members type: array,values.length === columns.length
        // columns type: array,column.length > 1,values type: array,values members type: string,values.length < columns.length
        // columns type: array,column.length > 1,values type: array,values members type: string,values.length > columns.length
        // columns type: array,column.length > 1,values type: array,values members type: string,values.length === columns.length
              
        // Specific issue to my code
        columns = ['foo', 'bar'];
        values = ['1','1']
        await expect(pQuery.insert('test', columns, values)).to.not.be.rejected;

        // columns type: array,column.length > 1,values type: !array,values members type: array,values.length < columns.length
        // columns type: array,column.length > 1,values type: !array,values members type: array,values.length > columns.length
        // columns type: array,column.length > 1,values type: !array,values members type: array,values.length === columns.length
        // columns type: array,column.length > 1,values type: !array,values members type: string,values.length < columns.length
        // columns type: array,column.length > 1,values type: !array,values members type: string,values.length > columns.length
        // columns type: array,column.length > 1,values type: !array,values members type: string,values.length === columns.length
                
  

        // columns type: string,column.length === 0,values type: array,values members type: array,values.length < columns.length
        // columns type: string,column.length === 0,values type: array,values members type: array,values.length > columns.length
        // columns type: string,column.length === 0,values type: array,values members type: array,values.length === columns.length
        // columns type: string,column.length === 0,values type: array,values members type: string,values.length < columns.length
        // columns type: string,column.length === 0,values type: array,values members type: string,values.length > columns.length
        // columns type: string,column.length === 0,values type: array,values members type: string,values.length === columns.length
        // columns type: string,column.length === 0,values type: !array,values members type: array,values.length < columns.length
        // columns type: string,column.length === 0,values type: !array,values members type: array,values.length > columns.length
        // columns type: string,column.length === 0,values type: !array,values members type: array,values.length === columns.length
        // columns type: string,column.length === 0,values type: !array,values members type: string,values.length < columns.length
        // columns type: string,column.length === 0,values type: !array,values members type: string,values.length > columns.length
        // columns type: string,column.length === 0,values type: !array,values members type: string,values.length === columns.length
        // columns type: string,column.length === 1,values type: array,values members type: array,values.length < columns.length
        // columns type: string,column.length === 1,values type: array,values members type: array,values.length > columns.length
        // columns type: string,column.length === 1,values type: array,values members type: array,values.length === columns.length
        // columns type: string,column.length === 1,values type: array,values members type: string,values.length < columns.length
        // columns type: string,column.length === 1,values type: array,values members type: string,values.length > columns.length
        // columns type: string,column.length === 1,values type: array,values members type: string,values.length === columns.length
        // columns type: string,column.length === 1,values type: !array,values members type: array,values.length < columns.length
        // columns type: string,column.length === 1,values type: !array,values members type: array,values.length > columns.length
        // columns type: string,column.length === 1,values type: !array,values members type: array,values.length === columns.length
        // columns type: string,column.length === 1,values type: !array,values members type: string,values.length < columns.length
        // columns type: string,column.length === 1,values type: !array,values members type: string,values.length > columns.length
        // columns type: string,column.length === 1,values type: !array,values members type: string,values.length === columns.length
        // columns type: string,column.length > 1,values type: array,values members type: array,values.length < columns.length
        // columns type: string,column.length > 1,values type: array,values members type: array,values.length > columns.length
        // columns type: string,column.length > 1,values type: array,values members type: array,values.length === columns.length
        // columns type: string,column.length > 1,values type: array,values members type: string,values.length < columns.length
        // columns type: string,column.length > 1,values type: array,values members type: string,values.length > columns.length
        // columns type: string,column.length > 1,values type: array,values members type: string,values.length === columns.length
        // columns type: string,column.length > 1,values type: !array,values members type: array,values.length < columns.length
        // columns type: string,column.length > 1,values type: !array,values members type: array,values.length > columns.length
        // columns type: string,column.length > 1,values type: !array,values members type: array,values.length === columns.length
        // columns type: string,column.length > 1,values type: !array,values members type: string,values.length < columns.length
        // columns type: string,column.length > 1,values type: !array,values members type: string,values.length > columns.length
        // columns type: string,column.length > 1,values type: !array,values members type: string,values.length === columns.length
        // columns type: (!string || array),column.length === 0,values type: array,values members type: array,values.length < columns.length
        // columns type: (!string || array),column.length === 0,values type: array,values members type: array,values.length > columns.length
        // columns type: (!string || array),column.length === 0,values type: array,values members type: array,values.length === columns.length
        // columns type: (!string || array),column.length === 0,values type: array,values members type: string,values.length < columns.length
        // columns type: (!string || array),column.length === 0,values type: array,values members type: string,values.length > columns.length
        // columns type: (!string || array),column.length === 0,values type: array,values members type: string,values.length === columns.length
        // columns type: (!string || array),column.length === 0,values type: !array,values members type: array,values.length < columns.length
        // columns type: (!string || array),column.length === 0,values type: !array,values members type: array,values.length > columns.length
        // columns type: (!string || array),column.length === 0,values type: !array,values members type: array,values.length === columns.length
        // columns type: (!string || array),column.length === 0,values type: !array,values members type: string,values.length < columns.length
        // columns type: (!string || array),column.length === 0,values type: !array,values members type: string,values.length > columns.length
        // columns type: (!string || array),column.length === 0,values type: !array,values members type: string,values.length === columns.length
        // columns type: (!string || array),column.length === 1,values type: array,values members type: array,values.length < columns.length
        // columns type: (!string || array),column.length === 1,values type: array,values members type: array,values.length > columns.length
        // columns type: (!string || array),column.length === 1,values type: array,values members type: array,values.length === columns.length
        // columns type: (!string || array),column.length === 1,values type: array,values members type: string,values.length < columns.length
        // columns type: (!string || array),column.length === 1,values type: array,values members type: string,values.length > columns.length
        // columns type: (!string || array),column.length === 1,values type: array,values members type: string,values.length === columns.length
        // columns type: (!string || array),column.length === 1,values type: !array,values members type: array,values.length < columns.length
        // columns type: (!string || array),column.length === 1,values type: !array,values members type: array,values.length > columns.length
        // columns type: (!string || array),column.length === 1,values type: !array,values members type: array,values.length === columns.length
        // columns type: (!string || array),column.length === 1,values type: !array,values members type: string,values.length < columns.length
        // columns type: (!string || array),column.length === 1,values type: !array,values members type: string,values.length > columns.length
        // columns type: (!string || array),column.length === 1,values type: !array,values members type: string,values.length === columns.length
        // columns type: (!string || array),column.length > 1,values type: array,values members type: array,values.length < columns.length
        // columns type: (!string || array),column.length > 1,values type: array,values members type: array,values.length > columns.length
        // columns type: (!string || array),column.length > 1,values type: array,values members type: array,values.length === columns.length
        // columns type: (!string || array),column.length > 1,values type: array,values members type: string,values.length < columns.length
        // columns type: (!string || array),column.length > 1,values type: array,values members type: string,values.length > columns.length
        // columns type: (!string || array),column.length > 1,values type: array,values members type: string,values.length === columns.length
        // columns type: (!string || array),column.length > 1,values type: !array,values members type: array,values.length < columns.length
        // columns type: (!string || array),column.length > 1,values type: !array,values members type: array,values.length > columns.length
        // columns type: (!string || array),column.length > 1,values type: !array,values members type: array,values.length === columns.length
        // columns type: (!string || array),column.length > 1,values type: !array,values members type: string,values.length < columns.length
        // columns type: (!string || array),column.length > 1,values type: !array,values members type: string,values.length > columns.length
        // columns type: (!string || array),column.length > 1,values type: !array,values members type: string,values.length === columns.length

        pQuery.connection.end();
    });

    describe('Allows ignore', async function() {
        let pQuery;
        before(async function() {
            pQuery = await createPQuery();
        });

        after(async function () {
            pQuery.connection.end();
        })

        it('Is set up', async function () {
            await pQuery.query('CREATE TABLE IF NOT EXISTS lol (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) UNIQUE);');
            expect((await pQuery.showCurrentDbTables())).to.include('lol');
        })

        it('Ignores duplicates', async function () {
            await pQuery.insert('lol', ['name'], ['hi', 'hi', 'hello'], true);
            expect((await pQuery.select('*', 'lol')).length).to.equal(2);
        })
    });

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
        const pQuery = await createPQuery();
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
    const pQuery = new PQuery({ user: process.env.DB_USER, password: process.env.DB_PASSWORD });
    await pQuery.dropDb('test_db');
    await pQuery.createDb('test_db');
    await pQuery.useDb('test_db');
    return pQuery;
}

