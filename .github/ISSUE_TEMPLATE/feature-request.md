---
name: Feature request
description: Suggest a new feature or enhancement
labels: enhancement
body:
  - type: markdown
    attributes:
      value: |
        Thanks for your feature request! Please fill out the template below.
  - type: textarea
    attributes:
      label: Feature description
      description: A clear and concise description of what the feature is.
    validations:
      required: true
  - type: textarea
    attributes:
      label: Motivation
      description: |
        Why is this feature needed? What problem does it solve?
        Is there a workaround currently?
    validations:
      required: true
  - type: textarea
    attributes:
      label: Proposed solution
      description: |
        Describe your proposed solution. Include API design if applicable.
  - type: textarea
    attributes:
      label: Alternatives
      description: |
        Describe any alternative solutions you've considered.
  - type: dropdown
    attributes:
      label: Priority
      description: How important is this feature?
      options:
        - Critical - blocker for production
        - High - important for production
        - Medium - nice to have
        - Low - can wait
  - type: textarea
    attributes:
      label: Additional context
      description: Add any other context or screenshots about the feature request.
