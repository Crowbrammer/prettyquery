// This is a list of ideas I tested to be able to figure out
// pretty query. I decided to keep this for posteriority, so that
// people may follow my path of learning and see how things like
// promises, the mysql library, and Node.js's util libray works. 

require('dotenv').config();
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = require('chai').expect;
const util = require('util');
const mysql = require('mysql');
const PQuery = require('../index');
const sinon = require('sinon');

function test(options, cb) {
    cb(null, options.str);
}
const testPromisify = util.promisify(test);

describe('Operators', function () {
    it('Returns the full value with +=', function () {
        let a = 'Hello';
        expect(a += ', world!').to.equal('Hello, world!');
    })
})

describe('Mocking', function () {
    it('Updates the call count', function () {
        // If: I have a sinon fake
        // and: I call it once
        // and: the sinon fake is in the blah var
        // then: blah.callCount should equal 1;
        let blah = sinon.fake();
        blah();
        expect(blah.callCount).to.equal(1);

        // If: I have a sinon fake
        // and: I call it ten times
        // and: the sinon fake is in the blah var
        // then: blah.callCount should equal 10;
        blah = sinon.fake();
        for (let i = 0; i < 10; i++) {
            blah();
        }
        expect(blah.callCount).to.equal(10);
    })
})

describe('Learning MySQL', function () {
    it('Shows the currently selected db', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.createDb('test_db');
        expect(await pQuery.showCurrentDb()).be.null;
        await pQuery.useDb('test_db');
        expect(await pQuery.showCurrentDb()).equal('test_db');
        pQuery.connection.end();
    })

    it('Shows the tables', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.dropDb('test_db');
        await pQuery.createDb('test_db');
        await pQuery.useDb('test_db');
        // If no db used;
        expect(await pQuery.showCurrentDbTables()).to.deep.equal([]);
        await pQuery.query('CREATE TABLE test1 (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
        await pQuery.query('CREATE TABLE test2 (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
        expect(await pQuery.showCurrentDbTables()).to.deep.equal(['test1', 'test2']);
        pQuery.connection.end();
    });
    
    xit('Uses a DB that doesn\'t exist (Not used b/c bad dbs always throw an error)', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        expect(await pQuery.useDb('LOL')).to.eventually.be.rejected;
        pQuery.connection.end();
    })
})

describe('Node.js', function () {
    it('Allows multiple assignment... once', function () {
        let {a,b} = {a: 1, b: 2};
        expect(a).to.equal(1);
        expect(b).to.equal(2);
        let {e,f} = {c: 1, d: 2};
        expect(e).to.be.undefined;
        expect(f).to.be.undefined;
    })

    it('Doesn\'t error with sync functions with async calls', function () {
        function blah () {
            return new Promise(() => {throw new Error()});
        };
        expect(blah).to.not.throw;
    })

    it('Shows that async functions always return a promise', async function () {
        async function giveString() {
            return 'Hi';
        }
        expect(giveString()).to.be.a('promise');
        expect(await giveString()).to.equal('Hi');
        return expect(giveString()).to.eventually.equal('Hi');
    })
})

describe('Understand asynchronicity', function () {
    it('Shows the error', function (done) {
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
    })
})

xdescribe('Database reliability', function () {
    it('Starts of disconnected with working creds', function () {
        const connection = mysql.createConnection({user: 'root', password: 'F@lc0n15'});
        expect(connection.state).to.equal('disconnected');
    });

    it('Starts off disconnected with bad creds', function () {
        const connection = mysql.createConnection({user: 'foo', password: 'bar'}) // foo, bar shouldn't exist... Can I check that these...
        expect(connection.state).to.equal('disconnected');
    });

    it('Does not call the connect right away', function () {
        const connection = mysql.createConnection({user: 'root', password: 'F@lc0n15'});
        expect(connection._connectCalled).to.be.false;
    });
    
    it('Changes the connection when a query is called', function () {
        const connection = mysql.createConnection({user: 'foo', password: 'bar'}); // foo, bar shouldn't exist... Can I check that these...
        connection.query('SHOW DATABASES;', () => {});
        expect(connection._connectCalled).to.be.ok;
        connection.end();
    })

    it('Remains disconnected after the query if the connection has bad credentials', function (done) {
        const connection = mysql.createConnection({user: 'foo', password: 'bar'}); // foo, bar shouldn't exist... Can I check that these...
        connection.query('SHOW DATABASES;', () => {
            expect(connection.state).to.equal('disconnected');
            connection.end();
            done();
        });
    })

    it('Becomes connected after the query if the connection has good credentials', function (done) {
        const connection = mysql.createConnection({user: 'root', password: 'F@lc0n15'}); // foo, bar shouldn't exist... Can I check that these...
        connection.query('SHOW DATABASES;', () => {
            expect(connection.state).to.equal('authenticated');
            connection.end();
            done();
        });
    })
})

describe('Chaining', function () {
    it('Promisify works', function () {
        return expect(testPromisify({str: 'Hello'})).to.eventually.equal('Hello');
    })
    it('Chains', function () {
        let testThen = testPromisify({str: 'Hello'})
        .then(() => testPromisify({str: 'Hi'}));
        return expect(testThen).to.eventually.equal('Hi');
    })
})
