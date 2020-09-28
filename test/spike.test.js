require('dotenv').config();
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = require('chai').expect;
const util = require('util');
const mysql = require('mysql');
const PQuery = require('../index');

function test(options, cb) {
    cb(null, options.str);
}
const testPromisify = util.promisify(test);

describe('Learning MySQL', function () {
    it('Shows the currently selected db', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.createDb('test_db');
        await pQuery.useDB('test_db');
        expect(await pQuery.showCurrentDb()).equal('test_db');
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
