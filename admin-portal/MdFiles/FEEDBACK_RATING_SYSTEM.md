# Feedback & Rating Distribution System

## Overview

This system allows patients to provide feedback for appointments and automatically distributes ratings among multiple practitioners involved in the appointment using a sophisticated formula that accounts for their roles and contributions.

## Database Tables

### 1. `appointment_feedback` (Tenant Database)
Stores the main feedback for each appointment.

**Fields:**
- `id` - Primary key
- `appointment_id` - Reference to appointment
- `patient_id` - Patient ID from central database
- `visit_rating` - Overall rating (1-5 stars)
- `visit_led_by` - Name of practitioner who led the visit
- `call_out_person` - Name of practitioner to recognize
- `additional_feedback` - Optional text feedback
- `is_editable` - Whether feedback can still be edited
- `submitted_at` - When feedback was first submitted
- `last_edited_at` - When feedback was last modified
- `created_at`, `updated_at` - Laravel timestamps

### 2. `practitioner_ratings` (Tenant Database)
Stores individual ratings for each practitioner involved in the appointment.

**Fields:**
- `id` - Primary key
- `appointment_id` - Reference to appointment
- `practitioner_id` - Practitioner ID from central database
- `patient_id` - Patient ID from central database
- `rating_points` - Points allocated to this practitioner (decimal 0.00-5.00)
- `rating_percentage` - Percentage of total rating (0.00-100.00)
- `is_lead_practitioner` - Whether this practitioner led the visit
- `is_called_out` - Whether this practitioner was called out for recognition
- `notes` - Additional notes about the rating calculation
- `created_at`, `updated_at` - Laravel timestamps

## Rating Distribution Formula

### Formula Explanation

The rating distribution system uses a sophisticated algorithm to fairly distribute a patient's overall rating among all practitioners involved in their appointment. Here's how it works:

#### Step 1: Base Distribution
- Total rating is divided equally among all practitioners
- Example: 5-star rating with 3 practitioners = 1.67 points each

#### Step 2: Role-Based Bonuses
- **Lead Practitioner Bonus**: +20% of total rating
- **Called Out Practitioner Bonus**: +10% of total rating
- These bonuses are applied on top of the base distribution

#### Step 3: Normalization
- The total is adjusted to ensure it equals the original rating
- All practitioners' ratings are proportionally scaled if needed

#### Step 4: Percentage Calculation
- Each practitioner's percentage is calculated based on their final points

### Example Calculation

**Scenario**: 5-star rating, 3 practitioners, Dr. Smith led the visit, Dr. Johnson was called out

1. **Base Distribution**: 5 ÷ 3 = 1.67 points each
2. **Apply Bonuses**:
   - Dr. Smith (lead): 1.67 + (5 × 0.20) = 2.67 points
   - Dr. Johnson (called out): 1.67 + (5 × 0.10) = 2.17 points
   - Dr. Brown: 1.67 points
3. **Current Total**: 2.67 + 2.17 + 1.67 = 6.51 points
4. **Normalization**: Scale by 5/6.51 = 0.768
   - Dr. Smith: 2.67 × 0.768 = 2.05 points (41%)
   - Dr. Johnson: 2.17 × 0.768 = 1.67 points (33.4%)
   - Dr. Brown: 1.67 × 0.768 = 1.28 points (25.6%)
5. **Final Total**: 2.05 + 1.67 + 1.28 = 5.00 points ✓

## Features

### 1. Dynamic Practitioner Selection
- Practitioners are loaded from the `appointment_practitioner` table
- Only real practitioners involved in the appointment are shown
- No static lists or placeholders

### 2. Editable Feedback
- Patients can edit their feedback within 24 hours of submission
- Clear visual indicators show editing status
- Form fields are disabled after editing window expires

### 3. No Skip Buttons
- All questions are optional by design
- "None" option instead of "Skip" for better UX
- Patients can leave any field blank

### 4. Smart Rating Distribution
- Automatic distribution based on roles
- Lead practitioners get recognition bonus
- Called out practitioners get appreciation bonus
- Fair distribution ensures all practitioners benefit

### 5. Comprehensive Statistics
The system provides detailed statistics for practitioners:
- Average rating across all appointments
- Total number of ratings received
- Rating distribution (1-5 stars)
- Number of times led an appointment
- Number of times called out for recognition
- Total appointments participated in

## Usage

### For Patients
1. Complete an appointment
2. Access feedback form via `/appointments/{id}/feedback`
3. Rate overall experience (1-5 stars)
4. Select who led the visit (optional)
5. Select anyone to call out (optional)
6. Add additional comments (optional)
7. Submit feedback
8. Edit within 24 hours if needed

### For Administrators
- View practitioner statistics
- Monitor feedback trends
- Identify top-performing practitioners
- Track patient satisfaction

## Technical Implementation

### Models
- `AppointmentFeedback` - Main feedback model
- `PractitionerRating` - Individual practitioner ratings

### Service
- `FeedbackRatingService` - Handles rating distribution logic

### Controller
- `AppointmentController@showFeedback` - Display feedback form
- `AppointmentController@storeFeedback` - Process and store feedback

### Routes
- `GET /appointments/{appointment}/feedback` - Show form
- `POST /appointments/{appointment}/feedback` - Submit feedback

## Security

- Only patients can provide feedback for their own appointments
- Only completed appointments can receive feedback
- Feedback editing is time-limited (24 hours)
- All data is stored in tenant-specific databases
- Proper validation and authorization checks

## Future Enhancements

- Email notifications for practitioners when they receive feedback
- Dashboard for practitioners to view their ratings
- Anonymous feedback options
- Integration with performance review systems
- Bulk feedback reporting and analytics
