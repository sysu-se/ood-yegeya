export class Sudoku {
  constructor(grid) {
    this.grid = JSON.parse(JSON.stringify(grid));
  }

  getGrid() {
    return JSON.parse(JSON.stringify(this.grid));
  }

  guess(move) {
    const { row, col, value } = move;
    if (row < 0 || row >= 9 || col < 0 || col >= 9) return false;
    if (value < 0 || value > 9) return false;

    this.grid[row][col] = value;
    return true;
  }

  isSolved() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0 || this.grid[r][c] === null) return false;
      }
    }
    return true;
  }

  clone() {
    return new Sudoku(this.getGrid());
  }

  toString() {
    return this.grid.map(row => row.join(' ')).join('\n');
  }

  toJSON() {
    return { grid: this.getGrid() };
  }

  // 返回指定格子的候选数（1-9），不包含已填入的数字
  getCandidates(row, col) {
    if (row < 0 || row >= 9 || col < 0 || col >= 9) return [];
    if (this.grid[row][col] && this.grid[row][col] !== 0) return [];

    const used = new Set();
    // 行
    for (let c = 0; c < 9; c++) {
      const v = this.grid[row][c];
      if (v) used.add(v);
    }
    // 列
    for (let r = 0; r < 9; r++) {
      const v = this.grid[r][col];
      if (v) used.add(v);
    }
    // 宫
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        const v = this.grid[r][c];
        if (v) used.add(v);
      }
    }

    const candidates = [];
    for (let n = 1; n <= 9; n++) {
      if (!used.has(n)) candidates.push(n);
    }
    return candidates;
  }

  getHint(row, col) {
    const candidates = this.getCandidates(row, col);
    if (candidates.length === 0) return null;

    return {
      row,
      col,
      candidates,
      value: candidates.length === 1 ? candidates[0] : null,
      reason: candidates.length === 1 ? 'single-candidate' : 'candidates-only'
    };
  }

  getNextStepHint() {
    let best = null;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.grid[row][col] !== 0 && this.grid[row][col] !== null) continue;

        const candidates = this.getCandidates(row, col);
        if (candidates.length === 0) continue;

        if (candidates.length === 1) {
          return {
            row,
            col,
            candidates,
            value: candidates[0],
            reason: 'single-candidate'
          };
        }
      }
    }

    return best;
  }

  getExploreHint() {
    let best = null;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.grid[row][col] !== 0 && this.grid[row][col] !== null) continue;

        const candidates = this.getCandidates(row, col);
        if (candidates.length <= 1) continue;

        if (!best || candidates.length < best.candidates.length) {
          best = {
            row,
            col,
            candidates,
            reason: 'explore-candidate'
          };
        }
      }
    }

    return best;
  }

  // 快速校验当前棋盘是否存在冲突（重复数字）
  hasConflict() {
    // 检查行
    for (let r = 0; r < 9; r++) {
      const seen = new Set();
      for (let c = 0; c < 9; c++) {
        const v = this.grid[r][c];
        if (!v) continue;
        if (seen.has(v)) return true;
        seen.add(v);
      }
    }
    // 检查列
    for (let c = 0; c < 9; c++) {
      const seen = new Set();
      for (let r = 0; r < 9; r++) {
        const v = this.grid[r][c];
        if (!v) continue;
        if (seen.has(v)) return true;
        seen.add(v);
      }
    }
    // 检查宫
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const seen = new Set();
        for (let r = br * 3; r < br * 3 + 3; r++) {
          for (let c = bc * 3; c < bc * 3 + 3; c++) {
            const v = this.grid[r][c];
            if (!v) continue;
            if (seen.has(v)) return true;
            seen.add(v);
          }
        }
      }
    }
    return false;
  }

  // 可选：Sudoku 也配一个工厂函数
  static fromJSON(json) {
    return new Sudoku(json.grid);
  }
}

export class Game {
  constructor({ sudoku }) {
    this.currentSudoku = sudoku;
    this.history = [];
    this.future = [];
    this._inExplore = false;
    this._exploreSnapshot = null; // Sudoku
    this._exploreHistory = []; // 临时记录 explore 中的快照
    this._failedExploreStates = new Set();
    this._exploreFailed = false;
  }

  _gridKey(sudoku) {
    return JSON.stringify(sudoku.getGrid());
  }

  _rememberFailedExplorePath() {
    if (!this._inExplore || !this._exploreSnapshot) return;

    this._failedExploreStates.add(this._gridKey(this._exploreSnapshot));
    for (const snapshot of this._exploreHistory) {
      this._failedExploreStates.add(this._gridKey(snapshot));
    }
    this._failedExploreStates.add(this._gridKey(this.currentSudoku));
    this._exploreFailed = true;
  }

  _refreshExploreFailureState() {
    if (!this._inExplore) return;

    const currentKey = this._gridKey(this.currentSudoku);
    this._exploreFailed = this.currentSudoku.hasConflict() || this._failedExploreStates.has(currentKey);

    if (this._exploreFailed && this.currentSudoku.hasConflict()) {
      this._rememberFailedExplorePath();
    }
  }

  getSudoku() {
    return this.currentSudoku;
  }

  guess(move) {
    if (this._inExplore) {
      if (move.row < 0 || move.row >= 9 || move.col < 0 || move.col >= 9) return false;
      this._exploreHistory.push(this.currentSudoku.clone());
      const success = this.currentSudoku.guess(move);
      if (!success) {
        this._exploreHistory.pop();
        return false;
      }

      this._refreshExploreFailureState();
      return true;
    }

    this.history.push(this.currentSudoku.clone());
    this.future = [];
    return this.currentSudoku.guess(move);
  }

  undo() {
    if (!this.canUndo()) return;
    this.future.push(this.currentSudoku.clone());
    this.currentSudoku = this.history.pop();
  }

  redo() {
    if (!this.canRedo()) return;
    this.history.push(this.currentSudoku.clone());
    this.currentSudoku = this.future.pop();
  }

  canUndo() {
    return this.history.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  getHint(row, col) {
    return this.currentSudoku.getHint(row, col);
  }

  getNextStepHint() {
    return this.currentSudoku.getNextStepHint();
  }

  getExploreHint() {
    return this.currentSudoku.getExploreHint();
  }

  canEnterExplore() {
    return !this._inExplore && !this.currentSudoku.hasConflict() && this.getNextStepHint() === null;
  }

  enterExplore() {
    if (this._inExplore) return false;

    this._exploreSnapshot = this.currentSudoku.clone();
    this._exploreHistory = [];
    this._inExplore = true;
    this._exploreFailed = this._failedExploreStates.has(this._gridKey(this.currentSudoku));

    if (this.currentSudoku.hasConflict()) {
      this._rememberFailedExplorePath();
    }

    return true;
  }

  submitExplore() {
    if (!this._inExplore || !this._exploreSnapshot) return false;
    if (this._exploreFailed || this.currentSudoku.hasConflict()) {
      this._rememberFailedExplorePath();
      return false;
    }

    this.history.push(this._exploreSnapshot.clone());
    this.future = [];
    this._inExplore = false;
    this._exploreSnapshot = null;
    this._exploreHistory = [];
    this._exploreFailed = false;
    return true;
  }

  abandonExplore() {
    if (!this._inExplore || !this._exploreSnapshot) return false;

    this.currentSudoku = this._exploreSnapshot.clone();
    this._inExplore = false;
    this._exploreSnapshot = null;
    this._exploreHistory = [];
    this._exploreFailed = false;
    return true;
  }

  isInExplore() {
    return this._inExplore;
  }

  isExploreFailed() {
    return this._exploreFailed;
  }

  getExploreState() {
    return {
      active: this._inExplore,
      failed: this._exploreFailed,
      canEnter: this.canEnterExplore(),
      hint: this.getExploreHint()
    };
  }

  getStateSnapshot() {
    return {
      grid: this.currentSudoku.getGrid(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      isSolved: this.currentSudoku.isSolved(),
      explore: this.getExploreState()
    };
  }

  toJSON() {
    return {
      version: '1.0',
      currentSudoku: this.currentSudoku.toJSON(),
      history: this.history.map(s => s.toJSON()),
      future: this.future.map(s => s.toJSON())
    };
  }

  // 扩展序列化，记录 explore 的最小信息（不强制）
  toFullJSON() {
    const base = this.toJSON();
    base.explore = {
      active: this._inExplore,
      failed: this._exploreFailed,
      snapshot: this._exploreSnapshot ? this._exploreSnapshot.toJSON() : null,
      history: this._exploreHistory.map(s => s.toJSON()),
      failedStates: Array.from(this._failedExploreStates)
    };
    return base;
  }

  static fromJSON(json) {
    if (!json || !json.currentSudoku) {
      throw new Error('Invalid game state JSON');
    }

    const sudoku = Sudoku.fromJSON(json.currentSudoku);
    const game = new Game({ sudoku });

    game.history = (json.history || []).map(s => Sudoku.fromJSON(s));
    game.future = (json.future || []).map(s => Sudoku.fromJSON(s));

    // 恢复 explore（如果有）
    if (json.explore && json.explore.active) {
      game._inExplore = true;
      game._exploreSnapshot = json.explore.snapshot ? Sudoku.fromJSON(json.explore.snapshot) : null;
      game._exploreHistory = (json.explore.history || []).map(s => Sudoku.fromJSON(s));
      game._exploreFailed = !!json.explore.failed;
      game._failedExploreStates = new Set(json.explore.failedStates || []);
    }

    return game;
  }

  serialize() {
    return JSON.stringify(this.toFullJSON());
  }

  static deserialize(str) {
    const json = JSON.parse(str);
    return Game.fromJSON(json);
  }
}

// ------------------------------
// 【新增】工厂函数（方便测试和使用）
// ------------------------------

export function createSudoku(input) {
  return new Sudoku(input);
}

export function createSudokuFromJSON(json) {
  return Sudoku.fromJSON(json);
}

export function createGame({ sudoku }) {
  return new Game({ sudoku });
}

export function createGameFromJSON(json) {
  return Game.fromJSON(json);
}
