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
    // Explore 模式相关
    this._inExplore = false;
    this._exploreSnapshot = null; // Sudoku
    this._exploreHistory = []; // 临时记录 explore 中的快照
  }

  getSudoku() {
    return this.currentSudoku;
  }

  guess(move) {
    if (this._inExplore) {
      // 在 explore 中，记录到 exploreHistory，不污染主 history
      this._exploreHistory.push(this.currentSudoku.clone());
      // 清空未来栈只在提交主线时处理
      return this.currentSudoku.guess(move);
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

  getStateSnapshot() {
    return {
      grid: this.currentSudoku.getGrid(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      isSolved: this.currentSudoku.isSolved()
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
    if (this._inExplore && this._exploreSnapshot) {
      base.explore = {
        active: true,
        snapshot: this._exploreSnapshot.toJSON(),
        history: this._exploreHistory.map(s => s.toJSON())
      };
    }
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
      game._exploreSnapshot = Sudoku.fromJSON(json.explore.snapshot);
      game._exploreHistory = (json.explore.history || []).map(s => Sudoku.fromJSON(s));
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
