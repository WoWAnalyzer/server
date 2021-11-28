import request from 'helpers/request';

export async function fetchCommits(login) {
  // This will only get commits to master, but that should generally be sufficient.
  const url = `https://api.github.com/repos/WoWAnalyzer/WoWAnalyzer/commits?client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&author=${login}`;
  // eslint-disable-next-line no-return-await
  const jsonString = await request({
    url: url,
    headers: {
      'User-Agent': 'WoWAnalyzer.com API',
    },
    gzip: true, // using gzip is 80% quicker
  });
  return JSON.parse(jsonString);
}
function getMostRecentCommit(commits) {
  if (!commits || commits.length === 0) {
    return null;
  }
  return commits[0];
}
export async function fetchLastCommit(login) {
  const commits = await fetchCommits(login);
  return getMostRecentCommit(commits);
}
function getCommitDate(commit) {
  return new Date(commit.commit.committer.date);
}
export async function fetchGitHubLastCommitDate(login) {
  const lastCommit = await fetchLastCommit(login);
  if (!lastCommit) {
    return null;
  }
  return getCommitDate(lastCommit);
}

export async function refreshGitHubLastContribution(user) {
  console.log(
    `Refreshing GitHub data for ${user.data.name} (${user.gitHubId} - ${user.data.github.login})`,
  );
  const lastContribution = await fetchGitHubLastCommitDate(user.data.github.login);

  // We shouldn't have to wait for this update to finish, since it immediately updates the local object's data
  user.update({
    data: {
      ...user.data,
      github: {
        ...user.data.github,
        lastContribution,
        updatedAt: new Date(),
      },
    },
  });
}
