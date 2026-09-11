<script lang="ts">
	export let title: string;
	export let disabled = false;
</script>

<button class="add-btn" type="button" {title} aria-label={title} {disabled} on:click>
	<!-- inlined from static/add.svg so the plus follows the button's colour. app.css inverts
	     every svg *file* in dark mode, which would flip this to white on a yellow button -->
	<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path
			d="M6 12H12M12 12H18M12 12V18M12 12V6"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</button>

<style>
	/* yellow in both themes, like the send plane - so no dark override */
	.add-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.9rem;
		height: 1.9rem;
		padding: 0;
		border: 1px solid rgba(214, 164, 6, 0.55);
		border-radius: 6px;
		background: #ffc107;
		color: rgba(33, 33, 30, 0.9);
		cursor: pointer;
		transition: background 0.12s ease, transform 0.1s ease;
	}

	.add-btn:hover:not(:disabled) {
		background: #ffcd39;
	}

	.add-btn:active:not(:disabled) {
		transform: scale(0.94);
	}

	.add-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.add-btn svg {
		width: 1.05rem;
		height: 1.05rem;
	}
</style>
