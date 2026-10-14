# DeepSeek Harness UI 复刻（HTML + JavaScript）

对本地页面 `http://127.0.0.1:3080`（DeepSeek Harness，AI 聊天工作台）的 UI 交互与样式的纯静态复刻。
零依赖、零构建，所有数据由 `mock/*.json` 通过拦截层模拟 XHR / fetch 提供，可离线完整测试全部操作。

## 运行

需要通过 HTTP 访问（要 fetch JSON 文件），任选其一：

```bash
# 方式一：项目自带的零依赖 Node 服务器（默认 3081，避免与原服务 3080 冲突）
node tools/serve.js 3081

# 方式二：任意静态服务器
npx serve -l 3081 .
# 或
php -S 127.0.0.1:3081
```

然后浏览器打开 <http://127.0.0.1:3081/>。

> 原页面当前已有一个服务跑在 3080；复刻页使用 3081 端口，两者可同时打开对比。

## 目录结构

```
dsh-ui-replica/
├── index.html                  # 单页外壳：三列框架 + overlay/toast 挂载点
├── assets/
│   ├── replica.css             # 全部复刻样式（设计令牌 + 组件 + light/dark 主题变量）
│   ├── icons.js                # 101 个从原页提取的内联 SVG 图标（window.ICONS / window.icon()）
│   ├── mock-api.js             # 网络拦截层：fetch 与 XMLHttpRequest 双兼容
│   ├── mock-stream.js          # 流式引擎：按脚本事件延时推送，支持取消
│   └── app.js                  # 状态管理 + 六大视图渲染 + 通用菜单组件 + 全部交互
├── mock/
│   ├── bootstrap.json          # 初始数据：工作区/会话/模型/Effort/模式/权限/设置/插件
│   ├── session-s-cfd.json      # 预置会话完整聊天记录（用户消息+活动分组+工具调用+统计+Trajectory）
│   ├── session-s-new.json      # 空会话（hero 视图）
│   └── chat-stream.json        # 发送消息后的脚本化流式事件序列（含 delayMs）
└── tools/                      # 构建/辅助脚本（图标生成、静态服务器）
```

## Mock 接口清单

拦截层（`assets/mock-api.js`）同时覆盖 `window.fetch` 与 `XMLHttpRequest`，按 URL 路由到 JSON 文件：

| 方法与 URL | 返回 | 说明 |
| --- | --- | --- |
| `GET mock/bootstrap.json` | `mock/bootstrap.json` | 首屏全量初始数据 |
| `GET mock/session-<id>.json` | `mock/session-<id>.json` | 会话完整消息（点击侧边栏会话时按需加载） |
| `GET mock/chat-stream.json` | `mock/chat-stream.json` | 流式脚本（也可直接查看） |
| `GET mock/workspace-files.json` | `mock/workspace-files.json` | 右栏文件树的 G:/Moira 目录结构 |
| `GET mock/file-content.json?path=<enc>` | `{ ok, path, file }` | 单个文件内容（md/vb/xml），按 query 过滤 |
| `POST api/sessions/<id>/messages` | `{ ok, sessionId, events }` | 发送消息，返回脚本化事件序列 |

`POST` 的事件由 `mock/chat-stream.json` 驱动，支持类型：
`status`（"Deep diving" 指示）、`group`（活动分组）、`think`（思考文本）、
`tool`（工具调用，先 running 后落定 success/failed）、`text`（逐段 Markdown 文本）、
`deliverables`（结果文件卡片）、`todos`（任务列表浮卡）、
`done`（时长 pill + Turn usage + 会话统计 + Token usage + 上下文用量，驱动底部三个统计 pill）。
每个事件带 `delayMs`，可自行调整节奏。

调试：控制台执行 `MockApi.log()` 查看拦截到的请求记录；`window.__errors` 收集运行时错误。

## 可测试的交互一览

- **侧边栏**：New Session（或 `Ctrl+Alt+N`）、Plugins 页切换、工作区搜索过滤（120ms 防抖）、
  工作区展开/收起、会话选择、会话行 ⋯ 菜单（Pin / Rename 内联改名 / Fork / Archive）、
  工作区 ⋯ 菜单（Rename / Delete）、新建工作区、排序/筛选菜单、侧边栏折叠为图标栏、Settings 入口
- **Hero 视图**：工作区选择芯片、模式选择芯片（Standard/PTC/Minimal/Creator，含描述）
- **输入卡**：`+` 触发菜单（File/Goal/Plan/Feedback/Commands）、访问权限下拉
  （Read Only / Workspace Write / Full access）、模型下拉（Model / Effort 两级子菜单，
  模型 DeepSeek-V41-Flash / V4-Pro，Effort Off/Low/High/Max）、Enter 发送、流式中变为停止按钮
- **聊天视图**：用户气泡（时间 + 复制）、助手 Markdown 渲染（加粗/行内代码/列表/链接）、
  可折叠活动分组、工具调用行（done/failed 状态，文件路径参数可点击开右栏标签）、时长 pill、
  消息尾部反馈按钮、**结果文件产物卡片**（整卡预览 / Show file location / More ways to open 菜单）、
  消息内"用量 63.7M tok"触发器、结束时间、Chat / Trajectory 双标签、底部统计 pills；
  **悬浮 To-dos 任务卡**独立于滚动对话流，固定在输入卡上方（与输入卡同宽 712px、同款阴影圈、
  可展开/折叠，切到 Trajectory 标签自动隐藏）；支持三态圆点：`done` 绿色勾 / `active`（或
  `in_progress`）蓝色空心环脉冲 / `pending` 灰色空心环（文字变浅），进度文案按状态显示
  "5 done · 1 running" 或 "N completed"
- **右栏多标签文件查看器**：Files 工作区文件树（文件夹展开收起、按类型图标）、
  文件预览标签（面包屑路径 + Code/Line wrap/Read again/Show file location 工具钮、
  VB/XML 语法高亮 + 行号、Markdown 文档渲染含标题/表格/引用），多开互切、单标签关闭
- **Trajectory 标签**：Duration / Turns / Calls 工具栏 + 搜索过滤（120ms 防抖）、
  **甘特图三车道时间轴**（Input/Model/Tools，模型紫渐变、工具琥珀、轮次分隔线）、
  **时间轴表格**（TOOL 行：琥珀标签 + 等宽 payload + → 结果摘要；ASSISTANT 行：Request #N 边界 +
  紫色标签 + 文本；Load earlier history 行），点击 TOOL 行弹出**五标签详情面板**
  （Summary/Payload/Result/Schema/Timing，JSON 树可折叠）
- **统计详情面板**：消息 usage 触发器 → Turn usage（Provider/model 路由、Cache hit、
  Uncached/Cached input、Cache write、Output）；底部 dock 三 pill 分别弹出
  Session statistics（LLM time/Tool time/Avg TTFT/TPS）、Token usage（总量 + 缓存四项）、
  上下文用量（49% of context used + 堆叠条 System/Tools/Messages + swatch 明细行）
- **设置弹窗**：General（Permission / Language / Appearance 浅色-深色-系统 / 字号 / Work details /
  Show coding view / 快捷键）、Models（DeepSeek provider + Add model provider）、
  Built-in plugins、Agent presets；主题切换即时生效并覆盖全部表面色
- **Plugins 页**：8 个官方插件卡片、Experimental 徽章、启用开关、刷新 / Add plugin
- **右侧栏**：展开/收起（或 `Ctrl+Shift+B`）、Start 面板、Workspace files / New terminal 快捷卡片；
  **宽度可拖拽**——拖动与聊天区之间的分割线自由调整（光标 col-resize，悬停/拖拽时显示主色高亮线），
  范围 240px ~ 窗口宽减去侧边栏与 360px，双击分割线或按 `Home` 恢复默认 300px，
  聚焦后 `←/→` 每次 16px（按住 Shift 48px）；窗口缩小时自动收敛，宽度跨关闭/重开保持
- **快捷键**：`Ctrl+Alt+N` 新会话、`Ctrl+Shift+B` 右侧栏、`Esc` 关闭菜单/弹窗

## 复刻说明与已知取舍

- 尺寸/颜色/圆角等均按原页实测值复刻（侧边栏 280px/#F9FAFB、输入卡圆角 28px + 三层阴影、
  主色 #4176E6、用户气泡 #EDF3FE、字体栈与 14px 正文等）。
- SVG 图标（鱼形 Logo、deepseek 词标、文件夹、chevron、盾牌、插件彩标等）全部从原页提取，
  见 `tools/gen-icons.js`（源数据在 `tools/icons-unique.json`）。
- 消息流式输出为脚本模拟（非真实模型）；Trajectory 甘特图 / 时间轴 / 工具详情由
  `session-<id>.json` 的 `timeline` 数组驱动（含 start/end 百分比、payload/result/schema/timing）。
- 预置文件内容为原页真实文件的摘录（README.md / StableFluidsSolver.vb / ChannelTest.vb /
  FlowVizSelfTest.vbproj），其余文件点击会提示无 mock 内容。
- 最低支持约 1024px 宽度；更窄时右侧栏浮动覆盖。
