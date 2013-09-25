assert = require('assert');
eval(require('fs').readFileSync('codehint.js').toString())
_ = require('./underscore-min');

// Simple testing code.
function test() {
    var two = 2;
    var s = 'live';
    var plus = function(x, y) { if (typeof x !== 'number' || typeof y !== 'number') throw 'Must give a number.'; else return x + y; };
    var person = { firstName: "John", lastName: "Doe", age: 42, live: function(x) { if (typeof(x) == 'number') { this.age += x; return this.age; } else throw 'Must give a number.' }, answer: function () { return 42; } };
    var a = [1, 2, 3];
    var results = CodeHint.synthesize({two: two, s: s, person: person, a: a, plus: plus, n: null, u: undefined}, function (rv) { return typeof rv == 'number'; });
    console.log('Found ' + results.length + ' results.');
    
    var resultStrs = _.map(results, function (e) { return e.str; });
    assert(resultStrs.length === _.uniq(resultStrs).length, 'Contains duplicate results');

    var resultsMap = _.object(_.map(results, function (e) { return [e.str, e]; }));

    function checkEquals(str, val) {
	assert.strictEqual(resultsMap[str].value, val, str + ' has value ' + resultsMap[str].value + ' but should be ' + val);
    }
    
    function checkDepth(str, depth) {
	assert.strictEqual(resultsMap[str].depth, depth, 'Depth of ' + str + ' is ' + resultsMap[str].depth + ' but should be ' + depth);
    }
    
    function checkContainsStr(str, shouldHave) {
	var has = str in resultsMap;
	if (shouldHave)
	    assert(has, 'Does not contain ' + str);
	else
	    assert(!has, 'Contains ' + str);
    }

    // Check values
    checkEquals('two', two);
    assert.throws(function() { checkEquals('two', 42) });
    checkEquals('a.length', a.length);
    checkEquals('person.answer()', 42);

    // Check depths
    checkDepth('two', 0);
    checkDepth('plus(two, two)', 1);
    checkDepth('person.live(two)', 2);
    assert.throws(function() { checkDepth('person.live(two)', 1); });

    // Ensure we can access properties with . and [].
    checkContainsStr('person.live(two)', true);
    checkContainsStr('person[s](two)', true);
    checkContainsStr('person.age', true);
    checkContainsStr('person[\'age\']', false);

    // Ensure we do not have certain infix ops.
    checkContainsStr('two - two', false);
    checkContainsStr('two / two', false);
    checkContainsStr('(-two) * (-two)', false);

    // Check parens
    checkContainsStr('two + two + two', false);
    checkContainsStr('two * (two * two)', true);
}

test();
