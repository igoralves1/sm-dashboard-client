# sm-dashboard-client

## Claude AI Usage

This project uses Claude Code (AI assistant) for development.

### Retrieving saved plans

To continue work on a previously planned feature, tell Claude:

> "retrieve the hidroforte dashboard plan"

Claude will read `.claude/hidroforte-dashboard-plan.md` and resume from where we left off, including pending tasks, data mappings, and AWS resource names.

### AWS Profile

This project uses the `dev-sm` AWS profile (account `650254791912`, region `us-east-2`).  
Credentials are managed via SSO — run `aws sso login --profile dev-sm` if expired.  
The profile is auto-loaded when you `cd` into this directory (via direnv + `.envrc`).
