import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class GitSource {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'graviton-converter');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Clone a GitHub repository to a temporary directory.
   */
  async clone(repoUrl: string, branch?: string): Promise<string> {
    const repoName = this.extractRepoName(repoUrl);
    const clonePath = path.join(this.tempDir, `${repoName}-${Date.now()}`);

    const git: SimpleGit = simpleGit();
    const options: string[] = ['--depth', '1']; // Shallow clone for speed

    if (branch) {
      options.push('--branch', branch);
    }

    await git.clone(repoUrl, clonePath, options);
    return clonePath;
  }

  /**
   * Clean up a cloned repository.
   */
  cleanup(clonePath: string): void {
    try {
      fs.rmSync(clonePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  private extractRepoName(url: string): string {
    const match = url.match(/\/([^\/]+?)(\.git)?$/);
    return match ? match[1] : 'repo';
  }
}
