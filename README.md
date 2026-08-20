# Omarchy Backlog Inbox

An experimental Omarchy Quattro bar widget that shows issues assigned to the
current Backlog user. Authentication and API access are delegated to the
[Bee Backlog CLI](https://github.com/nulab/bee).

This is an unofficial personal project by Gaku Wada. It is not an official
Nulab product and is not covered by Nulab support.

## Features

- Shows `BL <count>` in the bar (`+` means the result may be truncated).
- Opens a configurable list of assigned issues (10 by default, up to 50).
- Pages through fetched issues with the left/right keys or footer arrows.
- Orders issues by due date, earliest first, with undated issues last.
- Highlights overdue and due-today issues and labels undated issues.
- Opens the selected issue in the browser.
- Refreshes on open, every five minutes, or with `R`/middle-click.
- Excludes status ID `4` and statuses named `完了`, `Closed`, or `Completed`.

## Requirements

Install Bee and authenticate it before enabling this plugin:

```bash
npm install -g @nulab/bee
bee auth login
bee auth status
```

Bee supports both API-key and OAuth authentication. For OAuth, register a
Backlog OAuth application with `http://localhost:5033/callback`, then run:

```bash
export BACKLOG_OAUTH_CLIENT_ID="..."
export BACKLOG_OAUTH_CLIENT_SECRET="..."
bee auth login --method oauth
```

Confirm that the exact read-only command used by the plugin works:

```bash
bee issue list --assignee @me --sort dueDate --order asc --count 100 \
  --json issueKey,summary,status,priority,dueDate
```

If Bee was installed through nvm, `omarchy-shell` may not inherit the shell
configuration that adds Bee to `PATH`. Find its absolute path:

```bash
which bee
```

Then set **Bee executable path** in the plugin settings, for example
`/home/you/.nvm/versions/node/v24.11.1/bin/bee`. Leaving the setting blank uses
`bee` from the GUI session's `PATH`.

The plugin never reads Bee's credentials.

## Install on Omarchy Quattro

Install directly from GitHub:

```bash
omarchy plugin add https://github.com/wdgk/omarchy-backlog-inbox.git --enable
```

## Settings

| Setting | Default | Description |
| --- | ---: | --- |
| Refresh interval | 300 seconds | Between 60 and 3,600 seconds |
| Issues to display | 10 | Between 1 and 50 rows |
| Backlog space hostname | Active Bee space | Optional hostname for multi-space setups |
| Bee executable path | `bee` from `PATH` | Optional absolute path, useful with nvm |

## Known limitation

Bee returns at most 100 issues for the command used by this MVP. The plugin
then removes completed issues locally. When Bee returns exactly 100 records,
the bar adds `+` to the count and the panel warns that older open issues may be
omitted. Custom workflow statuses that represent completion but have another
ID and name cannot be identified reliably by this version.

## Security note

Omarchy plugins run as unsandboxed code inside `omarchy-shell`. Review plugins
before enabling them. This plugin only runs two fixed Bee commands:

```text
bee issue list --assignee @me --sort dueDate --order asc --count 100 --json ...
bee browse <issue-key>
```

The plugin never reads Bee's credential files and does not store credentials.
Avoid publishing screenshots containing private issue data.
