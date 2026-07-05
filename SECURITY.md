# Security & Dependency Monitoring

This document tracks the core frameworks and libraries used in the Mr.H Academy platform to assist with future security monitoring and CVE patching.

## Core Dependencies
As of the end of Day 5, the following core dependencies and versions are installed:
- **NestJS** (`@nestjs/core`): `^11.0.1`
- **TypeORM** (`typeorm`): `^1.0.0`
- **Next.js** (`next`): `15.5.19`
- **Passport** (`passport`): `^0.7.0`

## Day 30 Definition of Done (DoD)
Before the final handover on Day 30, it is a **hard requirement** that `pnpm audit` must show exactly zero HIGH or CRITICAL vulnerabilities. All dependencies must be secured before going to production.

## Post-Handover Monitoring Recommendation
It is strongly recommended that Mr. Hani configures free automated dependency monitoring post-handover.
If the project is hosted on GitHub, we highly recommend enabling **GitHub Dependabot alerts** (which are free and require zero-configuration for repositories). This will continuously scan `package.json` for newly-disclosed CVEs and open automated pull requests to patch them, protecting against future supply chain attacks (e.g. RCE vulnerabilities discovered in underlying frameworks).
