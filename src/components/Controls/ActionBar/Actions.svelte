<script>
	import { candidates } from '@sudoku/stores/candidates';
	import { userGrid, undo, redo, canUndo, canRedo } from '@sudoku/stores/grid';
	import { cursor } from '@sudoku/stores/cursor';
	import { hints } from '@sudoku/stores/hints';
	import { notes } from '@sudoku/stores/notes';
	import { settings } from '@sudoku/stores/settings';
	import { keyboardDisabled } from '@sudoku/stores/keyboard';
	import { gamePaused } from '@sudoku/stores/game';
	import { modal } from '@sudoku/stores/modal';
	import { exploreState } from '@sudoku/stores/grid';

	$: hintsAvailable = $hints > 0;
	$: candidateHint = $cursor.x == null || $cursor.y == null ? [] : userGrid.getCandidates($cursor);
	$: nextHint = userGrid.getNextHint();

	function handleHint() {
		if (hintsAvailable) {
			if ($candidates.hasOwnProperty($cursor.x + ',' + $cursor.y)) {
				candidates.clear($cursor);
			}

			if (!userGrid.applyHint($cursor)) {
				modal.show('confirm', {
					title: 'Hint',
					text: nextHint ? `Try ${nextHint.value} at row ${nextHint.row + 1}, column ${nextHint.col + 1}.` : 'No forced move is available. Use Explore instead.',
					button: 'Okay'
				});
			}
		}
	}

	function handleCandidates() {
		if ($cursor.x == null || $cursor.y == null) {
			modal.show('confirm', {
				title: 'Candidates',
				text: 'Select an empty cell first.',
				button: 'Okay'
			});
			return;
		}

		modal.show('confirm', {
			title: `Candidates for row ${$cursor.y + 1}, column ${$cursor.x + 1}`,
			text: candidateHint.length > 0 ? candidateHint.join(', ') : 'No candidates available.',
			button: 'Okay'
		});
	}

	function handleEnterExplore() {
		if (!userGrid.enterExplore()) {
			modal.show('confirm', {
				title: 'Explore',
				text: $exploreState.failed ? 'This board state has already failed before.' : 'A forced move is still available. Use Hint first.',
				button: 'Okay'
			});
		}
	}

	function handleSubmitExplore() {
		if (!userGrid.submitExplore()) {
			modal.show('confirm', {
				title: 'Explore',
				text: $exploreState.failed ? 'Explore failed because this branch contains a conflict.' : 'Nothing to submit yet.',
				button: 'Okay'
			});
		}
	}

	function handleAbandonExplore() {
		userGrid.abandonExplore();
	}
</script>

<div class="action-buttons space-x-3">
	{#if $exploreState.active}
		<div class="explore-banner" class:explore-banner-failed={$exploreState.failed}>
			{#if $exploreState.failed}
				Explore failed
			{:else}
				Explore active
			{/if}
		</div>
	{/if}

	<button class="btn btn-round" disabled={$gamePaused || $exploreState.active || !$canUndo} title="Undo" on:click={undo}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
		</svg>
	</button>

	<button class="btn btn-round" disabled={$gamePaused || $exploreState.active || !$canRedo} title="Redo" on:click={redo}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 90 00-8 8v2M21 10l-6 6m6-6l-6-6" />
		</svg>
	</button>

	<button class="btn btn-round btn-badge" disabled={$keyboardDisabled || $exploreState.active} on:click={handleCandidates} title="Show candidates">
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m-4-4h8" />
		</svg>
	</button>

	<button class="btn btn-round btn-badge" disabled={$keyboardDisabled || $exploreState.active || !hintsAvailable} on:click={handleHint} title="Next hint ({$hints})">
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
		</svg>

		{#if $settings.hintsLimited}
			<span class="badge" class:badge-primary={hintsAvailable}>{$hints}</span>
		{/if}
	</button>

	{#if $exploreState.active}
		<button class="btn btn-round" disabled={$exploreState.failed} on:click={handleSubmitExplore} title="Submit Explore">
			Submit
		</button>
		<button class="btn btn-round" on:click={handleAbandonExplore} title="Abandon Explore">
			Back
		</button>
	{:else}
		<button class="btn btn-round" disabled={$gamePaused || $exploreState.failed || nextHint !== null} on:click={handleEnterExplore} title="Enter Explore">
			Explore
		</button>
	{/if}

	<button class="btn btn-round btn-badge" on:click={notes.toggle} title="Notes ({$notes ? 'ON' : 'OFF'})">
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
		</svg>

		<span class="badge tracking-tighter" class:badge-primary={$notes}>{$notes ? 'ON' : 'OFF'}</span>
	</button>

</div>


<style>
	.action-buttons {
		@apply flex flex-wrap justify-evenly self-end;
	}

	.explore-banner {
		@apply px-3 py-2 rounded-full text-xs font-semibold bg-primary-lighter text-primary-dark self-center;
	}

	.explore-banner-failed {
		@apply bg-red-200 text-red-700;
	}

	.btn-badge {
		@apply relative;
	}

	.badge {
		min-height: 20px;
		min-width:  20px;
		@apply p-1 rounded-full leading-none text-center text-xs text-white bg-gray-600 inline-block absolute top-0 left-0;
	}

	.badge-primary {
		@apply bg-primary;
	}
</style>