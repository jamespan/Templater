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
import {evaluate} from "mathjs";

const defaults = (o: any, v: any) => o != null ? o : v;

declare global {
    interface Number {
        financial(): string

        percent(): number

        half(): number

        left(): number

        one_third(): number
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

Number.prototype.one_third = function () {
    return Math.round(this / 3);
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
        this.pivot = evaluate(input.pivot);
        this.stop = defaults(input.stop, input.pivot);
        if (typeof this.stop === 'string' || this.stop instanceof String) {
            if (!this.stop.endsWith('%')) {
                this.stop = evaluate(this.stop as any);
            }
        }
        this.atr = input.atr;
        this.take = input.take;
        // this.take = input.take != null ? evaluate(input.take) : input.take;
        if (typeof this.take === 'string' || this.take instanceof String) {
            if (!this.take.endsWith('%')) {
                this.take = evaluate(this.take as any);
            }
        }
        this.pattern = defaults(input.pattern, 'Consolidation');
    }

    init() {
        this.long = this._direction.toUpperCase() !== "SHORT";
        this.actionable = new Range(this.pivot, this.pivot * (100 + 5 * (this.long ? 1 : -1)).percent());
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

    constructor(assets: any, setup: any, trades: any, layer: number) {
        assets = evaluate(assets);
        this.setup = setup
        const percentageStopLoss = (typeof setup.stop === 'string' || setup.stop instanceof String) && setup.stop.endsWith('%');
        if (percentageStopLoss) {
            this.risk = parseFloat(setup.stop.slice(0, -1));
            setup.stop = setup.pivot * (100 - this.risk * (this.setup.long ? 1: -1)).percent()
            this.position = assets / 10;
        } else {
            let x = setup.pivot
            if (trades != null && trades.length === layer) {
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
        this.take = setup.pivot * (100 + this.profit * (this.setup.long ? 1: -1)).percent();
        const percentageTake = setup.take != null && (typeof setup.take === 'string' || setup.take instanceof String) && setup.take.endsWith('%');
        if (setup.take != null) {
            if (percentageTake) {
                this.profit = parseFloat(setup.take.slice(0, -1));
                this.take = setup.pivot * (100 + this.profit * (this.setup.long ? 1: -1)).percent();
            } else {
                this.take = setup.take;
                this.profit = (this.take / setup.pivot - 1) * 100;
            }
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
    public share: number;
    public invested: any;
    public stop: any;
    public take: any;
    public protect: any;

    constructor(builder: PyramidBuilder, number: number, trade: any) {
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
        // this.limit = this.price;
        if (!this.builder.setup.long) {
            this.limit = this.price;
        }
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
            this.stop = this.price * (100 - builder.risk.risk * (builder.setup.long ? 1: -1)).percent();
        }
        if (this.number > 0) {
            this.stop = builder.setup.pivot * (100 - 0.5).percent();
        }
        this.take = builder.risk.take;

    }

    _close_range_1m() {
        return "(close-Lowest(low, 390))/(Highest(high, 390)-Lowest(low, 390))"
    }

    build() {
        let primary = new OrderOTOCO();
        this.primary = primary;
        let symbol = this.builder.setup.symbol;
        if (this.builder.config['dynamic'] && this.limit !== this.price) {
            let upper = [1.25, 3.25, 5][this.number];
            if (this.builder.config.count === 1) {
                upper = 4.5;
            }
            this.limit = this.builder.setup.pivot * (100 + upper).percent();
            primary.trigger = new LimitOrder(
                symbol, this.builder.setup.open(), this.share, 'LAST+.50%');
            primary.trigger.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1000), ${-60 * 60 * 6 + 60 * 30}, 0) and Between(close, ${this.price.financial()}, ${this.limit.financial()}) and (Average(close, 10) > ExpAverage(close, 21) and ExpAverage(close, 21) > Average(close, 50) and Average(close, 50) > Average(close[5], 50) and low >= Average(close, 10));1m' IS TRUE`;
            if (this.builder.config['estimate'] && this.builder.config.volume != null) {
                let avg = parseInt(this.builder.config.volume.split(',').join(''));
                primary.trigger.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1000), ${-60 * 60 * 6 + 60 * 30}, 0) and Between(close, ${this.price.financial()}, ${this.limit.financial()}) and (Average(close, 10) > ExpAverage(close, 21) and ExpAverage(close, 21) > Average(close, 50) and Average(close, 50) > Average(close[5], 50) and low >= Average(close, 10)) and (((fold i = 0 to 40 with s = 0 do if  GetValue(GetYYYYMMDD(),i*10) == GetYYYYMMDD() and GetValue(SecondsTillTime(930),i*10)<=-600 then s + GetValue(Sum(volume, 10), i*10) else s) + (fold j = 0 to 10 with b = 0 do if j <= ((-SecondsTillTime(930)/60)%10) then b + if j == 0 then GetValue(volume, (-SecondsTillTime(930)/60)-0) else if j == 1 then GetValue(volume, (-SecondsTillTime(930)/60)-1) else if j == 2 then GetValue(volume, (-SecondsTillTime(930)/60)-2) else if j == 3 then GetValue(volume, (-SecondsTillTime(930)/60)-3) else if j == 4 then GetValue(volume, (-SecondsTillTime(930)/60)-4) else if j == 5 then GetValue(volume, (-SecondsTillTime(930)/60)-5) else if j == 6 then GetValue(volume, (-SecondsTillTime(930)/60)-6) else if j == 7 then GetValue(volume, (-SecondsTillTime(930)/60)-7) else if j == 8 then GetValue(volume, (-SecondsTillTime(930)/60)-8) else if j == 9 then GetValue(volume, (-SecondsTillTime(930)/60)-9) else 0 else b))/(-SecondsTillTime(930)/60+1)*390) > ${avg}*2;1m' IS TRUE`;
            }
        } else {
            primary.trigger = new StopLimitOrder(
                symbol, this.builder.setup.open(), this.share, this.price, this.limit);
            if (!this.builder.setup.long) {
                (primary.trigger as StopLimitOrder).stopType = "MARK";
            }
            let pullback = this.price * (100 - 2).percent();
            if (this.builder.setup.atr != null) {
                pullback = this.price - this.builder.setup.atr / 2;
            }
            primary.trigger.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1000), ${-60 * 60 * 6 + 60 * 30}, 0) and ((Highest(high, 390) >= ${this.price.financial()} and high <= ${pullback.financial()}) or ((Highest(high, 390) < ${this.price.financial()}) and Between(high, ${(this.price * (100 - 1).percent()).financial()}, ${this.price.financial()})));1m' IS TRUE`;
            if (this.limit === this.price) {
                primary.trigger.submit = null;
            }
            primary.trigger.submit = null;
        }

        primary.group.push(new LimitOrder(symbol, this.builder.setup.close(), this.share, this.take));
        primary.group.slice(-1)[0].profit = (this.take - this.limit) * this.share * (this.builder.setup.long ? 1 : -1);

        // round-trip sell rule
        this.protect = this.price * (100 + 10 * (this.builder.setup.long ? 1: -1)).percent();
        if (this.builder.setup.long) {
            this.protect = Math.min(this.price + (this.price - this.stop) * 2, this.protect);
        } else {
            this.protect = Math.max(this.price + (this.price - this.stop) * 2, this.protect);
        }
        let cond = `${symbol} MARK AT OR ${this.builder.setup.long ? "ABOVE" : "BELOW"} ${this.protect.financial()}`;

        primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.limit !== this.price ? "TRG+0.00%": this.limit));
        primary.group.slice(-1)[0].submit = cond;

        if (this.builder.config.count === 1 && this.limit !== this.price) {
            primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, `TRG${this.builder.setup.long ? "-" : "+"}${this.builder.risk.risk.financial()}%`));
        } else {
            primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.stop));
        }
        primary.group.slice(-1)[0].cancel = cond;
        primary.group.slice(-1)[0].loss = (this.stop - this.limit) * this.share * (this.builder.setup.long ? -1 : 1);

        // sell near market close if low close range and pretty near to stop to avoid heart by gap down tomorrow
        let reversal = new MarketOrder(symbol, this.builder.setup.close(), this.share);
        reversal.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1600),0,${60 * 3}) and (${this._close_range_1m()}<0.4) and close <= ${(this.stop*1.01).financial()};1m' IS TRUE`;
        reversal.tif = "GTC";
        // primary.group.push(reversal);
        if (this.builder.config.volume != null && this.builder.config.trades == null && this.builder.setup.long) {
            let avg = parseInt(this.builder.config.volume.split(',').join(''));
            let volume = new MarketOrder(symbol, this.builder.setup.close(), this.share);
            // sell near market close if volume not high enough on pivot day
            volume.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1600),0,${60 * 3}) and Sum(volume, 390) < ${avg} and (${this._close_range_1m()}<0.45);1m' IS TRUE`;
            volume.tif = "GTC";
            primary.group.push(volume);
        }
    }

    exit() {
        if (this.builder['exit'] == null) {
            return
        }
        let multi = this.exit_base();
        for (const [key, config] of Object.entries(this.builder['exit'])) {
            if (key === 'pivot') {
                this.exits["universe"] = this.exit_pivot(config, multi);
            }
            if (key === 'segment') {
                this.exits["universe"] = this.exit_segment(config, multi);
            }
        }
    }

    exit_base(): MultiOCO {
        let symbol = this.builder.setup.symbol;
        let multi = new MultiOCO();
        let shares = [this.share.half(), this.share.left()];
        for (let i = 0; i < shares.length; ++i) {
            let oco = new OrderOCO();
            oco.group.push(new LimitOrder(symbol, this.builder.setup.close(), shares[i], this.take));
            oco.group.slice(-1)[0].profit = (this.take - this.limit) * shares[i];
            oco.group.push(new StopOrder(symbol, this.builder.setup.close(), shares[i], this.limit));
            oco.group.slice(-1)[0].submit = this.primary.group[1].submit;
            oco.group.push(new StopOrder(symbol, this.builder.setup.close(), shares[i], this.stop));
            oco.group.slice(-1)[0].cancel = this.primary.group[1].submit;
            // oco.group.slice(-1)[0].loss = (this.stop - this.limit) * shares[i] * (this.builder.setup.long ? -1 : 1);
            let reversal = new MarketOrder(symbol, this.builder.setup.close(), shares[i]);
            reversal.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1600),0,${60 * 3}) and (${this._close_range_1m()}<0.4) and close <= ${(this.stop*1.01).financial()};1m' IS TRUE`;
            reversal.tif = "GTC";
            oco.group.push(reversal);
            multi.orders.push(oco);
        }
        return multi;
    }

    exit_pivot(params: any, base: MultiOCO): MultiOCO {
        let symbol = this.builder.setup.symbol;
        // let multi = new MultiOCO();
        let low = defaults(params['low'], this.stop);
        let prev = defaults(params['prev'], this.stop);
        let early = [low, prev].sort().reverse();
        let shares = [this.share.half(), this.share.left()];
        for (let i = 0; i < shares.length; ++i) {
            let oco = base.orders[i];
            let advance = new MarketOrder(symbol, this.builder.setup.close(), shares[i]);
            // sell near market close if price undercut pivot day low and not rebound
            advance.submit = `${symbol} STUDY '{tho=true};Between(SecondsTillTime(1600),0,${60 * 3}) and close < ${early[i].financial()};1m' IS TRUE`;
            advance.tif = "GTC";
            advance.loss = (early[i] - this.limit) * shares[i] * (this.builder.setup.long ? -1 : 1);
            oco.group.push(advance);
        }

        return base;
    }

    exit_segment(params: any, base: MultiOCO): MultiOCO {
        let symbol = this.builder.setup.symbol;
        let stop = defaults(params['stop'], this.stop);
        let avg = defaults(params['avg'], '5%');
        if (typeof avg === 'string' || avg instanceof String) {
            if (avg.endsWith("%")) {
                avg = parseFloat(avg.toString()) / 100;
            }
        }
        let shares = [this.share.half(), this.share.left()];
        // solve {a==(c*(h+l)-s*h-y*l)/(c*(h+l))}
        let stops = [-((avg - 1) * this.limit * this.share + stop * shares[0]) / (shares[1]), stop]
        for (let i = 0; i < shares.length; ++i) {
            let oco = base.orders[i];
            oco.group[2] = new StopOrder(symbol, this.builder.setup.close(), shares[i], stops[i])
            oco.group[2].cancel = this.primary.group[1].submit;
            oco.group[2].loss = (stops[i] - this.limit) * shares[i] * (this.builder.setup.long ? -1 : 1);
        }
        return base;
    }
}

export class PyramidBuilder {
    public style: any;
    public setup: any;
    public risk: any;
    public config: any;
    public exit: any;

    constructor(style: any, setup: any, risk: any, config: any, exit: any) {
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

export function building(params: any) {
    let setup = new Setup(params.build.setup);
    setup.init();
    let risk = new Risk(params['assets'], setup, params.build['pyramid']['trades'], params.build['pyramid']['count']);
    let builder = new PyramidBuilder(params.build.style, setup, risk, params.build['pyramid'], params.build['exit'])
    return builder.build();
}

export function checking(pyramids: Array<Pyramid>) {
    let message = "";
    let shares = [] as number[];
    for (let i = 0; i < pyramids.length; ++i) {
        let pyramid = pyramids[i];
        let share = pyramid.primary.trigger.share;
        if (shares.length > 0 && share > shares[shares.length - 1]) {
            message = "Follow through buys not in pyramid";
            break;
        }
        shares.push(share);
    }
    return message;
}

export function riding(builder: PyramidBuilder, params: any) {
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
        let multi = pyramid.exits['universe'];
        if (multi != null) {
            strategies.set('Universe', multi);
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
            let target = evaluate(config.target);
            let stop = config['support'];
            let drawback = Math.abs(((target / stop) - 1) / 2 * 100).financial();
            if (config['part'] === 'half') {
                let oco = new OrderOCO();
                oco.group.push(new StopOrder(symbol, builder.setup.close(), shares.half(), stop));
                oco.group.push(new TrailStopOrder(symbol, builder.setup.close(), shares.half(), builder.setup.long ? `MARK-${drawback}%` : `MARK+${drawback}%`));
                multi.orders.push(oco);
                shares = shares.left();
            } else if (config['part'] === 'third') {
                let third = shares.one_third();
                let oco = new OrderOCO();
                oco.group.push(new StopOrder(symbol, builder.setup.close(), shares - third, stop));
                oco.group.push(new TrailStopOrder(symbol, builder.setup.close(), shares - third, builder.setup.long ? 'MARK-${drawback}%' : 'MARK+${drawback}%'));
                multi.orders.push(oco);
                shares = third;
            }
            let oco = new OrderOCO();
            oco.group.push(new LimitOrder(symbol, builder.setup.close(), shares, target));
            oco.group.push(new StopOrder(symbol, builder.setup.close(), shares, stop));
            let reversal = new MarketOrder(symbol, builder.setup.close(), shares);
            let conditions = [
              "def FastHigh = Max((fold i = 0 to 40 with h = high do if GetValue(GetYYYYMMDD(),i*10) == GetYYYYMMDD() and GetValue(SecondsTillTime(930),i*10)<=-600 then Max(h, GetValue(Highest(high, 10), i*10)) else h), (fold ii = 0 to 10 with hh = high do if ii <= ((-SecondsTillTime(930)/60)%10) then Max(hh, if ii == 0 then GetValue(high, (-SecondsTillTime(930)/60)-0) else if ii == 1 then GetValue(high, (-SecondsTillTime(930)/60)-1) else if ii == 2 then GetValue(high, (-SecondsTillTime(930)/60)-2) else if ii == 3 then GetValue(high, (-SecondsTillTime(930)/60)-3) else if ii == 4 then GetValue(high, (-SecondsTillTime(930)/60)-4) else if ii == 5 then GetValue(high, (-SecondsTillTime(930)/60)-5) else if ii == 6 then GetValue(high, (-SecondsTillTime(930)/60)-6) else if ii == 7 then GetValue(high, (-SecondsTillTime(930)/60)-7) else if ii == 8 then GetValue(high, (-SecondsTillTime(930)/60)-8) else if ii == 9 then GetValue(high, (-SecondsTillTime(930)/60)-9) else 0) else hh));",
              "def FastLow = Min((fold j = 0 to 40 with l = low do if GetValue(GetYYYYMMDD(),j*10) == GetYYYYMMDD() and GetValue(SecondsTillTime(930),j*10)<=-600 then Min(l, GetValue(lowest(low, 10), j*10)) else l), (fold jj = 0 to 10 with ll = low do if jj <= ((-SecondsTillTime(930)/60)%10) then Min(ll, if jj == 0 then GetValue(low, (-SecondsTillTime(930)/60)-0) else if jj == 1 then GetValue(low, (-SecondsTillTime(930)/60)-1) else if jj == 2 then GetValue(low, (-SecondsTillTime(930)/60)-2) else if jj == 3 then GetValue(low, (-SecondsTillTime(930)/60)-3) else if jj == 4 then GetValue(low, (-SecondsTillTime(930)/60)-4) else if jj == 5 then GetValue(low, (-SecondsTillTime(930)/60)-5) else if jj == 6 then GetValue(low, (-SecondsTillTime(930)/60)-6) else if jj == 7 then GetValue(low, (-SecondsTillTime(930)/60)-7) else if jj == 8 then GetValue(low, (-SecondsTillTime(930)/60)-8) else if jj == 9 then GetValue(low, (-SecondsTillTime(930)/60)-9) else 0) else ll));",
              "def CloseRange = (Close-FastLow)/(FastHigh-FastLow);",
              `plot Cond = Between(SecondsTillTime(1600),0,${60 * 3}) and CloseRange < 0.6 and FastHigh >= ${(stop + (target-stop) * 0.6).financial()};`,
            ];
            reversal.submit = `${symbol} STUDY '{tho=true};${conditions.map((x)=>x.replace(";", "|$")).join("")};1m' IS TRUE`;
            reversal.tif = "GTC";
            oco.group.push(reversal);
            multi.orders.push(oco);
            multi.orders = multi.orders.reverse();
        }
    }
    return strategies;
}

