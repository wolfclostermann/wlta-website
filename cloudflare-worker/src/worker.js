// Reverse proxy for wlta.cc -> the wlta-website GitHub Pages project page.
//
// GitHub serves this repo at github.io/wlta-website/ (a *project* page, not
// a user page), so every request has its host rewritten to that and
// `/wlta-website` prepended to its path before being forwarded. Visitors at
// wlta.cc never see github.io or the /wlta-website segment, so every path
// (e.g. /offline) behaves as if the site were served from the root.
//
// GitHub's static server 301s a bare directory path to add a trailing slash
// (e.g. /offline -> /offline/), Location: pointed at github.io. Passed
// through unchanged, that would bounce the visitor off wlta.cc entirely, so
// any Location pointing back at GITHUB_PAGES_HOST gets rewritten to the
// visitor's own host with the path prefix stripped back off.
//
// Update GITHUB_PAGES_HOST/GITHUB_PAGES_PATH_PREFIX and redeploy
// (`npm run deploy`) if the repo is ever renamed.
const GITHUB_PAGES_HOST = "wolfclostermann.github.io";
const GITHUB_PAGES_PATH_PREFIX = "/wlta-website";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);

    const upstreamUrl = new URL(request.url);
    upstreamUrl.protocol = "https:";
    upstreamUrl.hostname = GITHUB_PAGES_HOST;
    upstreamUrl.port = "";
    upstreamUrl.pathname = GITHUB_PAGES_PATH_PREFIX + upstreamUrl.pathname;

    const proxyRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });

    const response = await fetch(proxyRequest);

    const location = response.headers.get("location");
    if (location) {
      const resolved = new URL(location, upstreamUrl);
      if (resolved.hostname === GITHUB_PAGES_HOST) {
        // Built from a template rather than off the mutated `resolved` URL
        // object -- `wrangler dev --local` silently downgrades any outgoing
        // header value that's an absolute https:// URL pointing back at the
        // current request's own Host to http:// (a local-only convenience,
        // since local dev has no TLS listener to send the browser back to;
        // confirmed isolated from this logic -- a hardcoded literal string
        // gets the same treatment). Doesn't affect the real deploy, where
        // Cloudflare's edge terminates real TLS for the domain.
        let path = resolved.pathname;
        if (path.startsWith(GITHUB_PAGES_PATH_PREFIX)) {
          path = path.slice(GITHUB_PAGES_PATH_PREFIX.length) || "/";
        }
        const rewritten = `https://${incoming.hostname}${path}${resolved.search}${resolved.hash}`;

        const headers = new Headers(response.headers);
        headers.set("location", rewritten);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    return response;
  },
};
