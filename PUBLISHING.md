# TemporalLayr PyPI Publishing Guide

TemporalLayr utilizes [Trusted Publishing (OIDC)](https://docs.pypi.org/trusted-publishers/) to securely upload Python distributions to PyPI strictly through automated CI/CD runs avoiding static API credentials gracefully.

## 1. Required Configuration

To authorize the `.github/workflows/publish.yml` CI routine, you must link the GitHub Repository to the matching PyPI Project properly.

### Create the PyPI Project (First Time)
1. Register or Log in to PyPI via [pypi.org](https://pypi.org).
2. Go to **Account settings** > **Publishing**.
3. Scroll to "Add a new pending publisher".
4. Fill in:
   - **PyPI Project Name**: `temporallayr`
   - **Owner**: `CodeWizarz` 
   - **Repository Name**: `Temporallayr-Powerhouse`
   - **Workflow name**: `publish.yml`
   - **Environment name**: `pypi`

### Setting up the GitHub Environment
1. In the GitHub Repository, go to **Settings** > **Environments**.
2. Create or verify an environment explicitly named `pypi`.
3. *(Optional)* You can secure this Environment with "Required reviewers" to prevent rogue deployments. 

## 2. Triggering a Release Deployment
The CI publish pipeline strictly listens for the `release: types: [published]` GitHub constraint.

To cut a new version:
1. Ensure `pyproject.toml`'s version reflects the target publish build.
2. Draft a new Release on GitHub.
3. Target the `main` branch, define the release Tag (`vX.Y.Z`).
4. Select **Publish release**.

The `Publish to PyPI` Actions workflow will spawn natively, execute `python -m build`, and authenticate the wheel upload targeting the PyPI Registry flawlessly.
