const blogpostMarkdown = `# control

*humans should focus on bigger problems*

## Setup

\`\`\`bash
git clone git@github.com:anysphere/control
\`\`\`

\`\`\`bash
./init.sh
\`\`\`

## Folder structure

**The most important folders are:**

1. \`vscode\`: this is our fork of vscode, as a submodule.
2. \`milvus\`: this is where our Rust server code lives.
3. \`schema\`: this is our Protobuf definitions for communication between the client and the server.

Each of the above folders should contain fairly comprehensive README files; please read them. If something is missing, or not working, please add it to the README!

Some less important folders:

1. \`release\`: this is a collection of scripts and guides for releasing various things.
2. \`infra\`: infrastructure definitions for the on-prem deployment.
3. \`third_party\`: where we keep our vendored third party dependencies.

## Miscellaneous things that may or may not be useful

##### Where to find rust-proto definitions

They are in a file called \`aiserver.v1.rs\`. It might not be clear where that file is. Run \`rg --files --no-ignore bazel-out | rg aiserver.v1.rs\` to find the file.

## Releasing

Within \`vscode/\`:

- Bump the version
- Then:

\`\`\`
git checkout build-todesktop
git merge main
git push origin build-todesktop
\`\`\`

- Wait for 14 minutes for gulp and ~30 minutes for todesktop
- Go to todesktop.com, test the build locally and hit release
`;

interface MarkdownElement {
  type: string;
  process: (char: string) => boolean;
  isActive: () => boolean;
  reset: () => void;
}

class MarkdownParser {
  public currentContainer: HTMLElement | null = null;
  private elements: MarkdownElement[] = [];
  private lastSixChars: string = '';

  constructor() {
    this.initializeElements();
  }

  // Initialize the different markdown elements this parser supports
  private initializeElements() {
    this.elements = [
      new CodeBlockElement(this),
      new InlineCodeElement(this),
      new HeadingElement(this),
      new UnorderedListElement(this),
      new EmphasisElement(this), // Add the new EmphasisElement
    ];
  }

  // Set the HTML container where parsed elements will be added
  public setContainer(container: HTMLElement) {
    this.currentContainer = container;
  }

  // Tokenize the input and process each token to detect markdown elements
  public addToken(token: string) {
    if (!this.currentContainer) return;

    for (let char of token) {
      this.lastSixChars = (this.lastSixChars + char).slice(-6); // Keep track of the last 6 characters to identify certain markdown patterns

      let handled = false;
      for (const element of this.elements) {
        if (element.isActive()) {
          handled = element.process(char);
          if (handled) break;
        }
      }

      // If no element handled the character, try again for inactive elements
      if (!handled) {
        for (const element of this.elements) {
          handled = element.process(char);
          if (handled) break;
        }
      }

      // If no markdown element was detected, treat it as plain text
      if (!handled) {
        this.appendText(char);
      }
    }
  }

  // Append parsed HTML elements to the container
  public appendElement(element: HTMLElement) {
    this.currentContainer?.appendChild(element);
  }

  // Append text as a span element if no markdown is detected
  public appendText(text: string) {
    const span = document.createElement('span');
    span.innerText = text;
    this.appendElement(span);
  }

  // Retrieve the last six characters to detect patterns like code blocks
  public getLastSixChars() {
    return this.lastSixChars;
  }
}

// Example implementation of a markdown element for handling code blocks
class CodeBlockElement implements MarkdownElement {
  private isCodeBlock = false;
  private currentCodeBlock = '';
  private parser: MarkdownParser;

  constructor(parser: MarkdownParser) {
    this.parser = parser;
  }

  type = 'codeBlock';

  process(char: string): boolean {
    // Handle content inside code blocks
    if (this.isCodeBlock) {
      this.currentCodeBlock += char;
      if (this.currentCodeBlock.endsWith('```')) {
        this.closeCodeBlock();
        return true;
      }
      return true;
    }
    // Detect code block opening pattern
    else if (this.parser.getLastSixChars().endsWith('```')) {
      this.isCodeBlock = true;
      this.currentCodeBlock = '```';
      return true;
    }
    return false;
  }

  isActive() {
    return this.isCodeBlock;
  }

  reset() {
    this.isCodeBlock = false;
    this.currentCodeBlock = '';
  }

  // Close the code block and create a corresponding HTML structure
  private closeCodeBlock() {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.style.backgroundColor = 'red'; // Style the code block
    code.innerText = this.currentCodeBlock.slice(3, -3).trim(); // Remove the backticks
    pre.appendChild(code);
    this.parser.appendElement(pre);
    this.reset();
  }
}

// Function to simulate token processing
function runStream() {
  const parser = new MarkdownParser();
  parser.setContainer(document.getElementById('markdownContainer')!);

  // Split the markdown content into tokens of random lengths for processing
  const tokens: string[] = [];
  let remainingMarkdown = blogpostMarkdown;
  while (remainingMarkdown.length > 0) {
    const tokenLength = Math.floor(Math.random() * 18) + 2;
    const token = remainingMarkdown.slice(0, tokenLength);
    tokens.push(token);
    remainingMarkdown = remainingMarkdown.slice(tokenLength);
  }

  // Simulate the streaming of tokens over time
  const toCancel = setInterval(() => {
    const token = tokens.shift();
    if (token) {
      parser.addToken(token);
    } else {
      clearInterval(toCancel);
    }
  }, 20);
}

class InlineCodeElement implements MarkdownElement {
  private isInlineCode = false;
  private currentInlineCode = '';
  private parser: MarkdownParser;

  constructor(parser: MarkdownParser) {
    this.parser = parser;
  }

  type = 'inlineCode';

  process(char: string): boolean {
    // Handle inline code enclosed by backticks
    if (this.isInlineCode) {
      if (char === '`') {
        this.closeInlineCode();
        return true;
      }
      this.currentInlineCode += char;
      return true;
    } else if (char === '`') {
      this.isInlineCode = true;
      return true;
    }
    return false;
  }

  isActive() {
    return this.isInlineCode;
  }

  reset() {
    this.isInlineCode = false;
    this.currentInlineCode = '';
  }

  // Close the inline code and create the corresponding HTML span element
  private closeInlineCode() {
    const span = document.createElement('span');
    span.style.backgroundColor = 'skyblue'; // Style inline code
    span.innerText = this.currentInlineCode;
    this.parser.appendElement(span);
    this.reset();
  }
}

class HeadingElement implements MarkdownElement {
  private isHeading = false;
  private headingLevel = 0;
  private currentHeadingText = '';
  private parser: MarkdownParser;

  constructor(parser: MarkdownParser) {
    this.parser = parser;
  }

  type = 'heading';

  process(char: string): boolean {
    if (char === '#' && (!this.isHeading || this.currentHeadingText === '')) {
      this.isHeading = true;
      this.headingLevel++;
      return true;
    }
    if (this.isHeading) {
      if (char === ' ' && this.currentHeadingText === '') {
        return true;
      } else if (char === '\n' || char === '\r') {
        this.closeHeading();
        return true;
      } else {
        this.currentHeadingText += char;
        return true;
      }
    }
    return false;
  }

  isActive() {
    return this.isHeading;
  }

  reset() {
    this.isHeading = false;
    this.headingLevel = 0;
    this.currentHeadingText = '';
  }

  private closeHeading() {
    const heading = document.createElement(`h${this.headingLevel}`);
    heading.innerText = this.currentHeadingText.trim();
    this.parser.appendElement(heading);
    this.reset();
  }
}

class UnorderedListElement implements MarkdownElement {
  private isUnorderedList = false;
  private currentListItem = '';
  private parser: MarkdownParser;

  constructor(parser: MarkdownParser) {
    this.parser = parser;
  }

  type = 'unorderedList';

  process(char: string): boolean {
    if (char === '-' && this.parser.getLastSixChars().endsWith('\n-')) {
      this.isUnorderedList = true;
      return true;
    }
    if (this.isUnorderedList) {
      if (char === '\n') {
        this.closeListItem();
        return true;
      } else {
        this.currentListItem += char;
        return true;
      }
    }
    return false;
  }

  isActive() {
    return this.isUnorderedList;
  }

  reset() {
    this.isUnorderedList = false;
    this.currentListItem = '';
  }

  private closeListItem() {
    if (!this.parser.currentContainer) return;

    const li = document.createElement('li');
    li.innerText = this.currentListItem.trim();

    let ul = this.parser.currentContainer.lastElementChild;
    if (!ul || ul.tagName !== 'UL') {
      ul = document.createElement('ul');
      this.parser.appendElement(ul as HTMLElement);
    }

    (ul as HTMLElement).appendChild(li);
    this.reset();
  }
}

class EmphasisElement implements MarkdownElement {
  private isEmphasis = false;
  private emphasisType: 'italic' | 'bold' | null = null;
  private currentEmphasisText = '';
  private parser: MarkdownParser;

  constructor(parser: MarkdownParser) {
    this.parser = parser;
  }

  type = 'emphasis';

  process(char: string): boolean {
    const lastSixChars = this.parser.getLastSixChars();
    if (this.isEmphasis) {

      if (this.emphasisType === 'italic' && lastSixChars.endsWith('**')) {
        this.emphasisType = 'bold';
      }

      if (this.emphasisType === 'italic' && char === '*') {
        this.closeEmphasis();
        return true;
      } else if (this.emphasisType === 'bold' && this.currentEmphasisText.endsWith('*') && char === '*') {
        this.closeEmphasis();
        return true;
      }
      this.currentEmphasisText += char;
      return true;
    } else if (char === '*') {
      if (lastSixChars.endsWith('**')) {
        this.isEmphasis = true;
        this.emphasisType = 'bold';
        console.log('bold');
        this.currentEmphasisText = '*'; // Start with one '*' since the second '*' is the current char
        return true;
      } else if (lastSixChars.endsWith('*')) {
        this.isEmphasis = true;
        this.emphasisType = 'italic';
        console.log('italic');
        return true;
      }
    }
    return false;
  }

  isActive() {
    return this.isEmphasis;
  }

  reset() {
    this.isEmphasis = false;
    this.emphasisType = null;
    this.currentEmphasisText = '';
  }

  private closeEmphasis() {
    const span = document.createElement('span');
    span.style.fontStyle = this.emphasisType === 'italic' ? 'italic' : 'normal';
    span.style.fontWeight = this.emphasisType === 'bold' ? 'bold' : 'normal';

    // Adjust the slicing to remove the initial '*' for bold text
    const textToDisplay = this.emphasisType === 'bold'
      ? this.currentEmphasisText.slice(1, -1).trim() // Remove the leading '*' and trailing '**'
      : this.currentEmphasisText.slice(0, -1).trim(); // Remove the trailing '*'

    span.innerText = textToDisplay;
    this.parser.appendElement(span);
    this.reset();
  }
}
