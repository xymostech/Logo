function makeParser(regex, transformFunc) {
    return function(input) {
        var result = input.match(regex);

        if (result) {
            return {
                good: true,
                value: transformFunc(result[1]),
                length: result[0].length
            };
        } else {
            return {good: false};
        }
    }
}

var identity = function(x) { return x; };

var numberParse = makeParser(/^\s*((-)?[0-9]+)/, Number.parseInt);
var wordParse = makeParser(/^\s*([a-zA-Z]+)/, identity);
var commentParse = makeParser(/^\s*(#.*)?$/, identity);
function singleWordParser(word) {
    return makeParser(new RegExp("^\\s*(" + word + ")"), identity);
}

function Parser(input) {
    this.input = input;

    this.finishedParsing = false;
    this.result = null;
    this.resultLength = 0;

    this.successful = false;
}

Parser.prototype.tryParse = function(func) {
    if (this.finishedParsing) {
        return this;
    }

    this.successful = true;
    this.currInput = this.input;
    this.currResult = [];
    this.currLength = 0;

    return this.then(func);
};

Parser.prototype.then = function(func) {
    if (!this.successful || this.finishedParsing) {
        return this;
    }

    var result = func(this.currInput);

    if (result.good) {
        this.currResult.push(result.value);
        this.currInput = this.currInput.slice(result.length);
        this.currLength += result.length;
    } else {
        this.successful = false;
    }

    return this;
};

Parser.prototype.or = function(func) {
    if (this.successful) {
        this.finishedParsing = true;
        this.result = this.currResult;
        this.resultLength = this.currLength;
    }

    return this.tryParse(func);
};

Parser.prototype.transform = function(func) {
    if (!this.finishedParsing && this.successful) {
        this.currResult = func(this.currResult);
    }

    return this;
};

Parser.prototype.done = function() {
    if (!this.finishedParsing && this.successful) {
        this.finishedParsing = true;

        this.result = this.currResult;
        this.resultLength = this.currLength;
    }

    if (this.finishedParsing) {
        return {
            good: true,
            value: this.result,
            length: this.resultLength
        }
    } else {
        return {
            good: false
        };
    }
};

Parser.prototype.complete = function(func) {
    var result = this.done();

    if (result.good) {
        result.value = func(result.value);
    }

    return result;
}
