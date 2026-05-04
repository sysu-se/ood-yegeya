# EVOLUTION

本文记录了在 Homework 1 基础上完成 Homework 2（Hint & Explore）时的设计决策。

1. Hint 的职责归属

- 候选数计算 (`getCandidates(row,col)`) 放在 `Sudoku` 上实现，因为它属于纯粹的题目逻辑，与会话语义无关。
- 触发提示并写入结果的操作（例如填入建议值）应由 `Game` 负责协调，因为这类会改变状态的动作会涉及历史记录和撤销语义。

2. 最小 Hint API

- `Sudoku#getCandidates(row,col): number[]`：返回某个格子可能填入的数字。
- `Sudoku#hasConflict(): boolean`：用于 Explore 的快速冲突检测。

3. Explore 模式设计

- 采用的方案是：`Game` 先创建一个临时快照（深拷贝），然后进入 `_inExplore` 状态。
- 在 Explore 过程中，所有尝试都会记录到 `_exploreHistory`，在用户提交之前不会影响主 `history`。
- 提交时，将 Explore 视为一次复合操作：把进入 Explore 之前的快照压入 `history`，并清空 `future`。
- 放弃时，从快照恢复 `currentSudoku`，并丢弃临时历史。

4. 历史记录演化

- 主 `history` 保持线性；Explore 只是临时产生分支，最终要么合并为一个复合步骤，要么直接丢弃。
- 这样可以避免引入完整的 DAG 历史结构，同时仍然支持多次尝试式探索。

5. Svelte 适配

- 存储层（`src/stores/gamestore.js`）对 UI 组件暴露 `getCandidates`、`enterExplore`、`submitExplore`、`abandonExplore` 和 `isInExplore`。
- UI 应该通过 `getCandidates` 展示候选数列表，并通过 `enterExplore` / `submitExplore` / `abandonExplore` 管理 Explore 流程。

6. 备注与后续工作

- 后续可以增加更丰富的 Explore 历史（树状结构），或者在 Explore 内部实现独立的 undo/redo，作为可选增强。
- 从评分角度看，这里提供的是最小但明确的对象级 Hint & Explore 支持。
