<script lang="ts">
	import { onMount } from "svelte";
    import * as store from './stores.js';

   class Duck {
		constructor(public name: string) {
			this.name = name;
		}
	}

    // just make a class. it might be useful later
    class Badling {
        ducks: Duck[];

        constructor(public name: string) {
            this.name = name;
            this.ducks = [];
        }
    }

	let badlings: Badling[] = [];
  let duck_v = new Duck('');
  let newDuckTo: string = '';

    function loadDuck(duck: Duck) {
        store.duck.set(duck);
        duck_v = duck;
    }

    function addDuck(badling: string) {
        let duckName = (document.getElementById('new-duck') as HTMLInputElement).value;
        if (duckName == '') {
            return;
        }
        
        fetch('/ducks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                badling: badling,
                duck: duckName
            })
        })
            .then(res => res.json())
            .then(data => {
                // remove 'new-duck' input
                newDuckTo = '';
                // add new duck to badling
                badlings = badlings.map(b => {
                    if (b.name == badling) {
                        b.ducks.push(new Duck(duckName));
                    }
                    return b;
                });

                // load new duck
                // TODO
                // loadDuck(new Duck(data.duck));
            })
            .catch(err => {
                console.error(err);
            });
    }

    onMount(() => {
        fetch('/ducks')
			.then(res => res.json())
			.then(data => {
				badlings = data.badlings;
			})
			.catch(err => {
				console.error(err);
			});
    });
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
      {#each badlings as badling}
      <div class="position-relative">
      <li class="mb-1">
			<button
				class="btn btn-toggle d-inline-flex align-items-center rounded border-0 collapsed"
				data-bs-toggle="collapse"
				data-bs-target="#{badling.name}-collapse"
                aria-expanded="true"
			>
				{badling.name}
			</button>
			<div class="collapse show" id="{badling.name}-collapse">
				<ul class="btn-toggle-nav list-unstyled fw-normal pb-1 small">
          {#each badling.ducks as duck}
					<li>
						<a href="#" on:click={() => loadDuck(duck)} class="{duck.name == duck_v.name ? 'active' : ''} link-body-emphasis d-inline-flex text-decoration-none rounded">
                <img src="/duck.svg" alt="duck" class="me-2" width="16" height="16" />
                {duck.name}
            </a>
					</li>
          {/each}
          {#if newDuckTo == badling.name}
          <li class="">
						<a href="#" class="link-body-emphasis d-inline-flex text-decoration-none rounded">
                <img src="/duck.svg" alt="duck" class="me-2" width="16" height="16" />
                <input id="new-duck" type="text" class="form-control p-0" placeholder="New Duck" on:keydown={(e) => e.key == 'Enter' && addDuck(badling.name)} on:focusout={() => newDuckTo=''} />
            </a>
					</li>
          {/if}
				</ul>
			</div>
		</li>
    <button class="btn btn-hidden rounded border-0 position-absolute top-0 end-0" on:click={() => newDuckTo = badling.name}>
      <img src="/add.svg" alt="add" class="me-2" width="16" height="16" />
    </button>
    </div>
    {/each}
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

/* https://oklch-palette.vercel.app/#84.1,0.169,92.385,100 */
.btn-toggle-nav a.active {
  color: var(--bs-emphasis-color);
  background-color: var(--bs-warning-bg-subtle);
}

.btn-hidden {
  padding: .25rem .5rem;
  font-weight: 600;
  color: var(--bs-emphasis-color);
  background-color: transparent;
}
.btn-hidden:hover,
.btn-hidden:focus {
  color: rgba(var(--bs-emphasis-color-rgb), .85);
  background-color: var(--bs-tertiary-bg);
}

.btn-hidden::before {
  width: 1.25em;
  line-height: 0;
  transition: transform .35s ease;
  transform-origin: .5em 50%;
}

div .btn-hidden {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
}

div:hover > .btn-hidden {
  opacity: 1;
  visibility: visible;
}
</style>
