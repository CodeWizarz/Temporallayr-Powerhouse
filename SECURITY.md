# TemporalLayr Security Vulnerability Response Policy

## Security Change Log and Support

Details regarding security fixes are publicly reported in our [security changelog](https://temporallayr.com/docs/whats-new/security-changelog/). A summary of known security vulnerabilities is shown at the bottom of this page.

Vulnerability notifications pre-release or during embargo periods are available to enterprise support customers registered for vulnerability alerts. Refer to our [Embargo Policy](#embargo-policy) below.

The following versions of TemporalLayr server are currently supported with security updates:

| Version | Supported |
|:-|:-|
| 0.3.x | ✅ |
| 0.2.x | ✅ |
| 0.1.x | ❌ |

## Reporting a Vulnerability

We're extremely grateful for security researchers and users that report vulnerabilities to the TemporalLayr Open Source Community. All reports are thoroughly investigated by developers.

To report a potential vulnerability in TemporalLayr please send the details through our email: **security@temporallayr.com**

### When Should I Report a Vulnerability?

- You think you discovered a potential security vulnerability in TemporalLayr
- You are unsure how a vulnerability affects TemporalLayr

### When Should I NOT Report a Vulnerability?

- You need help tuning TemporalLayr components for security
- You need help applying security related updates
- Your issue is not security related

## Security Vulnerability Response

Each report is acknowledged and analyzed by TemporalLayr maintainers within 5 business days.
As the security issue moves from triage, to identified fix, to release planning we will keep the reporter updated.

## Public Disclosure Timing

A public disclosure date is negotiated by the TemporalLayr maintainers and the bug submitter. We prefer to fully disclose the bug as soon as possible once a user mitigation is available. It is reasonable to delay disclosure when the bug or the fix is not yet fully understood, the solution is not well-tested, or for vendor coordination. The timeframe for disclosure is from immediate (especially if it's already publicly known) to 90 days. For a vulnerability with a straightforward mitigation, we expect the report date to disclosure date to be on the order of 7 days.

## Embargo Policy

Enterprise support customers may subscribe to receive alerts during the embargo period by contacting us at security@temporallayr.com. Subscribers agree not to make these notifications public, issue communications, share this information with others, or issue public patches before the disclosure date. Accidental disclosures must be reported immediately to security@temporallayr.com. Failure to follow this policy or repeated leaks may result in removal from the subscriber list.

Participation criteria:
1. Be a current enterprise customer with a valid corporate email domain (no @gmail.com, @hotmail.com, etc.)
2. Sign up for the TemporalLayr Security Vulnerability Response Policy as outlined above
3. Subscribe to security alerts

Removal criteria:
1. Members may be removed for failure to follow this policy or repeated leaks
2. Members may be removed for bounced messages (mail delivery failure)
3. Members may unsubscribe at any time

## Compliance

TemporalLayr is designed to help meet compliance requirements including:

- **SOC 2**: Audit logging, access controls, encryption at rest and in transit
- **GDPR**: Data export, deletion, and privacy-by-design principles
- **HIPAA**: Suitable for healthcare with appropriate configuration (BAA required)
- **PCI DSS**: Secure handling of payment-related data

For enterprise compliance documentation, contact: compliance@temporallayr.com

## Security Best Practices for Deployment

When deploying TemporalLayr in production:

1. **API Keys**: Use strong, unique API keys per tenant
2. **Network**: Deploy behind a reverse proxy with TLS termination
3. **Database**: Use encrypted connections (PostgreSQL TLS, ClickHouse secure)
4. **Monitoring**: Enable audit logging for compliance
5. **Updates**: Keep TemporalLayr updated to the latest stable version
6. **Rate Limiting**: Configure per-tenant rate limits in production
7. **Secret Management**: Use environment variables or secret management systems

## Encryption

- **Data at Rest**: All persistent data can be encrypted at the storage layer
- **Data in Transit**: TLS 1.2+ required for all external connections
- **API**: All API endpoints require HTTPS in production
- **Internal**: Service-to-service communication uses secure channels

## Security Headers

TemporalLayr implements the following security headers:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection`
- `Content-Security-Policy`

## Vulnerability History

| CVE ID | Severity | Description | Fixed In |
|:-|:-|:-|:-|
| - | - | No vulnerabilities reported yet | - |

---

*Last updated: March 2026*
*For questions about this policy, contact: security@temporallayr.com*
