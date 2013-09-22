var CodeHint = function() {

    if (isNodeJS())
	_ = require('./underscore-min');

    //var equivalences = Object.create(null);

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
	    candidates.push(new Literal(x, seeds[x]));
	// Generate the expressions.
	var allExprs = _.range(2).reduce(function (acc, cur) {
	    return genOneLevel(acc, cur + 1);
	}, candidates);
	console.log('Generated ' + allExprs.length + ' exprs.');
	//console.log(prettyStringOfExprs(allExprs));
	// Filter with the spec.
	var goodExprs = spec ? allExprs.filter(function (expr) { return spec(expr.value); }) : allExprs;
	//var finalExprs = expandEquivs(goodExprs);
	console.log('Found ' + goodExprs.length + ' results.');
	console.log(prettyStringOfExprs(goodExprs));
	return goodExprs;
    };

    /**
     * Generates one extra level of expressions out of the given
     * candidates.
     * @param {Expression[]} candidates The candidate expressions out
     * of which to build the result set of expressions.
     * @param {number} curDepth The current search depth.
     * @returns {Expression[]} Expressions built out of the given
     * candidates.
     */
    var genOneLevel = function(candidates, curDepth) {
	newCandidates = [].concat(candidates);
	candidates.forEach(function (expr) {
	    if (_.isNumber(expr.value)) {
		// Numbers: +, -, *, /
		candidates.filter(function (e) { return _.isNumber(e.value); }).forEach(function (expr2) {
		    newCandidates.push(new Plus(expr, expr2));
		    newCandidates.push(new Minus(expr, expr2));
		    newCandidates.push(new Times(expr, expr2));
		    if (expr2.value !== 0)
			newCandidates.push(new Div(expr, expr2));
		});
	    } else if (_.isArray(expr.value)) {
		// Arrays: [], .length
		candidates.filter(function (e) { return _.isNumber(e.value); }).forEach(function (expr2) {
		    if (expr2.value in expr.value)
			newCandidates.push(new BracketAccess(expr, expr2));
		});
		newCandidates.push(new DotAccess(expr, 'length'));
		// TODO: Do something for array methods: console.log(Object.getOwnPropertyNames(Array.prototype));
	    } else if (_.isString(expr.value)) {
		// Strings: +
		candidates.filter(function (e) { return _.isString(e.value); }).forEach(function (expr2) {
		    newCandidates.push(new Plus(expr, expr2));
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
		    }), true);
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
			return new Call(expr, args, result);
		}).filter(function (x) { return x != null; });
		newCandidates.push.apply(newCandidates, calls);
	    } else if (_.isObject(expr.value)) {
		// Objects: dereference
		for (var field in expr.value)
		    newCandidates.push(new DotAccess(expr, field));
		// We access string-based properties of objects but only if those properties exist in that object.
		candidates.filter(function (e) { return e.value in expr.value; }).forEach(function (expr2) {
		    newCandidates.push(new BracketAccess(expr, expr2));
		});
	    }
	});
	/*newCandidates.forEach(function (expr) {
	    var equivs = equivalences[expr.value];
	    if (equivs)
		equivs.push(expr);
	    else
		equivalences[expr.value] = [expr];
	});
	var uniqueCandidates = _.map(equivalences, function (value, key) { return value[0]; });*/
	newCandidates = newCandidates.filter(function (expr) { return expr.depth == curDepth; });
	return candidates.concat(newCandidates);
    };

    /* Expression AST */

    /**
     * Represents an expression.
     * @constructor
     * @param {string} str The string representation of
     * the expression.
     * @param value The value of the expression.
     * @param depth {number} The depth of the expression.
     */
    function Expression(str, value, depth) {
	this.str = str;
	this.value = value;
	this.depth = depth;
    }

    Expression.prototype.toString = function() {
	return this.str + ' (' + this.value + ')';
    };

    function Literal(str, value) {
	Expression.call(this, str, value, 0);
    }
    inheritsFrom(Literal, Expression);

    function BinaryOp(lhs, op, rhs, value) {
	Expression.call(this, lhs.str + ' ' + op + ' ' + rhs.str, value, Math.max(lhs.depth, rhs.depth) + 1);
	this.lhs = lhs;
	this.rhs = rhs;
    }
    inheritsFrom(BinaryOp, Expression);
    function Plus(left, right) {
	BinaryOp.call(this, left, '+', right, left.value + right.value);
    }
    inheritsFrom(Plus, BinaryOp);
    function Minus(left, right) {
	BinaryOp.call(this, left, '-', right, left.value - right.value);
    }
    inheritsFrom(Minus, BinaryOp);
    function Times(left, right) {
	BinaryOp.call(this, left, '*', right, left.value * right.value);
    }
    inheritsFrom(Times, BinaryOp);
    function Div(left, right) {
	BinaryOp.call(this, left, '/', right, left.value / right.value);
    }
    inheritsFrom(Div, BinaryOp);

    function BracketAccess(obj, prop) {
	Expression.call(this, obj.str + '[' + prop.str + ']', bindIfFunction(obj.value[prop.value], obj), Math.max(obj.depth, prop.depth) + 1);
	this.obj = obj;
	this.prop = prop;
    }
    inheritsFrom(BracketAccess, Expression);

    function DotAccess(obj, prop) {
	Expression.call(this, obj.str + '.' + prop, bindIfFunction(obj.value[prop], obj), obj.depth + 1);
	this.obj = obj;
	this.prop = prop;
    }
    inheritsFrom(DotAccess, Expression);

    function Call(fn, args, value) {
	Expression.call(this, fn.str + '(' + args.map(function (e) { return e.str; }).join(', ') + ')', value, Math.max.apply(null, [fn].concat(args).map(function (e) { return e.depth; })) + 1);
	this.fn = fn;
	this.args = args;
    }
    inheritsFrom(Call, Expression);

    /* Utilities */

    function inheritsFrom(child, parent) {
	child.prototype = Object.create(parent.prototype);
	child.prototype.constructor = child;
    }

    function prettyStringOfExprs(exprs) {
	return exprs.reduce(function (acc, cur) {
	    return acc + '\n' + cur.toString();
	}, '');
    }

    function bindIfFunction(val, obj) {
	return _.isFunction(val) ? val.bind(obj.value) : val;
    }

    return { synthesize: synthesize };
}();

// Simple testing code.
function test() {
    var two = 2;
    var s = 'live';
    var plus = function(x, y) { if (typeof x !== 'number' || typeof y !== 'number') throw 'Must give a number.'; else return x + y; };
    var person = { firstName: "John", lastName: "Doe", age: 42, live: function(x) { if (typeof(x) == 'number') { this.age += x; return this.age; } else throw 'Must give a number.' }, answer: function () { return 42; } };
    var a = [1, 2, 3];
    var results = CodeHint.synthesize({two: two, s: s, person: person, a: a, plus: plus, n: null, u: undefined}, function (rv) { return typeof rv == 'number'; });
}

// Hacky check to see if we're running in node.js.
function isNodeJS() {
    return typeof window == 'undefined';
}

if (isNodeJS())
    test();
