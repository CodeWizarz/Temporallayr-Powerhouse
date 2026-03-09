---
name: Question
description: Ask a question or get help
labels: question
body:
  - type: markdown
    attributes:
      value: |
        Thanks for your question! We'll try to answer as quickly as possible.
  - type: textarea
    attributes:
      label: Your question
      description: Describe what you'd like to know.
    validations:
      required: true
  - type: input
    attributes:
      label: Version
      description: Which version of TemporalLayr are you using?
      placeholder: e.g., 0.2.0
  - type: textarea
    attributes:
      label: Context
      description: |
        What are you trying to achieve? What have you already tried?
  - type: textarea
    attributes:
      label: Additional context
      description: Add any other relevant context.
