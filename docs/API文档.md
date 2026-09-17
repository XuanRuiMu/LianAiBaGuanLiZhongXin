# 管理后端现行接口（FP-11）

> 旧双栈文档已冻结移入 `docs/archive/` 备查；本文件为现行契约唯一来源，悬空引用一律以本文件为准。

基地址 `http://<服务器>:3100`；包络成功 `{cheng_gong:true, shu_ju, fen_ye?}`，失败 `{cheng_gong:false, shu_ju:null, ti_shi, cuo_wu_ma}`；分页键 `ye_ma/mei_ye_tiao_shu/zong_shu`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/jian-kang | 存活探针（公开） |
| GET | /api/ready | 就绪探针（`jiu_xu/kui`） |
| GET | /api/zhi-biao | 指标概览（审计总数等） |
| POST | /api/guan-li/deng-lu | 管理登录（安全Cookie签发） |
| POST | /api/guan-li/shua-xin | 令牌轮换 |
| GET | /api/guan-li/zhang-hao-lie-biao | 账号列表（掩码分页总数） |
| GET | /api/guan-li/zhang-hao-xiang-qing/:yongHuId | 账号详情（掩码记审计） |
| GET | /api/guan-li/zhang-hao-jie-mi/:yongHuId | 解密（明文记审计） |
| GET | /api/guan-li/xiao-xi | 单聊消息分页 |
| GET | /api/guan-li/hao-you-xiao-xi | 好友消息分页 |
| GET | /api/guan-li/ji-yi | 记忆分页 |
| GET | /api/guan-li/dui-hua-zhai-yao | 对话摘要分页 |
| GET | /api/guan-li/guan-jian-shi-jian | 关键事件分页 |
| GET | /api/guan-li/duo-she-ri-zhi | 夺舍日志分页 |
| GET | /api/guan-li/ping-gu | 评估分页 |
| GET | /api/guan-li/si-kao-ji-lu | 思考记录分页（回放以落库为准） |
| GET | /api/guan-li/si-kao-ji-lu/:记_录_ID | 思考记录详情 |
| GET | /api/guan-li/si-kao-shuo-ming | 思考说明（含回放准则） |
| GET | /api/guan-li/feng-jin-ji-lu | 封禁记录分页总数 |
| POST | /api/guan-li/feng-jin | 封禁写入（事务审计） |
| GET | /api/guan-li/zhang-hao-feng-jin | 账号封禁分页总数（替代200截断） |
| POST | /api/guan-li/zhang-hao-feng-jin/jie-feng | 解封（影响行断言） |
| POST | /api/guan-li/shen-su/shen-he | 申诉审核（影响行断言） |
| GET | /api/guan-li/shen-ji-ri-zhi | 审计分页多维保留 |
| GET | /api/guan-li/shen-ji-bao-liu | 审计保留总数 |
| GET | /api/guan-li/shen-ji-dao-chu | 审计导出（审批单水印） |
| GET | /api/guan-li/tong-ji/zhu-ce | 注册聚合总数 |
| GET | /api/guan-li/tong-ji/xiao-xi | 消息聚合 |
| GET | /api/guan-li/tong-ji/hao-gan-du | 好感聚合 |
| GET | /api/guan-li/tong-ji/liu-cun | 留存聚合 |
| GET | /api/guan-li/tong-ji/ai-yong-liang | 用量真实口径 |
| GET | /api/guan-li/tong-ji/mai-dian-zi-dian | 埋点字典（22事件版本漏斗留存归因） |
| GET | /api/guan-li/ju-bao-lie-biao | 举报分页超时筛选 |
| POST | /api/guan-li/ju-bao-xin-jian | 举报新建（SLA24小时） |
| POST | /api/guan-li/ju-bao-yi-shen | 举报一审 |
| POST | /api/guan-li/ju-bao-er-shen | 举报二审 |
| POST | /api/guan-li/ju-bao-pi-liang | 举报批量（同态原子） |
| GET | /api/guan-li/gong-dan-lie-biao | 工单分页 |
| POST | /api/guan-li/gong-dan-xin-jian | 工单新建（SLA48小时） |
| POST | /api/guan-li/gong-dan-yi-shen | 工单一审 |
| POST | /api/guan-li/gong-dan-er-shen | 工单二审 |
| POST | /api/guan-li/gong-dan-pi-liang | 工单批量 |
| GET | /api/guan-li/gong-gao-lie-biao | 公告分页 |
| POST | /api/guan-li/gong-gao-xin-jian | 公告新建（SLA24小时） |
| POST | /api/guan-li/gong-gao-yi-shen | 公告一审 |
| POST | /api/guan-li/gong-gao-er-shen | 公告二审 |
| POST | /api/guan-li/gong-gao-pi-liang | 公告批量 |
| POST | /api/guan-li/gong-gao-fa-bu | 公告发布下线 |
| GET | /api/guan-li/huo-dong-lie-biao | 活动分页 |
| POST | /api/guan-li/huo-dong-xin-jian | 活动新建（SLA72小时） |
| POST | /api/guan-li/huo-dong-yi-shen | 活动一审 |
| POST | /api/guan-li/huo-dong-er-shen | 活动二审 |
| POST | /api/guan-li/huo-dong-pi-liang | 活动批量 |
| POST | /api/guan-li/huo-dong-fa-bu | 活动发布结束 |
| GET | /api/guan-li/shi-yan-lie-biao | 实验分页 |
| POST | /api/guan-li/shi-yan-xin-jian | 实验新建（SLA72小时） |
| POST | /api/guan-li/shi-yan-yi-shen | 实验一审 |
| POST | /api/guan-li/shi-yan-er-shen | 实验二审 |
| POST | /api/guan-li/shi-yan-pi-liang | 实验批量 |
| POST | /api/guan-li/shi-yan-fa-bu | 实验发布结束 |
| GET | /api/guan-li/liu-hen | 审核留痕分页 |
| POST | /api/guan-li/shou-quan | 授（事务二次确认） |
| POST | /api/guan-li/hui-shou | 收（事务二次确认） |
| POST | /api/guan-li/duo-she | 夺舍（事务审计） |
| POST | /api/guan-li/gui-huan | 归还（事务审计） |

下线项（悬空禁用）：`/api/v1/*`、` /dashboard`、`/assistant`、`/ops`、`/orchestrate`、`/mcp`、`/api/chat/stream`、`/api/v1/reports/*`、` /api/v1/sync/*` 均已下线，前端禁止引用。

