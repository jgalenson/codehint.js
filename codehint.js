var CodeHint = function() {

    if (isNodeJS())
	_ = require('./underscore-min');

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
	var allExprs = _.range(2).reduce(function (acc) {
	    return genOneLevel(acc);
	}, candidates);
	//console.log(allExprs);
	// Filter with the spec.
	var goodExprs = spec ? allExprs.filter(function (expr) { return spec(expr.value); }) : allExprs;
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
	    if (_.isNumber(expr.value)) {
		// Numbers: +, -, *, /
		candidates.filter(function (e) { return _.isNumber(e.value); }).forEach(function (expr2) {
		    newCandidates.push(new Expression(expr.toString + ' + ' + expr2.toString, expr.value + expr2.value));
		    newCandidates.push(new Expression(expr.toString + ' - ' + expr2.toString, expr.value - expr2.value));
		    newCandidates.push(new Expression(expr.toString + ' * ' + expr2.toString, expr.value * expr2.value));
		    if (expr2.value !== 0)
			newCandidates.push(new Expression(expr.toString + ' / ' + expr2.toString, expr.value / expr2.value));
		});
	    } else if (_.isArray(expr.value)) {
		// Arrays: [], .length
		candidates.filter(function (e) { return _.isNumber(e.value); }).forEach(function (expr2) {
		    if (expr2.value in expr.value)
			newCandidates.push(new Expression(expr.toString + '[' + expr2.toString + ']', expr.value[expr2.value]));
		});
		newCandidates.push(new Expression(expr.toString + '.length', expr.value.length));
		// TODO: Do something for array methods: console.log(Object.getOwnPropertyNames(Array.prototype));
	    } else if (_.isString(expr.value)) {
		// Strings:
		candidates.filter(function (e) { return _.isString(e.value); }).forEach(function (expr2) {
		    newCandidates.push(new Expression(expr.toString + ' + ' + expr2.toString, expr.value + expr2.value));
		});
		// TODO: Do something for string methods: console.log(Object.getOwnPropertyNames(String.prototype));
	    } else if (_.isFunction(expr.value)) {
		// Functions: call
		// Get all of the possible arguments of the right length.
		var allArgs = _.range(expr.value.length).reduce(function(acc) {
		    return _.flatten(acc.map(function (acc) {
			return candidates.map(function (cur) {
			    return acc.concat([cur]);
			});
		    }));
		}, [[]]);
		// Call the given function with the just-computed arguments.
		var calls = allArgs.map(function (args) {
		    var result;
		    try {
			result = expr.value.apply(null, args.map(function (e) { return e.value; }));
		    } catch (e) {
			result = NaN;
		    }
		    if (_.isNumber(result) && _.isNaN(result))  // Ignore NaN results.
			return null;
		    else
			return new Expression(expr.toString + '(' + args.map(function (e) { return e.toString; }).join(', ') + ')', result);
		}).filter(function (x) { return x != null; });
		newCandidates.push.apply(newCandidates, calls);
	    } else if (_.isObject(expr.value)) {
		// Objects: dereference
		for (var field in expr.value)
		    newCandidates.push(new Expression(expr.toString + '.' + field, _.isFunction(expr.value[field]) ? expr.value[field].bind(expr.value) : expr.value[field]));
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

    return { synthesize: synthesize };
}()

// Simple testing code.
function test() {
    var two = 2;
    var s = "Hello, world.";
    var plus = function(x, y) { return x + y };
    var plusOne = function(x) { return x + 1 };
    var person = { firstName: "John", lastName: "Doe", age: 42, live: function(x) { if (typeof(x) == 'number') { this.age += x; return this.age; } else throw "Must give a number." } };
    var a = [1, 2, 3];
    var results = CodeHint.synthesize({two: two, s: s, person: person, a: a, /*plus: plus, plusOne: plusOne,*/ n: null, u: undefined}, function (rv) { return typeof rv == 'number'; });
    console.log(results);
}

// Hacky check to see if we're running in node.js.
function isNodeJS() {
    return typeof window == 'undefined';
}

if (isNodeJS())
    test();
