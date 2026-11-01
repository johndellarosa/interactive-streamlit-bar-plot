# Publishing interactive-streamlit-bar-plot

Package: `interactive-streamlit-bar-plot` · prepared version: `0.5.0` · author: John Della Rosa · MIT.

## One-time account setup

1. Sign in to [PyPI](https://pypi.org/) and enable two-factor authentication if
   your account is not already configured.
2. Open [PyPI Publishing](https://pypi.org/manage/account/publishing/). Under
   **Add a new pending publisher**, select GitHub and enter:

   | Field | Value |
   | --- | --- |
   | PyPI project name | `interactive-streamlit-bar-plot` |
   | Owner | `johndellarosa` |
   | Repository name | `interactive-streamlit-bar-plot` |
   | Workflow name | `publish.yml` |
   | Environment name | `pypi` |

   Use just the workflow filename, not `.github/workflows/publish.yml`.
   If the project already exists under your account, add the same publisher
   through that project's **Manage → Publishing** page instead.
3. In the [GitHub repository environments](https://github.com/johndellarosa/interactive-streamlit-bar-plot/settings/environments),
   create an environment named `pypi`. You can require a reviewer here if your
   GitHub plan supports environment protection rules.

This setup lets the specified workflow publish the package using short-lived
credentials. No PyPI password or API token is stored in GitHub.
Pending publishers do not reserve package names; PyPI checks name availability
when the first upload occurs.

## Publish a release

1. Confirm `project.version` in `pyproject.toml` is an unused PyPI version.
   The current prepared version is `0.5.0`, so its release tag is `v0.5.0`.
   Update the README chart catalog and run the local checks below.
2. Commit and push the project, including all new chart modules, frontend assets,
   demos, tests and `.github/workflows/publish.yml`, to
   `johndellarosa/interactive-streamlit-bar-plot`.
3. Open [Create a GitHub release](https://github.com/johndellarosa/interactive-streamlit-bar-plot/releases/new).
   Create tag `v0.5.0` against the commit containing this package and workflow.
   Add a release title and notes, then publish the release.
4. Watch [GitHub Actions](https://github.com/johndellarosa/interactive-streamlit-bar-plot/actions/workflows/publish.yml).
   The build job verifies the tag, runs tests, builds both distributions, and
   checks metadata and packaged assets. The publish job uploads those artifacts
   to PyPI. Approve the `pypi` environment deployment if configured.
5. Confirm the version on [PyPI](https://pypi.org/project/interactive-streamlit-bar-plot/),
   then install in a fresh environment:

   ```powershell
   python -m pip install interactive-streamlit-bar-plot==0.4.0
   ```

   Verify the new public imports, for example:

   ```shell
   python -c "from streamlit_interactive_charts import waterfall_chart, bullet_chart, sequence_chart, ridgeline_chart"
   ```

The workflow only runs when a GitHub release is published. Ordinary commits and
pull requests do not publish packages. If the publisher settings are wrong,
correct them and rerun the failed publish job.

## Local release checks

```powershell
.venv\Scripts\python -m pip install -e '.[release]'
.venv\Scripts\python -m unittest discover -s tests -v
node --test tests/*.mjs
.venv\Scripts\python -m build --outdir dist/0.5.0
.venv\Scripts\python -m twine check --strict dist/0.5.0/*
```

Use a fresh output directory for each version so old artifacts are not included
in the local checks. The wheel must include both import namespaces, all fourteen
chart implementations, frontend JavaScript/CSS (including the shared axis and
distribution helpers), and the MIT license. The source archive also includes
the demo scripts and tests. CI checks the bundled assets before publishing.
The README is used as the PyPI project description; `twine check --strict`
validates its metadata and rendering markup.

Before later releases, increment `project.version` in `pyproject.toml` and create
the matching `v<version>` release tag. PyPI does not allow replacing an uploaded
file with the same filename; use a new version for package changes.

References: [creating a project through Trusted Publishing](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/)
and [publishing with GitHub Actions](https://docs.pypi.org/trusted-publishers/using-a-publisher/).
