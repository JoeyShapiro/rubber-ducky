import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
	// HTTPS in dev too, with an auto-generated self-signed cert - not for wire security (this
	// never leaves localhost/the LAN either way), but because window.crypto.subtle only exists
	// in a secure context (https, or the special-cased http://localhost), and testing on a real
	// phone means hitting a LAN IP, which was never going to qualify. Browsers show a "not
	// private" warning for the first visit to a given host - click through it once per device;
	// after that crypto.subtle works like it will in production, where real TLS makes this moot.
	// See NOTES.md, 2026-09-15.
	//
	// server.proxy: {} looks like a no-op, but it isn't - Vite's dev server (resolveHttpServer in
	// vite/dist/node/chunks/dep-*.js) uses node:http2's createSecureServer for HTTPS *unless*
	// `proxy` is set, in which case it falls back to plain node:https. That fallback is the actual
	// point here: @sveltejs/kit's getRequest() (node/index.js) passes Node's raw
	// IncomingMessage.headers straight into `new Request(..., { headers })`, and an HTTP/2
	// IncomingMessage carries a Symbol-keyed own property that undici's WebIDL header conversion
	// cannot stringify - every request 500s with "Request constructor: init.headers is a symbol".
	// ALPNProtocols: ['http/1.1'] alone does not prevent this - createSecureServer still
	// advertises h2 regardless. Forcing the plain node:https path is what actually avoids h2 being
	// offered at all. Real production TLS (a reverse proxy terminating it) is unaffected either
	// way - the app itself only ever speaks plain HTTP behind that.
	server: {
		proxy: {}
	},
	// VITE_NO_SSL=1 bun run dev drops the self-signed cert for plain http://localhost - useful
	// when a client can't be told to trust a self-signed cert (e.g. the Wails desktop shell's
	// WKWebView, which has no "click through" warning and just fails silently). Still a secure
	// context for crypto.subtle per the note above, so nothing behaves differently - just don't
	// use this for the LAN/mobile case, which is the whole reason basicSsl() is here.
	plugins: [sveltekit(), ...(process.env.VITE_NO_SSL ? [] : [basicSsl()])]
});
