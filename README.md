# OptionKiller

白色 / 浅蓝主题的选择题学习工具。界面参考用户提供的蓝基因医学截图；账号、群组和同步基于本机 NounKiller 的独立源码副本。原工程与数据保持不动。

```
OptionKiller/
├── build/
│   ├── latest/          # 仅当前 APK、IPA、dist
│   └── history/         # 构建脚本自动归档旧网页
├── src/                 # Git 根、Web、后端、Android / iOS 壳及测试
└── .cache/              # 截图、验证报告、临时脚本、原始副本；可清理
```

## 本地启动

```sh
/Users/y/Downloads/Codex/Mac工作区/OptionKiller/src/tool/run.sh dev
```

访问 http://127.0.0.1:5198 。Node 24 自带 SQLite，不需要 npm 安装。真实账号与题库存储在 `src/.local/optionkiller.sqlite`（Git 忽略）；QA 使用 `.cache/qa.sqlite`。首次使用需注册 OptionKiller 账号，和 NounKiller 不共用数据库或登录会话。线上网站： https://optionkiller.pages.dev 。旧 Worker 入口保留，Pages 迁移准备为直接使用现有 D1 数据库和独立配置的发件密钥；上线前仍通过现有 Worker 服务绑定提供 API。

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
/Users/y/Downloads/Codex/Mac工作区/OptionKiller/src/tool/run.sh test
/Users/y/Downloads/Codex/Mac工作区/OptionKiller/src/tool/run.sh web
/Users/y/Downloads/Codex/Mac工作区/OptionKiller/src/tool/run.sh sync-native
/Users/y/Downloads/Codex/Mac工作区/OptionKiller/src/tool/run.sh clean
```

网页产物进入 `build/latest/dist/`；旧网页自动进入 `build/history/<时间>/dist/`。`clean` 只清 `.cache/`，不动源码、依赖、持久数据和交付物。执行 clean 会清除回滚所需的原始参考快照。

## 1.1 发布与账号

- 正式网站使用独立 Cloudflare Worker 和 D1；本机服务仍使用本机 SQLite，不共享两者数据，也不改动 NounKiller。
- Android 和 iOS 安装包使用独立标识 `com.optionkiller.app`，并在本地文件运行时连接上述 HTTPS API。Android 安装包使用独立签名密钥；请安全保管 `android/signing/optionkiller-release.jks` 与本机钥匙串中的签名口令，否则后续更新可能无法覆盖安装。
- iOS 为开发签名，只能安装到描述文件登记的设备；个人团队描述文件有效期较短，到期需重新签名。
- 发件邮箱与授权码在 Cloudflare 环境变量 / 密钥中配置，不存入源码。`keep_vars` 保留控制台中维护的变量；未经验证邮箱所有权时，不要通过 `ADMIN_EMAILS` 直接授予管理员。管理员权限已对注册账号单独设置。
- AI 导入核对默认关闭，开启后会把原始文本和解析文本发给已配置的服务，可能产生费用；图片只传识别出的文本，核对结果需人工确认。文末可用 `参考答案`、`答案汇总` 或 `答案` 加 `1.A 2.AC` 等按题号提供答案。

## 目录归类约定

`build/latest/` 仅保留当前 APK、IPA 和 `dist/`，旧成品进入 `build/history/`。截图、补丁、验证报告、签名旁车文件和一次性回滚脚本统一归入 `.cache/`；Sites 兼容打包的可再生中间文件输出到 `.cache/sites-bundle/`，不再写入 `src/dist/`。

`src/` 保留源码、测试、正式工具脚本、依赖与提速中间物；本机题库数据库和 Android 签名文件不清理、不移动到缓存。

## 1.1 更新与部署

- 记住每个题库的阅读位置，题号始终显示原题号 / 全库总数。
- 顶栏重做本题只重置该题进度，保留解析、简记、收藏、笔记和草稿；历史日统计保留。
- 自动解析设置即时保存到私有题库；生成结果、重新解析结果与阅读位置随账号同步。API Key 会包含在私有云同步和私人备份中，未增加应用层加密；群分享不包含这些配置。
- 简短逐项解析覆盖每个选项，辨别反向题；不编造教材版本、页码或引用。
- 阅读区支持横滑切题，固定底栏不触发；减少动态效果的系统设置会关闭切题动画。
- 网络请求有超时、失败状态与恢复重试；使用 Pages 入口与 NounKiller 的入口类型对齐，不承诺所有大陆运营商线路均可达。

Pages 静态文件准备：

```sh
/Users/y/toolchains/run node tool/pages/prepare.mjs
cd tool/pages
/Users/y/toolchains/run node ../../node_modules/wrangler/bin/wrangler.js pages deploy --project-name optionkiller --branch 1.0 --commit-dirty=true
```

先执行 web 构建。本地 Pages 迁移配置计划直接绑定原有 D1 数据库；等待 Cloudflare 授权恢复、配置 QQ_SMTP_PASS 并验证后再部署。线上现状仍通过 Worker 服务绑定。
