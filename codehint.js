var CodeHint = function() {

    /**
     * Synthesizes expressions built out of the given seeds that
     * satisfy the given spec (if given).
     * @param seeds {Object} An object whose keys are the strings of
     * the expressions and whose values are their values.
     * @param spec {Function} A function that specifies which of the
     * candidate expressions we should show to the user.
     * @returns {Expression[]} Expressions built out of the given
     * seeds that satisfy the spec (if given).
     */
    var synthesize = function(seeds, spec) {
	// Convert the seeds object into an array of expressions.
	candidates = []
	for (x in seeds)
	    candidates.push(new Expression(x, seeds[x]));
	// Generate the expressions.
	var allExprs = range(2).reduce(function (acc) {
	    return genOneLevel(acc);
	}, candidates);
	console.log(allExprs);
	// Filter with the spec.
	var goodExprs = spec ? allExprs.filter(function (expr) { return spec(expr.value); }) : allExprs;
	console.log(goodExprs);
	return goodExprs;
    };

    /**
     * Generates one extra level of expressions out of the given
     * candidates.
     * @param {Expression[]} candidates The candidate expressions out
     * of which to build the result set of expressions.
     * @returns {Expression[]} Expressions built out of the given
     * candidates.
     */
    var genOneLevel = function(candidates) {
	newCandidates = [].concat(candidates);
	candidates.forEach(function (expr) {
	    if (isNumber(expr.value)) {
		// Numbers: +
		candidates.filter(function (e) { return isNumber(e.value); }).forEach(function (expr2) {
		    newCandidates.push(new Expression(expr.toString + ' + ' + expr2.toString, expr.value + expr2.value));
		});
	    } else if (isArray(expr.value)) {
		// Arrays: []
		candidates.filter(function (e) { return isNumber(e.value); }).forEach(function (expr2) {
		    if (expr2.value in expr.value)
			newCandidates.push(new Expression(expr.toString + '[' + expr2.toString + ']', expr.value[expr2.value]));
		});
	    } else if (isFunction(expr.value)) {
		// Functions: call
		// Get all of the possible arguments of the right length.
		var allArgs = range(expr.value.length).reduce(function(acc) {
		    return [].concat.apply([], acc.map(function (acc) {
			return candidates.map(function (cur) {
			    return acc.concat([cur]);
			});
		    }));
		}, [[]]);
		// Call the given function with the just-computed arguments.
		var calls = allArgs.map(function (args) {
		    var result = expr.value.apply(null, args.map(function (e) { return e.value; }));
		    if (isNumber(result) && isNaN(result))  // Ignore NaN results.
			return null;
		    else
			return new Expression(expr.toString + '(' + args.map(function (e) { return e.toString; }).join(', ') + ')', result);
		}).filter(function (x) { return x != null; });
		newCandidates.push.apply(newCandidates, calls);
	    } else if (isObject(expr.value)) {
		// Objects: dereference
		for (var field in expr.value)
		    newCandidates.push(new Expression(expr.toString + '.' + field, isFunction(expr.value[field]) ? expr.value[field].bind(expr.value) : expr.value[field]));
	    }
	});
	return newCandidates;
    };

    /**
     * Represents an expression.
     * @constructor
     * @param {string} toString The string representation of
     * the expression.
     * @param value The value of the expression.
     */
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
