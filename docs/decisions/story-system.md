# 正式劇情系統

## 目的

正式劇情不得再只靠分散在 `src/*-quest.ts` 的临时布尔值和难以追踪的条件判断。
每段剧情使用永久事件 ID，通过统一 registry、状态、条件、runner 与 audit 查找。
现有序章及角色任务不会一次重写；采用逐段迁移，避免影响已经能玩的内容。

## 永久 ID 与单一索引

- 事件 ID 格式：`故事线.章节.事件`，例如 `main.prologue.arrival`。
- 对话、选择、奖励也必须使用稳定 ID；进入存档后不可随意改名。
- `src/story/story-registry.ts` 的 `STORY_EVENTS` 是正式事件唯一索引。
- 各章只在 `src/story/chapters/` 定义资料，再由 registry 汇入；运行端不可绕过
  registry 各自 import 章节。
- `main.prologue.arrival` 已登记为第一笔正式 ID；实际演出仍由旧的
  `src/prologue.ts` 执行，结束时写入完成状态。

## 模组职责

- `story-types.ts`：事件、条件、步骤、context 与存档资料型别。
- `story-state.ts`：当前章节、完成事件、旗标、选择、已领取奖励与状态正规化。
- `story-conditions.ts`：统一判断触发资格，并回传每项失败原因供除错 UI 使用。
- `story-runner.ts`：依序执行步骤；对话、选择、镜头、移动等由 adapter 接回既有系统。
- `story-registry.ts`：所有正式事件的唯一查询入口。
- `story-audit.ts`／`scripts/story-audit.ts`：检查重复／非法 ID、缺少前置、循环依赖、
  重复 choice/reward ID、空事件与不合法奖励数量。

## 支援的资料

触发条件目前包括：手动、前置事件完成／未完成、旗标、地图、日期、季节、时段、
NPC 好感度与物品数量。步骤目前包括：对话、选择、旗标、等待、镜头、角色移动、
传送与给予物品。runner 不直接 import DOM／Three.js，而由 `StoryRuntimeAdapter`
执行表现层动作，以免形成新循环依赖。

## 存档规则

存档版本从 v6 升到 v7，并新增 `story`：

```ts
story: {
  currentChapter: string;
  completedEvents: string[];
  activeEventId: string | null;
  flags: Record<string, string | number | boolean | null>;
  choices: Record<string, string>;
  claimedRewards: string[];
}
```

v6 以前的旧档会自动补默认值。游戏不允许在剧情过场中主动存档；若异常资料仍有
`activeEventId`，读档时会清空，让事件从安全起点重播。`claimedRewards` 独立防止
奖励重复发放；完成事件与玩家选择都以永久 ID 保存。新游戏必须调用
`resetStoryState()`，避免从刚读过的档案继承剧情状态。

## 新增事件流程

1. 在对应 `src/story/chapters/*.ts` 新增 `StoryEvent`。
2. 使用永久 ID，并填写开发标题、摘要、章节、角色、优先度、条件与步骤。
3. 玩家文字一律填写 i18n key，不把可见台词直接写进步骤。
4. 奖励必须有全局唯一 `rewardId`，选择必须有全局唯一 `choiceId`。
5. 执行 `npm run story-audit`、`npm run test:story` 与 `npm run build`。

`story-audit` 发现结构错误时必须以非零退出码失败。第一章内容将从
`concept/海風牧歌 主線劇本.txt` 逐段迁移；触发地点、时间与镜头确认前不要先填
猜测资料，避免形成第二套剧情事实来源。

## 后续阶段

目前完成的是资料骨架、持久化、条件说明、runner 和自动稽核。下一阶段才将现有
对话、镜头、移动与奖励系统实现为浏览器 runtime adapter，并加入开发用候选事件
面板（显示每个事件为什么不能触发），再逐段迁移第一章及角色事件。
