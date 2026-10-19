"""T1/T2 分批金字塔买卖点引擎（ATR 波动通道版）
输入：250 根前复权日 K + 现价 → 输出：买T1/T2、卖T1/T2 四档价格带
"""

TIER_PCTS = [40, 60]
ATR_PERIOD = 20
ATR_MULT_BUY_T1, ATR_MULT_BUY_T2 = 1.0, 2.2
ATR_MULT_SELL_T1, ATR_MULT_SELL_T2 = 1.8, 3.2
CLAMP_BUY_T1, CLAMP_BUY_T2 = (0.030, 0.080), (0.070, 0.200)
CLAMP_SELL_T1, CLAMP_SELL_T2 = (0.060, 0.120), (0.100, 0.260)
ABSORB_WIN = 0.025
ABSORB_CLAMP_SLACK = 1.25
ATR_MIN_GAP = 1.05
ATR_GAP_TOL = 0.95
EDGE_MIN_BUY_T1, EDGE_MIN_SELL_T1 = 0.025, 0.050
WATCH_MIN_UPSIDE, WATCH_MAX_UPSIDE = 0.025, 0.080
MERGE_NEAR = 0.018
CHANGE_THRESHOLD = 0.030
MIN_TIER_GAP = 0.020
DROP_SHORT_ANCHORS = True

ANCHOR_WEIGHT = {
    "近120日高点": 9, "近120日低点": 9,
    "近60日高点": 8, "近60日低点": 8,
    "Fib 50%回撤": 7, "Fib 61.8%回撤": 7, "年线MA250": 7,
    "Fib 50%反弹": 7, "Fib 61.8%反弹": 7,
    "Fib 38.2%回撤": 6, "Fib 78.6%回撤": 6, "MA120": 6,
    "Fib 38.2%反弹": 6, "Fib 78.6%反弹": 6,
    "Fib 50%支撑": 6, "Fib 61.8%支撑": 6,
    "Fib 38.2%支撑": 5, "Fib 78.6%支撑": 5,
    "Fib扩展1.236": 5, "Fib扩展1.382": 5, "MA60": 5,
}


def calc_atr(bars, n=ATR_PERIOD):
    if not bars or len(bars) < 2:
        return None
    trs, start = [], max(1, len(bars) - n)
    for i in range(start, len(bars)):
        h, l, pc = bars[i]["high"], bars[i]["low"], bars[i - 1]["close"]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    return sum(trs) / len(trs) if trs else None


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def round_step(price):
    if price < 10:  return 0.05
    if price < 30:  return 0.10
    if price < 100: return 0.50
    return 1.00


def band_width(price):
    w = price * 0.012
    if price < 10:  return max(w, 0.10)
    if price < 30:  return max(w, 0.25)
    if price < 100: return max(w, 0.50)
    return max(w, 1.00)


def round_to(v, step):
    return round(round(v / step) * step, 2)


def make_zone(center):
    step, w = round_step(center), band_width(center)
    low, high = round_to(center - w, step), round_to(center + w, step)
    if high <= low:
        high = round(low + step, 2)
    return low, high


def pct_diff(a, b):
    return abs(a - b) / b if b else 1.0


def ma_last(closes, p):
    if len(closes) < p:
        return None
    v = sum(closes[-p:]) / p
    return v if v else None


def build_anchors(bars):
    highs = [b["high"] for b in bars]
    lows = [b["low"] for b in bars]
    closes = [b["close"] for b in bars]

    HH, LL = max(highs), min(lows)
    H120 = max(highs[-120:]) if len(highs) >= 120 else HH
    L120 = min(lows[-120:]) if len(lows) >= 120 else LL
    rng120 = H120 - L120
    H60 = max(highs[-60:]) if len(highs) >= 60 else HH
    L60 = min(lows[-60:]) if len(lows) >= 60 else LL

    MA60, MA120, MA250 = ma_last(closes, 60), ma_last(closes, 120), ma_last(closes, 250)

    fib_retr = {
        "Fib 38.2%回撤": H120 - rng120 * 0.382,
        "Fib 50%回撤": H120 - rng120 * 0.500,
        "Fib 61.8%回撤": H120 - rng120 * 0.618,
        "Fib 78.6%回撤": H120 - rng120 * 0.786,
    }
    fib_bounce = {
        "Fib 38.2%反弹": L120 + rng120 * 0.382,
        "Fib 50%反弹": L120 + rng120 * 0.500,
        "Fib 61.8%反弹": L120 + rng120 * 0.618,
        "Fib 78.6%反弹": L120 + rng120 * 0.786,
    }

    supports, resists = [], []

    def add(pool, name, val):
        if val and val > 0:
            pool.append({"name": name, "price": float(val)})

    for n, v in fib_retr.items():
        add(supports, n, v)
    add(supports, "MA60", MA60)
    add(supports, "MA120", MA120)
    add(supports, "年线MA250", MA250)
    add(supports, "近60日低点", L60)
    add(supports, "近120日低点", L120)
    for n, v in fib_bounce.items():
        add(supports, n.replace("反弹", "支撑"), v)

    add(resists, "近60日高点", H60)
    add(resists, "近120日高点", H120)
    for n, v in fib_bounce.items():
        add(resists, n, v)
    add(resists, "MA60", MA60)
    add(resists, "MA120", MA120)
    add(resists, "年线MA250", MA250)
    add(resists, "Fib扩展1.236", H120 + rng120 * 0.236)
    add(resists, "Fib扩展1.382", H120 + rng120 * 0.382)

    struct = {"HH": HH, "LL": LL, "H120": H120, "L120": L120,
              "MA60": MA60, "MA120": MA120, "MA250": MA250}
    return supports, resists, struct


def fit_edge(center, price, min_edge, side):
    """按价格带边沿校正 T1 中心（触发看边沿，不看中心）"""
    for _ in range(12):
        lo, hi = make_zone(center)
        edge = hi if side == "buy" else lo
        ok = (edge <= price * (1 - min_edge)) if side == "buy" else (edge >= price * (1 + min_edge))
        if ok:
            break
        step = round_step(center)
        center = center - step if side == "buy" else center + step
    return center


def band_gap(t1, t2, side):
    return (t1["low"] - t2["high"]) if side == "buy" else (t2["low"] - t1["high"])


def enforce_band_gap(tiers, side, price, atr, hi_pct=None):
    """成带后的间距回检：整条 T2 带平移，直到净空隙达标（保间距优先于软夹逼）"""
    if len(tiers) < 2 or not price:
        return tiers
    need = ATR_MIN_GAP * (atr if atr else price * 0.03) * ATR_GAP_TOL
    t1, t2 = tiers[0], tiers[1]
    step = round_step((t2["low"] + t2["high"]) / 2)
    for _ in range(80):
        if band_gap(t1, t2, side) >= need:
            break
        d = -step if side == "buy" else step
        t2["low"], t2["high"] = round(t2["low"] + d, 2), round(t2["high"] + d, 2)
    if hi_pct is not None:
        ctr = (t2["low"] + t2["high"]) / 2
        if abs(ctr / price - 1) > hi_pct:
            tgt = price * (1 - hi_pct) if side == "buy" else price * (1 + hi_pct)
            d = tgt - ctr
            nlow, nhigh = round_to(t2["low"] + d, step), round_to(t2["high"] + d, step)
            if band_gap(t1, {"low": nlow, "high": nhigh}, side) >= need:
                t2["low"], t2["high"] = nlow, nhigh
    return tiers


def pick_tiers(pool, price, side, atr=None):
    if side == "buy":
        clamps = (CLAMP_BUY_T1, CLAMP_BUY_T2)
        mults = (ATR_MULT_BUY_T1, ATR_MULT_BUY_T2)
    else:
        clamps = (CLAMP_SELL_T1, CLAMP_SELL_T2)
        mults = (ATR_MULT_SELL_T1, ATR_MULT_SELL_T2)

    atr_pct = (atr / price) if (atr and price > 0) else None
    gap_abs = ATR_MIN_GAP * (atr if atr else price * 0.03)

    picked = []
    for i, mult in enumerate(mults):
        lo, hi = clamps[i]
        pct = clamp(mult * atr_pct, lo, hi) if atr_pct else (lo + hi) / 2.0
        target = price * (1 - pct) if side == "buy" else price * (1 + pct)

        cands = []
        for c in pool:
            if abs(c["price"] / target - 1) > ABSORB_WIN:
                continue
            pct_of = abs(c["price"] / price - 1)
            if pct_of < lo or pct_of > hi * ABSORB_CLAMP_SLACK:
                continue
            if picked:
                prev = picked[-1]["center"]
                if side == "buy" and prev - c["price"] < gap_abs:
                    continue
                if side == "sell" and c["price"] - prev < gap_abs:
                    continue
            cands.append(c)

        if cands:
            cands.sort(key=lambda x: (-ANCHOR_WEIGHT.get(x["name"], 0),
                                      abs(x["price"] / target - 1)))
            best = cands[0]
            near = [c["name"] for c in pool
                    if abs(c["price"] / best["price"] - 1) < MERGE_NEAR]
            seen, uniq = set(), []
            for n in near:
                if n not in seen:
                    seen.add(n)
                    uniq.append(n)
            picked.append({"center": best["price"], "names": uniq[:3]})
        else:
            center = target
            if picked:
                prev = picked[-1]["center"]
                if side == "buy" and prev - center < gap_abs:
                    center = prev - gap_abs
                if side == "sell" and center - prev < gap_abs:
                    center = prev + gap_abs
                if abs(center / price - 1) > hi:
                    center = price * (1 - hi) if side == "buy" else price * (1 + hi)
            picked.append({"center": center, "names": ["ATR波动通道"]})

    edge_min = EDGE_MIN_BUY_T1 if side == "buy" else EDGE_MIN_SELL_T1
    picked[0]["center"] = fit_edge(picked[0]["center"], price, edge_min, side)

    tiers = []
    for i, p in enumerate(picked[:2]):
        low, high = make_zone(p["center"])
        tiers.append({"tier": f"T{i+1}", "low": low, "high": high,
                      "pct": TIER_PCTS[i], "note": "+".join(p["names"])})

    for i in range(1, len(tiers)):
        if side == "buy" and tiers[i]["high"] >= tiers[i - 1]["low"]:
            tiers[i]["low"], tiers[i]["high"] = make_zone(tiers[i - 1]["low"] * (1 - MIN_TIER_GAP))
        if side == "sell" and tiers[i]["low"] <= tiers[i - 1]["high"]:
            tiers[i]["low"], tiers[i]["high"] = make_zone(tiers[i - 1]["high"] * (1 + MIN_TIER_GAP))

    enforce_band_gap(tiers, side, price, atr, clamps[1][1])
    return tiers


def pick_watch(pool, price, t1_low):
    lo = price * (1 + WATCH_MIN_UPSIDE)
    hi = min(price * (1 + WATCH_MAX_UPSIDE), t1_low)
    if hi <= lo:
        return None
    cand = [c for c in pool if lo <= c["price"] <= hi]
    if not cand:
        return None
    cand.sort(key=lambda x: -ANCHOR_WEIGHT.get(x["name"], 0))
    top = cand[0]
    names = [c["name"] for c in cand if abs(c["price"] / top["price"] - 1) < MERGE_NEAR]
    seen, uniq = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    return {"price": round(top["price"], 2), "name": "+".join(uniq[:3]),
            "upside": round((top["price"] / price - 1) * 100, 1)}


def validate_tiers(buy, sell, price, stoploss=None):
    errs = []
    if len(buy) != 2 or len(sell) != 2:
        return ["档位数量不足2档"]
    for side, tiers in (("买入", buy), ("卖出", sell)):
        for t in tiers:
            if t["low"] >= t["high"]:
                errs.append(f"{side}{t['tier']}区间倒挂")
            if t["low"] <= 0:
                errs.append(f"{side}{t['tier']}非正价格")
    if buy[1]["high"] >= buy[0]["low"]:
        errs.append("买T2未低于买T1")
    if sell[1]["low"] <= sell[0]["high"]:
        errs.append("卖T2未高于卖T1")
    if buy[0]["high"] >= price:
        errs.append("买T1未低于现价")
    if sell[0]["low"] <= price:
        errs.append("卖T1未高于现价")
    if buy[1]["low"] < price * 0.40:
        errs.append("买T2偏离现价过远")
    if sell[1]["high"] > price * 2.50:
        errs.append("卖T2偏离现价过远")
    if stoploss:
        for t in buy:
            if t["low"] < stoploss:
                errs.append(f"买入{t['tier']}低于止损位{stoploss:.2f}")
    return errs


def calc_tiers(bars, price, stoploss=None):
    """主入口：喂前复权日K（≥60根，理想250根）+ 现价 → 四档价格带"""
    if len(bars) < 60:
        return {"ok": False, "errors": [f"K线不足（{len(bars)}根<60）"]}
    atr = calc_atr(bars, ATR_PERIOD)
    sup, res, struct = build_anchors(bars)
    buy = pick_tiers(sup, price, "buy", atr)
    sell = pick_tiers(res, price, "sell", atr)
    errs = validate_tiers(buy, sell, price, stoploss)
    if errs:
        return {"ok": False, "errors": errs, "atr": atr}
    return {"ok": True, "atr": round(atr, 4), "atr_pct": round(atr / price * 100, 2),
            "struct": struct, "buy": buy, "sell": sell,
            "watch": pick_watch(res, price, sell[0]["low"])}
