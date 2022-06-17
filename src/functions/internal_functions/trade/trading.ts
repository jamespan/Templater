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
import {evaluate, isNaN, round} from "mathjs";
import {And, BiExpr, Expr, Or, Study} from "./thinkscript";
import {
    AvoidMarketOpenVolatile,
    BeforeMarketClose,
    BuyRange,
    BuyRangeSMA,
    ClsRange, DecisivePassThrough,
    DecisiveUndercut, HalfProfit, HalfProfitShorting, Highest_High,
    HugeVolume, Lowest_Low, AvoidFallingKnife, NotExtended, PassThrough,
    SellRange,
    SMA_LAST, TightBidAskSpread,
    Undercut, UpsideReversal, ShortingIntoStrength, NotExtendedShorting, EMA_LAST, EMA, LightVolume
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

    constructor(input: any, trendline: any) {
        this.symbol = input.symbol;
        this._direction = input.direction ?? 'long';
        this.pivot = evaluate(input.pivot);
        if (trendline?.open?.regression) {
            this.pivot = trendline?.open?.regression;
        }
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
            let cost = setup.pivot;
            if (trades != null && trades.length === layer) {
                let invested = 0;
                let shares = 0;
                for (let i = 0; i < trades.length; ++i) {
                    let parts = trades[i].split('@', 2);
                    shares += parseInt(parts[0]);
                    invested += parseInt(parts[0]) * parseFloat(parts[1]);
                }
                cost = invested / shares;
            }
            this.risk = (1 - setup.stop / cost) * 100 * (this.setup.long ? 1 : -1);
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

        if (!builder.risk.isPercentage) {
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
            let conditions = [AvoidMarketOpenVolatile, TightBidAskSpread] as Expr[];
            if (this.builder.setup.long) {
                conditions.push(this.builder.setup.long ? AvoidFallingKnife : ShortingIntoStrength);
            }
            if (!this.builder.risk.isPercentage) {
                if (this.builder.setup.long) {
                    conditions.push(NotExtended.over(`(${this.builder.setup.stop.financial()}*${(100 + Math.min(7, round(this.builder.risk.risk * 1.5, 2))).percent().toFixed(4)})`));
                } else {
                    conditions.push(NotExtendedShorting.over(`(${this.builder.setup.stop.financial()}*${(100 - Math.min(5, round(this.builder.risk.risk * 1.5, 2))).percent().toFixed(4)})`));
                }
            }
            if (this.builder.setup.pattern.contains('Follow Through')) {
                conditions = [BeforeMarketClose(), TightBidAskSpread];
                conditions.push(PassThrough.value("close(period=AggregationPeriod.DAY)[1]*1.017"));
            } else if (this.builder.setup.pattern.contains('Pullback')) {
                conditions.push(BuyRangeSMA);
                conditions.push(PassThrough.value("close(period=AggregationPeriod.DAY)[1]"));
                if (this.builder.config.reversal ?? true) {
                    conditions.push(UpsideReversal);
                }
            } else {
                if (this.builder.setup.long) {
                    conditions.push(BuyRange.of(this.price, this.limit));
                } else {
                    let offset = upper / 3;
                    conditions.push(SellRange.of(this.price * (100 - offset).percent(), this.price * (100 + offset * 2).percent()));
                }
            }

            if (this.builder.config?.estimate) {
                let volumeAnchor = this.builder.config.volume_anchor ?? "avg";
                if ("avg" === volumeAnchor) {
                    let avg = this.builder.config.volume != null ?
                        parseInt(this.builder.config.volume.split(',').join('')) :
                        "MovingAverage(data=VOLUME(period=AggregationPeriod.DAY),length=50)[1]";
                    if (this.builder.setup.long) {
                        conditions.push(HugeVolume.over(`(${avg}*1.4)`));
                    } else {
                        conditions.push(LightVolume.over(`(${avg})`));
                    }
                } else {
                    if (this.builder.setup.long) {
                        conditions.push(HugeVolume.over(`(volume(period=AggregationPeriod.DAY)[1])`));
                    } else {
                        conditions.push(LightVolume.over(`(volume(period=AggregationPeriod.DAY)[1])`));
                    }
                }
            }
            primary.trigger.submit = new Study(new And(...conditions));
        } else {
            primary.trigger = new StopLimitOrder(symbol, this.builder.setup.open(), this.share, this.price, this.limit);
            if (!this.builder.setup.long) {
                (primary.trigger as StopLimitOrder).stopType = "MARK";
            }
        }

        if (this.builder.config?.mode == "manual") {
            primary.trigger.submit = null;
            primary.trigger.tif = "DAY";
        }

        primary.group.push(new LimitOrder(symbol, this.builder.setup.close(), this.share, this.take));
        primary.group.slice(-1)[0].profit = (this.take - this.limit) * this.share * (this.builder.setup.long ? 1 : -1);
        primary.group.slice(-1)[0].comment = "Profit Taking";

        if (this.builder.config.sell_without_cushion ?? false) {
            let order = new MarketOrder(symbol, this.builder.setup.close(), this.share);
            order.tif = "GTC";
            order.submit = new Study(new And(BeforeMarketClose(), Undercut.value(`${this.price.financial()}*1.05`)));
            order.comment = "Exit without enough Cushion"
            primary.group.push(order);
        }
        let trailing_price = _ma_trailing_price(this.builder);
        let ma_stop_ignore_atr = this.builder.config.ma_stop_ignore_atr ?? false;
        if (this.limit === this.price && trailing_price != null && this.builder.config.ma_stop != null) {
            if (ma_stop_ignore_atr
                || (this.builder.setup.long && (trailing_price < this.builder.bookkeeper?.price - this.builder.bookkeeper?.atr))
                || (!this.builder.setup.long && (trailing_price > this.builder.bookkeeper?.price + this.builder.bookkeeper?.atr))) {
                primary.group.push(_ma_dynamic_stop(this.builder, this.share, this.builder.config.ma_stop ?? 10, trailing_price));
                if (this.builder.setup.long) {
                    primary.group.slice(-1)[0].loss = Math.max((this.price - trailing_price * 0.985) * this.share, 0);
                } else {
                    primary.group.slice(-1)[0].loss = Math.max((this.price - trailing_price * 1.015) * this.share * -1, 0);
                }
            }
        }

        if (this.builder.trendline?.close?.regression) {
            let stop = _stop_loss_order(this.builder,
                this.builder.trendline?.close?.regression * (100 - 1 * (this.builder.setup.long ? 1 : -1)).percent(), this.share, this.limit);
            stop.comment = "Undercut Trendline";
            primary.group.push(stop);
        }

        // round-trip sell rule
        this.protect = this.builder.setup.pivot * (100 + 10 * (this.builder.setup.long ? 1 : -1)).percent();
        if (this.builder.setup.long) {
            this.protect = Math.min(this.price + Math.max(0, (this.price - this.stop)) * 2, this.protect);
        } else {
            this.protect = Math.max(this.price + Math.min(0, (this.price - this.stop)) * 2, this.protect);
        }
        let cond = `${symbol} MARK AT OR ${this.builder.setup.long ? "ABOVE" : "BELOW"} ${this.protect.financial()}`;
        let highest_high = this.builder.bookkeeper?.highest_high ?? 0;
        let lowest_low = this.builder.bookkeeper?.lowest_low ?? NaN;
        let break_even = false;
        if (this.limit === this.price) {
            if (this.builder.config.cond_sl == true && ((this.builder.setup.long && highest_high > 0) || (!this.builder.setup.long && !isNaN(lowest_low)))) {
                let lock_half_profit = Math.min(10, (Math.min(this.builder.risk.risk * 2, 10) + this.builder.risk.profit) / 2.0);
                if (this.builder.setup.long) {
                    let half_profit_stop = HalfProfit.with(this.price, highest_high);
                    let order = _stop_loss_order(this.builder, half_profit_stop, this.share);
                    (order.submit as Study).body = new And((order.submit as Study).body as Expr, new BiExpr(Highest_High.of(highest_high), ">=", `${this.builder.setup.pivot.financial()}*(100+${lock_half_profit.financial()})/100`));
                    primary.group.push(order);
                } else {
                    let half_profit_stop = HalfProfitShorting.with(this.price, lowest_low);
                    let order = _stop_loss_order(this.builder, half_profit_stop, this.share);
                    (order.submit as Study).body = new And((order.submit as Study).body as Expr, new BiExpr(Lowest_Low.of(lowest_low), "<=", `${this.builder.setup.pivot.financial()}*(100-${lock_half_profit.financial()})/100`));
                    primary.group.push(order);
                }
            } else {
                primary.group.push(new TrailStopOrder(symbol, this.builder.setup.close(), this.share, this.builder.setup.long ? `MARK-${(this.builder.risk.profit / 2).financial()}%` : `MARK+${(this.builder.risk.profit / 2).financial()}%`));
            }
            primary.group.slice(-1)[0].comment = "Protect Half Profit";
            primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.limit));
            primary.group.slice(-1)[0].submit = cond;
            if ((this.builder.setup.long && highest_high >= this.protect) || (!this.builder.setup.long && lowest_low <= this.protect)) {
                break_even = true;
                primary.group.slice(-1)[0].submit = null;
                primary.group.slice(-1)[0].loss = 0;
            }
            primary.group.slice(-1)[0].comment = "Round-Trip";
        } else {
            if (this.builder.risk.isPercentage) {
                primary.group.push(new TrailStopOrder(symbol, this.builder.setup.close(), this.share, this.builder.setup.long ? `MARK-${(this.builder.risk.risk * 2).financial()}%` : `MARK+${(this.builder.risk.risk * 2).financial()}%`));
                primary.group.slice(-1)[0].comment = "Round-Trip";
            } else {
                let lock_half_profit = Math.min(10, (Math.min(this.builder.risk.risk * 2, 10) + this.builder.risk.profit) / 2.0);
                if (this.builder.setup.long) {
                    let half_profit_stop = HalfProfit.with(this.price, this.price);
                    let order = _stop_loss_order(this.builder, half_profit_stop, this.share);
                    (order.submit as Study).body = new And((order.submit as Study).body as Expr, new BiExpr(Highest_High.of(this.price), ">=", `${this.price.financial()}*(100+${lock_half_profit.financial()})/100`));
                    primary.group.push(order);
                } else {
                    let half_profit_stop = HalfProfitShorting.with(this.price, this.price);
                    let order = _stop_loss_order(this.builder, half_profit_stop, this.share);
                    (order.submit as Study).body = new And((order.submit as Study).body as Expr, new BiExpr(Lowest_Low.of(this.price), "<=", `${this.price.financial()}*(100-${lock_half_profit.financial()})/100`));
                    primary.group.push(order);
                }
                primary.group.slice(-1)[0].comment = "Protect Half Profit";

                primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.price));
                primary.group.slice(-1)[0].submit = cond;
                primary.group.slice(-1)[0].comment = "Round-Trip";
            }
        }

        if (this.limit === this.price && !break_even && this.builder.bookkeeper?.atrp != null && !this.builder.setup.long) {
            let stop = this.builder.setup.long ?
                new Expr(`close(period=AggregationPeriod.DAY)[1]*(100-${this.builder.bookkeeper?.aurp}*1.5)/100`)
                : new Expr(`close(period=AggregationPeriod.DAY)[1]*(100+${this.builder.bookkeeper?.adrp}*1.5)/100`);
            let volatile = _stop_loss_order(this.builder, stop, this.share);
            volatile.comment = "Volatile Stop-Loss";
            if (this.limit == this.price) {
                let close = this.builder.bookkeeper?.price;
                let stop_price = this.builder.setup.long ? close * (100 - this.builder.bookkeeper?.aurp * 1.5) / 100
                    : close * (100 + this.builder.bookkeeper?.adrp * 1.5) / 100;
                volatile.loss = Math.max((this.limit - stop_price) * this.share * (this.builder.setup.long ? 1 : -1), 0);
            }
            primary.group.push(volatile);
        }

        if (this.limit !== this.price && this.builder.risk.isPercentage) {
            primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, `TRG${this.builder.setup.long ? "-" : "+"}${this.builder.risk.risk.financial()}%`));
            primary.group.slice(-1)[0].loss = (this.limit * this.builder.risk.risk / 100) * this.share;
        } else {
            if (this.builder.config.cond_sl) {
                let insurance = new StopOrder(symbol, this.builder.setup.close(), this.share, this.limit * (100 - 7 * (this.builder.setup.long ? 1 : -1)).percent());
                insurance.comment = "Emergency Stop-Loss";
                primary.group.push(insurance);

                if (this.limit == this.price) {
                    let backup = new StopOrder(symbol, this.builder.setup.close(), this.share, this.stop * (100 - 0.5 * (this.builder.setup.long ? 1 : -1)).percent());
                    backup.comment = "Backup Stop-Loss";
                    let currentTime = new Date().toLocaleString(
                        'zh-CN', {timeZone: 'America/New_York'}).substr(-8);
                    if ('09:35:00' <= currentTime && currentTime <= '16:00:00') {
                        backup.submitAt = null;
                    } else {
                        backup.submitAfterOpen();
                    }
                    primary.group.push(backup);
                }

                if (this.builder.setup.pattern.contains('Volatility Contraction')) {
                    if (this.builder.bookkeeper?.lower_low?.length >= 3 && this.builder.bookkeeper.lower_low[2] >= this.stop * 1.005) {
                        let violation = _stop_loss_order(this.builder, this.builder.bookkeeper.lower_low[2], this.share, null);
                        violation.comment = "Violation Stop-Loss";
                        primary.group.push(violation);
                    }
                    if (this.builder.bookkeeper?.vcp_violation?.length > 0) {
                        let violation = new MarketOrder(symbol, this.builder.setup.close(), this.share);
                        violation.tif = "GTC";
                        let combined = null;
                        if (this.builder.bookkeeper?.vcp_violation?.contains("closing low beats closing high")) {
                            combined = new BiExpr(ClsRange, '<', 0.4);
                        }
                        if (this.builder.bookkeeper?.vcp_violation?.contains("down days beats up days")) {
                            let cond = new BiExpr("close", '<', "close(period=AggregationPeriod.DAY)[1]");
                            combined = combined == null ? cond : new Or(combined, cond);
                        }
                        if (this.builder.bookkeeper?.vcp_violation?.contains("exit if close below 20 day")) {
                            let cond = new BiExpr("close", '<', EMA.length(21));
                            combined = combined == null ? cond : new Or(combined, cond);
                        }
                        violation.submit = new Study(new And(BeforeMarketClose(), combined));
                        violation.comment = "Violation Expectation Break";
                        if (combined != null) {
                            primary.group.push(violation);
                        }
                    }
                }

                let stop = _stop_loss_order(this.builder, this.stop, this.share, this.limit);
                primary.group.push(stop);
            } else {
                primary.group.push(new StopOrder(symbol, this.builder.setup.close(), this.share, this.stop));
                primary.group.slice(-1)[0].cancel = cond;
            }
            primary.group.slice(-1)[0].loss = Math.max(0, (this.limit - this.stop) * this.share * (this.builder.setup.long ? 1 : -1));
        }
        primary.group.slice(-1)[0].comment = "Initial Stop-Loss";

        if (this.limit === this.price) {
            if (this.protect != this.price && (
                (this.builder.setup.long && highest_high >= this.protect && this.stop <= this.price)
                || (!this.builder.setup.long && lowest_low <= this.protect && this.stop >= this.price)
            )) {
                primary.group.pop();
                primary.group.pop();
            } else {
                let better_sl = primary.group.slice(0, -1).filter((o) => {
                    return !isNaN(o.loss) && o.loss <= primary.group.slice(-1)[0].loss;
                });
                if (better_sl.length > 0 &&
                    ((this.builder.setup.long && this.stop <= this.price)
                        || (!this.builder.setup.long && this.stop >= this.price))) {
                    primary.group.pop();
                    primary.group.pop();
                }
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
        multi.tidy();
    }

    exit_base(part: number = 2): MultiOCO {
        let multi = new MultiOCO();
        let shares = [Math.round(this.share / part)];
        shares.push(this.share - shares[0]);
        for (let i = 0; i < shares.length; ++i) {
            let oco = new OrderOCO();
            this.primary.group.forEach((o: any) => {
                let order = Object.assign(Object.create(Object.getPrototypeOf(o)), o);
                order.share = shares[i];
                oco.group.push(order);
            });
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
            let initial = oco.group.slice(-1)[0];
            if (initial.comment != "Initial Stop-Loss") {
                continue
            }
            if (this.builder.config.cond_sl) {
                initial.submit = new Study(this.builder.setup.long ? Undercut.value(stops[i]) : PassThrough.value(stops[i]));
            } else {
                (initial as StopOrder).stop = stops[i];
            }
            initial.loss = (stops[i] - this.limit) * shares[i] * (this.builder.setup.long ? -1 : 1);
            oco.group.pop();
            oco.group.push(initial);
        }
        return base;
    }
}

export class PyramidBuilder {
    public style: any;
    public setup: Setup;
    public risk: any;
    public config: any;
    public trendline: any;
    public exit: any;
    public bookkeeper: any;

    constructor(style: any, setup: any, risk: any, config: any, trendline: any, exit: any, bookkeeper: any) {
        this.style = style
        this.setup = setup
        this.risk = risk
        this.config = config
        this.trendline = trendline
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
            pyramid.primary.tidy()
            pyramids.push(pyramid);
        }
        return pyramids;
    }
}

export function building(params: any) {
    let setup = new Setup(params.build.setup, params.build.trendline);
    setup.init();
    let risk = new Risk(params.build.style, params['assets'], setup, params.build['pyramid']['trades'], params.build['pyramid']['count']);
    let builder = new PyramidBuilder(params.build.style, setup, risk, params.build['pyramid'], params.build['trendline'], params.build['exit'], params.bookkeeper)
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
    if (builder.config.cond_sl == true) {
        order = new MarketOrder(symbol, builder.setup.close(), share);
        order.tif = "GTC";
        if (builder.setup.long) {
            order.submit = new Study(AvoidMarketOpenVolatile.and(Undercut.value(stop)));
        } else {
            order.submit = new Study(AvoidMarketOpenVolatile.and(PassThrough.value(stop)));
        }
    } else {
        order = new StopOrder(symbol, builder.setup.close(), share, typeof stop == "number" ? stop : stop.toString());
    }
    if (cost !== null && typeof stop == "number") {
        order.loss = Math.max((cost - stop) * share * (builder.setup.long ? 1 : -1), 0);
    }
    return order;
}

function _ma_trailing_price(builder: PyramidBuilder) {
    let ma_length = builder.config.ma_stop ?? 10;
    let trailing = builder.config.ma_stop_trailing ?? true;
    let suffix = trailing ? "_trailing" : "";
    let trailing_key = "sma10";
    if (ma_length == 10) {
        trailing_key = "sma10";
    } else if (ma_length == 50) {
        trailing_key = "sma50";
    } else if (ma_length == 21) {
        trailing_key = "ema21";
    }
    trailing_key += suffix;
    return (builder.bookkeeper ?? {})[trailing_key];
}

function _ma_dynamic_stop(builder: PyramidBuilder, share: number, ma_length: number = 10, trailing_price: number = null): MarketOrder {
    let stop = new MarketOrder(builder.setup.symbol, builder.setup.close(), share);
    stop.tif = "GTC";
    let ma_expr = SMA_LAST.length(ma_length);
    if (ma_length === 21) {
        ma_expr = EMA_LAST.length(ma_length);
    }
    if (builder.setup.long) {
        if (trailing_price != null) {
            stop.submit = new Study(AvoidMarketOpenVolatile.and(DecisiveUndercut.value(trailing_price).or(DecisiveUndercut.value(ma_expr))));
        } else {
            stop.submit = new Study(AvoidMarketOpenVolatile.and(DecisiveUndercut.value(ma_expr)));
        }
    } else {
        if (trailing_price != null) {
            stop.submit = new Study(AvoidMarketOpenVolatile.and(DecisivePassThrough.value(trailing_price).or(DecisivePassThrough.value(ma_expr))));
        } else {
            stop.submit = new Study(AvoidMarketOpenVolatile.and(DecisivePassThrough.value(ma_expr)));
        }
    }
    stop.comment = "Undercut Moving Average";
    return stop;
}

export function riding(builder: PyramidBuilder, params: any) {
    let strategies = new Map();
    let pyramid = null;
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
        pyramid = new Pyramid(builder, 0, trade);
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
            let shares = config.shares;
            let target = evaluate(config.target);
            let stop = config['support'];

            if (pyramid == null) {
                pyramid = new Pyramid(builder, 0, `${shares}@${stop}`);
            }

            pyramid.take = target;
            pyramid.share = shares;
            pyramid.build();
            pyramid.exit();

            let multi;
            if (['half', 'third'].contains(config['part'])) {
                multi = pyramid.exit_base(config['part'] == 'half' ? 2 : 3);
            } else {
                multi = pyramid.exit_base(config['part']);
            }
            strategies.set(key, multi);

            multi.orders.forEach(oco => {
                oco.group.filter(x => x.comment == "Round-Trip").forEach(o => {
                    (o as StopOrder).stop = stop.financial();
                })
            });

            let reversal = new MarketOrder(symbol, builder.setup.close(), multi.orders[0].group[0].share);
            if (builder.setup.long) {
                reversal.submit = new Study(new And(BeforeMarketClose(), new BiExpr(ClsRange, '<', 0.6), new BiExpr('high(period=AggregationPeriod.DAY)', '>=', stop + (target - stop) * 0.6)));
            } else {
                reversal.submit = new Study(new And(BeforeMarketClose(), new BiExpr(ClsRange, '>', 0.6), new BiExpr('low(period=AggregationPeriod.DAY)', '<=', stop + (target - stop) * 0.6)));
            }
            reversal.tif = "GTC";
            reversal.comment = "Against Reversal";
            multi.orders[0].group.push(reversal);

            // remove profit taking
            multi.orders[1].group.shift();
            multi.tidy();
        }
    }
    return strategies;
}

