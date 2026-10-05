import { useContext, useEffect, useState } from "react";
import { initializeConfigFile, ConfigContext, loadConfig, getGraphqlWithAuth } from "./utils";
import {
  Image,
  Icon,
  Color,
  ActionPanel,
  Action,
  List,
  Keyboard,
  launchCommand,
  LaunchType,
  Toast,
  showToast,
} from "@raycast/api";

const ISSUE_COUNT = 50;

export default function Main() {
  initializeConfigFile();
  return (
    <ConfigContext.Provider value={loadConfig()}>
      <CombinedList />
    </ConfigContext.Provider>
  );
}

// CombinedList shows the configured shorthand users and repos along with the user-entered user prefix, if applicable
function CombinedList() {
  const config = useContext(ConfigContext);
  const [searchText, setSearchText] = useState("");
  const exactMatch = Object.entries(config.usersAndOrgs).some(([shorthand]) => shorthand == searchText);
  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering={true}
      searchBarPlaceholder="Shorthand or user..."
    >
      {config.isEmpty() && searchText.length == 0 && (
        <List.EmptyView
          title="No shorthand configured"
          description="Type a user or org name, or select 'Edit Configuration File' to configure shorthand for GitHub users, orgs, repos and more."
          icon={Icon.QuestionMark}
          actions={
            <ActionPanel>
              <Action
                title="Edit Configuration File"
                icon={Icon.Gear}
                onAction={async () => {
                  await launchCommand({ name: "configure", type: LaunchType.UserInitiated });
                }}
                shortcut={Keyboard.Shortcut.Common.Edit}
              />
            </ActionPanel>
          }
        />
      )}
      {Object.entries(config.multi).map(([shorthand, { name, repos }]) => (
        <Multi key={`multi-${shorthand}`} shorthand={shorthand} name={name} repos={repos} />
      ))}
      {Object.entries(config.repos).map(([shorthand, full]) => (
        <Repo key={`repo-${shorthand}`} repo={full} shorthand={shorthand} />
      ))}
      {Object.entries(config.users).map(([shorthand, full]) => (
        <User key={`user-${shorthand}`} user={full} shorthand={shorthand} />
      ))}
      {Object.entries(config.orgs).map(([shorthand, full]) => (
        <User key={`org-${shorthand}`} user={full} shorthand={shorthand} org />
      ))}
      {!exactMatch && searchText.length > 0 && !searchText.includes("/") && !searchText.includes(" ") && (
        <User key={`search-${searchText}`} user={searchText} />
      )}
    </List>
  );
}

// RepoList shows the repos for a given owner along with a user-entered repo, if applicable
function RepoList({ owner }: { owner: string }) {
  const config = useContext(ConfigContext);
  const [searchText, setSearchText] = useState("");
  const filtered = Object.entries(config.repos).filter(([, full]) => {
    return full.split("/")[0] == owner;
  });
  const exactMatch = Object.entries(filtered).some(([, [shorthand]]) => shorthand == searchText);
  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering={true}
      searchBarPlaceholder={`Select repository in ${owner}/...`}
      navigationTitle={`Repositories in ${owner}/...`}
    >
      {filtered.length == 0 && searchText.length == 0 && (
        <List.EmptyView
          title={`No shorthand under ${owner}/... configured`}
          description="Type a user or org name, or select 'Edit Configuration File' to configure shorthand for GitHub users, orgs, repos and more."
          icon={Icon.QuestionMark}
          actions={
            <ActionPanel>
              <Action
                title="Edit Configuration File"
                icon={Icon.Gear}
                onAction={async () => {
                  await launchCommand({ name: "configure", type: LaunchType.UserInitiated });
                }}
                shortcut={Keyboard.Shortcut.Common.Edit}
              />
            </ActionPanel>
          }
        />
      )}
      {searchText.length > 0 && !exactMatch && (
        <Repo key={`repo-search-${searchText}`} repo={`${owner}/${searchText}`} />
      )}
      {filtered.map(([shorthand, full]) => (
        <Repo key={`repo-${shorthand}`} repo={full} shorthand={shorthand} />
      ))}
    </List>
  );
}

interface IssueOrPr {
  title: string;
  number: number;
  url: string;
  state: string;
  stateReason?: string;
  isDraft?: boolean;
  __typename: "Issue" | "PullRequest";
  repository: {
    nameWithOwner: string;
  };
}

function issueReference(issue: IssueOrPr) {
  return `${issue.repository.nameWithOwner}#${issue.number}`;
}

function iconForIssue(issue: IssueOrPr): Image {
  if (issue.__typename == "PullRequest") {
    switch (issue.state) {
      case "OPEN":
        return issue.isDraft
          ? { source: "git-pull-request-draft.png", tintColor: Color.SecondaryText }
          : { source: "git-pull-request.png", tintColor: Color.Green };
      case "CLOSED":
        return { source: "git-pull-request-closed.png", tintColor: Color.Red };
      case "MERGED":
        return { source: "git-merge.png", tintColor: Color.Purple };
      default:
        return { source: Icon.QuestionMark, tintColor: Color.Red };
    }
  }
  switch (issue.state) {
    case "OPEN":
      return { source: "issue-opened.png", tintColor: Color.Green };
    case "CLOSED":
      return issue.stateReason == "NOT_PLANNED"
        ? { source: "skip.png", tintColor: Color.SecondaryText }
        : { source: "issue-closed.png", tintColor: Color.Red };
    default:
      return { source: Icon.QuestionMark, tintColor: Color.Red };
  }
}

const ISSUE_QUERY = `query ($searchText: String!) {
  search(query: $searchText, type: ISSUE, first: ${ISSUE_COUNT}) {
    nodes {
      ... on Issue {
        number
        title
        url
        state
        stateReason
        __typename
        repository {
          nameWithOwner
        }
      }
      ... on PullRequest {
        number
        title
        url
        isDraft
        state
        __typename
        repository {
          nameWithOwner
        }
      }
    }
  }
}`;

function IssueSearch({ scope, description }: { scope: string; description: string }) {
  const graphqlWithAuth = getGraphqlWithAuth();
  const config = useContext(ConfigContext);
  const [searchText, setSearchText] = useState(config.defaultScope.length > 0 ? `${config.defaultScope} ` : "");
  const [issues, setIssues] = useState([] as IssueOrPr[]);
  const [isLoading, setIsLoading] = useState(false);
  const [cache, setCache] = useState({} as { [key: string]: IssueOrPr[] });

  useEffect(() => {
    const fetchIssues = async () => {
      setIsLoading(true);
      if (cache[searchText]) {
        setIssues(cache[searchText]);
        setIsLoading(false);
        return;
      }
      try {
        const result = await graphqlWithAuth<{
          search: { nodes: IssueOrPr[] };
        }>(ISSUE_QUERY, {
          searchText: `${scope} ${searchText}`,
        });
        setCache((prevCache) => ({ ...prevCache, [searchText]: result.search.nodes }));
        setIssues(result.search.nodes);
      } catch (error) {
        showToast({ style: Toast.Style.Failure, title: "Failed to search issues", message: (error as Error).message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchIssues();
  }, [searchText]);

  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle={true}
      isLoading={isLoading}
      searchBarPlaceholder={`Search issues in ${description}`}
      navigationTitle={`Search issues in ${description}`}
    >
      {issues.length == 0 && searchText.length == 0 && (
        <List.EmptyView
          title="No issues found"
          description={`If you're not seeing issues listed here with an empty search query,\nmake sure the API token you're using has 'repo' scope and has\nSSO authorization (if applicable) for ${description}.`}
          icon={Icon.QuestionMark}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="View Search on GitHub"
                url={`https://github.com/issues?q=${encodeURIComponent(scope)}`}
              />
            </ActionPanel>
          }
        />
      )}
      {issues.map((issue) => (
        <Issue key={issueReference(issue)} issue={issue} search={`${scope} ${searchText}`} />
      ))}
    </List>
  );
}

interface Branch {
  name: string;
  target: {
    committedDate: string;
    author: { name: string };
  };
}

const BRANCH_PAGE_LIMIT = 10;

// GitHub can't sort branches by commit date, so fetch them all and sort locally.
const BRANCH_QUERY = `query ($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      name
    }
    refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
        target {
          ... on Commit {
            committedDate
            author {
              name
            }
          }
        }
      }
    }
  }
}`;

function BranchList({ repo }: { repo: string }) {
  const [branches, setBranches] = useState([] as Branch[]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBranches = async () => {
      const graphqlWithAuth = getGraphqlWithAuth();
      const [owner, name] = repo.split("/");
      try {
        const all: Branch[] = [];
        let defaultBranch: string | undefined;
        let cursor: string | null = null;
        for (let page = 0; page < BRANCH_PAGE_LIMIT; page++) {
          const result: {
            repository: {
              defaultBranchRef: { name: string } | null;
              refs: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: Branch[] };
            };
          } = await graphqlWithAuth(BRANCH_QUERY, { owner, name, cursor });
          defaultBranch = result.repository.defaultBranchRef?.name;
          all.push(...result.repository.refs.nodes);
          if (!result.repository.refs.pageInfo.hasNextPage) break;
          cursor = result.repository.refs.pageInfo.endCursor;
        }
        setBranches(
          all
            .filter((branch) => branch.name != defaultBranch)
            .sort((a, b) => b.target.committedDate.localeCompare(a.target.committedDate)),
        );
      } catch (error) {
        showToast({ style: Toast.Style.Failure, title: "Failed to list branches", message: (error as Error).message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBranches();
  }, [repo]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Filter branches in ${repo}`}
      navigationTitle={`Branches in ${repo}`}
    >
      {branches.map((branch) => (
        <BranchItem key={branch.name} repo={repo} branch={branch} />
      ))}
    </List>
  );
}

function BranchItem({ repo, branch }: { repo: string; branch: Branch }) {
  const path = branch.name.split("/").map(encodeURIComponent).join("/");
  return (
    <List.Item
      title={branch.name}
      icon={{ source: "git-branch.png", tintColor: Color.PrimaryText }}
      accessories={[{ text: branch.target.author.name }, { date: new Date(branch.target.committedDate) }]}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            title="Compare and Open PR on GitHub"
            url={`https://github.com/${repo}/compare/${path}?expand=1`}
            icon={{ source: "git-pull-request.png", tintColor: Color.PrimaryText }}
          />
          <Action.OpenInBrowser
            title="Open Branch on GitHub"
            url={`https://github.com/${repo}/tree/${path}`}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
          <Action.CopyToClipboard
            title="Copy Branch Name"
            content={branch.name}
            shortcut={Keyboard.Shortcut.Common.CopyName}
          />
        </ActionPanel>
      }
    />
  );
}

function User({ user, shorthand, org }: { user: string; shorthand?: string; org?: boolean }) {
  return (
    <List.Item
      title={shorthand ? `${shorthand}/` : user}
      subtitle={`${user}/...`}
      icon={{ source: org ? "organization.png" : "person.png", tintColor: Color.PrimaryText }}
      actions={
        <ActionPanel>
          <Action.Push
            title="Search Repositories"
            icon={Icon.MagnifyingGlass}
            target={
              <ConfigContext.Provider value={useContext(ConfigContext)}>
                <RepoList owner={user} />
              </ConfigContext.Provider>
            }
          />
          <Action.Push
            title="Search Issues"
            icon={Icon.MagnifyingGlass}
            target={
              <ConfigContext.Provider value={useContext(ConfigContext)}>
                <IssueSearch scope={org ? `org:${user}` : `user:${user}`} description={`${user}/`} />
              </ConfigContext.Provider>
            }
            shortcut={{ modifiers: ["cmd"], key: "i" }}
          />
        </ActionPanel>
      }
    />
  );
}

function Repo({ repo, shorthand }: { repo: string; shorthand?: string }) {
  const url = `https://github.com/${repo}`;
  return (
    <List.Item
      title={shorthand ? shorthand : repo}
      subtitle={shorthand ? repo : undefined}
      icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
      keywords={repo.split("/")}
      actions={
        <ActionPanel>
          <Action.Push
            title="Search Issues"
            icon={Icon.MagnifyingGlass}
            target={
              <ConfigContext.Provider value={useContext(ConfigContext)}>
                <IssueSearch scope={`repo:${repo}`} description={`${repo}`} />
              </ConfigContext.Provider>
            }
          />
          <Action.Push
            title="List Branches"
            icon={{ source: "git-branch.png", tintColor: Color.PrimaryText }}
            target={<BranchList repo={repo} />}
            shortcut={{ modifiers: ["cmd"], key: "b" }}
          />
          <Action.OpenInBrowser
            title="Open Repo on GitHub"
            url={url}
            icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
          <Action.OpenInBrowser
            title="Open Issues on GitHub"
            url={`${url}/issues`}
            icon={{ source: "issue-opened.png", tintColor: Color.PrimaryText }}
            shortcut={{ modifiers: ["cmd"], key: "i" }}
          />
          <Action.OpenInBrowser
            title="Open PRs on GitHub"
            url={`${url}/pulls`}
            icon={{ source: "git-pull-request.png", tintColor: Color.PrimaryText }}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          <Action.OpenInBrowser
            title="Create New Issue on GitHub"
            url={`${url}/issues/new`}
            icon={Icon.PlusCircle}
            shortcut={Keyboard.Shortcut.Common.New}
          />
          <Action.CopyToClipboard title="Copy URL" content={url} shortcut={Keyboard.Shortcut.Common.Copy} />
        </ActionPanel>
      }
    />
  );
}

function Multi({ shorthand, name, repos }: { shorthand: string; name: string; repos: string[] }) {
  return (
    <List.Item
      title={shorthand}
      subtitle={name}
      keywords={[name]}
      icon={{ source: "repo-clone.png", tintColor: Color.PrimaryText }}
      actions={
        <ActionPanel>
          <Action.Push
            title="Search Issues"
            icon={Icon.MagnifyingGlass}
            target={
              <ConfigContext.Provider value={useContext(ConfigContext)}>
                <IssueSearch scope={`repo:${repos.join(" repo:")}`} description={`${name}`} />
              </ConfigContext.Provider>
            }
          />
        </ActionPanel>
      }
    />
  );
}

function Issue({ issue, search }: { issue: IssueOrPr; search: string }) {
  return (
    <List.Item
      title={issue.title}
      icon={iconForIssue(issue)}
      accessories={[{ text: issueReference(issue) }]}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open on GitHub" url={issue.url} />
          <Action.CopyToClipboard title="Copy URL" content={issue.url} shortcut={Keyboard.Shortcut.Common.Copy} />
          <Action.OpenInBrowser
            title="View Search on GitHub"
            url={`https://github.com/issues?q=${encodeURIComponent(search)}`}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
        </ActionPanel>
      }
    />
  );
}
