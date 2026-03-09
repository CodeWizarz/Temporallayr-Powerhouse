---
name: Documentation issue
description: Report missing or incorrect documentation
labels: documentation
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a documentation issue!
  - type: textarea
    attributes:
      label: Page or section
      description: Which documentation page or section needs improvement?
    validations:
      required: true
  - type: textarea
    attributes:
      label: Issue description
      description: Describe what's wrong or missing.
    validations:
      required: true
  - type: textarea
    attributes:
      label: Suggested improvement
      description: How would you improve this documentation?
