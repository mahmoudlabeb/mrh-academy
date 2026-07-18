import { XssCleanMiddleware } from '../../common/xss-clean.middleware';

describe('B4 Bug Condition — XSS Middleware Strips HTML', () => {
  let middleware: XssCleanMiddleware;

  beforeEach(() => {
    middleware = new XssCleanMiddleware();
  });

  it('should strip all HTML tags from rich-text content using sanitize-html', () => {
    const req = {
      body: { content: '<strong>bold</strong>' },
    } as any;
    const next = jest.fn();

    middleware.use(req, {} as any, next);

    // sanitize-html removes tags entirely, leaving only text content
    expect(req.body.content).toBe('bold');
  });

  it('should strip partial HTML from plain-text fields too (global scope)', () => {
    const req = {
      body: { title: 'Test <title>' },
    } as any;
    const next = jest.fn();

    middleware.use(req, {} as any, next);

    // <title> is treated as a tag by sanitize-html and stripped; .trim() removes trailing space
    expect(req.body.title).toBe('Test');
  });

  it('should strip all HTML tags from nested objects', () => {
    const req = {
      body: { nested: { value: '<script>evil</script>' } },
    } as any;
    const next = jest.fn();

    middleware.use(req, {} as any, next);

    // script tags are stripped entirely, leaving no content
    expect(req.body.nested.value).toBe('');
  });
});
