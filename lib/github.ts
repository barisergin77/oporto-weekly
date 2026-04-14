// Commits files to the GitHub repo via the Git Data API (atomic multi-file commits).
// Used by the cron route to archive newsletters since Vercel's filesystem is read-only.

const REPO_OWNER = 'barisergin77';
const REPO_NAME = 'oporto-weekly';
const BRANCH = 'main';

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var is not set');
  return token;
}

async function githubApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

// Create a blob (file content) in the repo
async function createBlob(content: string, encoding: 'utf-8' | 'base64' = 'utf-8'): Promise<string> {
  const data = await githubApi('/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content, encoding }),
  });
  return data.sha;
}

// Get the SHA of the latest commit on the branch
async function getHeadSha(): Promise<string> {
  const data = await githubApi(`/git/ref/heads/${BRANCH}`);
  return data.object.sha;
}

// Get the tree SHA of a commit
async function getCommitTreeSha(commitSha: string): Promise<string> {
  const data = await githubApi(`/git/commits/${commitSha}`);
  return data.tree.sha;
}

// Get an existing file's content from the repo
export async function getFileContent(filePath: string): Promise<string | null> {
  try {
    const data = await githubApi(`/contents/${filePath}?ref=${BRANCH}`);
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

interface FileChange {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

/**
 * Commits multiple files atomically to the repo.
 * Uses the Git Data API: create blobs → create tree → create commit → update ref.
 */
export async function commitFiles(
  files: FileChange[],
  message: string,
  retries = 3
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      // Small delay to account for GitHub eventual consistency if a very recent commit just landed
      if (i > 0) {
        console.log(`[commitFiles] Retrying commit (attempt ${i + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, i * 2000)); // Exponential backoff
      }

      // 1. Get current HEAD
      const headSha = await getHeadSha();
      const baseTreeSha = await getCommitTreeSha(headSha);

      // 2. Create blobs for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const blobSha = await createBlob(file.content, file.encoding ?? 'utf-8');
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobSha,
      };
    })
  );

  // 3. Create a new tree
  const tree = await githubApi('/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });

  // 4. Create a new commit
  const commit = await githubApi('/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [headSha],
    }),
  });

  // 5. Update the branch ref
  await githubApi(`/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });

  return commit.sha;
    } catch (err: any) {
      if (err.message && err.message.includes('sha_invalid') && i < retries - 1) {
        console.warn(`[commitFiles] Encountered 'sha_invalid' error, retrying: ${err.message}`);
        // Continue to next loop iteration for retry
      } else {
        throw err; // Re-throw if not a 'sha_invalid' error or out of retries
      }
    }
  }
  throw new Error(`Failed to commit files after ${retries} attempts.`);
}

export interface NewsletterMeta {
  slug: string;
  title: string;
  weekRange: string;
  sentAt: string;
  description: string;
}

/**
 * Archives a newsletter edition by committing the HTML file and updating
 * the JSON index via the GitHub API. Works on Vercel's read-only filesystem.
 */
export async function archiveViaGitHub(
  meta: NewsletterMeta,
  html: string,
  indexFile: 'newsletters.json' | 'newsletters-pt.json' = 'newsletters.json'
): Promise<string> {
  // Read the current index from the repo
  const currentIndex = await getFileContent(`data/${indexFile}`);
  const existing: NewsletterMeta[] = currentIndex ? JSON.parse(currentIndex) : [];
  const filtered = existing.filter((e) => e.slug !== meta.slug);
  const updatedIndex = JSON.stringify([meta, ...filtered], null, 2);

  // Commit both the HTML file and updated index atomically
  const commitSha = await commitFiles(
    [
      { path: `public/newsletters/${meta.slug}.html`, content: html },
      { path: `data/${indexFile}`, content: updatedIndex },
    ],
    `chore: archive ${meta.slug} edition`
  );

  console.log(`[github] Committed ${meta.slug} → ${commitSha.slice(0, 7)}`);
  return commitSha;
}
