export class Expr {

    expr: string;

    constructor(expression: string) {
        this.expr = expression;
    }

    toString(): string {
        return this.expr;
    }

    and(...others: Expr[]): And {
        return new And(this, ...others);
    }

    or(...others: Expr[]): Or {
        return new Or(this, ...others);
    }
}

export class BiExpr extends Expr {
    left: string | Expr;
    op: string;
    right: any;


    constructor(left: string | Expr, op: string, right: any) {
        super(`${left}${op}${typeof right == 'number' ? right.financial() : right}`);
        this.left = left;
        this.op = op;
        this.right = right;
    }

    with(right: any): BiExpr {
        return new BiExpr(this.left, this.op, right);
    }
}

export class Call extends Expr {
    name: string;

    constructor(name: string, ...params: any[]) {
        super(`${name}(${params.join(", ")})`);
        this.name = name;
    }

    withParams(...params: any[]) {
        return new Call(this.name, ...params);
    }
}

export class VarExpr extends Expr {
    variable: any[];
    func: (x: any) => string

    constructor(func: (...x: any[]) => string, ...value: any[]) {
        super(func(value));
        this.variable = value;
        this.func = func;
    }

    withParams(...value: any[]): VarExpr {
        return new VarExpr(this.func, ...value);
    }
}

export class And extends Expr {
    left: Expr;
    right: Expr;

    constructor(...expr: Expr[]) {
        super(expr.map((e) => `(${e})`).join(' and '));
    }
}

export class Or extends Expr {
    left: Expr;
    right: Expr;

    constructor(...expr: Expr[]) {
        super(expr.map((e) => `(${e})`).join(' or '));
    }
}

abstract class Statement {
    left: string;
    right: Expr;

    constructor(left: string, right: Expr) {
        this.left = left;
        this.right = right;
    }
}

export class Define extends Statement {
    toString(): string {
        return `def ${this.left} = ${this.right}`;
    }
}

export class Plot extends Statement {
    toString(): string {
        return `plot ${this.left} = ${this.right}`;
    }
}

export class Study {

    tho: boolean = false;
    period: string = "1m";
    body: Statement[] | Expr


    constructor(body: Statement[] | Expr) {
        this.body = body;
    }

    toString(): string {
        let prefix = this.tho ? '{tho=true}' : '';
        let suffix = this.period;
        let body = "";
        if (this.body instanceof Expr) {
            body = this.body.toString();
        } else {
            body = this.body.join("|$");
        }
        return [prefix, body, suffix].filter((x) => x?.length > 0).join(';');
    }
}

if (module.id == ".") {
    let cond = new Expr("low < 100").or(new Expr("low < 90"));
    console.log(cond.toString());

    let study = new Study([new Define("CloseRange", new Expr("close/low")), new Plot("Cond", new BiExpr("CloseRange", "<", 0.6).with(0.7))]);
    console.log(study.toString());

    let delay = new VarExpr((x) => {
        let until_to_open = (Math.floor(x / 100) - Math.floor(930 / 100)) * 60 + (x % 100 - 930 % 100);
        return `Between(SecondsTillTime(${x}), ${(-390 + until_to_open) * 60}, 0)`;
    }, 935)
    console.log(delay.toString());
    let func = new Call("Between", "high", new Expr("MovingAverage(data=close(period=AggregationPeriod.DAY),length=50)"), 2);
    console.log(func.toString());
}

