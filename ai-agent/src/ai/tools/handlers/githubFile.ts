import { fetchUrl } from './fetchUrl.js';

export async function githubFile(
  owner: string,
  repo: string,
  filePath: string,
  ref = 'main',
  allowedDomains: string[] = ['raw.githubusercontent.com']
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
  return fetchUrl(url, allowedDomains);
}
