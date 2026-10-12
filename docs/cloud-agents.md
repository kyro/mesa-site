# Cloud agent preview

The Mesa marketing site is static HTML, CSS, and JavaScript. GitHub Pages serves this repository as-is (`CNAME`, `.nojekyll`, no build). Preview and checks stay on a local server. They do not edit pages, styles, or `CNAME`, and they do not deploy.

## Preview

`.cursor/environment.json` runs `bash .cursor/preview.sh` on every Cloud Agent boot. That script starts `python3 -m http.server` on port **8000** from the repository root. If something is already answering `http://127.0.0.1:8000/` with status 200, it leaves that process alone.

The boot command is not waited on. If the port is not up yet, read `/tmp/cursor/start-user/start-user.log`. Start it yourself the same way when you are working in a session that did not run `start`:

```bash
bash .cursor/preview.sh
```

Open the home page at [http://127.0.0.1:8000/](http://127.0.0.1:8000/). Other pages use the same origin, for example [http://127.0.0.1:8000/students.html](http://127.0.0.1:8000/students.html).

Confirm the page you changed:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/students.html
```

A healthy page returns `200`. Use the local server for this. The production host serves the published branch, not your working tree.

## Local link check

Optional. This only reads the checkout:

```bash
python3 .cursor/check-links.py
```

It resolves local `href`, `src`, and `poster` values in the root HTML files, and local `url(...)` values in the root CSS files, then checks that those files exist. External URLs, `#fragments`, and `data:` URIs are skipped. The script does not write files and does not request mesanotebook.com.

## Screenshot

After a visible change, open the affected page at `http://127.0.0.1:8000/<page>` and take a screenshot of that page (the changed section is enough). If the edit was in a shared file such as `styles.css` or `main.js`, also open one other page that loads that file and screenshot it. Put the screenshot in the pull request.

Leave `CNAME` and `.nojekyll` unchanged unless the task is specifically about the GitHub Pages host.
