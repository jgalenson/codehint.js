var CodeHint = function() {

    var MAX_DEPTH = 2;

    if (isNodeJS())
	_ = require('./underscore-min');

    var equivalences = Object.create(null);

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
	candidates.forEach(function (expr) {
	    getOrElseUpdate(equivalences, expr.valueStr, []).push(expr);
	});
	// Generate the expressions.
	var allExprs = _.range(MAX_DEPTH).reduce(function (acc, cur) {
	    return genOneLevel(acc, cur + 1);
	}, candidates);
	console.log('Generated ' + allExprs.length + ' exprs.');
	//console.log(prettyStringOfExprs(allExprs));
	// Filter with the spec.
	var goodExprs = spec ? allExprs.filter(function (expr) { return spec(expr.value); }) : allExprs;
	var finalExprs = expandEquivs(goodExprs);
	console.log('Found ' + finalExprs.length + ' results.');
	console.log(prettyStringOfExprs(finalExprs));
	return finalExprs;
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
		// Numbers: +, -, *, /, unary negation
		candidates.filter(function (e) { return _.isNumber(e.value); }).forEach(function (expr2) {
		    if (isUsefulInfix(expr, '+', expr2))
			newCandidates.push(new BinaryOp(expr, '+', expr2, expr.value + expr2.value));
		    if (isUsefulInfix(expr, '-', expr2))
			newCandidates.push(new BinaryOp(expr, '-', expr2, expr.value - expr2.value));
		    if (isUsefulInfix(expr, '*', expr2))
			newCandidates.push(new BinaryOp(expr, '*', expr2, expr.value * expr2.value));
		    if (isUsefulInfix(expr, '/', expr2) && expr2.value !== 0)
			newCandidates.push(new BinaryOp(expr, '/', expr2, expr.value / expr2.value));
		});
		if (isUsefulPrefix('-', expr))
		    newCandidates.push(new UnaryOp('-', expr, -expr.value));
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
		    newCandidates.push(new BinaryOp(expr, '+', expr2, expr.value + expr2.value));
		});
		// TODO: Do something for string methods: console.log(Object.getOwnPropertyNames(String.prototype));
	    } else if (_.isFunction(expr.value)) {
		// Functions: call
		var calls = makeCalls(expr, _.range(expr.value.length).map(function (_) { return candidates; }));
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
	newCandidates.forEach(function (expr) {
	    if (expr.depth == curDepth)
		getOrElseUpdate(equivalences, expr.valueStr, []).push(expr);
	});
	var uniqueCandidates = _.map(equivalences, function (value, key) { return value[0]; });
	//console.log(prettyStringOfEquivs());
	//console.log(prettyStringOfExprs(uniqueCandidates));
	return uniqueCandidates;
    };

    /**
     * Makes all possible calls to the given function
     * with the given arguments.
     * @param {Expression} fn The function to call.
     * @param {Expression[][]} The potential arguments.
     * @param [value] The value, or undefined if we
     * should compute it.
     * @returns {Call[]} All valid calls to the given
     * function with the given arguments.
     */
    function makeCalls(fn, candidates, value) {
	// Get all of the possible arguments of the right length.
	var allArgs = candidates.reduce(function(acc, cur) {
	    return _.flatten(acc.map(function (acc) {
		return cur.map(function (cur) {
		    return acc.concat([cur]);
		});
	    }), true);
	}, [[]]);
	// Call the given function with the just-computed arguments.
	var calls = allArgs.map(function (args) {
	    var result = value;
	    if (!value) {
		try {
		    result = fn.value.apply(null, args.map(function (e) { return e.value; }));
		} catch (e) {
		    result = NaN;
		}
		if (_.isNumber(result) && _.isNaN(result))  // Ignore NaN results.
		    return null;
	    }
	    return new Call(fn, args, result);
	}).filter(function (x) { return x != null; });
	return calls;
    }

    /**
     * Expands the given expressions by replacing
     * equivalent subexpressions.
     * @param {Expression[]} exprs The expressions to expand.
     * @param {number} maxDepth The maximum depth.
     * @returns {Expression[]} The expanded expressions.
     */
    function expandEquivs(exprs, maxDepth) {
	var newlyExpandedObjs = Object.create(null);
	var newlyExpandedVals = Object.create(null);
	function expandRec(expr) {
	    if (expr.str in newlyExpandedObjs)
		return equivalences[expr.valueStr];
	    newlyExpandedObjs[expr.str] = true;
	    var curEquivs = getOrElseUpdate(equivalences, expr.valueStr, [expr]);
	    var newEquivs = [];
	    if (!(expr.valueStr in newlyExpandedVals)) {
		newlyExpandedVals[expr.valueStr] = true;
		newEquivs = _.flatten(_.map(curEquivs, expandRec), true);
	    }
	    if (expr instanceof Literal)
		;
	    else if (expr instanceof BinaryOp)
		pushAll(newEquivs, pairs(expandRec(expr.lhs), expandRec(expr.rhs)).map(function (cur) {
		    var swap = !isUsefulInfix(cur[0], expr.op, cur[1]);  // If this infix is not useful, swap it.  This should not get duplicates because we do not generate useless infixes initially.
		    return new BinaryOp(swap ? cur[1] : cur[0], expr.op, swap ? cur[0] : cur[1], expr.value);
		}));
	    else if (expr instanceof UnaryOp)
		pushAll(newEquivs, expandRec(expr.expr).map(function (cur) {
		    return new UnaryOp(expr.op, cur, expr.value);
		}));
	    else if (expr instanceof BracketAccess)
		pushAll(newEquivs, pairs(expandRec(expr.obj), expandRec(expr.prop)).map(function (cur) {
		    return new BracketAccess(cur[0], cur[1], expr.value);
		}));
	    else if (expr instanceof DotAccess)
		pushAll(newEquivs, expandRec(expr.obj).map(function (cur) {
		    return new DotAccess(cur, expr.prop, expr.value);
		}));
	    else if (expr instanceof Call) {
		var candidateArgs = expr.args.map(function (arg) { return expandRec(arg); });
		expandRec(expr.fn).forEach(function (fn) {
		    pushAll(newEquivs, makeCalls(fn, candidateArgs, expr.value));
		});
	    } else
		throw 'Illegal type for ' + expr.str;
	    newEquivs = newEquivs.filter(function (expr) { return expr.depth <= MAX_DEPTH; });
	    pushAll(curEquivs, newEquivs);
	    curEquivs = removeDuplicates(curEquivs);
	    equivalences[expr.valueStr] = curEquivs;
	    return curEquivs;
	}
	return _.flatten(_.map(exprs, expandRec), true);
    }

    /**
     * Ensures that the given infix operation is useful with respect
     * to our heuristics that remove uninteresting expressions like
     * x+x or y+x (given that we have x+y).
     * @param {Expression} lhs The left side.
     * @param {string} op The operation.
     * @param {Expression} rhs The right side.
     * @returns {boolean} Whether or not the given infix expression is useful.
     */
    function isUsefulInfix(lhs, op, rhs) {
	if (op === '+')
	    return (_.isString(lhs.value) || _.isString(rhs.value)) ? true : lhs.str < rhs.str && !(lhs instanceof UnaryOp) && !(rhs instanceof UnaryOp);
	if (op === '-')
	    return lhs.str !== rhs.str && !(rhs instanceof UnaryOp) && !firstIsUnaryOfSecond(lhs, rhs);
	if (op === '*')
	    return lhs.str <= rhs.str && !firstIsUnaryOfSecond(lhs, rhs) && !firstIsUnaryOfSecond(rhs, lhs);
	if (op === '/')
	    return lhs.str != rhs.str && !firstIsUnaryOfSecond(lhs, rhs) && !firstIsUnaryOfSecond(rhs, lhs);
	else
	    throw 'Unknown operator ' + op;
    }

    /**
     * Checks whether the first expression is a unary operation
     * on the second.  E.g., -x and x.
     */
    function firstIsUnaryOfSecond(first, second) {
	return first instanceof UnaryOp && first.expr.str == second.str;
    }

    /**
     * Ensures that the given prefix operation is useful with respect
     * to our heuristics that remove uninteresting expressions like
     * --x
     * @param {string} op The operation.
     * @param {Expression} expr The expression.
     * @returns {boolean} Whether or not the given prefix expression is useful.
     */
    function isUsefulPrefix(op, expr) {
	if (op === '-')
	    return !(expr instanceof BinaryOp) && !(expr instanceof UnaryOp);
	else
	    throw 'Unknown operator ' + op;
    }

    /* Expression AST */

    /**
     * Represents an expression.
     * @constructor
     * @param {string} str The string representation of
     * the expression.
     * @param value The value of the expression.
     * @param {number} depth The depth of the expression.
     * @param {string} [valueStr] The string of the value.
     * We need this because it can be lost (e.g., binding
     * a function loses its toString).
     */
    function Expression(str, value, depth, valueStr) {
	this.str = str;
	this.value = value;
	this.depth = depth;
	this.valueStr = valueStr ? valueStr : value;
    }

    Expression.prototype.toString = function() {
	return this.str + ' (' + this.valueStr + ')';
    };

    function Literal(str, value) {
	Expression.call(this, str, value, 0);
    }
    inheritsFrom(Literal, Expression);

    function BinaryOp(lhs, op, rhs, value) {
	Expression.call(this, parenIfNeeded(lhs) + ' ' + op + ' ' + parenIfNeeded(rhs), value, Math.max(lhs.depth, rhs.depth) + 1);
	this.lhs = lhs;
	this.rhs = rhs;
	this.op = op;
    }
    inheritsFrom(BinaryOp, Expression);

    function UnaryOp(op, expr, value) {
	Expression.call(this, op + parenIfNeeded(expr), value, expr.depth + 1);
	this.op = op;
	this.expr = expr;
    }
    inheritsFrom(UnaryOp, Expression);

    /**
     * Represents a bracket expression such as e[f].
     * @param {Expression} obj The object on the left.
     * @param {Expression} prop The property on the right.
     * @param {Expression} [value] The value, or undefined
     * if we should compute it.
     */
    function BracketAccess(obj, prop, value) {
	Expression.call(this, obj.str + '[' + prop.str + ']', value ? value : bindIfFunction(obj.value[prop.value], obj), Math.max(obj.depth, prop.depth) + 1, obj.value[prop.value]);
	this.obj = obj;
	this.prop = prop;
    }
    inheritsFrom(BracketAccess, Expression);

    /**
     * Represents a dot expression such as e.f.
     * @param {Expression} obj The object on the left.
     * @param {string} prop The property on the right.
     * @param {Expression} [value] The value, or undefined
     * if we should compute it.
     */
    function DotAccess(obj, prop, value) {
	Expression.call(this, obj.str + '.' + prop, value ? value : bindIfFunction(obj.value[prop], obj), obj.depth + 1, obj.value[prop]);
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

    /**
     * Returns the string representation of the given expression
     * with parents if it is a unary or binary operation.
     * @param {Expression} expr The expression.
     * @returns {string} The string of the given expression with
     * parens if it is a unary or binary operation.
     */
    function parenIfNeeded(expr) {
	if (expr instanceof BinaryOp || expr instanceof UnaryOp)
	    return '(' + expr.str + ')';
	else
	    return expr.str;
    }

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

    function prettyStringOfEquivs() {
	return _.reduce(equivalences, function (acc, value, key) {
	    return acc + '\n' + key.toString() + ' -> ' + value.toString();
	}, '');
    }

    function bindIfFunction(val, obj) {
	return _.isFunction(val) ? val.bind(obj.value) : val;
    }

    /**
     * Pushes all elements of the second array onto the first.
     * This is thus like a mutable version of concat.
     * @param {Array} arr The array to modify.
     * @param {Array} arr2 The array whose elements to add
     * to the other array.
     * @returns {Array} The first array with the elements of
     * the second array appended.
     */
    function pushAll(arr, arr2) {
	return arr.push.apply(arr, arr2);
    }

    /**
     * Returns the value that the given map maps to the given key
     * if it is in the map; adds and returns the given value otherwise.
     * @param {Object} map The map.
     * @param {*} key The key.
     * @param {*} newValue The value to add to the map and return if
     * it does not currently contain a mapping for the given key.
     * @returns {*} The value that the given map stores for the given key,
     * which is newValue if the map did not previously contain a mapping.
     */
    function getOrElseUpdate(map, key, newValue) {
	var equivs = map[key];
	if (equivs)
	    return equivs;
	else {
	    map[key] = newValue;
	    return newValue;
	}
    }

    /**
     * Returns all pairs of elements of the given lists.
     */
    function pairs(xs, ys) {
	return _.flatten(xs.map(function (x) {
	    return ys.map(function (y) {
		return [x, y];
	    });
	}), true);
    }

    /**
     * Asserts that the given condition holds.
     * @param {boolean} b The condition that should hold.
     * @param {string} [msg] The optional message to print
     * if the condition does not hold.
     */
    function assert(b, msg) {
	if (!b)
            throw msg || "Assertion failed";
    }

    /**
     * Removes all duplicates in the given array.
     * @param {Expression[]} The array.
     * @returns {Expression[]} The given array with all duplicates removed.
     */
    function removeDuplicates(arr) {
	var set = Object.create(null);
	arr.forEach(function (cur) {
	    if (!(cur.str in set))  // We use the string of the expression as a key.
		set[cur.str] = cur;
	});
	return _.values(set);
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
