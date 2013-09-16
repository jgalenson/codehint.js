var CodeHint = function() {

    var synthesize = function(seeds, spec) {
	candidates = []
	for (x in seeds)
	    candidates.push(new Expression(x, seeds[x]));
	var allExprs = range(2).reduce(function (acc) {
	    return genOneLevel(acc);
	}, candidates);
	console.log(allExprs);
	var goodExprs = spec ? allExprs.filter(function (expr) { return spec(expr.value); }) : allExprs;
	console.log(goodExprs);
	return goodExprs;
    };

    var genOneLevel = function(candidates) {
	newCandidates = [].concat(candidates);
	candidates.forEach(function (expr) {
	    if (isNumber(expr.value)) {
		candidates.filter(function (e) { return isNumber(e.value); }).forEach(function (expr2) {
		    newCandidates.push(new Expression(expr.toString + ' + ' + expr2.toString, expr.value + expr2.value));
		});
	    } else if (isArray(expr.value)) {
		candidates.filter(function (e) { return isNumber(e.value); }).forEach(function (expr2) {
		    if (expr2.value in expr.value)
			newCandidates.push(new Expression(expr.toString + '[' + expr2.toString + ']', expr.value[expr2.value]));
		});
	    } else if (isFunction(expr.value)) {
		var allArgs = range(expr.value.length).reduce(function(acc) {
		    return [].concat.apply([], acc.map(function (acc) {
			return candidates.map(function (cur) {
			    return acc.concat([cur]);
			});
		    }));
		}, [[]]);
		var calls = allArgs.map(function (args) {
		    var result = expr.value.apply(null, args.map(function (e) { return e.value; }));
		    if (isNumber(result) && isNaN(result))
			return null;
		    else
			return new Expression(expr.toString + '(' + args.map(function (e) { return e.toString; }).join(', ') + ')', result);
		}).filter(function (x) { return x != null; });
		newCandidates.push.apply(newCandidates, calls);
	    } else if (isObject(expr.value)) {
		for (var field in expr.value)
		    newCandidates.push(new Expression(expr.toString + '.' + field, isFunction(expr.value[field]) ? expr.value[field].bind(expr.value) : expr.value[field]));
	    }
	});
	return newCandidates;
    };

    var Expression = function(toString, value) {
	this.toString = toString;
	this.value = value;
    }

    // Helpers
    var range = function(num) { return (new Array(num)).join().split(','); };
    var isNumber = function(v) { return typeof v == 'number'; };
    var isString = function(v) { return typeof v == 'string' || v instanceof String; };
    var isArray = function(v) { return v instanceof Array; };
    var isObject = function(v) { return typeof v == 'object'; };
    var isFunction = function(v) { return typeof v == 'function'; };

    return { synthesize: synthesize };
}()

// Simple testing code.
function test() {
    var two = 2;
    var s = "Hello, world.";
    var plus = function(x, y) { return x + y };
    var plusOne = function(x) { return x + 1 };
    var person = { firstName: "John", lastName: "Doe", age: 42, live: function(x) { this.age += x; return this.age; } };
    var a = [1, 2, 3];
    CodeHint.synthesize({two: two, s: s, person: person, a: a, /*plus: plus, plusOne: plusOne,*/ n: null, u: undefined}, function (rv) { return typeof rv == 'number'; });
}

test();
