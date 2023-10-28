import axios from "axios";
import { Strategy as GitHubStrategy } from "passport-github";
import User from "../../models/User";

async function fetchCommits(login: string) {
  // This will only get commits to master, but that should generally be sufficient.
  const url = `https://api.github.com/repos/WoWAnalyzer/WoWAnalyzer/commits?client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&author=${login}`;
  // eslint-disable-next-line no-return-await
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "WoWAnalyzer.com API",
    },
  });
  return response.data;
}
function getMostRecentCommit(commits: { commit: Commit }[]) {
  if (!commits || commits.length === 0) {
    return null;
  }
  return commits[0];
}

async function fetchLastCommit(login: string) {
  const commits = await fetchCommits(login);
  return getMostRecentCommit(commits);
}

type Commit = {
  committer: {
    date: string;
  };
};

function getCommitDate(commit: { commit: Commit }) {
  return new Date(commit.commit.committer.date);
}

async function fetchGitHubLastCommitDate(login: string) {
  const lastCommit = await fetchLastCommit(login);
  if (!lastCommit) {
    return null;
  }
  return getCommitDate(lastCommit);
}

export async function refreshGitHubLastContribution(user: User) {
  if (!user.data.github) {
    return;
  }
  console.log(
    `Refreshing GitHub data for ${user.data.name} (${user.gitHubId} - ${user.data.github.login})`,
  );
  const lastContribution = await fetchGitHubLastCommitDate(
    user.data.github.login,
  );

  // We shouldn't have to wait for this update to finish, since it immediately updates the local object's data
  user.update({
    data: {
      ...user.data,
      github: {
        ...user.data.github,
        lastContribution: lastContribution?.getTime() ?? null,
        updatedAt: Date.now(),
      },
    },
  });
}

const github: GitHubStrategy | undefined =
  process.env.GITHUB_CLIENT_ID &&
  process.env.GITHUB_CLIENT_SECRET &&
  process.env.GITHUB_CALLBACK_URL
    ? new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: process.env.GITHUB_CALLBACK_URL,
        },
        async function (accessToken, refreshToken, originalProfile, done) {
          // The passport strategy removes data we need from `profile`, so re-extract the raw data received
          const profile = originalProfile._json as unknown as {
            id: number;
            login: string;
            name?: string;
            avatar_url: string;
          };

          const id = profile.id;
          const login = profile.login;
          const name = profile.name || login; // name is optional on GitHub

          if (process.env.NODE_ENV === "development") {
            console.log("GitHub login:", profile);
          } else {
            console.log(`GitHub login by ${name} (${id} - ${login})`);
          }

          const lastContribution = await fetchGitHubLastCommitDate(login);

          const user = await User.create({
            gitHubId: id,
            data: {
              name,
              avatar: profile.avatar_url,
              github: {
                login,
                lastContribution: lastContribution?.getTime() ?? null,
                updatedAt: Date.now(),
                accessToken,
                refreshToken,
              },
            },
          });

          done(null, user);
        },
      )
    : undefined;

export default github;
