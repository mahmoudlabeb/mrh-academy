import * as fs from 'fs';
import * as path from 'path';

describe('B5 Bug Condition — Wrong TypeORM Version Range', () => {
  it('should have "typeorm" dependency pinned to exact version (no caret prefix)', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const typeormDep = pkg.dependencies?.typeorm;

    expect(typeormDep).toBeDefined();
    expect(typeormDep).not.toMatch(/^\^/);
    expect(typeormDep).not.toMatch(/^~/);
    expect(typeormDep).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
