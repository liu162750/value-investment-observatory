# 维护要求
始终简体中文。修改前读docs/observation-level-rules.md、docs/t1t2-handoff-policy.md、docs/automatic-value-review.md。
股票唯一规则weekly-close-atr20-v1，算法scripts/tier-policy.mjs，不恢复旧ATR14、固定12%或0.5/1.25ATR分支。黄金独立。每个替换股票独立复核。
不下单、不假设成交、不自动改账户配置；股数现金不得公开。检查通过才能部署原服务，保留访问保护。证据未知保持pending。

用户2026-10-20要求：出现“大盘闸门待核验”立即主动查询。按最近完整月收盘比较包含该月的最近20个完整月收盘均值，排除当前月；月内结论稳定。区分核验日期与完整月数据日期；来源失败注明原因并重试，不伪造通过。
