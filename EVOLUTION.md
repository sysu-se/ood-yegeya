# EVOLUTION

## 1. 提示功能如何实现

实现分为两层：领域层的推导能力与会话/展示层的适配。

- 领域层（`Sudoku`）职责：
	- 精确计算每个格子的候选集合：方法 `getCandidates(index)`，返回 `Set<number>`。实现上基于行/列/宫的排除规则，不包含任何 UI 状态或历史信息。
	- 扫描并识别“下一步可填”（forced move）：方法 `getNextStepHint()`，返回 `{ index, value, reason? } | null`。只在存在唯一候选时返回，供 UI 高亮或直接填写。
	- 冲突检测：`hasConflict()`，用于判断当前盘面是否违反规则（重复数字等），在探索模式下用于判定路径失败。

- 会话/展示层（`Game` / store / UI）职责：
	- 暴露领域能力给前端：例如 `store.getCandidates(i)`、`store.getNextHint()` 只是 thin-wrapper，不重复实现候选逻辑。
	- 处理提示的消费语义（是否自动填写、是否消耗次数、UI 显示原因文字等），这些行为属于会话交互范畴，而不是领域推导。

- 设计理由与权衡：
	- 将推导留在 `Sudoku` 避免业务规则散落在组件内，有利于可测试性与复用（例如 CLI、自动解法器也能调用）。
	- `Game` 保持轻量：不重新计算候选，仅对提示结果执行会话级的副作用（apply move / record history）。

示例接口：
```
// Sudoku
getCandidates(index): Set<number>
getNextStepHint(): { index: number, value: number, reason?: string } | null
hasConflict(): boolean

// Game/Store
enterExplore(); submitExplore(); abandonExplore();
getNextHint(): same as getNextStepHint
```

## 2. 提示更属于 `Sudoku` 还是 `Game`

结论：核心推导属于 `Sudoku`，提示的会话语义属于 `Game`。

- 具体分工：
	- `Sudoku`：纯规则推导（候选、唯一候选、简单消除、冲突检查）。任何依赖棋盘当前配置的确定性推理都放在这里。
	- `Game`：负责“如何使用”这些推导结果——是否自动应用、是否作为消耗性资源、是否在探索模式下被忽略或禁止等。

- 举例说明：
	- 当 `getNextStepHint()` 返回 `{ index: 10, value: 7 }`：
		- `Sudoku` 只负责返回这个事实；
		- `Game` 可以决定是否自动执行 `game.fill(index, value)`（并在主 history 中记录一条变更），或只是向 UI 显示“下步可填位置”。

## 3. 探索模式如何实现

实现思路：把探索作为 `Game` 的临时子会话（snapshot + temp history），满足“提交/放弃/冲突检测/失败记忆”需求。

- 进入探索：`enterExplore()`
	- 序列化当前主盘面为 `exploreSnapshot`（字符串 key，参见失败记忆的序列化规则）。
	- 创建 `exploreHistory`（空栈）并将 `inExplore = true`。
	- 若 `exploreSnapshot` 在 `_failedExploreStates` 中，直接拒绝进入并返回提示“已知失败”。

- 探索内操作：
	- 所有填写操作写入 `exploreHistory`，不写入 `mainHistory`。
	- 每次变更后调用 `Sudoku.hasConflict()`：若为真，当前分支被判定失败；将当前局面序列化并加入 `_failedExploreStates`，并通知 UI（提示并可自动回到起点或等待用户操作）。

- 提交探索：`submitExplore()`
	- 合并策略：将探索结果以一次“复合变更”或若干条“正常变更”追加到 `mainHistory`。选择一次性入栈可以简化合并逻辑（也便于 undo 把整次探索当作单个操作回退），而逐步入栈更精细但实现复杂。
	- 清除 `exploreSnapshot`、`exploreHistory`，`inExplore = false`。

- 放弃探索：`abandonExplore()`
	- 恢复 `exploreSnapshot`（反序列化并替换当前盘面），丢弃 `exploreHistory`，`inExplore = false`。

- 设计权衡：
	- 临时 history 隔离保证主 history 不被污染；但需要额外逻辑把临时结果合并进主历史，尤其是要决定合并粒度（单次或多次变更）。
	- 本实现倾向于最小侵入（一次性合并最终盘面），满足作业要求并保持 undo/redo 语义清晰。

## 4. 主局面与探索局面的关系

实现策略：通过明确的快照/反序列化语义分离对象，而不是共享同一可变实例。

- 为什么不共享对象：
	- 共享同一棋盘对象会导致引用污染（探索修改影响主局面），增加回滚与并发复杂度。

- 快照语义：
	- 使用 `serialize(currentGrid)` 生成唯一字符串（仅包含格子值顺序），该字符串既可作为失败记忆 key，也可用作恢复时的反序列化输入。
	- 恢复时通过 `deserialize(serialized)` 或 `fromJSON()` 还原出新的 `Sudoku` 实例或直接替换格子数组。

- 深拷贝成本：
	- 快照采用字符串化（而非 full object clone），节省内存并便于哈希比较；恢复时再解析生成对象，性能在 81 格的 Sudoku 中开销可接受。

## 5. history 如何演进

总体原则：保持主 history 为线性栈；探索使用独立临时 history，提交时合并。

- 探索内 undo/redo：
	- 在探索模式下，对用户的撤销仅在 `exploreHistory` 中生效（从 UX 角度这更直观）。

- 提交后的历史语义：
	- 如果采用“一次性合并最终盘面”的策略，主 history 新增一条复合变更（代表整个探索会话）；若采用逐步合并，则每一次探索内填入都变为主 history 的一条记录。

- 是否引入树状分支：
	- 当前实现不引入持久树形历史（DAG），只保留失败记忆与临时分支。这样实现简单、便于测试且满足评分要求；若要支持完整树分支，需要更复杂的历史模型与 UI 展示。

## 6. Homework 1 中的局限

- 明确边界不足：Homework 1 的实现倾向把一些规则/推导逻辑散落在 store 或组件中，导致后续扩展（提示/探索）必须在多处修改。

- history 假设单线性：Homework 1 的 history 假设所有操作都属于同一线性序列，这在探索引入临时分支时不再充分，需要额外的快照边界。

- 序列化粒度：Homework 1 的序列化接口在保存额外会话语义（探索状态、失败集合）时缺少扩展点，因此需要在 `Game.toJSON()`/`fromJSON()` 增加字段。

## 7. 如果重做一次 Homework 1

如果重做，会从架构层面把职责划分更明确，从一开始就为“会话模式切换”保留扩展点：

- 设计改动建议：
	- `Sudoku`：仅实现纯领域逻辑（规则、候选、基本推理、冲突检测、序列化局面）。
	- `Game`：实现会话管理、history 接口（支持写入/回退）、模式切换（普通/探索/回放）以及会话级状态的序列化接口。
	- `Store`：只做 `Game` 的薄包装和响应式暴露，不承担任何规则计算。

- 额外考虑：
	- 早期设计应预留“复合变更”概念（将多次操作作为单个可撤销单元），这样未来实现探索提交或批量导入更方便。
	- 为失败记忆设计可控的持久化策略（例如基于 session）并提供清理接口，防止长期运行时集合膨胀。