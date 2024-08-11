<script lang="ts">
   class Duck {
		constructor(public name: string) {
			this.name = name;
		}
	}

	let badlings: { [id: string] : [Duck] } = {};
</script>

<div class="flex-shrink-0 p-3" style="width: 280px;">
	<a
		href="/"
		class="d-flex align-items-center pb-3 mb-3 link-body-emphasis text-decoration-none border-bottom"
	>
		<svg class="bi pe-none me-2" width="30" height="24"><use xlink:href="#bootstrap"></use></svg>
		<span class="fs-5 fw-semibold">Ducks</span>
	</a>
	<ul class="list-unstyled ps-0">
		<li class="mb-1">
			<button
				class="btn btn-toggle d-inline-flex align-items-center rounded border-0 collapsed"
				data-bs-toggle="collapse"
				data-bs-target="#home-collapse"
			>
				Home
			</button>
			<div class="collapse show" id="home-collapse">
				<ul class="btn-toggle-nav list-unstyled fw-normal pb-1 small">
					<li>
						<a href="#" class="link-body-emphasis d-inline-flex text-decoration-none rounded"
							>Overview</a
						>
					</li>
					<li>
						<a href="#" class="link-body-emphasis d-inline-flex text-decoration-none rounded"
							>Updates</a
						>
					</li>
					<li>
						<a href="#" class="link-body-emphasis d-inline-flex text-decoration-none rounded"
							>Reports</a
						>
					</li>
				</ul>
			</div>
		</li>
	</ul>
</div>

<style>
.btn-toggle {
  padding: .25rem .5rem;
  font-weight: 600;
  color: var(--bs-emphasis-color);
  background-color: transparent;
}
.btn-toggle:hover,
.btn-toggle:focus {
  color: rgba(var(--bs-emphasis-color-rgb), .85);
  background-color: var(--bs-tertiary-bg);
}

.btn-toggle::before {
  width: 1.25em;
  line-height: 0;
  content: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='rgba%280,0,0,.5%29' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 14l6-6-6-6'/%3e%3c/svg%3e");
  transition: transform .35s ease;
  transform-origin: .5em 50%;
}

[data-bs-theme="dark"] .btn-toggle::before {
  content: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='rgba%28255,255,255,.5%29' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 14l6-6-6-6'/%3e%3c/svg%3e");
}

.btn-toggle[aria-expanded="true"] {
  color: rgba(var(--bs-emphasis-color-rgb), .85);
}
.btn-toggle[aria-expanded="true"]::before {
  transform: rotate(90deg);
}

.btn-toggle-nav a {
  padding: .1875rem .5rem;
  margin-top: .125rem;
  margin-left: 1.25rem;
}
.btn-toggle-nav a:hover,
.btn-toggle-nav a:focus {
  background-color: var(--bs-tertiary-bg);
}
</style>
