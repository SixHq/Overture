# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously at Overture. If you discover a security vulnerability, please follow these steps:

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Do

1. **Email us directly** at [security@trysixth.com](mailto:security@trysixth.com)
2. **Include details** such as:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Status update** within 7 days with our assessment
- **Resolution timeline** based on severity
- **Credit** in our security acknowledgments (if desired)

### Severity Levels

| Level    | Response Time | Examples |
|----------|---------------|----------|
| Critical | 24-48 hours   | Remote code execution, data breach |
| High     | 7 days        | Authentication bypass, privilege escalation |
| Medium   | 30 days       | Information disclosure, CSRF |
| Low      | 90 days       | Minor issues with limited impact |

## Security Best Practices

When using Overture:

- Keep your Node.js version up to date
- Run Overture on localhost only (default behavior)
- Do not expose Overture ports to the public internet
- Review plans before approving execution

## Scope

This security policy applies to:
- The `overture-mcp` npm package
- The official Overture repository at github.com/SixHq/Overture

Third-party forks and modifications are not covered.

---

Thank you for helping keep Overture and our users safe!
