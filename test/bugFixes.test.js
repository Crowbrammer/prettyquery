require('dotenv').config();
const expect = require('chai').expect;
const PQuery = require('../index');

describe('Bug Fixes', function () {
    let pQuery;
    before(async function () {
        pQuery = new PQuery({user: process.env.DB_USER, password: process.env.DB_PASSWORD, db: process.env.DATABASE});
        await pQuery.query('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255), is_current BOOLEAN);');
    });
    
    after(async function () {
        await pQuery.query('DROP TABLE test;');
        pQuery.connection.end();
    });

    it('Gets a specific thing', async function () {
        const id = (await pQuery.query('INSERT INTO test (name) VALUES (\'Lol\');')).insertId;
        expect((await pQuery.select('id', 'test', 'id', id)).length).to.equal(1);
        await pQuery.query(`DELETE FROM test WHERE id = ${id};`);
    })
    
    it('Works with booleans', async function() {
        const id = (await pQuery.query('INSERT INTO test (name, is_current) VALUES (\'Lol\', true);')).insertId;
        expect((await pQuery.select('id', 'test', 'id', id)).length).to.equal(1);
        expect((await pQuery.select('id', 'test', 'is_current', true)).length).to.equal(1);
        expect((await pQuery.select('id', 'test', 'is_current', false)).length).to.equal(0);
        // Make sure there are no currently selected purposes
        await pQuery.query('UPDATE test SET is_current = false;');
        expect((await pQuery.select('id', 'test', 'id', id)).length).to.equal(1);
        expect((await pQuery.select('id', 'test', 'is_current', true)).length).to.equal(0);
        expect((await pQuery.select('id', 'test', 'is_current', false)).length).to.equal(1);
        
        // expect((await pQuery.select('*', 'outcomes','is_current', 'true')).length).to.equal(0); Bug in select
        // Set something I make as the current
    });

    it('Actually uses where clauses', async function () {
        await pQuery.query('INSERT INTO test (name, is_current) VALUES (\'Lol\', true);');
        await pQuery.query('INSERT INTO test (name, is_current) VALUES (\'Lol\', true);');
        await pQuery.query('INSERT INTO test (name, is_current) VALUES (\'Lol\', true);');
        await pQuery.query('INSERT INTO test (name, is_current) VALUES (\'Lol\', true);');
        const id = (await pQuery.query('INSERT INTO test (name, is_current) VALUES (\'Lol\', true);')).insertId;
        expect((await pQuery.select('id', 'test','id', id)).length).to.equal(1);
        await pQuery.query('DELETE FROM test');
    })

})