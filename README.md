# OptionKiller · 选择题学习工具

> 把一本题库，做成一套能刷、能记、能复习的选择题系统。

白色 / 浅蓝主题的选择题刷题工具：导入题目 → 单题作答 → 答题卡定位 → 错题与掌握度统计 → 间隔复习。界面参考蓝基因医学题库的排版；账号、群组与云同步复用 NounKiller 的独立源码副本，两个项目不共用数据库或登录会话。

网页端、Android、iOS 共用同一套 `web/` 业务代码，两端原生壳只补系统集成。

---

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Android | [`release/OptionKiller-1.2.apk`](release/OptionKiller-1.2.apk) | `minSdk 26`，与线上 API 通信 |
| iOS | [`release/OptionKiller-1.2.ipa`](release/OptionKiller-1.2.ipa) | development 签名，只能装到描述文件登记的设备 |
| 网页 | [`release/OptionKiller-1.2-web.zip`](release/OptionKiller-1.2-web.zip) | 纯静态包，解压即可用（不含云端账号） |

线上版本：<https://optionkiller.pages.dev>

## 功能

**导入**

- 文字粘贴 / TXT / JSON 导入；保留 PDF、DOCX、截图 OCR 提取入口，识别结果在导入前可检查修改。
- 单选 A 型题、多选 X 型题；支持 A–E、同行选项、续行、全角编号。
- 答案支持括号内标注与独立答案行；多选严格匹配，没有答案不猜测、不计正确率。
- 文末可用 `参考答案`、`答案汇总`、`答案` 加 `1.A 2.AC` 等按题号集中给答案。
- 可加 `难度：3`、`来源：自主整理`、`考点：知识点名称`；不编造官方考点或全站统计。

**练习**

- 答题卡题号网格，按题型、错题、收藏、未做、已做、草稿、掌握筛选；题号乱序、背题模式。
- 阅读区支持横滑切题，固定底栏不误触；系统开启「减少动态效果」时关闭切题动画。
- 题目解析、来源、难度、考点；个人统计、收藏、笔记、草稿、间隔复习。
- 记住每个题库的阅读位置，题号始终显示「原题号 / 全库总数」。
- 顶栏「本题」只重置当前题进度，保留解析、简记、收藏、笔记与草稿，历史日统计不受影响。

**账号与协作（可选）**

- 邮箱注册登录、个人云同步、冲突检测；群组题库分享（不分享私人笔记与答题记录）。
- AI 导入核对默认关闭；开启后会把原始文本与解析文本发给已配置的服务，可能产生费用，图片只传识别出的文本，核对结果需人工确认。
- 自动解析设置即时保存到私有题库，生成结果与阅读位置随账号同步；API Key 会包含在私有云同步与私人备份中，未做应用层加密，群分享不包含这些配置。
- 网络请求有超时、失败状态与恢复重试。

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

单独的 A/B/C/D/E 行也可以导入，界面会显示「空选项」；答案行可省略，稍后在题库编辑里补。

## 本地启动

```bash
./tool/run.sh dev      # http://127.0.0.1:5198
```

Node 24 自带 SQLite，不需要额外装依赖。真实账号与题库存在 `.local/optionkiller.sqlite`（Git 忽略），QA 使用 `.cache/qa.sqlite`。首次使用需注册 OptionKiller 账号。

## 测试与构建

```bash
./tool/run.sh test          # 接口与导入逻辑测试
./tool/run.sh web           # 网页产物 → build/latest/dist/
./tool/run.sh sync-native   # 把 web/ 同步进 Android / iOS 壳
./tool/run.sh clean         # 只清 .cache/
```

旧网页产物自动进 `build/history/<时间>/dist/`。`clean` 不动源码、依赖、持久数据和交付物。

## 目录

```
OptionKiller/
├── build/                 # 可交付产物（不在版本库内）
│   ├── latest/            # 当前 apk、ipa、dist/
│   └── history/           # 旧版本归档
├── src/                   # ← 版本库根
│   ├── web/               # 网页端与后端：index.html + css/ + js/
│   ├── server/            # 服务端 schema
│   ├── android/           # 原生壳（com.optionkiller.app）
│   ├── ios/               # 原生壳（com.optionkiller.app）
│   ├── test/              # 接口、导入、同步测试
│   ├── release/           # 当前版本的 apk / ipa / 网页包
│   └── tool/run.sh        # 开发 / 测试 / 构建入口
└── .cache/                # 截图、验证报告、临时脚本，可随时清空
```

## 部署与账号说明

- 正式网站使用独立 Cloudflare Worker 与 D1，本机服务使用本机 SQLite，两者不共享数据。
- Android 与 iOS 使用独立标识 `com.optionkiller.app`，在本地文件运行时连接线上 HTTPS API。
- Android 包使用独立签名密钥；签名文件与口令只在本地保存，丢失后无法覆盖安装升级。
- iOS 为开发签名，只能装到描述文件登记的设备；个人团队描述文件有效期较短，到期需重新签名。
- 发件邮箱与授权码在 Cloudflare 环境变量 / Secret 中配置，不入源码。未验证邮箱所有权时不要通过 `ADMIN_EMAILS` 直接授予管理员。

## 说明

个人项目，仓库公开用于交流与参考，未附开源许可证（默认保留所有权利）；要复用代码或素材请先联系作者。
