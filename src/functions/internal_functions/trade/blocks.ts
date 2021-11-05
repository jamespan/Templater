import {BiExpr, Expr, Call, VarExpr, And} from "./thinkscript";

declare global {
    interface Number {
        financial(): string
    }
}
Number.prototype.financial = function () {
    return this.toFixed(2);
};

export const VolumeEstimate = new Expr("(((fold i = 0 to 40 with s = 0 do if GetValue(GetYYYYMMDD(),i*10) == GetYYYYMMDD() and GetValue(SecondsTillTime(930),i*10)<=-600 then s + GetValue(Sum(volume, 10), i*10) else s) + (fold j = 0 to 10 with b = 0 do if j <= ((-SecondsTillTime(930)/60)%10) then b + if j == 0 then GetValue(volume, (-SecondsTillTime(930)/60)-0) else if j == 1 then GetValue(volume, (-SecondsTillTime(930)/60)-1) else if j == 2 then GetValue(volume, (-SecondsTillTime(930)/60)-2) else if j == 3 then GetValue(volume, (-SecondsTillTime(930)/60)-3) else if j == 4 then GetValue(volume, (-SecondsTillTime(930)/60)-4) else if j == 5 then GetValue(volume, (-SecondsTillTime(930)/60)-5) else if j == 6 then GetValue(volume, (-SecondsTillTime(930)/60)-6) else if j == 7 then GetValue(volume, (-SecondsTillTime(930)/60)-7) else if j == 8 then GetValue(volume, (-SecondsTillTime(930)/60)-8) else if j == 9 then GetValue(volume, (-SecondsTillTime(930)/60)-9) else 0 else b))/(-SecondsTillTime(930)/60+1)*390)");
export const ClsRange = new Expr("(close-low(period=AggregationPeriod.DAY))/(high(period=AggregationPeriod.DAY)-low(period=AggregationPeriod.DAY))");
export const HugeVolume = new (class extends BiExpr {
    over(value: any): BiExpr {
        return super.with(value);
    }
})(VolumeEstimate, '>', 1);

export const Undercut = new (class extends BiExpr {
    value(value: any): BiExpr {
        return super.with(value);
    }
})('low', '<', 1);

export const DecisiveUndercut = new (class extends BiExpr {
    value(value: any): BiExpr {
        return Undercut.value(new BiExpr(value, '*', '0.985'));
    }
})('low', '<', 1);

export const PassThrough = new (class extends BiExpr {
    value(value: any): BiExpr {
        return super.with(value);
    }
})('high', '>', 1);

export const AvoidMarketOpenVolatile = new VarExpr((x) => {
    let delay_minutes = (Math.floor(x / 100) - 9) * 60 + (x % 100 - 30);
    return `Between(SecondsTillTime(${x}), ${(-390 + delay_minutes) * 60}, 0)`;
}, 935);

export const BeforeMarketClose = new And(AvoidMarketOpenVolatile, new Call("Between", 'SecondsTillTime(1600)', 0, 60));

export const SMA = new (class extends VarExpr {
    length(len: number): VarExpr {
        return super.withParams(len);
    }
})((x) => {
    return `MovingAverage(data=close(period=AggregationPeriod.DAY),length=${x})`;
}, 50);

export const SMA_LAST = new (class extends VarExpr {
    length(len: number): VarExpr {
        return super.withParams(len);
    }
})((x) => {
    return `MovingAverage(data=close(period=AggregationPeriod.DAY)[1],length=${x})`;
}, 50);


export const Between = new Call("Between", "high", 1, 2);
export const Between_High = new (class extends Call {
    of(from: any, to: any): Call {
        return super.withParams("high", ...([from, to].map((x) => typeof x == 'number' ? x.financial() : x)));
    }
})("Between", "high");

export const Between_Low = new (class extends Call {
    of(from: any, to: any): Call {
        return super.withParams("low", ...([from, to].map((x) => typeof x == 'number' ? x.financial() : x)));
    }
})("Between", "low");

export const BuyRange = Between_High;
export const SellRange = Between_Low;
export const BuyRangeSMA = Between_High.of(new BiExpr(SMA, "+", 0.1), new BiExpr(SMA, "*", 1.05))

// condition not support bid ask
export const BidAskSpread = new Expr("(ask/bid-1)*100");
export const TightBidAskSpread = new BiExpr(BidAskSpread, '<', 0.5);

export const TodayLowUndercutPrevLow = new BiExpr("low(period=AggregationPeriod.DAY)", '<', 'low(period=AggregationPeriod.DAY)[1]');
export const UpsideReversal = TodayLowUndercutPrevLow.and(PassThrough.value('high(period=AggregationPeriod.DAY)[1]+0.1'));

export const PriceUp = new (class extends BiExpr {
    over(value: any): BiExpr {
        return super.with(value);
    }
})("close(period=AggregationPeriod.DAY)[1]", '<=', 1);

export const Highest_High = new (class extends Call {
    of(highest_high: number): Call {
        return super.withParams("high(period=AggregationPeriod.DAY)", highest_high.financial());
    }
})("Max", "high(period=AggregationPeriod.DAY)", 0);

export const HalfProfit = new (class extends VarExpr {
    with(cost: number, highest_high: number): VarExpr {
        return super.withParams(cost, highest_high);
    }
})((args) => {
    let cost = args[0] as number;
    let highest_high = args[1] as number;
    return `${Highest_High.of(highest_high)}+${cost?.financial()})/2`;
}, 0, 0, 0);

if (module.id == ".") {
    // console.log(BuyRange.of(72.85, 72.85 * 1.05));
    // console.log(AvoidMarketOpenVolatile.and(BuyRangeSMA).and(HugeVolume.over("26185800*1.4")));
    console.log(HalfProfit.with(100, 200));
}
