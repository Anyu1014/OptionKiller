# OptionKiller

白色 / 浅蓝主题的选择题学习工具。界面参考用户提供的蓝基因医学截图；账号、群组和同步基于本机 NounKiller 的独立源码副本。原工程与数据保持不动。

```
OptionKiller/
├── build/
│   ├── latest/          # 当前网页 dist、交付说明和验证报告
│   └── history/         # 构建脚本自动归档旧网页
├── src/                 # Git 根、Web、后端、Android / iOS 壳及测试
└── .cache/              # 验证数据库、截图、原始副本与回滚试验；可清理
```

## 本地启动

```sh
/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/src/tool/run.sh dev
```

访问 http://127.0.0.1:5198 。Node 24 自带 SQLite，不需要 npm 安装。真实账号与题库存储在 `src/.local/optionkiller.sqlite`（Git 忽略）；QA 使用 `.cache/qa.sqlite`。首次使用需注册 OptionKiller 账号，和 NounKiller 不共用数据库或登录会话。线上网站： https://optionkiller.yuanhyu1014.workers.dev 。

## 主要功能

- 文字粘贴 / TXT / JSON 导入；保留 PDF、DOCX、截图 OCR 提取入口，识别结果导入前可检查。
- 单选 A 型题、多选 X 型题，支持 A–E、同行选项、续行、全角编号。
- 括号答案和独立答案行；多选严格匹配；没有答案不猜测、不计正确率。
- 答题卡题号网格，按题型、错题、收藏、未做、已做、草稿、掌握筛选；题号乱序、背题模式。
- 题目解析、来源、难度、考点，个人统计、收藏、笔记、草稿、间隔复习。
- 邮箱注册登录、个人云同步、冲突检测、群组题库分享（不分享私人笔记或答题记录）。

## 导入示例

```text
一，单项选择题（单选/A型题）
1.问题()
A.选项一
B.选项二
C.选项三
D.选项四
E.选项五
答案：B
解析：可选的解析

二，多项选择题（多选/X型题）
1.问题()
A.选项一
B.选项二
C.选项三
D.选项四
E.选项五
答案：AC
```

单独的 A/B/C/D/E 行也可导入，界面显示“空选项”。答案行可省略，稍后在题库编辑中补充。可加 `难度：3`、`来源：自主整理`、`考点：知识点名称`；不补充不存在的官方考点、全站统计或医学答案。

## 测试与构建

```sh
/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/src/tool/run.sh test
/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/src/tool/run.sh web
/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/src/tool/run.sh sync-native
/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/src/tool/run.sh clean
```

网页产物进入 `build/latest/dist/`；旧网页自动进入 `build/history/<时间>/dist/`。`clean` 只清 `.cache/`，不动源码、依赖、持久数据和交付物。执行 clean 会清除回滚所需的原始参考快照。

## 1.0 发布与账号

- 正式网站使用独立 Cloudflare Worker 和 D1；本机服务仍使用本机 SQLite，不共享两者数据，也不改动 NounKiller。
- Android 和 iOS 安装包使用独立标识 `com.optionkiller.app`，并在本地文件运行时连接上述 HTTPS API。Android 安装包使用独立签名密钥；请安全保管 `android/signing/optionkiller-release.jks` 与本机钥匙串中的签名口令，否则后续更新可能无法覆盖安装。
- iOS 为开发签名，只能安装到描述文件登记的设备；个人团队描述文件有效期较短，到期需重新签名。
- 发件邮箱与授权码在 Cloudflare 环境变量 / 密钥中配置，不存入源码。`keep_vars` 保留控制台中维护的变量；未经验证邮箱所有权时，不要通过 `ADMIN_EMAILS` 直接授予管理员。管理员权限已对注册账号单独设置。
- AI 导入核对默认关闭，开启后会把原始文本和解析文本发给已配置的服务，可能产生费用；图片只传识别出的文本，核对结果需人工确认。文末可用 `参考答案`、`答案汇总` 或 `答案` 加 `1.A 2.AC` 等按题号提供答案。
