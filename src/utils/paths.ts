/** Relative path from the current page to a site-root asset (css, js, …). */
export function asset(rootPath: string, pathname: string): string {
  const target = rootPath.replace(/^\//, '');
  const prefix = prefixFrom(pathname);
  return prefix + target;
}

/** Relative path from the current page to another page (.html file). */
export function page(rootPath: string, pathname: string): string {
  const target = rootPath.replace(/^\//, '').replace(/\/$/, '');
  const prefix = prefixFrom(pathname);
  return prefix + target + '.html';
}

/** Relative path from the current page back to the home page. */
export function home(pathname: string): string {
  return prefixFrom(pathname) + 'index.html';
}

function prefixFrom(pathname: string): string {
  const clean = pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '');
  if (!clean || clean === 'index') return './';
  const segments = clean.split('/').filter(Boolean);
  // Last segment is the page name, not a folder (build format: 'file')
  const dirDepth = segments.length - 1;
  if (dirDepth <= 0) return './';
  return '../'.repeat(dirDepth);
}
