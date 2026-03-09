# Contributing to TemporalLayr

Thank you for your interest in contributing to TemporalLayr!

## Ways to Contribute

You can contribute in many ways:
- **Code** - Fix bugs, add features, improve performance
- **Documentation** - Improve docs, fix typos, add examples
- **Issues** - Report bugs, suggest features, ask questions
- **Testing** - Test new features, write integration tests
- **Reviews** - Review pull requests

## Development Setup

```bash
# Clone the repository
git clone https://github.com/CodeWizarz/Temporallayr-Powerhouse
cd Temporallayr-Powerhouse

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[all,dev]"

# Install pre-commit hooks
pre-commit install
```

## Code Style

We use industry-standard Python tooling:

- **Black** for formatting (line-length: 100)
- **Ruff** for linting
- **MyPy** for type checking

Run before committing:
```bash
ruff --fix .
black .
mypy src
```

## Testing

Run the test suite:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=temporallayr --cov-report=html
```

Integration tests require external services (Redis, ClickHouse, Postgres):
```bash
TEMPORALLAYR_RUN_EXTERNAL_TESTS=1 pytest
```

## Project Structure

```
src/temporallayr/
├── core/           # Core execution engine
├── server/         # FastAPI server
├── sdk/            # SDK for agent instrumentation
├── models/         # Pydantic models
├── analytics/      # ClickHouse analytics
└── ...
```

## Pull Request Process

1. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes** following our code style guidelines

3. **Run tests and linters**:
   ```bash
   ruff --fix .
   black .
   mypy src
   pytest
   ```

4. **Commit with clear messages**:
   - Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
   - Reference issues: `Closes #123`

5. **Create a Pull Request**:
   - Fill out the PR template
   - Include changelog entry
   - Link related issues

## Commit Message Format

We follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks
- `ci:` CI/CD changes

Example:
```
feat(analytics): add latency percentile queries

Add p50, p95, p99 latency queries for span monitoring.

Closes #42
```

## Security

If you find a security vulnerability, please report it according to our [Security Policy](SECURITY.md).

## License

By contributing to TemporalLayr, you agree that your contributions will be licensed under the MIT License.

## Getting Help

- **Discord**: [Join our community](https://discord.gg/temporallayr)
- **GitHub Discussions**: Ask questions
- **Issues**: Report bugs

---

*Last updated: March 2026*
