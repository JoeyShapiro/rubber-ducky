import hljs from 'highlight.js/lib/common';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * One markdown path for the whole app: messages, notes, quest descriptions.
 *
 * marked parses the *source string* and DOMPurify sanitises the result. The old renderer worked
 * by regexing over already-rendered innerHTML, which mangled anything with HTML-significant
 * characters and left `{@html}` open to injection.
 */

marked.setOptions({ gfm: true, breaks: true });

// ||spoiler|| is ours, not markdown - carried over from the old renderer
marked.use({
    extensions: [
        {
            name: 'spoiler',
            level: 'inline',
            start(src: string) {
                return src.indexOf('||');
            },
            tokenizer(this: any, src: string) {
                const match = /^\|\|([\s\S]+?)\|\|/.exec(src);
                if (!match) return undefined;
                return { type: 'spoiler', raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
            },
            renderer(this: any, token: any) {
                return `<span class="spoil">${this.parser.parseInline(token.tokens)}</span>`;
            },
        },
    ],
});

let hooked = false;

export function renderMarkdown(source: string): string {
    const html = marked.parse(source ?? '', { async: false }) as string;

    // DOMPurify needs a dom. Everything that renders markdown does so client side.
    if (typeof window === 'undefined') return '';

    if (!hooked) {
        hooked = true;
        DOMPurify.addHook('afterSanitizeAttributes', (node) => {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noreferrer');
            }
        });
    }

    return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}

function highlightBlocks(root: HTMLElement) {
    for (const block of Array.from(root.querySelectorAll('pre code'))) {
        if (block.classList.contains('hljs')) continue;

        const named = Array.from(block.classList).find((c) => c.startsWith('language-'));
        const language = named?.slice('language-'.length);

        // an unknown or missing language stays plain rather than being guessed at
        if (!language || !hljs.getLanguage(language)) continue;
        hljs.highlightElement(block as HTMLElement);
    }
}

function addCopyButtons(root: HTMLElement) {
    for (const pre of Array.from(root.querySelectorAll('pre'))) {
        if (pre.querySelector('.md-copy')) continue;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'md-copy';
        button.textContent = 'Copy';
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '');
                button.textContent = 'Copied';
                setTimeout(() => (button.textContent = 'Copy'), 1200);
            } catch {
                button.textContent = 'Failed';
                setTimeout(() => (button.textContent = 'Copy'), 1200);
            }
        });

        pre.appendChild(button);
    }
}

/**
 * Svelte action for a node whose innerHTML came from renderMarkdown: highlights fenced code and
 * gives each block a copy button. Pass the html as the parameter so it re-runs on change.
 */
export function enhanceMarkdown(node: HTMLElement, _html: string) {
    function run() {
        highlightBlocks(node);
        addCopyButtons(node);
    }

    run();
    return {
        update() {
            run();
        },
    };
}
