import App from './App.svelte';
import { isStateCode, restoreFromStateCode, getStateCode, getLastStateRestoreError } from '@sudoku/stores/grid';

const app = new App({
	target: document.getElementById('app')
});

export default app;

// Expose debug helpers to the window for easier QA in dev
if (typeof window !== 'undefined') {
	window.__sudoku = window.__sudoku || {};
	window.__sudoku.isStateCode = isStateCode;
	window.__sudoku.restoreFromStateCode = restoreFromStateCode;
	window.__sudoku.getStateCode = getStateCode;
	window.__sudoku.getLastStateRestoreError = getLastStateRestoreError;
}


// TODO: Warn when hint not possible
// TODO: Undo/Redo
// TODO: Import sudoku
// TODO: Creator mode
// TODO: Bug hunt
// TODO: Announce