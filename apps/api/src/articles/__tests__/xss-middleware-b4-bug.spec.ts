import { XssCleanMiddleware } from '../../common/xss-clean.middleware';

describe('B4 Bug Condition — XSS Middleware Strips HTML', () => {
  let middleware: XssCleanMiddleware;

  beforeEach(() => {
    middleware = new XssCleanMiddleware();
  });

  it('should strip < and > from rich-text content, leaving non-tag characters intact', () => {
    const req = {
      body: { content: '<strong>bold</strong>' },
    } as any;
    const next = jest.fn();

    middleware.use(req, {} as any, next);

    // <strong>bold</strong> -> strip < and > -> strongbold/strong
    // The / and text content remain; only angle brackets are removed
    expect(req.body.content).toBe('strongbold/strong');
  });

  it('should strip < and > from plain-text fields too (global scope)', () => {
    const req = {
      body: { title: 'Test <title>' },
    } as any;
    const next = jest.fn();

    middleware.use(req, {} as any, next);

    expect(req.body.title).toBe('Test title');
  });

  it('should strip < and > from nested objects', () => {
    const req = {
      body: { nested: { value: '<script>evil</script>' } },
    } as any;
    const next = jest.fn();

    middleware.use(req, {} as any, next);

    expect(req.body.nested.value).toBe('scriptevil/script');
  });
});
