function VariableValue(isVariable, value) {
    this.isVariable = isVariable;
    this.value = value;
}

VariableValue.prototype.get = function(state) {
    if (this.isVariable) {
        if (this.value in state) {
            return state[this.value];
        } else {
            throw new Error("Unknown variable: " + this.value);
        }
    } else {
        return this.value;
    }
};

var variableParse = function(input) {
    return new Parser(input)
        .tryParse(numberParse)
        .or(wordParse)
        .complete(function(values) {
            return new VariableValue(typeof values[0] === "string", values[0]);
        });
};

function Expression(left, operation, right) {
    this.left = left;
    this.operation = operation;
    this.right = right;
}

Expression.prototype.get = function(state) {
    var left = this.left.get(state);
    var right = this.right.get(state);

    if (this.operation === "+") {
        return left + right;
    } else if (this.operation === "-") {
        return left - right;
    } else if (this.operation === "*") {
        return left * right;
    }
};

var operatorParse = makeParser(/^\s*(\+|-|\*)/, identity);
var openParenParse = makeParser(/^\s*\(/, identity);
var closeParenParse = makeParser(/^\s*\)/, identity);

function parenthesizedExpressionParse(input) {
    return new Parser(input)
        .or(openParenParse).then(expressionParse).then(closeParenParse)
        .transform(function(values) {
            return values[1];
        })
        .or(variableParse).transform(function(values) {
            return values[0];
        })
        .done();
}

function expressionParse(input) {
    return new Parser(input)
        .or(parenthesizedExpressionParse).then(operatorParse)
            .then(parenthesizedExpressionParse)
        .transform(function(values) {
            return new Expression(values[0], values[1], values[2]);
        })
        .or(variableParse).transform(function(values) {
            return values[0];
        })
        .done();
}

function Comparison(left, comparator, right) {
    this.left = left;
    this.comparator = comparator;
    this.right = right;
}

Comparison.prototype.get = function(state) {
    var left = this.left.get(state);
    var right = this.right.get(state);

    if (this.comparator === "<=") {
        return left <= right;
    } else if (this.comparator === ">=") {
        return left >= right;
    } else if (this.comparator === "<") {
        return left < right;
    } else if (this.comparator === ">") {
        return left > right;
    } else if (this.comparator === "=") {
        return left === right;
    }
};

// x < y

// !A

// A && B

var comparatorParse = makeParser(/^\s*(<=|>=|<|>|=)/, identity);

function comparisonParse(input) {
    return new Parser(input)
        .tryParse(parenthesizedExpressionParse).then(comparatorParse)
            .then(parenthesizedExpressionParse)
        .complete(function(values) {
            return new Comparison(values[0], values[1], values[2]);
        });
}

function CombinedComparison(left, combiner, right) {
    this.left = left;
    this.right = right;
    this.combiner = combiner;
}

CombinedComparison.prototype.get = function(state) {
    var left = this.left.get(state);

    if (this.combiner === "!") {
        return !left;
    } else {
        var right = this.right.get(state);

        if (this.combiner === "&&") {
            return left && right;
        } else if (this.combiner === "||") {
            return left || right;
        }
    }
};

var negatorParser = makeParser(/^\s*(!)/, identity);
var combinerParser = makeParser(/^\s*(&&|\|\|)/, identity);

function combinedComparisonParse(input) {
    return new Parser(input)
        .tryParse(negatorParser).then(openParenParse)
            .then(combinedComparisonParse).then(closeParenParse)
        .transform(function(values) {
            return new CombinedComparison(values[2], values[0]);
        })
        .or(openParenParse).then(combinedComparisonParse).then(closeParenParse)
            .then(combinerParser)
        .then(openParenParse).then(combinedComparisonParse).then(closeParenParse)
        .transform(function(values) {
            return new CombinedComparison(values[1], values[3], values[5]);
        })
        .or(comparisonParse).transform(function(values) {
            return values[0];
        })
        .done();
}
