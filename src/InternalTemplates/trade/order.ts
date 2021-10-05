import {Study} from "./thinkscript";

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
  public submit: string | Study;
  public cancel: any;
  public loss: any;
  public profit: any;
  public comment: string;

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
    this.loss = NaN;
    this.profit = NaN;
    this.comment = null;
  }

  submitAfterOpen() {
    let now = new Date();
    this.submitAt = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear() % 100} 09:31:00`;
  }

  toString() {
    let expression = "";
    if (this.submitAt != null) {
      expression += ` SUBMIT AT ${this.submitAt}`;
    }
    if (this.cancelAt != null) {
      expression += ` CANCEL AT ${this.cancelAt}`;
    }
    if (this.submit != null) {
      if (this.submit instanceof Study) {
        expression += ` WHEN ${this.symbol} STUDY '${this.submit}' IS TRUE`;
      } else {
        expression += ` WHEN ${this.submit}`;
      }
    }
    // MARKET order may not have cancel conditions.
    if (this.cancel != null && !(this instanceof MarketOrder)) {
      expression += ` CANCEL IF ${this.cancel}`;
    }
    if (this.comment != null) {
      expression += ` #${this.comment}`;
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
  public stopType: string;

  constructor(symbol: string, direction: string, share: number, stop: number | string) {
    super(symbol, direction, share);
    this.stop = typeof stop === 'number' ? financial(stop) : stop;
    this.stopType = "STD";
  }

  toString() {
    let expression = `${this.direction} ${this.prefix}${this.share} ${this.symbol} STP ${this.stop}${this.stopType == "STD" ? " " : " " + this.stopType + " "}${this.tif}`;
    expression += super.toString();
    return expression;
  }
}

export class StopLimitOrder extends ConditionalOrder {
  public stop: any;
  public limit: any;
  public stopType: string;

  constructor(symbol: string, direction: string, share: number, stop: any, limit: any) {
    super(symbol, direction, share);
    this.stopType = "STD";
    this.stop = typeof stop === 'number' ? financial(stop) : stop;
    this.limit = typeof limit === 'number' ? financial(limit) : limit;
  }

  toString() {
    let expression = `${this.direction} ${this.prefix}${this.share} ${this.symbol} @${this.limit} STPLMT ${this.stop}${this.stopType == "STD" ? " " : " " + this.stopType + " "}${this.tif}`;
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
    return Math.min(...this.group.map(x => x.loss).filter((x)=>!isNaN(x)));
  }

  getProfit() {
    return this.group.map(x => x.profit).filter((x)=>!isNaN(x)).reduce((x, y) => x + y, 0);
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
    return this.orders.map(x => x.getLoss()).filter((x)=>!isNaN(x)).reduce((x, y) => x + y, 0);
  }

  getProfit() {
    return this.orders.map(x => x.getProfit()).filter((x)=>!isNaN(x)).reduce((x, y) => x + y, 0);
  }

  String() {
    return this.orders.map(x => x.toString()).join('\n')
  }
}

