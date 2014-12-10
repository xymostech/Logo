var inputArea = document.getElementById("input");
var outputCanvas = document.getElementById("output");
var outputContext = outputCanvas.getContext("2d");
var errorArea = document.getElementById("error");

function clearContext(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 400, 400);
    ctx.setTransform(1, 0, 0, -1, 200.5, 200.5);
}
clearContext(outputContext);

inputArea.focus();

function Turtle() {
    this.x = 0;
    this.y = 0;

    this.angle = Math.PI / 2;

    this.drawing = true;

    this.program = [];
}

Turtle.prototype.draw = function(ctx) {
    this.x = 0;
    this.y = 0;
    this.angle = Math.PI / 2;
    this.drawing = true;

    for (var i = 0; i < this.program.length; i++) {
        this.execute(ctx, this.program[i]);
    }

    if (this.drawing) {
        this.drawTurtle(ctx);
    }
};

Turtle.prototype.execute = function(ctx, step) {
    if (step.type === "move") {
        var newX = this.x + step.length * Math.cos(this.angle);
        var newY = this.y + step.length * Math.sin(this.angle);

        if (this.drawing) {
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(newX, newY);
            ctx.closePath();
            ctx.stroke();
        }

        this.x = newX;
        this.y = newY;
    } else if (step.type === "rotate") {
        this.angle += step.angle;
    } else if (step.type === "lift") {
        this.drawing = false;
    } else if (step.type === "place") {
        this.drawing = true;
    } else {
        throw new Error("Got invalid step of type: " + step.type);
    }
};

Turtle.offsets = [
    [7, 0],
    [0, 14],
    [-7, 0]
];

Turtle.prototype.drawTurtle = function(ctx) {
    ctx.save();

    ctx.beginPath();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle - Math.PI / 2);

    for (var i = 0; i < Turtle.offsets.length; i++) {
        var offset = Turtle.offsets[i];
        ctx.lineTo(offset[0], offset[1]);
    }

    ctx.closePath();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
};

Turtle.prototype.move = function(length) {
    this.program.push({
        type: "move",
        length: length
    });
};

Turtle.prototype.rotate = function(angle) {
    this.program.push({
        type: "rotate",
        angle: angle
    });
};

Turtle.prototype.lift = function() {
    this.program.push({
        type: "lift"
    });
};

Turtle.prototype.place = function() {
    this.program.push({
        type: "place"
    });
};

var turtle = new Turtle();

function MoveInstruction(length) {
    this.length = length;
}

MoveInstruction.prototype.execute = function(turtle, state) {
    turtle.move(this.length.get(state));
};

MoveInstruction.tryParse = function(line) {
    return new Parser(line)
        .or(singleWordParser("MOVE")).then(expressionParse).then(commentParse)
        .or(singleWordParser("M")).then(expressionParse).then(commentParse)
        .complete(function(values) {
            return new MoveInstruction(values[1]);
        });
};

function RotateInstruction(angle) {
    this.angle = angle;
}

RotateInstruction.prototype.execute = function(turtle, state) {
    turtle.rotate(this.angle.get(state) * Math.PI / 180);
};

RotateInstruction.tryParse = function(line) {
    return new Parser(line)
        .or(singleWordParser("ROTATE")).then(expressionParse).then(commentParse)
        .or(singleWordParser("R")).then(expressionParse).then(commentParse)
        .complete(function(values) {
            return new RotateInstruction(values[1]);
        });
};

function LiftInstruction() {}

LiftInstruction.prototype.execute = function(turtle, state) {
    turtle.lift();
};

LiftInstruction.tryParse = function(line) {
    return new Parser(line)
        .or(singleWordParser("LIFT")).then(commentParse)
        .or(singleWordParser("L")).then(commentParse)
        .complete(function(values) {
            return new LiftInstruction();
        });
};

function PlaceInstruction() {}

PlaceInstruction.prototype.execute = function(turtle, state) {
    turtle.place();
};

PlaceInstruction.tryParse = function(line) {
    return new Parser(line)
        .or(singleWordParser("PLACE")).then(commentParse)
        .or(singleWordParser("P")).then(commentParse)
        .complete(function(values) {
            return new PlaceInstruction();
        });
};

function SetInstruction(variable, value) {
    this.variable = variable;
    this.value = value;
}

SetInstruction.prototype.execute = function(turtle, state) {
    state[this.variable] = this.value.get(state);
};

SetInstruction.tryParse = function(line) {
    return new Parser(line)
        .tryParse(singleWordParser("SET")).then(wordParse)
            .then(expressionParse).then(commentParse)
        .or(singleWordParser("S")).then(wordParse)
            .then(expressionParse).then(commentParse)
        .complete(function(values) {
            return new SetInstruction(values[1], values[2]);
        });
};

function pushJumpPosition(state, pos) {
    state._jumpTable = state._jumpTable || [];

    state._jumpTable.push(pos);
}

function popJumpPosition(state) {
    if (("_jumpTable" in state) && (state._jumpTable.length > 0)) {
        return state._jumpTable.pop();
    } else {
        throw new Error("End statement with no matching conditional")
    }
}

function EndInstruction() {}

EndInstruction.prototype.execute = function(turtle, state) {
    return popJumpPosition(state);
};

EndInstruction.tryParse = function(line) {
    return new Parser(line)
        .or(singleWordParser("END")).then(commentParse)
        .or(singleWordParser("E")).then(commentParse)
        .complete(function(values) {
            return new EndInstruction();
        });
};

function findMatchingEnd(start, program) {
    var depth = 0;
    for (var i = start + 1; i < program.length; i++) {
        var step = program[i];

        if ((step instanceof IfInstruction) ||
            (step instanceof WhileInstruction)) {
            depth++;
        }

        if (step instanceof EndInstruction) {
            if (depth === 0) {
                return i;
            } else {
                depth--;
            }
        }
    }

    throw new Error("No matching end, from line " + start);
}

function IfInstruction(comparison) {
    this.comparison = comparison;
}

IfInstruction.prototype.execute = function(turtle, state, instruction, program) {
    var comparison = this.comparison.get(state);
    var endPosition = findMatchingEnd(instruction, program);

    if (comparison) {
        pushJumpPosition(state, endPosition + 1);
    } else {
        return endPosition + 1;
    }
};

IfInstruction.tryParse = function(line) {
    return new Parser(line)
        .tryParse(singleWordParser("IF")).then(combinedComparisonParse).then(commentParse)
        .complete(function(values) {
            return new IfInstruction(values[1]);
        });
}

function WhileInstruction(comparison) {
    this.comparison = comparison;
}

WhileInstruction.prototype.execute = function(turtle, state, instruction, program) {
    var comparison = this.comparison.get(state);
    var endPosition = findMatchingEnd(instruction, program);

    if (comparison) {
        pushJumpPosition(state, instruction);
    } else {
        return endPosition + 1;
    }
};

WhileInstruction.tryParse = function(line) {
    return new Parser(line)
        .tryParse(singleWordParser("WHILE")).then(combinedComparisonParse).then(commentParse)
        .complete(function(values) {
            return new WhileInstruction(values[1]);
        });
};

function EmptyInstruction() {}

EmptyInstruction.prototype.execute = function() {};

EmptyInstruction.tryParse = function(line) {
    return new Parser(line)
        .tryParse(commentParse)
        .complete(function() { return new EmptyInstruction(); });
};

var instructionParsers = [
    MoveInstruction,
    RotateInstruction,
    LiftInstruction,
    PlaceInstruction,
    SetInstruction,
    EndInstruction,
    IfInstruction,
    WhileInstruction,
    EmptyInstruction
];

function parseInstruction(line) {
    var parser = new Parser(line);

    for (var i = 0; i < instructionParsers.length; i++) {
        parser.or(instructionParsers[i].tryParse);
    }

    var result = parser.complete(function(values) { return values[0]; });

    return result.good ? result.value : null;
}

function parseInput(input) {
    var lines = input.split("\n");

    var program = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        var instruction = parseInstruction(line);

        if (!instruction) {
            throw new Error("Parser Error: line " + (i+1));
        }

        program.push(instruction);
    }

    return program;
}

function runProgram(program, turtle) {
    var state = {};
    turtle.program = [];
    var instructions = 0;

    for (var i = 0; i < program.length;) {
        instructions++;
        if (instructions > 10000) {
            throw new Error("Too many instructions");
        }

        var step = program[i];

        var next = step.execute(turtle, state, i, program);

        if (next) {
            i = next;
        } else {
            i++;
        }
    }
}

function run() {
    try {
        errorArea.innerText = "";
        var program = parseInput(inputArea.value);
        runProgram(program, turtle);
    } catch (e) {
        errorArea.innerText = e.message;
        return;
    }

    clearContext(outputContext);
    turtle.draw(outputContext);
}

inputArea.addEventListener("keyup", function(e) {
    run();
});
