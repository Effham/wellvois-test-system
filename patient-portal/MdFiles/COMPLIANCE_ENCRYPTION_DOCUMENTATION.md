# Encryption & Key Management Compliance Documentation

**Document Version:** 1.0  
**Last Updated:** October 2025  
**Application:** EMR Web Application  
**Prepared For:** Security Auditors & Compliance Review

---

## Executive Summary

This document describes the encryption implementation for sensitive patient medical data in our Electronic Medical Records (EMR) system. Our implementation uses **AWS Key Management Service (KMS)** for key management and **CipherSweet** for field-level encryption, providing HIPAA-compliant, enterprise-grade security for Protected Health Information (PHI).

### Key Highlights:
- ✅ **FIPS 140-2 Level 2** validated encryption (AWS KMS)
- ✅ **Automatic annual key rotation** (AWS managed)
- ✅ **Envelope encryption** architecture
- ✅ **Field-level encryption** for sensitive data
- ✅ **Searchable encryption** using blind indexes
- ✅ **Multi-tenant isolation** with separate databases
- ✅ **Complete audit trail** via AWS CloudTrail

---

## Table of Contents

1. [Encryption Architecture](#1-encryption-architecture)
2. [Key Management](#2-key-management)
3. [Data Protection](#3-data-protection)
4. [Key Rotation Policy](#4-key-rotation-policy)
5. [Access Controls](#5-access-controls)
6. [Compliance Standards](#6-compliance-standards)
7. [Audit & Monitoring](#7-audit--monitoring)
8. [Incident Response](#8-incident-response)
9. [Technical Implementation](#9-technical-implementation)
10. [Security Certifications](#10-security-certifications)

---

## 1. Encryption Architecture

### 1.1 Overview

We implement a **two-layer envelope encryption** architecture:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: AWS KMS (Key Encryption Key)                   │
│ - FIPS 140-2 Level 2 validated                         │
│ - Managed by AWS                                        │
│ - Automatic rotation enabled                            │
└─────────────────────────────────────────────────────────┘
                        ↓ encrypts
┌─────────────────────────────────────────────────────────┐
│ Layer 2: CipherSweet Key (Data Encryption Key)         │
│ - 256-bit symmetric key                                 │
│ - Used for field-level encryption                       │
│ - Stored encrypted, never in plaintext                  │
└─────────────────────────────────────────────────────────┘
                        ↓ encrypts
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Patient Medical Data (PHI)                    │
│ - Family medical history                                │
│ - Patient medical records                               │
│ - Sensitive health information                          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Encryption Algorithms

| Component | Algorithm | Key Size | Standard |
|-----------|-----------|----------|----------|
| AWS KMS | AES-256-GCM | 256-bit | FIPS 140-2 Level 2 |
| CipherSweet Backend | XSalsa20-Poly1305 (NaCl) | 256-bit | Modern Cryptography |
| Blind Indexes | BLAKE2b (keyed hash) | Variable | Secure Hash |

### 1.3 Envelope Encryption Flow

```
Application Startup:
┌──────────────────────────────────────────────────────┐
│ 1. Application reads encrypted key from environment   │
│    CIPHERSWEET_KMS_ENCRYPTED_KEY (base64)           │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 2. Application calls AWS KMS Decrypt API             │
│    - Uses IAM role authentication                     │
│    - Includes encryption context verification         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 3. AWS KMS validates and decrypts                    │
│    - Verifies IAM permissions                         │
│    - Validates encryption context                     │
│    - Returns plaintext data encryption key            │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 4. Application caches key in memory (5 minutes)      │
│    - Reduces KMS API calls                           │
│    - Key never written to disk                        │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 5. CipherSweet uses key for data encryption          │
│    - Field-level encryption                           │
│    - Blind index generation                           │
└──────────────────────────────────────────────────────┘
```

---

## 2. Key Management

### 2.1 Key Hierarchy

```
Root of Trust: AWS KMS
    │
    ├─→ KMS Customer Master Key (CMK)
    │   ├─ Key ID: [Customer Specific]
    │   ├─ ARN: arn:aws:kms:region:account:key/[key-id]
    │   ├─ Type: Symmetric
    │   ├─ Usage: ENCRYPT_DECRYPT
    │   └─ Rotation: Automatic (Annual)
    │
    └─→ Data Encryption Key (DEK)
        ├─ CipherSweet Application Key
        ├─ Size: 256-bit
        ├─ Storage: Encrypted by CMK
        └─ Location: Environment variable (encrypted)
```

### 2.2 Key Storage

| Key Type | Storage Location | Format | Protection |
|----------|------------------|--------|------------|
| KMS CMK | AWS KMS Service | Hardware Security Module | FIPS 140-2 Level 2 |
| DEK (encrypted) | Environment Variable | Base64-encoded ciphertext | Encrypted by KMS CMK |
| DEK (plaintext) | Application Memory | Binary (runtime only) | Process isolation, 5-min cache |

**Important:** The Data Encryption Key is **NEVER** stored in plaintext on disk. It only exists in plaintext in application memory during runtime.

### 2.3 Key Access

**Who Can Access Keys:**

| Entity | KMS CMK Access | DEK Access | Purpose |
|--------|---------------|------------|---------|
| Application (IAM Role) | Decrypt only | Runtime memory | Encrypt/decrypt data |
| DevOps (IAM User) | Encrypt, Describe | Initial setup only | Key wrapping |
| Database | None | None | Stores only encrypted data |
| Developers | None | None | No direct access |

**Access Controls:**
- IAM policies restrict KMS access
- Encryption context provides additional security layer
- CloudTrail logs all key usage
- MFA required for administrative actions

### 2.4 Encryption Context

Every KMS operation includes encryption context for additional security:

```json
{
  "Application": "EMR-Web-Application",
  "Purpose": "CipherSweet-Encryption"
}
```

**Benefits:**
- Additional authentication beyond IAM
- Prevents key misuse in wrong context
- Detailed audit logging
- Binding to application identity

---

## 3. Data Protection

### 3.1 Data at Rest

**Encrypted Fields:**

| Model | Encrypted Fields | Purpose | Blind Index |
|-------|------------------|---------|-------------|
| FamilyMedicalHistory | summary | Medical condition description | ✓ |
| FamilyMedicalHistory | details | Detailed medical information | ✓ |
| FamilyMedicalHistory | relationship_to_patient | Family relationship | ✓ |

**Database Storage:**
```sql
-- Example: family_medical_histories table
| id | patient_id | summary (encrypted)           | details (encrypted)           |
|----|------------|------------------------------|------------------------------|
| 1  | 123        | nacl:aW5jb21lOnNhbHQ6Y3l...  | nacl:bW9yZTplbmNyeXB0ZWQ...  |
```

**Encryption Prefix:**
- All encrypted fields start with `nacl:` prefix
- Indicates NaCl (Sodium) encryption algorithm
- Allows identification of encrypted vs plaintext data

### 3.2 Data in Transit

| Layer | Protection | Standard |
|-------|------------|----------|
| Application ↔ AWS KMS | TLS 1.3 | HTTPS |
| Application ↔ Database | TLS 1.2+ | Encrypted connection |
| Client ↔ Application | TLS 1.3 | HTTPS |

### 3.3 Data in Use

| State | Protection Mechanism |
|-------|---------------------|
| Application Memory | Process isolation, OS memory protection |
| Database Queries | Parameterized queries, ORM protection |
| API Responses | Data decrypted just-in-time, auto-encrypted in transit |

### 3.4 Searchable Encryption (Blind Indexes)

**Challenge:** How to search encrypted data without decrypting?

**Solution:** Blind indexes using keyed BLAKE2b hashing

```
Original Value: "Heart Disease"
        ↓
Blind Index: blake2b(key, "Heart Disease") 
        ↓
Stored Hash: "a1b2c3d4e5f6..."
```

**Searching:**
```php
// User searches for "Heart Disease"
$query = "Heart Disease";

// Application generates same blind index
$blindIndex = generateBlindIndex($query);

// Database searches hashed value (no decryption needed!)
SELECT * FROM family_medical_histories 
WHERE blind_indexes.value = '$blindIndex'
```

**Security Properties:**
- Cannot reverse engineer original value from hash
- Same input always produces same hash (searchable)
- Different encryption key = different hashes
- Separate database table for indexes

---

## 4. Key Rotation Policy

### 4.1 AWS KMS Key Rotation

**Type:** Automatic  
**Frequency:** Annual (365 days)  
**Status:** ✅ Enabled  

**How it Works:**

```
Year 0: Initial Setup
├─ KMS Key Version 1 (ACTIVE)
└─ DEK encrypted with Version 1

Year 1: Automatic Rotation
├─ KMS Key Version 1 (available for decryption)
├─ KMS Key Version 2 (ACTIVE) ← New encryptions use this
└─ DEK still encrypted with Version 1
    ✓ AWS automatically uses Version 1 to decrypt
    ✓ No application changes needed

Year 2: Second Rotation
├─ KMS Key Version 1 (available)
├─ KMS Key Version 2 (available)
├─ KMS Key Version 3 (ACTIVE)
└─ DEK still encrypted with Version 1
    ✓ Still works perfectly!
```

**Key Points:**
- ✅ **No downtime** - rotation is transparent
- ✅ **No data re-encryption** needed
- ✅ **No manual intervention** required
- ✅ **Backward compatible** - all versions work
- ✅ **Audit logged** - CloudTrail tracks rotation events

### 4.2 Data Encryption Key (DEK) Rotation

**Type:** Manual  
**Frequency:** As needed (security incident or compliance requirement)  
**Status:** On-demand  

**When to Rotate DEK:**
- ❌ NOT during normal operations (unnecessary)
- ✅ Security incident (key compromise suspected)
- ✅ Compliance requirement (policy change)
- ✅ Cryptographic weakness discovered

**DEK Rotation Process:**
```bash
# 1. Generate new CipherSweet key
php artisan ciphersweet:generate-key

# 2. Wrap new key with KMS
php artisan ciphersweet:wrap-key --plaintext-key="new-key"

# 3. Update environment variable
CIPHERSWEET_KMS_ENCRYPTED_KEY="new-wrapped-key"

# 4. Re-encrypt all data with new key
php artisan tenants:encrypt-family-history

# 5. Verify and deploy
```

**Impact:** Requires re-encrypting all sensitive data (planned maintenance window)

### 4.3 Rotation Audit Trail

All rotation events are logged in AWS CloudTrail:

```json
{
  "eventName": "RotateKey",
  "eventSource": "kms.amazonaws.com",
  "eventTime": "2025-01-15T10:30:00Z",
  "userIdentity": {
    "type": "AWSService",
    "principalId": "kms.amazonaws.com"
  },
  "requestParameters": {
    "keyId": "arn:aws:kms:us-east-1:123456789012:key/abc-123"
  },
  "responseElements": null,
  "eventType": "AwsApiCall"
}
```

---

## 5. Access Controls

### 5.1 IAM Policy (Application)

**Principle:** Least Privilege

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowKMSDecryptForApplication",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:*:key/*",
      "Condition": {
        "StringEquals": {
          "kms:EncryptionContext:Application": "EMR-Web-Application",
          "kms:EncryptionContext:Purpose": "CipherSweet-Encryption"
        }
      }
    }
  ]
}
```

**Permissions:**
- ✅ `kms:Decrypt` - Required for decrypting DEK
- ✅ `kms:DescribeKey` - Optional, for monitoring
- ❌ `kms:Encrypt` - NOT granted (only DevOps)
- ❌ `kms:DeleteKey` - NOT granted
- ❌ `kms:DisableKey` - NOT granted

### 5.2 KMS Key Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM policies",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "Allow application to decrypt",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/EMR-Application-Role"
      },
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:EncryptionContext:Application": "EMR-Web-Application",
          "kms:EncryptionContext:Purpose": "CipherSweet-Encryption"
        }
      }
    }
  ]
}
```

### 5.3 Multi-Tenant Isolation

**Architecture:** Database-per-tenant

```
Central Database (unencrypted):
├─ tenants (tenant metadata)
├─ users (user accounts)
└─ domains (tenant domains)

Tenant Database 1 (encrypted):
├─ family_medical_histories (PHI - encrypted)
├─ patient_medical_histories (PHI - encrypted)
└─ blind_indexes (searchable hashes)

Tenant Database 2 (encrypted):
├─ family_medical_histories (PHI - encrypted)
├─ patient_medical_histories (PHI - encrypted)
└─ blind_indexes (searchable hashes)
```

**Isolation Benefits:**
- ✅ Physical data separation
- ✅ No cross-tenant data access possible
- ✅ Independent backup/restore
- ✅ Compliance boundary per tenant
- ✅ Easier audit trail

---

## 6. Compliance Standards

### 6.1 HIPAA Compliance

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **§164.312(a)(2)(iv)** Encryption | AES-256-GCM + XSalsa20 | ✅ |
| **§164.312(e)(2)(ii)** Encryption in transit | TLS 1.3 | ✅ |
| **§164.308(b)(1)** Business associate | AWS BAA in place | ✅ |
| **§164.312(a)(1)** Access control | IAM policies, encryption context | ✅ |
| **§164.312(b)** Audit controls | CloudTrail logging | ✅ |
| **§164.308(a)(7)** Contingency plan | Automated backups, key recovery | ✅ |

### 6.2 GDPR Compliance

| Article | Requirement | Implementation |
|---------|-------------|----------------|
| **Art. 32** Security of processing | Encryption at rest and in transit | ✅ |
| **Art. 32** Pseudonymization | Blind indexes for searchability | ✅ |
| **Art. 33** Breach notification | CloudWatch alarms, audit logs | ✅ |
| **Art. 17** Right to erasure | Key deletion capability | ✅ |

### 6.3 SOC 2 Type II

| Control | Implementation |
|---------|----------------|
| **CC6.1** Logical access | IAM roles, encryption context |
| **CC6.6** Encryption | FIPS 140-2 validated KMS |
| **CC6.7** Data classification | PHI encrypted, non-PHI plaintext |
| **CC7.2** System monitoring | CloudTrail, CloudWatch |

### 6.4 PCI DSS (if applicable)

| Requirement | Implementation |
|-------------|----------------|
| **3.4** Render PAN unreadable | Strong encryption (AES-256) |
| **3.5** Key management | AWS KMS, automatic rotation |
| **3.6** Key procedures | Documented in this file |

---

## 7. Audit & Monitoring

### 7.1 AWS CloudTrail Logging

**All KMS operations are logged:**

```json
{
  "eventName": "Decrypt",
  "eventSource": "kms.amazonaws.com",
  "eventTime": "2025-10-14T15:30:00Z",
  "userIdentity": {
    "type": "AssumedRole",
    "principalId": "AIDAI...:EMR-Application",
    "arn": "arn:aws:sts::123456789012:assumed-role/EMR-App/i-12345"
  },
  "requestParameters": {
    "keyId": "arn:aws:kms:us-east-1:123:key/abc-123",
    "encryptionContext": {
      "Application": "EMR-Web-Application",
      "Purpose": "CipherSweet-Encryption"
    }
  },
  "responseElements": null,
  "requestID": "req-abc-123",
  "eventID": "evt-xyz-789",
  "readOnly": true,
  "resources": [
    {
      "ARN": "arn:aws:kms:us-east-1:123:key/abc-123",
      "accountId": "123456789012",
      "type": "AWS::KMS::Key"
    }
  ],
  "eventType": "AwsApiCall",
  "recipientAccountId": "123456789012"
}
```

### 7.2 Application Logging

**Encrypted operations logged:**
- Encryption events (field, tenant, timestamp)
- Decryption events (access logs)
- Key rotation events
- Failed encryption attempts
- Permission denied errors

**Log Location:** `storage/logs/laravel.log`

### 7.3 Monitoring Alerts

**CloudWatch Alarms:**

| Alarm | Threshold | Action |
|-------|-----------|--------|
| KMS Decrypt Failures | > 10 in 5 minutes | Email + Slack |
| Unauthorized KMS Access | Any occurrence | Immediate alert |
| KMS Key Deletion Attempt | Any occurrence | Critical alert + Block |
| Abnormal Decrypt Volume | > 1000/minute | Investigation alert |

### 7.4 Audit Reports

**Generated Reports:**
- Monthly KMS usage summary
- Quarterly access review
- Annual compliance report
- On-demand audit trail export

**Report Includes:**
- Number of encryption operations
- Number of decryption operations
- Failed access attempts
- Key rotation history
- User access patterns

---

## 8. Incident Response

### 8.1 Key Compromise Response

**If DEK (CipherSweet key) is compromised:**

```
1. IMMEDIATE ACTIONS (< 1 hour):
   ├─ Rotate DEK immediately
   ├─ Generate new CipherSweet key
   ├─ Wrap with KMS
   └─ Deploy to production

2. DATA PROTECTION (< 4 hours):
   ├─ Re-encrypt all sensitive data
   ├─ Update blind indexes
   └─ Verify encryption success

3. INVESTIGATION (< 24 hours):
   ├─ Review CloudTrail logs
   ├─ Identify breach source
   ├─ Document timeline
   └─ Report to stakeholders

4. REMEDIATION (< 1 week):
   ├─ Fix vulnerability
   ├─ Update security controls
   ├─ Enhance monitoring
   └─ Document lessons learned
```

### 8.2 KMS Key Deletion Protection

**Protection Mechanisms:**
- ❌ Deletion disabled by default
- ✅ 30-day waiting period if scheduled
- ✅ CloudWatch alarm on deletion attempt
- ✅ Automatic cancellation on detection
- ✅ Multi-person approval required

### 8.3 Disaster Recovery

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 1 hour

**Backup Strategy:**
- ✅ Database backups (automated, encrypted)
- ✅ KMS key ARN documented
- ✅ DEK encrypted backup stored securely
- ✅ Configuration as code (version controlled)

**Recovery Process:**
```
1. Restore database from backup
2. Verify KMS key access (IAM roles)
3. Deploy application with environment variables
4. Verify decryption works
5. Test end-to-end encryption
```

---

## 9. Technical Implementation

### 9.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│                     (HTTPS/TLS 1.3)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (ALB)                       │
│                     (HTTPS/TLS 1.3)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Application Server (PHP/Laravel)            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Request → Decrypt DEK from KMS (if not cached)   │  │
│  │  2. Use DEK for CipherSweet encryption/decryption    │  │
│  │  3. Store/retrieve encrypted data from database      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          ↓                                    ↓
┌──────────────────────────┐    ┌──────────────────────────┐
│      AWS KMS Service     │    │   Database (MySQL)       │
│  - Decrypt DEK           │    │  - Encrypted fields      │
│  - Manage key versions   │    │  - Blind indexes         │
│  - CloudTrail logging    │    │  - TLS connection        │
└──────────────────────────┘    └──────────────────────────┘
```

### 9.2 Code Implementation

**Location:** `app/Services/AwsKmsKeyProvider.php`

**Key Components:**
1. KMS client initialization
2. Encrypted key decryption
3. In-memory caching (5 minutes)
4. Error handling and logging

**Models Using Encryption:**
- `app/Models/Tenant/FamilyMedicalHistory.php`

**Configuration:**
- `config/ciphersweet.php` - CipherSweet settings
- `config/tenancy.php` - Multi-tenant configuration

**Environment Variables:**
```env
CIPHERSWEET_PROVIDER=custom
CIPHERSWEET_KMS_REGION=us-east-1
CIPHERSWEET_KMS_KEY_ID=arn:aws:kms:us-east-1:123:key/abc-123
CIPHERSWEET_KMS_ENCRYPTED_KEY=AQICAHh...base64...
```

### 9.3 Artisan Commands

| Command | Purpose |
|---------|---------|
| `php artisan ciphersweet:wrap-key` | Encrypt CipherSweet key with KMS |
| `php artisan ciphersweet:test-kms` | Test KMS integration |
| `php artisan tenants:encrypt-family-history` | Re-encrypt all medical history data |

---

## 10. Security Certifications

### 10.1 AWS KMS Certifications

- ✅ **FIPS 140-2 Level 2** validated
- ✅ **SOC 1, 2, 3** compliant
- ✅ **PCI DSS Level 1** certified
- ✅ **ISO 27001** certified
- ✅ **ISO 27017** (cloud security)
- ✅ **ISO 27018** (cloud privacy)
- ✅ **HIPAA** eligible service

### 10.2 Third-Party Audits

**AWS KMS Audit Reports Available:**
- SOC 2 Type II report
- PCI DSS Attestation of Compliance
- ISO 27001 certificate
- FedRAMP authorization

**Access:** Through AWS Artifact

---

## Contact Information

### Security Team
- **Email:** security@[company].com
- **Phone:** [Contact Number]
- **On-Call:** [PagerDuty/Alert System]

### Compliance Officer
- **Name:** [Name]
- **Email:** compliance@[company].com
- **Phone:** [Contact Number]

### AWS Support
- **Support Plan:** Enterprise
- **TAM (Technical Account Manager):** [Name if applicable]
- **Support Portal:** https://console.aws.amazon.com/support/

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | October 2025 | Development Team | Initial documentation |

**Review Schedule:** Quarterly  
**Next Review Date:** January 2026  
**Document Owner:** Security Team  

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **CMK** | Customer Master Key - Top-level key in AWS KMS |
| **DEK** | Data Encryption Key - Key used to encrypt actual data |
| **Envelope Encryption** | Encryption architecture where data is encrypted with DEK, and DEK is encrypted with CMK |
| **Blind Index** | Cryptographic hash that allows searching encrypted data |
| **PHI** | Protected Health Information - Regulated under HIPAA |
| **IAM** | Identity and Access Management - AWS access control |
| **CloudTrail** | AWS service for logging all API calls |
| **FIPS 140-2** | Federal standard for cryptographic modules |

---

## Appendix B: Quick Reference

### Emergency Contacts
```
Security Incident: security@[company].com
AWS Support: +1-XXX-XXX-XXXX (24/7)
On-Call Engineer: [Pager/Phone]
```

### Key ARNs
```
KMS Key: [To be filled by implementation team]
IAM Role: [To be filled by implementation team]
```

### Useful Commands
```bash
# Test KMS connectivity
php artisan ciphersweet:test-kms

# Check key rotation status
aws kms describe-key --key-id [KEY-ID] --query 'KeyMetadata.KeyRotationEnabled'

# View recent KMS activity
aws cloudtrail lookup-events --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::KMS::Key

# Encrypt all tenant data
php artisan tenants:encrypt-family-history
```

---

**END OF DOCUMENT**

*This document contains sensitive security information. Distribution should be limited to authorized personnel, auditors, and compliance officers only.*

