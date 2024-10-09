<script lang="ts">
    let password = '';

    async function handleSubmit(event: Event) {
        event.preventDefault();

        const hash = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(password));
        const hashArray = Array.from(new Uint8Array(hash));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                  'password' : hashHex,
                })
        })
            .then(res => res.json())
            .then(data => {
                document.cookie = `session=${data.uuid}; expires=${data.expiresOn}; path=/`;
                window.location.href = `${window.location.origin}/`;
            })
            .catch(err => {
                console.error(err);
            });
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
                    <img src="https://mdbcdn.b-cdn.net/img/Photos/new-templates/bootstrap-login-form/lotus.webp"
                      style="width: 185px;" alt="logo">
                    <h4 class="mt-1 mb-5 pb-1">Rubber Ducky</h4>
                  </div>
  
                  <form on:submit|preventDefault={handleSubmit}>
                    <div data-mdb-input-init class="form-floating mb-4">
                        <input bind:value={password} type="password" class="form-control" id="floatingPassword" placeholder="Password">
                        <label for="floatingPassword">Password</label>
                    </div>
  
                    <div class="text-center pt-1 mb-5 pb-1">
                        <button  data-mdb-button-init data-mdb-ripple-init class="btn btn-primary btn-block fa-lg gradient-custom-2 mb-3" type="submit">
                            Login
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
