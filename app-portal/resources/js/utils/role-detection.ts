export type RoleCategory = 'practitioner' | 'patient' | 'admin' | 'multi-role' | 'other';

export interface RoleDetectionResult {
  category: RoleCategory;
  isPractitioner: boolean;
  isPatient: boolean;
  isAdmin: boolean;
  hasMultipleRoles: boolean;
  roles: string[];
}

/**
 * Determines the user's role category based on their roles and records
 *
 * @param auth - Auth object from Inertia props
 * @param tenancy - Tenancy object from Inertia props
 * @returns RoleDetectionResult with category and role flags
 */
export function getUserRoleCategory(auth: any, tenancy: any): RoleDetectionResult {
  const isCentral = tenancy?.is_central;
  const userRoles = auth?.user?.roles || [];

  if (isCentral) {
    // Central context - check central practitioner/patient records
    const isPractitioner = auth?.user?.is_practitioner || false;
    const isPatient = auth?.user?.is_patient || false;

    return {
      category: isPractitioner ? 'practitioner' : (isPatient ? 'patient' : 'admin'),
      isPractitioner,
      isPatient,
      isAdmin: !isPractitioner && !isPatient,
      hasMultipleRoles: isPractitioner && isPatient,
      roles: userRoles,
    };
  } else {
    // Tenant context - CRITICAL: Check if user has a role AND a practitioner/patient TABLE RECORD

    // Check Spatie roles (what permissions user has)
    const hasAdminRole = userRoles.includes('Admin');
    const hasStaffRole = userRoles.includes('Staff');
    const hasPractitionerRole = userRoles.includes('Practitioner');
    const hasPatientRole = userRoles.includes('Patient');
    const hasCustomRole = userRoles.some((role: string) => !['Admin', 'Staff', 'Practitioner', 'Patient'].includes(role));

    // Check tenant table records (what identity user has)
    const hasTenantPractitionerRecord = auth?.user?.is_tenant_practitioner || false;
    const hasTenantPatientRecord = auth?.user?.is_tenant_patient || false;

    // Multi-role detection: User has a ROLE (Admin/Staff/Custom) AND a practitioner/patient RECORD
    const hasRoleWithoutPractitionerPatient = (hasAdminRole || hasStaffRole || hasCustomRole) &&
                                               !hasPractitionerRole &&
                                               !hasPatientRole;

    const hasMultipleIdentities = hasRoleWithoutPractitionerPatient &&
                                   (hasTenantPractitionerRecord || hasTenantPatientRecord);

    // Determine primary identity - Only check table records, not roles
    const isPractitioner = hasTenantPractitionerRecord;
    const isPatient = hasTenantPatientRecord;
    const isAdmin = hasAdminRole || hasStaffRole;

    let category: RoleCategory;
    if (hasMultipleIdentities) {
      // User has a role (Admin/Staff/Custom) + practitioner/patient table record
      category = 'multi-role';
    } else if (isPractitioner && !isAdmin && !hasCustomRole) {
      // Pure practitioner (only practitioner role/record)
      category = 'practitioner';
    } else if (isPatient && !isAdmin && !hasCustomRole) {
      // Pure patient (only patient role/record)
      category = 'patient';
    } else if (isAdmin || hasStaffRole || hasCustomRole) {
      // Pure admin/staff/custom role (no practitioner/patient records)
      category = 'admin';
    } else {
      category = 'other';
    }

    return {
      category,
      isPractitioner,
      isPatient,
      isAdmin,
      hasMultipleRoles: hasMultipleIdentities,
      roles: userRoles,
    };
  }
}

/**
 * Determines if central tour should be shown
 *
 * @param auth - Auth object from Inertia props
 * @returns boolean - true if central tour should be shown
 */
export function shouldShowCentralTour(auth: any): boolean {
  // Only show central tour for pure practitioners or patients
  const isPractitioner = auth?.user?.is_practitioner || false;
  const isPatient = auth?.user?.is_patient || false;

  return isPractitioner || isPatient;
}

/**
 * Determines if multi-role tenant tour should be shown
 *
 * @param auth - Auth object from Inertia props
 * @param tenancy - Tenancy object from Inertia props
 * @returns boolean - true if multi-role tour should be shown
 */
export function shouldShowMultiRoleTenantTour(auth: any, tenancy: any): boolean {
  if (tenancy?.is_central) return false;

  const userRoles = auth?.user?.roles || [];
  const hasTenantPractitionerRecord = auth?.user?.is_tenant_practitioner || false;
  const hasTenantPatientRecord = auth?.user?.is_tenant_patient || false;

  // Check if user has a role (Admin/Staff/Custom) but NOT Practitioner/Patient role
  const hasNonClinicalRole = userRoles.some((role: string) => !['Practitioner', 'Patient'].includes(role));

  // Multi-role if: has a role AND has practitioner/patient table record
  const isMultiRole = hasNonClinicalRole && (hasTenantPractitionerRecord || hasTenantPatientRecord);

  return isMultiRole;
}

/**
 * Determines if standard tenant tour should be shown
 *
 * @param auth - Auth object from Inertia props
 * @param tenancy - Tenancy object from Inertia props
 * @returns boolean - true if standard tenant tour should be shown
 */
export function shouldShowStandardTenantTour(auth: any, tenancy: any): boolean {
  if (tenancy?.is_central) return false;

  // Standard tour if NOT multi-role
  return !shouldShowMultiRoleTenantTour(auth, tenancy);
}
