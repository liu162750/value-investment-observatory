# 自动价值复核

用户最新确认每周完整复核一次，默认北京时间周五16:30；新业绩报告发现后当天额外复核该股。任务名“四股每周价值复核与业绩发布监测”，已创建为本聊天的本机心跳任务。任务运行依赖本机及应用可用，不是Render内置AI，也不承诺电脑离线仍执行。

当前四股及未来替换标的均复核产业竞争力、真实需求与订单、正常化扣非盈利、自由现金流与回款、负债、扩产回报、治理、估值假设与失效条件，并比较经核验的替代候选。结合私有已录入持仓判断适配性，个人股数和现金不能出现在公开研究文件。未更新成交反馈时不能假定持仓已改变。

结果文件 worker/investment-reviews.json：顶层 asOf、status；stocks按配置symbol键保存 longTermReview 与 replacementReview。longTermReview.status 为 pending/validated/invalidated，含reason、asOf、source及证据。replacementReview只有来源及比较证据完整且达到门槛才为qualified，含candidate.name、candidate.symbol、reason、asOf、source，否则pending。

初始为空，不能当作已完成分析。部署时构建会嵌入公开结果及快照。自动任务运行后提交有依据的研究变化，并经检查与Render部署确认后展示；无实质变化不通知。不下单、不自动改持仓、不发送群消息、不更改已确认买T1/T2。AI研究并非保证准确，数据缺失和估值不确定性必须写明。

监测在每日16:30和20:30运行，仅新报告或每周五16:30启动深入分析，其余只检查公告及事件变化，避免频繁重做分析。20:30后发布消息在下次可运行检查处理，记录实际披露与发现时间，不承诺全天实时捕捉。事件日期文件worker/event-calendar.json，三季报由预约披露接口同步；红底仅在距未来事件0至7天且尚未实际披露时显示。
