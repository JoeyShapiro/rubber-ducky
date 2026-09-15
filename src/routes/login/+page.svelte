<script lang="ts">
    import { sha512 } from 'js-sha512';

    let password = '';
    let error = '';
    let submitting = false;

    async function handleSubmit(event: Event) {
        event.preventDefault();
        error = '';
        submitting = true;

        try {
            // autocomplete="current-password" below is what a password manager needs to save/
            // fill the field - it doesn't care what the network request itself carries. This
            // app has no TLS (plain http on a LAN - see system.ts), so the wire still only ever
            // sees a hash, never the real password: plain JS, not window.crypto.subtle, since
            // that API is unavailable outside a secure context and a phone on the LAN isn't one.
            // See NOTES.md, 2026-09-15.
            const hashHex = sha512(password);

            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: hashHex }),
            });

            if (!res.ok) {
                error = res.status === 401 ? 'Incorrect password' : `Login failed (${res.status})`;
                return;
            }

            // the session cookie is set by the server; nothing to do here but go
            window.location.href = `${window.location.origin}/`;
        } catch (err) {
            console.error(err);
            error = 'Login failed - check your connection and try again';
        } finally {
            submitting = false;
        }
    }
</script>

<section class="w-100 h-100 gradient-form" style="background-color: #eee;">
    <div class="container py-5 h-100">
      <div class="row d-flex justify-content-center align-items-center h-100">
        <div class="col-xl-10">
          <div class="card rounded-3 text-black">
            <div class="row g-0">
              <div class="col-lg-6">
                <div class="card-body p-md-5 mx-md-4">
  
                  <div class="text-center">
                    <!-- was a lotus from an mdb cdn, which made the login screen need the internet -->
                    <img class="login-logo" src="/duck.svg" style="width: 110px;" alt="">
                    <h4 class="mt-1 mb-5 pb-1">Rubber Ducky</h4>
                  </div>
  
                  <form on:submit|preventDefault={handleSubmit}>
                    <div data-mdb-input-init class="form-floating mb-4">
                        <input bind:value={password} type="password" name="password" autocomplete="current-password" class="form-control {error ? 'is-invalid' : ''}" id="floatingPassword" placeholder="Password">
                        <label for="floatingPassword">Password</label>
                    </div>

                    {#if error}
                      <p class="login-error mb-4" role="alert">{error}</p>
                    {/if}

                    <div class="text-center pt-1 mb-5 pb-1">
                        <button  data-mdb-button-init data-mdb-ripple-init class="btn btn-primary btn-block fa-lg gradient-custom-2 mb-3" type="submit" disabled={submitting}>
                            {submitting ? 'Logging in…' : 'Login'}
                        </button>
                    </div>

                  </form>
  
                </div>
              </div>
              <div class="col-lg-6 d-flex align-items-center gradient-custom-2">
                <div class="text-white px-3 py-4 p-md-5 mx-md-4">
                    <h4 class="mb-4">More than a Journal</h4>
                    <p class="small mb-0">
                        Rubber Ducky is a journaling app that helps you track your thoughts and feelings.
                        It's a great way to reflect on your day and improve your mental health.
                        <!-- It will even help you track your mood and give you insights into your mental health. -->
                        It can even respond to your questions and recall your past entries.
                    </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

<style>
    /* app.css inverts svg files in dark mode, but this card stays white in both themes -
       inverting would leave a white duck on a white background */
    .login-logo {
        filter: none !important;
    }

    .login-error {
        margin-top: -1rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: #dc3545;
        text-align: center;
    }

    .gradient-custom-2 {
    /* fallback for old browsers */
    background: #fccb90;

    /* Chrome 10-25, Safari 5.1-6 */
    background: -webkit-linear-gradient(to right, #eebf24, #d8363a, #dd3675, #ba34eb);

    /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
    background: linear-gradient(to right, #eebf24, #d8363a, #dd3675, #ba34eb);
}

@media (min-width: 768px) {
.gradient-form {
height: 100vh !important;
}
}
@media (min-width: 769px) {
.gradient-custom-2 {
border-top-right-radius: .3rem;
border-bottom-right-radius: .3rem;
}
}
</style>
