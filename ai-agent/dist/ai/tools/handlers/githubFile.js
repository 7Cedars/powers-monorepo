import { fetchUrl } from './fetchUrl.js';
export async function githubFile(owner, repo, filePath, ref = 'main', allowedDomains = ['raw.githubusercontent.com']) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
    return fetchUrl(url, allowedDomains);
}
