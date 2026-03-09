---
name: Bug report
about: Report something that isn't working as expected
labels: bug
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report!
  - type: textarea
    attributes:
      label: Describe the bug
      description: A clear and concise description of what the bug is.
    validations:
      required: true
  - type: textarea
    attributes:
      label: To Reproduce
      description: |
        Steps to reproduce the behavior:
        1. Go to '...'
        2. Click on '....'
        3. See error
    validations:
      required: true
  - type: input
    attributes:
      label: Version
      description: Which version of TemporalLayr are you using?
      placeholder: e.g., 0.2.0
  - type: dropdown
    attributes:
      label: Deployment
      description: How are you running TemporalLayr?
      options:
        - Docker
        - pip install
        - Kubernetes
        - From source
        - Other
  - type: textarea
    attributes:
      label: Expected behavior
      description: A clear description of what you expected to happen.
  - type: textarea
    attributes:
      label: Screenshots
      description: If applicable, add screenshots to help explain your problem.
  - type: textarea
    attributes:
      label: Logs
      description: |
        Please include any relevant log output. Use ``` to format.
  - type: textarea
    attributes:
      label: Additional context
      description: Add any other context about the problem here.
