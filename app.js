// Use 2-space indentation throughout for consistency.
const langMap = {
	'php': 'php',
	'js': 'javascript',
	'ts': 'typescript',
	'py': 'python',
	'css': 'css',
	'html': 'xml',
	'json': 'json',
	'md': 'markdown',
	'sh': 'bash',
	'c': 'c',
	'cpp': 'cpp',
	'h': 'cpp',
	'java': 'java',
	'go': 'go',
	'rs': 'rust',
	'dart': 'dart',
	'cs': 'csharp',
	'rb': 'ruby'
};

function getQueryParam(key, fallback = null) {
	const params = new URLSearchParams(window.location.search);
	return params.has(key) ? params.get(key) : fallback;
}

function build() {
	let user = getQueryParam('user', 'kode-cat');
	let repo = getQueryParam('repo', 'tiiny');
	let path = getQueryParam('path', 'index.html');
	let rfnc = getQueryParam('rfnc', 'latest');
	let rtn = getQueryParam('rtn', null);
	let rwrt = getQueryParam('rwrt', '');

	const cdnRoot = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${rfnc}`;
	const fileUrl = `${cdnRoot}/${path}`;
	const ghUrl = `https://github.com/${user}/${repo}/blob/${rfnc}/${path}`;
	const ghDevUrl = `https://github.dev/${user}/${repo}/blob/${rfnc}/${path}`;
	const stzUrl = `https://stackblitz.com/github/${user}/${repo}`;

	return {
		user,
		repo,
		path,
		rfnc,
		rtn,
		rwrt,
		cdnRoot,
		fileUrl,
		ghUrl,
		ghDevUrl,
		stzUrl
	};
}

function copyCode() {
	const code = document.getElementById("code-block").innerText;
	navigator.clipboard.writeText(code);
	const btn = document.querySelector(".copy-btn");
	btn.textContent = "Copied!";
	setTimeout(() => {
		btn.textContent = "Copy";
	}, 1700);
}

function isHtmlFile(path, content) {
	if (/\.(html?)$/i.test(path)) return true;
	if (/^\s*<(!doctype|html|head|body|meta|title|link|script|style|div|span|h1|h2|h3|p|a|img|form)\b/i.test(content)) return true;
	return false;
}

function rewriteHtmlAssets(html, cdnRoot) {
	html = html.replace(/<(script|link|img|a)\b([^>]*?)\b(src|href)=["']([^"']+)["']/ig, function(_, tag, attrs, attr, assetPath) {
		if (/^(https?:|\/\/|data:|mailto:|javascript:|tel:|#)/i.test(assetPath)) return arguments[0];
		if (tag.toLowerCase() === "a" && /^#/.test(assetPath)) return arguments[0];
		return `<${tag}${attrs} ${attr}="${cdnRoot}/${assetPath.replace(/^\.?\//,'')}"`;
	});
	html = html.replace(/url\((["']?)([^"')]+)\1\)/ig, function(_, q, url) {
		if (/^(https?:|data:|\/\/|#)/i.test(url)) return arguments[0];
		return `url("${cdnRoot}/${url.replace(/^\.?\//,'')}")`;
	});
	return html;
}

function setLoaderStep(step) {
	document.getElementById('sb-step').textContent = step;
}

function showEl(id, show) {
	document.getElementById(id).style.display = show ? '' : 'none';
}

async function main() {
	const {
		user,
		repo,
		path,
		rfnc,
		rtn,
		rwrt,
		cdnRoot,
		fileUrl,
		ghUrl,
		ghDevUrl,
		stzUrl
	} = build();

	// Set GitHub link
	const ghLinkEl = document.getElementById('gh-link');
	ghLinkEl.href = ghUrl;
	ghLinkEl.style.display = 'inline-block';
	setLoaderStep(`(${repo}@${rfnc})/${path}`);

	// Set header info
	document.getElementById('filename').textContent = path.split('/').pop();
	document.getElementById('filetype').textContent = (path.split('.').pop() || 'txt').toUpperCase();

	// Return mode switch
	if (rtn === 'raw') {
		setLoaderStep('Redirecting to raw file…');
		window.location.replace(fileUrl);
		return;
	}
	if (rtn === 'ghr') {
		setLoaderStep('Redirecting to GitHub…');
		window.location.replace(ghUrl);
		return;
	}
	if (rtn === 'ghs') {
		setLoaderStep('Opening in github.dev…');
		window.location.replace(ghDevUrl);
		return;
	}
	if (rtn === 'stz') {
		setLoaderStep('Opening in StackBlitz…');
		window.location.replace(stzUrl);
		return;
	}

	// If scd: pretty code view with syntax highlighting
	if (rtn === 'scd') {
		setLoaderStep('Fetching file content…');
		try {
			let resp = await fetch(fileUrl);
			if (!resp.ok) throw new Error("Not found");
			let code = await resp.text();
			let ext = path.split('.').pop().toLowerCase();
			let hljsLang = langMap[ext] || '';
			// Dynamically load highlight.js only when needed
			let hljsLoaded = false;

			function loadHljs() {
				return new Promise((resolve, reject) => {
					if (window.hljs) return resolve();
					// load CSS
					let css = document.getElementById('hljs-css');
					css.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css";
					css.removeAttribute('disabled');
					// load JS
					let script = document.createElement('script');
					script.src = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js";
					script.onload = () => {
						hljsLoaded = true;
						resolve();
					};
					script.onerror = reject;
					document.body.appendChild(script);
				});
			}
			setLoaderStep('Rendering code…');
			await loadHljs();
			const codeBlock = document.getElementById('code-block');
			codeBlock.className = hljsLang ? 'hljs ' + hljsLang : 'hljs';
			codeBlock.textContent = code;
			showEl('sb-loader', false);
			showEl('code-container', true);
			document.querySelector('.copy-btn').style.display = '';
			window.hljs && window.hljs.highlightElement(codeBlock);
		} catch (e) {
			setLoaderStep('');
			document.getElementById('sb-loader').innerHTML = '<span class="err">Not Found</span>';
		}
		return;
	}

	// Otherwise: only loader + fetching steps, then nothing or error
	setLoaderStep('Fetching file (raw mode)…');
	try {
		let resp = await fetch(fileUrl);
		if (!resp.ok) throw new Error("Not found");
		let html = await resp.text();
		let doRewrite = true;
		if (rwrt === 'false' || rwrt === '0') doRewrite = false;
		let isHtml = isHtmlFile(path, html);
		setLoaderStep('Done. Rendering…');
		// Only rewrite if likely HTML
		if (doRewrite && isHtml) html = rewriteHtmlAssets(html, cdnRoot);
		// Render HTML in-place
		document.open();
		document.write(html);
		document.close();
	} catch (e) {
		setLoaderStep('');
		document.getElementById('sb-loader').innerHTML = '<span class="err">Failed to fetch ' + path + '</span>';
	}
}

main();
