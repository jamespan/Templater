function financial(x: number) {
    return x.toFixed(2);
}

class ConditionalOrder {
    public symbol: string;
    public direction: string;
    public prefix: string;
    public share: number;
    public tif: string;
    public submitAt: any;
    public cancelAt: any;
    public submit: any;
    public cancel: any;
    public loss: any;
    public profit: any;

    constructor(symbol: string, direction: string, share: number) {
        this.symbol = symbol;
        this.direction = direction;
        this.prefix = "BUY" === direction ? "+" : "-";
        this.share = share;
        this.tif = "GTC";
        this.submitAt = null;
        this.cancelAt = null;
        this.submit = null;
        this.cancel = null;
        this.loss = 0.0;
        this.profit = 0.0;
    }

    submitAfterOpen() {
        let now = new Date();
        this.submitAt = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear() % 100} 09:31:00`;
    }

    toString() {
        let expression = "";
        if (this.submitAt != null) {
            expression = expression + ` SUBMIT AT ${this.submitAt}`;
        }
        if (this.cancelAt != null) {
            expression = expression + ` CANCEL AT ${this.cancelAt}`;
        }
        if (this.submit != null) {
            expression = expression + ` WHEN ${this.submit}`;
        }
        if (this.cancel != null) {
            expression = expression + ` CANCEL IF ${this.cancel}`;
        }
        return expression;
    }
}

export class MarketOrder extends ConditionalOrder {
    constructor(symbol: string, direction: string, share: number) {
        super(symbol, direction, share);
        this.tif = "DAY";
    }

    toString() {
        let expression = `${this.direction} ${this.prefix}${this.share} ${this.symbol} MKT ${this.tif}`;
        expression += super.toString();
        return expression;
    }
}

export class StopOrder extends ConditionalOrder {
    public stop: any;

    constructor(symbol: string, direction: string, share: number, stop: number) {
        super(symbol, direction, share);
        this.stop = financial(stop);
    }

    toString() {
        let expression = `${this.direction} ${this.prefix}${this.share} ${this.symbol} STP ${this.stop} ${this.tif}`;
        expression += super.toString();
        return expression;
    }
}

export class StopLimitOrder extends ConditionalOrder {
    public stop: any;
    public limit: any;

    constructor(symbol: string, direction: string, share: number, stop: any, limit: any) {
        super(symbol, direction, share);
        this.stop = typeof stop === 'number' ? financial(stop) : stop;
        this.limit = typeof limit === 'number' ? financial(limit) : limit;
    }

    toString() {
        let expression = `${this.direction} ${this.prefix}${this.share} ${this.symbol} @${this.limit} STPLMT ${this.stop} ${this.tif}`;
        expression += super.toString();
        return expression;
    }
}

export class LimitOrder extends ConditionalOrder {
    public limit: any;

    constructor(symbol: string, direction: string, share: number, limit: any) {
        super(symbol, direction, share);
        this.limit = typeof limit === 'number' ? financial(limit) : limit;
    }

    toString() {
        let expression = `${this.direction} ${this.prefix}${this.share} ${this.symbol} @${this.limit} LMT ${this.tif}`;
        expression += super.toString();
        return expression;
    }
}

export class TrailStopOrder extends ConditionalOrder {
    public limit: string;

    constructor(symbol: string, direction: string, share: number, limit: string) {
        super(symbol, direction, share);
        this.limit = limit;
    }

    toString() {
        let expression = `${this.direction} ${this.prefix}${this.share} ${this.symbol} TRSTP ${this.limit} MARK ${this.tif}`;
        expression += super.toString();
        return expression;
    }
}

export class OrderOCO {
    public group: ConditionalOrder[];

    constructor() {
        this.group = [];
    }

    getLoss() {
        return this.group.map(x => x.loss).reduce((x, y) => x + y, 0);
    }

    getProfit() {
        return this.group.map(x => x.profit).reduce((x, y) => x + y, 0);
    }
}

export class OrderOTOCO extends OrderOCO {
    public trigger: ConditionalOrder;

    constructor() {
        super();
        this.trigger = null;
    }
}

export class MultiOCO {
    public orders: OrderOCO[];

    constructor() {
        this.orders = []
    }

    getLoss() {
        return this.orders.map(x => x.getLoss()).reduce((x, y) => x + y, 0);
    }

    getProfit() {
        return this.orders.map(x => x.getProfit()).reduce((x, y) => x + y, 0);
    }

    String() {
        return this.orders.map(x => x.toString()).join('\n')
    }
}

