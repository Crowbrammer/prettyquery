require('dotenv').config();
const expect = require('chai').expect;
const PQuery = require('../index');

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

    it('Returns a list of DBS', async function () {
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
        await pQuery.useDB('test_db');
        expect(await pQuery.showCurrentDb()).equal('test_db');
        pQuery.connection.end();
    })

    it('Shows the tables', async function () {
        const pQuery = new PQuery({ user: process.env.USER, password: process.env.PASSWORD });
        await pQuery.dropDb('test_db');
        await pQuery.createDb('test_db');
        await pQuery.useDB('test_db');
        // If no db used;
        expect(await pQuery.showCurrentDbTables()).to.deep.equal([]);
        await pQuery.query('CREATE TABLE test1 (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
        await pQuery.query('CREATE TABLE test2 (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
        expect(await pQuery.showCurrentDbTables()).to.deep.equal(['test1', 'test2']);
        pQuery.connection.end();
    });

    xit('Creates tables');
    xit('Drops tables');
    xit('Adds something');
    xit('Batch adds');
})


