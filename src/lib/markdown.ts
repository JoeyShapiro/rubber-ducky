import hljs from 'highlight.js/lib/core';
import 'highlight.js/styles/default.css'; // need to get the styles

const languages: string[] = [];

async function metaRegisterLanguage(name: string) {
    try {
        // this is dumb, but i cant get dynamic imports to work
        // https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
        let module: any;
        switch (name) {
            case 'javascript':
                module = await import('highlight.js/lib/languages/javascript');
                break;
            case 'typescript':
                module = await import('highlight.js/lib/languages/typescript');
                break;
            case 'python':
                module = await import('highlight.js/lib/languages/python');
                break;
            case 'java':
                module = await import('highlight.js/lib/languages/java');
                break;
            case 'c':
                module = await import('highlight.js/lib/languages/c');
                break;
            case 'cpp':
                module = await import('highlight.js/lib/languages/cpp');
                break;
            case 'csharp':
                module = await import('highlight.js/lib/languages/csharp');
                break;
            case 'go':
                module = await import('highlight.js/lib/languages/go');
                break;
            case 'rust':
                module = await import('highlight.js/lib/languages/rust');
                break;
            case 'ruby':
                module = await import('highlight.js/lib/languages/ruby');
                break;
            case 'php':
                module = await import('highlight.js/lib/languages/php');
                break;
            case 'swift':
                module = await import('highlight.js/lib/languages/swift');
                break;
            case 'kotlin':
                module = await import('highlight.js/lib/languages/kotlin');
                break;

            // Add more cases for other languages you need
            default:
                throw new Error(`Unsupported language: ${name}`);
        }
        // const module = await import(/* @vite-ignore */ `highlight.js/lib/languages/${name}`);
        hljs.registerLanguage(name, module.default);
    } catch (error) {
        console.error(`Failed to load language: ${name}`, error);
        throw error;
    }
}

// idk what this does, but it works
// not sure what full is, it should have "...args", but this works, and i dont need them
// https://stackoverflow.com/questions/33631041/javascript-async-await-in-replace
async function replaceAsync(str: string, regex: any, asyncFn: (full: string) => any) {
    const promises: any[] = [];
    str.replace(regex, (full) => {
        promises.push(asyncFn(full));
        return full;
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

/**
 * Svelte action that rewrites a node's already-rendered innerHTML into markdown.
 *
 * This is lifted verbatim from the old +page.svelte. It is regex-over-innerHTML, which is both
 * an XSS hole and quadratic - T-17 replaces the whole thing with a real markdown library.
 * Don't extend it; it is here so the refactor stays behaviour-preserving.
 */
export function markdown(node: HTMLElement) {
    // whatever man, this fuckin works
    // i might want to use an #await, but this seems more fitting
    async function render() {
        // add precode to any code block
        // could just await this in html. but that would require a more complex class
        await replaceAsync(node.innerHTML, /```(.*?)```/gs, async (p1) => {
            let language = p1.split('\n')[0].replace('```', '');

            // if the language is not in the list, add it
            if (!languages.includes(language)) {
                await metaRegisterLanguage(language)
                    .then(() => {
                        languages.push(language);
                    })
                    .catch(err => {
                        console.error(err);
                    });
            }

            return `<pre class="card p-2 d-inline-block" style="background: rgba(212, 212, 250, 0.3);"><code>${hljs.highlight(p1, { language }).value}</code></pre>`;
        })
            .then((data) => {
                node.innerHTML = data;
            });

        // add code to any inline code block (shrug)
        node.innerHTML = node.innerHTML.replace(/(?<!`)`[^`\n]+`(?!`)/gs, (p1) => {
            return `<code>${p1}</code>`;
        });

        // do markdown stuff because i cant be bothered to use lib
        // ai overlords did it :P
        node.innerHTML = node.innerHTML.replace(/(?<!\\)\*\*(.*?)\*\*/gs, '<strong>$1</strong>');
        node.innerHTML = node.innerHTML.replace(/(?<!\\)\*(.*?)\*/gs, '<em>$1</em>');
        node.innerHTML = node.innerHTML.replace(/(?<!\\)~~(.*?)~~/gs, '<del>$1</del>');
        node.innerHTML = node.innerHTML.replace(/(?<!\\)__(.*?)__/gs, '<u>$1</u>');
        node.innerHTML = node.innerHTML.replace(/(?<!\\)\[(.*?)\]\((.*?)\)/gs, '<a href="$2">$1</a>');
        node.innerHTML = node.innerHTML.replace(/(?<!\\)\n/g, '<br>');
        node.innerHTML = node.innerHTML.replace(/https?:\/\/\S+/g, (p1) => {
            return `<a href="${p1}">${p1}</a>`;
        });
        // spoilers
        node.innerHTML = node.innerHTML.replace(/(?<!\\)\|\|(.*?)\|\|/gs, '<span class="spoil">$1</span>');
    }

    render();

    return {
        destroy() {
            // Cleanup code if needed
        }
    };
}
