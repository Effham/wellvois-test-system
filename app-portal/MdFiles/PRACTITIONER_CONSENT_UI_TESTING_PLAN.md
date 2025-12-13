# Practitioner Consent System - UI Testing Plan

## Overview
This document provides a comprehensive testing plan for the practitioner consent system UI components and flows. The system includes consent modals, dashboard management, and integration with the practitioner registration process.

## Components to Test

### 1. ConfidentialityOathModal
**File**: `resources/js/components/practitioner/ConfidentialityOathModal.tsx`

**Test Scenarios**:
- [ ] Modal opens and displays correctly
- [ ] Full-screen blocking behavior works
- [ ] Cannot be dismissed by clicking outside or pressing escape
- [ ] All 7 oath points are displayed and readable
- [ ] Checkbox interaction works correctly
- [ ] Accept button is disabled until checkbox is checked
- [ ] Accept button becomes enabled when checkbox is checked
- [ ] Organization name is displayed correctly
- [ ] Dark mode styling works
- [ ] Mobile responsive design
- [ ] Accessibility - keyboard navigation works
- [ ] Accessibility - screen reader compatibility

### 2. DocumentUploadConsentModal
**File**: `resources/js/components/practitioner/DocumentUploadConsentModal.tsx`

**Test Scenarios**:
- [ ] Modal opens and displays correctly
- [ ] Patient name, document name, and type are displayed
- [ ] Checkbox interaction works
- [ ] Accept/Decline buttons work correctly
- [ ] Button states are correct based on checkbox
- [ ] Dark mode styling works
- [ ] Mobile responsive design

### 3. GoogleCalendarConsentModal
**File**: `resources/js/components/practitioner/GoogleCalendarConsentModal.tsx`

**Test Scenarios**:
- [ ] Modal opens and displays correctly
- [ ] All three checkboxes are present
- [ ] Each checkbox can be checked/unchecked independently
- [ ] Connect button is disabled until all checkboxes are checked
- [ ] Connect button becomes enabled when all checkboxes are checked
- [ ] Cancel button works correctly
- [ ] Dark mode styling works
- [ ] Mobile responsive design

### 4. SessionRecordingConsentModal
**File**: `resources/js/components/practitioner/SessionRecordingConsentModal.tsx`

**Test Scenarios**:
- [ ] Modal opens and displays correctly
- [ ] Session details are displayed correctly
- [ ] Session consent checkbox works
- [ ] Recording toggle switch works
- [ ] Recording notice appears when toggle is enabled
- [ ] Start Session button is disabled until session consent is checked
- [ ] Button text changes based on recording state
- [ ] Dark mode styling works
- [ ] Mobile responsive design

### 5. ConsentHistoryCard
**File**: `resources/js/components/practitioner/ConsentHistoryCard.tsx`

**Test Scenarios**:
- [ ] Card displays all consent information correctly
- [ ] Status badges show correct colors and text
- [ ] Icons are appropriate for each consent type
- [ ] Timestamps are formatted correctly
- [ ] IP address is displayed (when available)
- [ ] Metadata is displayed (when available)
- [ ] Dropdown menu works correctly
- [ ] View Details option works
- [ ] Revoke option appears only for revocable consents
- [ ] Non-revocable consents show appropriate notice
- [ ] Dark mode styling works
- [ ] Mobile responsive design

### 6. Practitioner Consents Dashboard
**File**: `resources/js/pages/Tenant/Practitioner/Consents.tsx`

**Test Scenarios**:
- [ ] Page loads correctly
- [ ] Header and description are displayed
- [ ] Statistics cards show correct counts
- [ ] Filter tabs work correctly (All, Required, Optional)
- [ ] Consent cards are displayed in grid layout
- [ ] Empty states are handled correctly
- [ ] View Details modal opens correctly
- [ ] Revoke confirmation modal works
- [ ] Dark mode styling works
- [ ] Mobile responsive design
- [ ] Tablet layout works correctly

### 7. Demo Page
**File**: `resources/js/pages/Practitioner/Consents/Demo.tsx`

**Test Scenarios**:
- [ ] Page loads and displays all components
- [ ] Modal trigger buttons work
- [ ] All modals can be opened and closed
- [ ] Mock data is displayed correctly
- [ ] Status examples are shown
- [ ] Features overview is displayed
- [ ] Dark mode toggle works
- [ ] Mobile responsive design

## Integration Testing

### 8. Practitioner Registration Flow
**File**: `resources/js/pages/auth/practitioner-invitation.tsx`

**Test Scenarios**:
- [ ] Password validation works before showing consent modal
- [ ] Terms acceptance is required before showing consent modal
- [ ] Consent modal appears after clicking "Complete Registration"
- [ ] Consent modal is blocking and cannot be dismissed
- [ ] Form submission includes consent data
- [ ] Success flow works correctly
- [ ] Error handling works correctly
- [ ] Console logging works for debugging
- [ ] Dark mode styling works
- [ ] Mobile responsive design

### 9. Sidebar Navigation
**File**: `resources/js/components/app-sidebar.tsx`

**Test Scenarios**:
- [ ] "My Consents" menu item appears for practitioners
- [ ] Menu item has correct icon (Shield)
- [ ] Menu item links to correct route
- [ ] Menu item is positioned correctly
- [ ] Dark mode styling works
- [ ] Mobile responsive design

### 10. Email Notifications
**File**: `app/Mail/Tenant/PractitionerConsentAcceptedMail.php`

**Test Scenarios**:
- [ ] Email is sent when consent is accepted
- [ ] Email contains correct practitioner information
- [ ] Email contains correct consent details
- [ ] Email contains audit information
- [ ] Email uses tenant theme color
- [ ] Email template renders correctly
- [ ] Email is mobile-friendly
- [ ] Logging works correctly

## Cross-Browser Testing

### Browsers to Test
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

### Test Scenarios
- [ ] All modals open and close correctly
- [ ] All interactions work (checkboxes, buttons, dropdowns)
- [ ] Styling is consistent across browsers
- [ ] No JavaScript errors in console
- [ ] Performance is acceptable

## Accessibility Testing

### WCAG 2.1 AA Compliance
- [ ] Color contrast meets 4.5:1 ratio
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Screen reader compatibility
- [ ] Alt text for images (if any)
- [ ] Form labels are properly associated
- [ ] Error messages are announced
- [ ] Modal titles are announced

### Keyboard Navigation
- [ ] Tab order is logical
- [ ] All interactive elements are reachable
- [ ] Space/Enter keys work for buttons and checkboxes
- [ ] Escape key works for dismissible modals
- [ ] Arrow keys work for dropdowns

## Performance Testing

### Load Times
- [ ] Initial page load is under 3 seconds
- [ ] Modal opening is under 500ms
- [ ] No memory leaks during modal interactions
- [ ] Smooth animations and transitions

### Mobile Performance
- [ ] Touch interactions are responsive
- [ ] No lag during scrolling
- [ ] Modals open smoothly on mobile
- [ ] Battery usage is reasonable

## Error Handling Testing

### Network Errors
- [ ] Graceful handling of network failures
- [ ] Appropriate error messages displayed
- [ ] Retry mechanisms work
- [ ] No broken states

### Validation Errors
- [ ] Form validation works correctly
- [ ] Error messages are clear and helpful
- [ ] Error states are visually distinct
- [ ] Accessibility of error messages

## Security Testing

### Input Validation
- [ ] XSS prevention in all text inputs
- [ ] CSRF protection on forms
- [ ] Proper sanitization of user data
- [ ] No sensitive data in client-side code

## Data Integrity Testing

### Mock Data
- [ ] All mock data displays correctly
- [ ] Data types are handled properly
- [ ] Edge cases are handled (empty data, null values)
- [ ] Date formatting is consistent

## User Experience Testing

### Flow Testing
- [ ] Registration flow is intuitive
- [ ] Consent process is clear
- [ ] Dashboard is easy to navigate
- [ ] Error recovery is straightforward

### Visual Design
- [ ] Consistent with application theme
- [ ] Professional medical aesthetic
- [ ] Clear visual hierarchy
- [ ] Appropriate use of colors and spacing

## Test Data Requirements

### Mock Consent Data
```typescript
const mockConsents = [
  {
    id: 1,
    type: 'confidentiality_oath',
    title: 'Confidentiality Oath',
    description: 'HIPAA compliance and patient data protection oath',
    status: 'granted',
    required: true,
    revocable: false,
    grantedAt: '2025-01-15T14:30:00Z',
    ipAddress: '192.168.1.1',
  },
  // ... more mock data
];
```

### Test Users
- [ ] Practitioner with various consent states
- [ ] Admin user for testing email notifications
- [ ] User with different permission levels

## Test Environment Setup

### Prerequisites
- [ ] Laravel application running
- [ ] Database migrations applied
- [ ] Test data seeded
- [ ] Email configuration working
- [ ] All dependencies installed

### Test Execution Order
1. Component unit tests
2. Integration tests
3. Cross-browser tests
4. Accessibility tests
5. Performance tests
6. Security tests
7. User acceptance tests

## Success Criteria

### Functional Requirements
- [ ] All modals work as specified
- [ ] Registration flow includes consent
- [ ] Dashboard displays consent history
- [ ] Email notifications are sent
- [ ] All user interactions work correctly

### Non-Functional Requirements
- [ ] Performance meets standards
- [ ] Accessibility compliance achieved
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness
- [ ] Security requirements met

### User Experience Requirements
- [ ] Intuitive user interface
- [ ] Clear consent language
- [ ] Professional appearance
- [ ] Smooth user flows
- [ ] Helpful error messages

## Bug Reporting

### Bug Report Template
```
**Component**: [Component Name]
**Browser**: [Browser and Version]
**Device**: [Desktop/Mobile/Tablet]
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**: [What should happen]
**Actual Result**: [What actually happens]
**Screenshots**: [If applicable]
**Console Errors**: [If any]
```

## Test Completion Checklist

- [ ] All components tested individually
- [ ] Integration flows tested
- [ ] Cross-browser compatibility verified
- [ ] Accessibility requirements met
- [ ] Performance benchmarks achieved
- [ ] Security requirements satisfied
- [ ] User experience validated
- [ ] Documentation updated
- [ ] Bug reports created and resolved
- [ ] Final sign-off obtained

---

**Note**: This testing plan should be executed systematically to ensure the practitioner consent system meets all requirements and provides an excellent user experience.