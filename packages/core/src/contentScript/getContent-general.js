/* global chrome, TurndownService, turndownPluginGfm, Readability */

/**
 * Extract general page content and convert to markdown.
 * Uses a Confluence-specific fast path when possible, otherwise falls back to
 * Mozilla's Readability for content extraction and Turndown for HTML to
 * Markdown conversion.
 */

(function () {
  'use strict';

  const CONFLUENCE_CONTENT_SELECTORS = [
    '#main-content',
    '.wiki-content',
    '.confluence-content',
  ];

  const CONFLUENCE_TITLE_SELECTORS = [
    'h1.pageTitle',
    '#title-text',
    'h1.pagetitle',
  ];

  const CONFLUENCE_NOISE_SELECTORS = [
    '.comment-threads',
    '.page-metadata',
    '.hidden',
    '.confluence-information-macro-footer',
    '.aui-sidebar',
    '.ia-splitter-handle',
    '.ia-fixed-sidebar',
    '.acs-side-bar',
    '.confluence-information-macro-tip',
    '.confluence-information-macro-note',
    '.confluence-information-macro-warning',
  ];

  /**
   * Find the primary Confluence content root.
   * @returns {Element | null}
   */
  function getConfluenceContentRoot() {
    for (const selector of CONFLUENCE_CONTENT_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * Find the best available Confluence page title.
   * @returns {string}
   */
  function getConfluencePageTitle() {
    for (const selector of CONFLUENCE_TITLE_SELECTORS) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }
    return document.title || '';
  }

  /**
   * Remove cloned UI chrome that should not appear in the exported markdown.
   * @param {Element} root
   * @returns {void}
   */
  function removeConfluenceNoise(root) {
    CONFLUENCE_NOISE_SELECTORS.forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => {
        element.parentNode?.removeChild(element);
      });
    });
  }

  /**
   * Create the generic Turndown service used for non-Confluence pages.
   * @returns {TurndownService}
   */
  function createGenericTurndownService() {
    const turndownService = new TurndownService({
      headingStyle: 'atx', // # H1
      codeBlockStyle: 'fenced', // ```js
      bulletListMarker: '-', // - list item
      emDelimiter: '*', // *italic*
      strongDelimiter: '**', // **bold**
      hr: '---',
      br: '\n',
      linkStyle: 'inlined', // [text](url)
      linkReferenceStyle: 'full',
    });

    // Use GitHub Flavored Markdown plugin for tables, strikethrough, etc.
    if (typeof turndownPluginGfm !== 'undefined') {
      turndownService.use(turndownPluginGfm.gfm);
    }

    // Drop empty paragraphs that often appear after Readability cleanup.
    turndownService.addRule('dropEmpty', {
      filter: (node) =>
        node.nodeName === 'P' &&
        !node.textContent.trim() &&
        !node.querySelector('img'),
      replacement: () => '',
    });

    return turndownService;
  }

  /**
   * Create a Turndown service tuned for Confluence page structure.
   * @returns {TurndownService}
   */
  function createConfluenceTurndownService() {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
    });

    turndownService.addRule('list', {
      filter: ['ul', 'ol'],
      replacement: (content, node) => {
        const normalizedContent = content.replace(/\n\s+\n/g, '\n');
        const parent = node.parentNode;
        if (
          parent instanceof Element &&
          parent.nodeName === 'LI' &&
          parent.lastElementChild === node
        ) {
          return `\n${normalizedContent}`;
        }
        return `\n\n${normalizedContent}\n\n`;
      },
    });

    turndownService.addRule('listItem', {
      filter: 'li',
      replacement: (content, node, options) => {
        const normalizedContent = content
          .replace(/^\n+/, '')
          .replace(/\n+$/, '\n')
          .replace(/\n/gm, '\n  ');

        let prefix = `${options.bulletListMarker} `;
        const parent = node.parentNode;
        if (parent instanceof HTMLOListElement) {
          const start = Number(parent.getAttribute('start') || '1');
          const index = Array.prototype.indexOf.call(parent.children, node);
          prefix = `${start + index}. `;
        }

        return (
          prefix +
          normalizedContent +
          (node.nextSibling && !/\n$/.test(normalizedContent) ? '\n' : '')
        );
      },
    });

    turndownService.addRule('table', {
      filter: 'table',
      replacement: (_content, node) => {
        if (!(node instanceof HTMLTableElement)) {
          return '';
        }

        if (
          node.parentElement?.closest('div[data-testid="sticky-table-fixed"]')
        ) {
          return '';
        }

        let markdown = '\n';
        let columnCount = 0;
        const headerCells = node.querySelectorAll('thead th');

        if (headerCells.length > 0) {
          columnCount = headerCells.length;
        } else {
          const firstBodyHeaderCells = node.querySelectorAll(
            'tbody tr:first-child th',
          );
          if (firstBodyHeaderCells.length > 0) {
            columnCount = firstBodyHeaderCells.length;
          } else {
            const firstBodyCells = node.querySelectorAll('tbody tr:first-child td');
            columnCount = firstBodyCells.length;
          }
        }

        if (columnCount === 0) {
          return '';
        }

        if (headerCells.length > 0) {
          markdown += `| ${Array.from(headerCells)
            .map((cell) => cell.textContent?.trim() || '')
            .join(' | ')} |\n`;
        } else {
          const firstBodyRow = node.querySelector('tbody tr:first-child');
          const bodyHeaderCells = firstBodyRow?.querySelectorAll('th') || [];

          if (bodyHeaderCells.length > 0 && firstBodyRow) {
            markdown += `| ${Array.from(bodyHeaderCells)
              .map((cell) => cell.textContent?.trim() || '')
              .join(' | ')} |\n`;

            if (bodyHeaderCells.length < columnCount) {
              markdown =
                markdown.slice(0, -2) +
                ` | ${Array(columnCount - bodyHeaderCells.length).fill('').join(' | ')} |\n`;
            }
            firstBodyRow.setAttribute('data-processed-as-header', 'true');
          } else {
            markdown += `| ${Array(columnCount).fill('').join(' | ')} |\n`;
          }
        }

        markdown += `| ${Array(columnCount).fill(':--').join(' | ')} |\n`;

        node.querySelectorAll('tbody tr').forEach((row) => {
          if (row.getAttribute('data-processed-as-header') === 'true') {
            return;
          }

          const cells = row.querySelectorAll('td');
          if (cells.length === 0) {
            return;
          }

          let rowMarkdown = '| ';
          for (let index = 0; index < columnCount; index += 1) {
            if (index < cells.length) {
              rowMarkdown += (cells[index].textContent?.trim() || '').replace(
                /\|/g,
                '\\|',
              );
            }
            if (index < columnCount - 1) {
              rowMarkdown += ' | ';
            }
          }
          rowMarkdown += ' |\n';
          markdown += rowMarkdown;
        });

        return `${markdown}\n`;
      },
    });

    turndownService.addRule('codeBlock', {
      filter: (node) =>
        node instanceof Element &&
        node.nodeName === 'DIV' &&
        (node.classList.contains('code-block') ||
          node.classList.contains('codeContent') ||
          node.classList.contains('syntaxhighlighter')),
      replacement: (_content, node) => {
        const codeContainer = /** @type {HTMLDivElement} */ (node);
        const pre = codeContainer.querySelector('pre') || codeContainer;
        const codeText = pre.textContent || '';
        const language = codeContainer.getAttribute('data-language') || '';
        return `\n\`\`\`${language}\n${codeText.trim()}\n\`\`\`\n\n`;
      },
    });

    turndownService.addRule('image', {
      filter: 'img',
      replacement: (_content, node) => {
        if (!(node instanceof HTMLImageElement)) {
          return '';
        }

        const alt = node.getAttribute('alt') || '';
        const emojiText = node.getAttribute('data-emoji-text');
        if (emojiText) {
          return emojiText;
        }

        try {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (node.complete && node.naturalWidth !== 0 && context) {
            canvas.width = node.naturalWidth;
            canvas.height = node.naturalHeight;
            context.drawImage(node, 0, 0);
            return `![${alt}](${canvas.toDataURL('image/png')})`;
          }
        } catch (error) {
          console.error(
            '[getContent] Error converting Confluence image to Data URI:',
            error,
          );
        }

        const src = node.getAttribute('src') || '';
        return `![${alt}](${src})`;
      },
    });

    return turndownService;
  }

  /**
   * Extract Confluence content before falling back to generic Readability logic.
   * @returns {string}
   */
  function getConfluencePageContent() {
    const contentRoot = getConfluenceContentRoot();
    if (!(contentRoot instanceof Element)) {
      return '';
    }

    try {
      const clonedRoot = contentRoot.cloneNode(true);
      if (!(clonedRoot instanceof Element)) {
        return '';
      }

      removeConfluenceNoise(clonedRoot);

      const title = getConfluencePageTitle();
      const markdownBody = createConfluenceTurndownService().turndown(
        clonedRoot,
      );

      if (!title) {
        return markdownBody;
      }

      return `# ${title}\n\n${markdownBody}`;
    } catch (error) {
      console.error('[getContent] Error extracting Confluence content:', error);
      return '';
    }
  }

  /**
   * Extract and convert page content to markdown.
   * @returns {Promise<string>}
   */
  async function getGeneralPageContent() {
    try {
      // Prefer a DOM-specific Confluence export before Readability strips structure.
      const confluenceMarkdown = getConfluencePageContent();
      if (confluenceMarkdown) {
        return confluenceMarkdown;
      }

      // Clone the document to avoid mutating the live page
      const clone = document.cloneNode(true);

      // Try to use Readability for better content extraction
      let contentHtml = '';
      try {
        const reader = new Readability(clone);
        const article = reader.parse();
        if (article && article.content) {
          contentHtml = article.content;
        }
      } catch (readabilityError) {
        console.warn(
          '[getContent] Readability failed, falling back to body:',
          readabilityError,
        );
      }

      // Fallback to body content if Readability fails
      if (!contentHtml) {
        const bodyClone = document.body.cloneNode(true);
        // Remove unwanted elements
        bodyClone
          .querySelectorAll(
            'script, style, noscript, iframe, svg, canvas, img, video, ' +
              'header, footer, nav, aside, [hidden], [aria-hidden="true"]',
          )
          .forEach((el) => el.remove());
        contentHtml = bodyClone.innerHTML;
      }

      const markdown = createGenericTurndownService().turndown(contentHtml);
      return markdown;
    } catch (error) {
      console.error('[getContent] Error extracting content:', error);
      return '';
    }
  }

  // Register the content getter function
  window['getContent'] = getGeneralPageContent;
})();
