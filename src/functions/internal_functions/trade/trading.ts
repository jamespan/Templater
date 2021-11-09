import {
    LimitOrder,
    MarketOrder,
    MultiOCO,
    OrderOCO,
    OrderOTOCO,
    StopLimitOrder,
    StopOrder,
    TrailStopOrder
} from "./order"
import {evaluate, isNaN} from "mathjs";
import {And, BiExpr, Expr, Or, Study} from "./thinkscript";
import {
    AvoidMarketOpenVolatile,
    BeforeMarketClose,
    BuyRange,
    BuyRangeSMA,
    ClsRange,
    DecisiveUndercut, HalfProfit, Highest_High,
    HugeVolume, PassThrough,
    SellRange,
    SMA_LAST,
    Undercut, UpsideReversal
} from "./blocks";

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
    return Math.round(this / 2);
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
    public long: boolean;
    public actionable: any;
    public scale: number;
    public range: number;

    constructor(input: any) {
        this.symbol = input.symbol;
        this._direction = input.direction ?? 'long';
        this.pivot = evaluate(input.pivot);
        this.stop = input.stop ?? input.pivot;
        if (typeof this.stop === 'string' || this.stop instanceof String) {
            // 100*0.985 etc
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
        this.pattern = input.pattern ?? 'Consolidation';
        this.scale = evaluate(input.scale ?? "1.0");
        this.range = input.range ?? 5;
    }

    init() {
        this.long = this._direction.toUpperCase() !== "SHORT";
        this.actionable = new Range(this.pivot, this.pivot * (100 + this.range * (this.long ? 1 : -1)).percent());
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
    public isPercentage: boolean;

    constructor(style: string, assets: any, setup: any, trades: any, layer: number) {
        assets = evaluate(assets);
        this.setup = setup
        this.isPercentage = (typeof setup.stop === 'string' || setup.stop instanceof String) && setup.stop.endsWith('%');
        if (this.isPercentage) {
            this.risk = parseFloat(setup.stop.slice(0, -1));
            setup.stop = setup.pivot * (100 - this.risk * (this.setup.long ? 1 : -1)).percent()
            this.position = assets / 10 * this.setup.scale;
        } else {
            this.risk = (1 - setup.stop / setup.pivot) * 100;
            if (style == "swing") {
                this.position = assets / 100 / this.risk.percent();
                // round swing position size to fit 10 parts
                let part = assets / 10;
                let times = Math.round(this.position / part);
                times = Math.min(times, 2);
                this.position = times * part;
            } else {
                this.position = assets / 10 * this.setup.scale;
            }
        }
        this.profit = Math.min(this.risk * 3, 24);
        this.profit = Math.max(10, this.profit);
        this.take = setup.pivot * (100 + this.profit * (this.setup.long ? 1 : -1)).percent();
        const percentageTake = setup.take != null && (typeof setup.take === 'string' || setup.take instanceof String) && setup.take.endsWith('%');
        if (setup.take != null) {
            if (percentageTake) {
                this.profit = parseFloat(setup.take.slice(0, -1));
                this.take = setup.pivot * (100 + this.profit * (this.setup.long ? 1 : -1)).percent();
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
            this.stop = this.price * (100 - builder.risk.risk * (builder.setup.long ? 1 : -1)).percent();
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
        if (this.builder.config?.dynamic && this.limit !== this.price) {
            let upper = [1.25, 3.25, 5][this.number];
            if (this.builder.config.count === 1) {
                upper = this.builder.setup.range;
            }
            this.limit = this.builder.setup.pivot * (100 + upper * (this.builder.setup.long ? 1 : -1)).percent();
            primary.trigger = new LimitOrder(symbol, this.builder.setup.open(), this.share, `MARK+0.00%`);
            if (this.builder.config.trigger_order_type == 'MKT' || !this.builder.setup.long) {
                primary.trigger = new MarketOrder(symbol, this.builder.setup.open(), this.share);
                primary.trigger.tif = 'GTC';
            }
            let conditions = [AvoidMarketOpenVolatile] as Expr[];
            if (this.builder.setup.pattern.contains('Pullback')) {
                conditions.push(BuyRangeSMA);
                if (this.builder.config.reversal ?? true) {
                    conditions.push(UpsideReversal);
                }
            } else {
                conditions.push(this.builder.setup.long ? BuyRange.of(this.price, this.limit) : SellRange.of(this.limit, this.price));
            }

            if (this.builder.config?.estimate && this.builder.config.volume != null) {
                let avg = parseInt(this.builder.config.volume.split(',').join(''));
                conditions.push(HugeVolume.over(`(${avg}*1.4)`));
            }
            primary.trigger.submit = new Study(new And(...conditions));
        } else {
            primary.trigger = new StopLimitOrder(symbol, this.builder.setup.open(), this.share, this.price, this.limit);
            if (!this.builder.setup.long) {
                (primary.trigger as StopLimitOrder).stopType = "MARK";
            }
        }

        primary.group.push(new LimitOrder(symbol, this.builder.setup.close(), this.share, this.take));
        primary.group.slice(-1)[0].profit = (this.take - this.limit) * this.share * (this.builder.setup.long ? 1 : -1);
        primary.group.slice(-1)[0].comment = "Profit Taking";

        if (this.builder.config.sell_without_cushion ?? false) {
            let order = new MarketOrder(symbol, this.builder.setup.close(), this.share);
            order.tif = "GTC";
            order.submit = new Study(new And(BeforeMarketClose, Undercut.value(`${this.price.financial()}*1.05`)));
            order.comment = "Exit without enough Cushion"
            primary.group.push(order);
        }

        if (this.builder.bookkeeper?.sma10_trailing != null && this.limit === this.price && this.builder.setup.long) {
            primary.group.push(_ma_dynamic_stop(this.builder, this.share));
            primary.group.slice(-1)[0].loss = Math.max((this.price - this.builder.bookkeeper?.sma10_trailing * 0.985) * this.share, 0);
        }

        // round-trip sell rule
        this.protect = this.price * (100 + 10 * (this.builder.setup.long ? 1 : -1)).percent();
        if (this.builder.setup.long) {
            this.protect = Math.min(this.price + (this.price - this.stop) * 2, this.protect);
        } else {
            this.protect = Math.max(this.price + (this.price - this.stop) * 2, this.protect);
        }
        let cond = `${symbol} MARK AT OR ${this.builder.setup.long ? "ABOVE" : "BELOW"} ${this.protect.financial()}`;
        let highest_high = this.builder.bookkeeper?.highest_high ?? 0;
        if (this.limit === this.price) {
            if (this.builder.setup.long && this.builder.config.cond_sl == true && highest_high > 0) {
                let half_profit_stop = HalfProfit.with(this.price, highest_high);
                let order = _stop_loss_order(this.builder, half_profit_stop, this.share);
                (order.submit as Study).body = new And((order.submit as Study).body as Expr, new BiExpr(Highest_High.of(highest_high), ">=", `${this.price.financial()}*1.1`))
                primary.group.push(order);
            } else {
                primary.group.push(new TrailStopOrder(symbol, this.builder.setup.close(), this.share, this.builder.setup.long ? `MARK-${(this.builder.risk.profit / 2).financial()}%` : `MARK+${(this.builder.risk.profit / 2).financial()}%`));
            }
            primary.group.slice(-1)[0].comment = "Protect Half Profit";
            primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.limit));
            primary.group.slice(-1)[0].submit = cond;
            if (highest_high >= this.protect) {
                primary.group.slice(-1)[0].submit = null;
                primary.group.slice(-1)[0].loss = 0;
            }
        } else {
            if (this.builder.risk.isPercentage) {
                primary.group.push(new TrailStopOrder(symbol, this.builder.setup.close(), this.share, this.builder.setup.long ? `MARK-${(this.builder.risk.risk * 2).financial()}%` : `MARK+${(this.builder.risk.risk * 2).financial()}%`));
            }
        }
        primary.group.slice(-1)[0].comment = "Round-Trip";
        if (this.limit === this.price && this.builder.setup.long) {
            let ma_trailing_stop = (this.builder.bookkeeper?.sma10_trailing ?? 0) * 0.985;
            if (this.builder.setup.long && ma_trailing_stop > this.limit) {
                primary.group.pop();
            }
            if (!this.builder.setup.long && ma_trailing_stop < this.limit) {
                primary.group.pop();
            }
        }

        if (this.limit !== this.price && this.builder.risk.isPercentage) {
            primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, `TRG${this.builder.setup.long ? "-" : "+"}${this.builder.risk.risk.financial()}%`));
        } else {
            if (this.builder.config.cond_sl) {
                let stop = new MarketOrder(symbol, this.builder.setup.close(), this.share)
                stop.tif = "GTC";
                stop.submit = new Study(this.builder.setup.long ? Undercut.value(this.stop) : PassThrough.value(this.stop));
                stop.cancel = cond;
                primary.group.push(stop);
            } else {
                primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.stop));
                primary.group.slice(-1)[0].cancel = cond;
            }
        }
        primary.group.slice(-1)[0].comment = "Initial Stop-Loss";
        primary.group.slice(-1)[0].loss = (this.limit * this.builder.risk.risk / 100) * this.share;

        if (highest_high > this.protect) {
            primary.group.pop();
        } else {
            let better_sl = primary.group.slice(0, -1).filter((o) => {
                return !isNaN(o.loss) && o.loss <= primary.group.slice(-1)[0].loss;
            });
            if (better_sl.length > 0) {
                primary.group.pop();
            }
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
            oco.group.slice(-1)[0].loss = (this.stop - this.limit) * shares[i] * (this.builder.setup.long ? -1 : 1);
            multi.orders.push(oco);
        }
        return multi;
    }

    exit_pivot(params: any, base: MultiOCO): MultiOCO {
        let symbol = this.builder.setup.symbol;
        let low = params['low'] ?? this.stop;
        let prev = params['prev'] ?? this.stop;
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
        let stop = params['stop'] ?? this.stop;
        let avg = params['avg'] ?? '5%';
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
    public setup: Setup;
    public risk: any;
    public config: any;
    public exit: any;
    public bookkeeper: any;

    constructor(style: any, setup: any, risk: any, config: any, exit: any, bookkeeper: any) {
        this.style = style
        this.setup = setup
        this.risk = risk
        this.config = config
        this.exit = exit
        this.bookkeeper = bookkeeper
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
    let risk = new Risk(params.build.style, params['assets'], setup, params.build['pyramid']['trades'], params.build['pyramid']['count']);
    let builder = new PyramidBuilder(params.build.style, setup, risk, params.build['pyramid'], params.build['exit'], params.bookkeeper)
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


function _stop_loss_order(builder: PyramidBuilder, stop: number | Expr, share: number, cost: number = null): MarketOrder | StopOrder {
    let symbol = builder.setup.symbol;
    let order: MarketOrder | StopOrder;
    if (builder.config.cond_sl == true && builder.setup.long) {
        order = new MarketOrder(symbol, builder.setup.close(), share);
        order.tif = "GTC";
        order.submit = new Study(Undercut.value(stop));
    } else {
        order = new StopOrder(symbol, builder.setup.close(), share, typeof stop == "number" ? stop : stop.toString());
    }
    if (cost !== null && typeof stop == "number") {
        order.loss = Math.max((cost - stop) * share, 0);
    }
    return order;
}

function _ma_dynamic_stop(builder: PyramidBuilder, share: number): MarketOrder {
    let stop = new MarketOrder(builder.setup.symbol, builder.setup.close(), share);
    stop.tif = "GTC";
    stop.submit = new Study(DecisiveUndercut.value(builder.bookkeeper.sma10_trailing).or(DecisiveUndercut.value(SMA_LAST.length(10))));
    stop.comment = "Undercut Moving Average";
    return stop;
}

function _selling_into_weakness(builder: PyramidBuilder, share: number, stop: number, drawback: number, target: number): OrderOCO {
    let symbol = builder.setup.symbol;
    let oco = new OrderOCO();
    oco.group.push(new StopOrder(symbol, builder.setup.close(), share, stop));
    oco.group.slice(-1)[0].comment = "Round-Trip";
    let expr = [] as Expr[];
    if ((builder.bookkeeper?.highest_high ?? 0) >= builder.setup.pivot * 1.1 && builder.setup.long) {
        let half_profit_stop = HalfProfit.with(stop, builder.bookkeeper?.highest_high);
        let order = _stop_loss_order(builder, half_profit_stop, share);
        order.comment = "Protect Half Profit";
        oco.group.push(order);
        expr.push((oco.group.slice(-1)[0].submit as Study).body as Expr);
    } else {
        oco.group.push(new TrailStopOrder(symbol, builder.setup.close(), share, builder.setup.long ? `MARK-${drawback.financial()}%` : `MARK+${drawback.financial()}%`));
    }
    if (builder.bookkeeper?.sma10_trailing != null) {
        oco.group.push(_ma_dynamic_stop(builder, share));
        expr.push((oco.group.slice(-1)[0].submit as Study).body as Expr);
    }
    if (expr.length > 0) {
        let comments = [];
        for (let i = 0; i < expr.length; ++i) {
            comments.unshift(oco.group.pop().comment);
        }
        let order = new MarketOrder(symbol, builder.setup.close(), share);
        order.tif = "GTC";
        order.submit = new Study(new Or(...expr));
        order.comment = comments.join(", ")
        oco.group.push(order);
    }
    return oco;
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

            // @ts-ignore
            let shares = config.shares;
            // @ts-ignore
            let target = evaluate(config.target);
            // @ts-ignore
            let stop = config['support'];
            let drawback = Math.abs(((Math.max(builder.bookkeeper?.highest_high ?? 0, target) / stop) - 1) / 2 * 100);
            // @ts-ignore
            if (['half', 'third'].contains(config['part'])) {
                // @ts-ignore
                let keep = config['part'] == 'half' ? shares.half() : shares.one_third();
                let amount = shares - keep;
                let oco = _selling_into_weakness(builder, amount, stop, drawback, target);
                multi.orders.push(oco);
                shares = keep;
            }
            let oco = _selling_into_weakness(builder, shares, stop, drawback, target);
            let reversal = new MarketOrder(symbol, builder.setup.close(), shares);
            reversal.submit = new Study(new And(BeforeMarketClose, new BiExpr(ClsRange, '<', 0.6), new BiExpr('high(period=AggregationPeriod.DAY)', '>=', stop + (target - stop) * 0.6)));
            reversal.tif = "GTC";
            reversal.comment = "Downside Reversal";
            oco.group.unshift(reversal);

            oco.group.unshift(new LimitOrder(symbol, builder.setup.close(), shares, target))
            oco.group[0].comment = "Profit Taking";

            multi.orders.push(oco);
            multi.orders = multi.orders.reverse();
        }
    }
    return strategies;
}

