# 自动复核与发布
每周三、周五北京时间16:30收盘后复核四股价值与四档，其他每日16:30/20:30只查新增业绩、重要事件和临时触发，避免重复研究。延迟运行记录实际时间，不承诺全天实时或离线执行。
价格仅执行docs/t1t2-handoff-policy.md，通过scripts/review-weekly.mjs保存；每次取得新数据，不用旧回归样本冒充新行情。临时触发、整组替换、下跌保护、许可分离均按唯一规范。
逐股核查产业竞争力、需求订单、正常化扣非盈利、现金流回款、债务、扩产回报、治理、估值假设与失效条件，以公司和交易所/巨潮原始披露为据；未知pending，单日涨跌不代表逻辑失效。替代候选仅完整比较核验后qualified。
公开研究写worker/investment-reviews.json，stocks按symbol存longTermReview（status/reason/asOf/source/证据）和replacementReview（qualified须candidate.name/symbol及reason/asOf/source）。个人股数现金不公开，不假设成交。
预约披露以官方最新记录核验变更，event-calendar仅未来0至7天突出，已披露不当未来预约。新正式报告/快报/预告在下一次可执行检查分析对应股，记录披露及发现时间、去重。
同步dashboard、snapshot、tier-reviews、日期、样本；npm test及npm run build通过后提交原GitHub、部署原Render并核验目标提交live和网页。WorkBuddy导出不代表迁移完成。失败不清空有效数据，下次重试。不新建付费资源、不下单、不改持仓、不向群/他人/其他聊天发消息。仅实质变化、重要事件、失败或需用户处理通知，其余安静。
