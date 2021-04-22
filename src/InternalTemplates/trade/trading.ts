import {
    MarketOrder,
    LimitOrder,
    OrderOCO,
    StopLimitOrder,
    MultiOCO,
    OrderOTOCO,
    TrailStopOrder,
    StopOrder
} from "./order"

const defaults = (o: any, v: any) => o != null ? o : v;

declare global {
    interface Number {
        financial(): string

        percent(): number

        half(): number

        left(): number
    }
}

Number.prototype.percent = function () {
    return this / 100;
};

Number.prototype.financial = function () {
    return this.toFixed(2);
};

Number.prototype.half = function () {
    return Math.floor(this / 2);
};

Number.prototype.left = function () {
    return this - this.half();
};


class Range {
    public from: any;
    public to: any;

    constructor(from: any, to: any) {
        this.from = from;
        this.to = to;
    }
}

class Setup {
    public symbol: any;
    public _direction: any;
    public pivot: any;
    public stop: any;
    public atr: any;
    public take: any;
    public pattern: any;
    public long: any;
    public actionable: any;

    constructor(input: any) {
        this.symbol = input.symbol;
        this._direction = defaults(input.direction, 'long');
        this.pivot = eval(input.pivot);
        this.stop = defaults(input.stop, input.pivot);
        if (typeof this.stop === 'string' || this.stop instanceof String) {
            if (!this.stop.endsWith('%')) {
                // @ts-ignore
                this.stop = eval(this.stop);
            }
        }
        this.atr = input.atr
        this.take = eval(input.take);
        this.pattern = defaults(input.pattern, 'Consolidation');
    }

    init() {
        this.long = this._direction.toUpperCase() !== "SHORT";
        this.actionable = new Range(this.pivot, this.pivot * (100 + 5).percent());
    }

    open() {
        return this.long ? "BUY" : "SELL";
    }

    close() {
        return this.long ? "SELL" : "BUY";
    }
}

class Risk {
    public setup: any;
    public risk: any;
    public position: any;
    public profit: any;
    public take: any;

    constructor(assets:any, setup:any, trades:any, layer:number) {
        assets = eval(assets);
        this.setup = setup
        const percentageStopLoss = (typeof setup.stop === 'string' || setup.stop instanceof String) && setup.stop.endsWith('%');
        if (percentageStopLoss) {
            this.risk = parseFloat(setup.stop.slice(0, -1));
            setup.stop = setup.pivot * (100 - this.risk).percent()
            this.position = assets / 10;
        } else {
            let x = setup.pivot
            if (trades != null && trades.length > 0) {
                let invested = 0;
                let shares = 0;
                for (let i = 0; i < trades.length; ++i) {
                    let parts = trades[i].split('@', 2);
                    shares += parseInt(parts[0]);
                    invested += parseInt(parts[0]) * parseFloat(parts[1]);
                }
                x = invested / shares;
            }
            // https://www.wolframalpha.com/
            // Simplify[z=(1.0125x-y)/(1.0125x)*0.5+(1.0325x-y)/(1.0325x)*0.3+(1.05x-y)/(1.05x)*0.2]
            this.risk = (1 - 0.97486 * setup.stop / x) * 100;
            if (layer === 1 || (trades != null && trades.length === layer)) {
                this.risk = (1 - setup.stop / x) * 100;
            }
            this.position = assets / 100 / this.risk.percent();
            // round swing position size to fit 10 parts
            let part = assets / 10;
            let times = Math.round(this.position / part);
            times = Math.min(times, 2);
            this.position = times * part;
        }
        this.profit = Math.min(this.risk * 3, 24);
        this.profit = Math.max(10, this.profit);
        this.take = setup.pivot * (100 + this.profit).percent();
        if (setup.take != null) {
            this.take = setup.take;
            this.profit = (this.take / setup.pivot - 1) * 100;
        }
    }
}

class Pyramid {
    public builder: any;
    public number: any;
    public primary: any;
    public exits: any;
    public position: any;
    public price: any;
    public limit: any;
    public share: any;
    public invested: any;
    public stop: any;
    public take: any;
    public protect: any;

    constructor(builder:PyramidBuilder, number:number, trade:any) {
        this.builder = builder;
        this.number = number;
        this.primary = null;
        this.exits = {};

        let offset = [defaults(this.builder.config.offset, 0.0), 2.5, 4.5][number];
        this.position = ([50, 30, 20][number]).percent() * builder.risk.position;
        if (this.builder.config.count === 1) {
            this.position = builder.risk.position;
        }
        this.price = (100 + offset).percent() * builder.setup.pivot;
        this.limit = Math.min(this.price + 0.5, (100 + offset + 0.2).percent() * builder.setup.pivot);
        this.share = Math.round(this.position / this.limit);
        if (trade != null && trade.indexOf('@') !== -1) {
            let parts = trade.split('@', 2);
            this.share = parseInt(parts[0]);
            this.limit = parseFloat(parts[1]);
            this.price = this.limit;
        }
        this.invested = this.limit * this.share;

        if ('swing' === builder.style) {
            this.stop = builder.setup.stop;
        } else {
            this.stop = this.price * (100 - builder.risk.risk).percent();
        }
        this.take = builder.risk.take;

    }

    build() {
        let primary = new OrderOTOCO();
        this.primary = primary;
        let symbol = this.builder.setup.symbol;
        if (this.builder.config['dynamic'] && this.limit !== this.price) {
            let upper = [1.25, 3.25, 5][this.number];
            this.limit = this.builder.setup.pivot * (100 + upper).percent();
            primary.trigger = new LimitOrder(
                symbol, this.builder.setup.open(), this.share, 'LAST+.10');
            primary.trigger.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1000), ${-60 * 60 * 6 + 60 * 30}, 0) and Between(close, ${this.price.financial()}, ${this.limit.financial()}) and (Average(close, 10) > ExpAverage(close, 21) and ExpAverage(close, 21) > Average(close, 50) and low >= Average(close, 10));1m' IS TRUE`;
        } else {
            primary.trigger = new StopLimitOrder(
                symbol, this.builder.setup.open(), this.share, this.price, this.limit);
            let pullback = this.price * (100 - 2).percent();
            if (this.builder.setup.atr != null) {
                pullback = this.price - this.builder.setup.atr / 2;
            }
            primary.trigger.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1000), ${-60 * 60 * 6 + 60 * 30}, 0) and ((Highest(high, 390) >= ${this.price.financial()} and high <= ${pullback.financial()}) or ((Highest(high, 390) < ${this.price.financial()}) and Between(high, ${(this.price * (100 - 1).percent()).financial()}, ${this.price.financial()})));1m' IS TRUE`;
            if (this.limit === this.price) {
                primary.trigger.submit = null;
            }
        }

        primary.group.push(new LimitOrder(symbol, this.builder.setup.close(), this.share, this.take));
        primary.group.slice(-1)[0].profit = (this.take - this.limit) * this.share;

        // round-trip sell rule
        this.protect = this.price * (100 + 10).percent();
        let cond = `${symbol} MARK AT OR ${this.builder.setup.long ? "ABOVE" : "BELOW"} ${this.protect.financial()}`;

        primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.limit));
        primary.group.slice(-1)[0].submit = cond;

        primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.stop));
        primary.group.slice(-1)[0].cancel = cond;
        primary.group.slice(-1)[0].loss = (this.stop - this.limit) * this.share * (this.builder.setup.long ? -1 : 1);

        if (this.builder.config.volume != null) {
            let avg = parseInt(this.builder.config.volume.split(',').join(''));
            let volume = new MarketOrder(symbol, this.builder.setup.close(), this.share);
            // sell near market close if volume not high enough on pivot day
            volume.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1600),0,${60 * 3}) and Sum(volume, 390) < ${avg};1m' IS TRUE`;
            volume.tif = "GTC";
            primary.group.push(volume);
        }
    }

    exit() {
        for (const [key, config] of Object.entries(this.builder['exit'])) {
            if (key === 'pivot') {
                this.exits[key] = this.exit_pivot(config);
            }
        }
    }

    exit_pivot(params:any):MultiOCO {
        let symbol = this.builder.setup.symbol;
        let multi = new MultiOCO();
        let low = defaults(params['low'], this.stop);
        let prev = defaults(params['prev'], this.stop);
        let early = [low, prev].sort().reverse();
        let shares = [this.share.half(), this.share.left()];
        for (let i = 0; i < shares.length; ++i) {
            let oco = new OrderOCO();
            oco.group.push(new LimitOrder(symbol, this.builder.setup.close(), shares[i], this.take));
            oco.group.slice(-1)[0].profit = (this.take - this.limit) * shares[i];
            oco.group.push(new StopOrder(symbol, this.builder.setup.close(), shares[i], this.limit));
            oco.group.slice(-1)[0].submit = this.primary.group[1].submit;
            oco.group.push(new StopOrder(symbol, this.builder.setup.close(), shares[i], this.stop));
            oco.group.slice(-1)[0].cancel = this.primary.group[1].submit;
            let advance = new MarketOrder(symbol, this.builder.setup.close(), shares[i]);
            // sell near market close if price undercut pivot day low and not rebound
            advance.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1600),0,${60 * 3}) and close < ${early[i].financial()};1m' IS TRUE`;
            advance.tif = "GTC";
            advance.loss = (early[i] - this.limit) * shares[i] * (this.builder.setup.long ? -1 : 1);
            oco.group.push(advance);
            multi.orders.push(oco);
        }

        return multi;
    }
}

export class PyramidBuilder {
    public style: any;
    public setup: any;
    public risk: any;
    public config: any;
    public exit: any;

    constructor(style:any, setup:any, risk:any, config:any, exit:any) {
        this.style = style
        this.setup = setup
        this.risk = risk
        this.config = config
        this.exit = exit
    }

    build() {
        let pyramids = [];
        for (let i = 0; i < this.config.count; ++i) {
            let trade = this.config['trades'];
            if (trade != null) {
                trade = trade[i];
            }
            let pyramid = new Pyramid(this, i, trade);
            pyramid.build();
            pyramid.exit();
            pyramids.push(pyramid);
        }
        return pyramids;
    }
}

export function building(params:any) {
    let setup = new Setup(params.build.setup);
    setup.init();
    let risk = new Risk(params['assets'], setup, params.build['pyramid']['trades'], params.build['pyramid']['count']);
    let builder = new PyramidBuilder(params.build.style, setup, risk, params.build['pyramid'], params.build['exit'])
    return builder.build();
}

export function riding(builder:PyramidBuilder, params:any) {
    let strategies = new Map();
    if (builder.config['trades'] != null) {
        let trades = builder.config['trades'].map((x: string) => x.split('@', 2));
        let total = 0;
        let share = 0;
        for (let i = 0; i < trades.length; ++i) {
            let s = parseInt(trades[i][0])
            total += s * parseFloat(trades[i][1])
            share += s
        }
        let trade = share + "@" + (total / share);
        let pyramid = new Pyramid(builder, 0, trade);
        pyramid.build();
        pyramid.exit();
        let multi = pyramid.exits['pivot'];
        if (multi != null) {
            strategies.set('Pivot Low', multi);
        }
    }
    if (params == null || params.length === 0) {
        return strategies;
    }

    let symbol = builder.setup.symbol;

    for (const idx in params) {
        for (const [key, config] of Object.entries(params[idx])) {
            let multi = new MultiOCO();
            strategies.set(key, multi);

            let shares = config.shares;
            let stop = config['support'];
            if (config['part'] === 'half') {
                let oco = new OrderOCO();
                oco.group.push(new StopOrder(symbol, builder.setup.close(), shares.half(), stop));
                oco.group.push(new TrailStopOrder(symbol, builder.setup.close(), shares.half(), builder.setup.long ? 'MARK-10.00%' : 'MARK+10.00%'));
                multi.orders.push(oco);
                shares = shares.left();
            }
            let oco = new OrderOCO();
            oco.group.push(new LimitOrder(symbol, builder.setup.close(), shares, config.target));
            oco.group.push(new StopOrder(symbol, builder.setup.close(), shares, stop));
            multi.orders.push(oco);
            multi.orders = multi.orders.reverse();
        }
    }
    return strategies;
}

//
// if (require.main === module) {
//     input = `
//     {"version":2,"assets":30000,"build":{"style":"swing","setup":{"symbol":"AAPL","pivot":100,"stop":99,"pattern":"Consolidation"},"pyramid":{"count":3,"trades":["10@101"]},"exit":{"pivot":{"low":97,"prev":96},"segment":null}},"ride":[{"Take 50%":{"shares":100,"part":"half","support":110,"target":120}}]}
//     `
//     let pyramids = building(JSON.parse(input));
//     let builder = pyramids[0].builder;
//     riding(builder, JSON.parse(input)['ride'])
// } else {
//     module.exports = {
//         building: building,
//         riding: riding,
//     }
// }
