<!-- 9943da19-20b5-49d5-b943-4b37b7c4ba35 d64d53b2-7a6f-427d-8484-c69817c66076 -->
# Complete Backend Implementation for Practitioner Consent System

## Phase 1: Database Cleanup & Setup

### 1.1 Drop Old Consent Definitions Table

**Create Migration**: `database/migrations/tenant/2025_10_23_180000_drop_consent_definitions_table.php`

```php
Schema::dropIfExists('consent_definitions');
```

### 1.2 Verify Existing Migrations

The three core tables are already in place:

- `consents` - Stores consent types (key, title, entity_type)
- `consent_versions` - Stores versioned consent content (consent_id, version, consent_body, status)
- `entity_consents` - Tracks who accepted which version (polymorphic: consentable_type, consentable_id, consent_version_id)

## Phase 2: Eloquent Models

### 2.1 Create Consent Model

**File**: `app/Models/Tenant/Consent.php`

```php
class Consent extends Model
{
    protected $fillable = ['key', 'title', 'entity_type'];
    
    public function versions() {
        return $this->hasMany(ConsentVersion::class);
    }
    
    public function activeVersion() {
        return $this->hasOne(ConsentVersion::class)->where('status', 'ACTIVE');
    }
    
    public function entityConsents() {
        return $this->hasManyThrough(EntityConsent::class, ConsentVersion::class);
    }
}
```

### 2.2 Create ConsentVersion Model

**File**: `app/Models/Tenant/ConsentVersion.php`

```php
class ConsentVersion extends Model
{
    protected $fillable = ['consent_id', 'version', 'consent_body', 'status'];
    protected $casts = ['consent_body' => 'array'];
    
    public function consent() {
        return $this->belongsTo(Consent::class);
    }
    
    public function entityConsents() {
        return $this->hasMany(EntityConsent::class);
    }
    
    // Auto-increment version number before creating
    protected static function boot() {
        parent::boot();
        static::creating(function ($version) {
            if (!$version->version) {
                $lastVersion = static::where('consent_id', $version->consent_id)
                    ->max('version');
                $version->version = ($lastVersion ?? 0) + 1;
            }
        });
    }
}
```

### 2.3 Create EntityConsent Model

**File**: `app/Models/Tenant/EntityConsent.php`

```php
class EntityConsent extends Model
{
    public $timestamps = false;
    protected $fillable = ['consent_version_id', 'consented_at', 'consentable_type', 'consentable_id'];
    protected $casts = ['consented_at' => 'datetime'];
    
    public function consentVersion() {
        return $this->belongsTo(ConsentVersion::class);
    }
    
    public function consentable() {
        return $this->morphTo();
    }
}
```

### 2.4 Add Relationship to Practitioner Model

**File**: `app/Models/Practitioner.php`

```php
// Add to existing model
public function entityConsents() {
    return $this->morphMany(EntityConsent::class, 'consentable');
}

public function hasConsentedTo(string $consentKey): bool {
    return $this->entityConsents()
        ->whereHas('consentVersion.consent', function($q) use ($consentKey) {
            $q->where('key', $consentKey)
              ->where('status', 'ACTIVE');
        })
        ->exists();
}
```

### 2.5 Add Relationship to Patient Model

**File**: `app/Models/Patient.php`

```php
// Add to existing model
public function entityConsents() {
    return $this->morphMany(EntityConsent::class, 'consentable');
}
```

## Phase 3: Database Seeder

### 3.1 Create Consent Seeder

**File**: `database/seeders/Tenant/ConsentSeeder.php`

```php
class ConsentSeeder extends Seeder
{
    public function run(): void
    {
        $consents = [
            [
                'key' => 'confidentiality_oath',
                'title' => 'Confidentiality Oath',
                'entity_type' => 'PRACTITIONER',
                'body' => [
                    'heading' => 'Confidentiality Oath',
                    'description' => 'Required for employment with this organization',
                    'important_notice' => 'As a healthcare practitioner...',
                    'points' => [
                        'I will maintain the strictest confidentiality...',
                        'I will comply with all applicable laws...',
                        'I will not disclose, discuss, or share...',
                        'I will use patient information only for legitimate...'
                    ]
                ]
            ],
            [
                'key' => 'document_upload_sharing',
                'title' => 'Document Upload Sharing Consent',
                'entity_type' => 'PRACTITIONER',
                'body' => [
                    'heading' => 'Document Sharing Consent',
                    'description' => 'This document will be accessible to the patient',
                    'warning' => 'Once shared, the patient can download and keep this document.',
                    'question' => 'Do you confirm you want to share this document with the patient?'
                ]
            ],
            [
                'key' => 'google_calendar_sync',
                'title' => 'Google Calendar Sync',
                'entity_type' => 'PRACTITIONER',
                'body' => [
                    'heading' => 'Google Calendar Integration',
                    'checkboxes' => [
                        'I understand appointments will sync to Google Calendar',
                        'I consent to staff members viewing my Google Calendar',
                        'I understand data is stored on Google servers'
                    ]
                ]
            ],
            [
                'key' => 'session_recording',
                'title' => 'Virtual Session Recording',
                'entity_type' => 'PRACTITIONER',
                'body' => [
                    'heading' => 'Session Participation & Recording',
                    'session_consent' => 'I consent to participate in this virtual session',
                    'recording_consent' => 'I consent to this session being recorded (optional)'
                ]
            ]
        ];

        foreach ($consents as $consentData) {
            $consent = Consent::create([
                'key' => $consentData['key'],
                'title' => $consentData['title'],
                'entity_type' => $consentData['entity_type'],
            ]);

            ConsentVersion::create([
                'consent_id' => $consent->id,
                'consent_body' => $consentData['body'],
                'status' => 'ACTIVE',
            ]);
        }
    }
}
```

## Phase 4: Controllers

### 4.1 Create Consent Controller

**File**: `app/Http/Controllers/Tenant/ConsentController.php`

```php
class ConsentController extends Controller
{
    public function getActiveConsent(Request $request)
    {
        $consentKey = $request->input('key');
        
        $consent = Consent::where('key', $consentKey)
            ->with('activeVersion')
            ->firstOrFail();
        
        return response()->json([
            'consent' => $consent,
            'version' => $consent->activeVersion,
        ]);
    }
    
    public function acceptConsent(Request $request)
    {
        $validated = $request->validate([
            'consent_key' => 'required|string',
            'consentable_type' => 'required|string',
            'consentable_id' => 'required|integer',
        ]);
        
        $consent = Consent::where('key', $validated['consent_key'])
            ->with('activeVersion')
            ->firstOrFail();
        
        $entityConsent = EntityConsent::create([
            'consent_version_id' => $consent->activeVersion->id,
            'consentable_type' => $validated['consentable_type'],
            'consentable_id' => $validated['consentable_id'],
            'consented_at' => now(),
        ]);
        
        return response()->json([
            'success' => true,
            'entity_consent' => $entityConsent,
        ]);
    }
}
```

### 4.2 Update PractitionerInvitationController

**File**: `app/Http/Controllers/PractitionerInvitationController.php`

Modify `registerAndAccept` method:

```php
// After user creation and before commit:
if ($validated['consent_accepted']) {
    // Get active confidentiality oath version
    $consent = \App\Models\Tenant\Consent::where('key', 'confidentiality_oath')
        ->with('activeVersion')
        ->first();
    
    if ($consent && $consent->activeVersion) {
        \App\Models\Tenant\EntityConsent::create([
            'consent_version_id' => $consent->activeVersion->id,
            'consentable_type' => 'App\\Models\\Practitioner',
            'consentable_id' => $invitation->practitioner_id,
            'consented_at' => now(),
        ]);
    }
}
```

### 4.3 Create Document Consent Controller

**File**: `app/Http/Controllers/Tenant/EncounterDocumentConsentController.php`

```php
class EncounterDocumentConsentController extends Controller
{
    public function checkConsent(Request $request)
    {
        $practitioner = auth()->user()->practitioner;
        
        // Check if practitioner has EVER consented to document sharing
        $hasConsented = $practitioner->entityConsents()
            ->whereHas('consentVersion.consent', function($q) {
                $q->where('key', 'document_upload_sharing');
            })
            ->exists();
        
        return response()->json([
            'needs_consent' => !$hasConsented,
            'consent_data' => $hasConsented ? null : $this->getConsentData(),
        ]);
    }
    
    private function getConsentData()
    {
        $consent = Consent::where('key', 'document_upload_sharing')
            ->with('activeVersion')
            ->first();
        
        return [
            'consent' => $consent,
            'version' => $consent->activeVersion,
        ];
    }
}
```

## Phase 5: Frontend Components

### 5.1 Create DocumentUploadConsentModal Component

**File**: `resources/js/components/practitioner/DocumentUploadConsentModal.tsx`

```tsx
interface DocumentUploadConsentModalProps {
    open: boolean;
    onAccept: () => void;
    onCancel: () => void;
    consentData: {
        heading: string;
        description: string;
        warning: string;
        question: string;
    };
    patientName?: string;
    documentName?: string;
}

export default function DocumentUploadConsentModal({ 
    open, 
    onAccept, 
    onCancel,
    consentData,
    patientName,
    documentName 
}: DocumentUploadConsentModalProps) {
    const [accepted, setAccepted] = useState(false);
    
    return (
        <Dialog open={open} onOpenChange={onCancel}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{consentData.heading}</DialogTitle>
                    <DialogDescription>{consentData.description}</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    {patientName && (
                        <p>Patient: <strong>{patientName}</strong></p>
                    )}
                    {documentName && (
                        <p>Document: <strong>{documentName}</strong></p>
                    )}
                    
                    <Alert variant="warning">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Important</AlertTitle>
                        <AlertDescription>{consentData.warning}</AlertDescription>
                    </Alert>
                    
                    <p className="font-medium">{consentData.question}</p>
                    
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="consent"
                            checked={accepted}
                            onCheckedChange={setAccepted}
                        />
                        <Label htmlFor="consent">
                            I confirm I want to share this document
                        </Label>
                    </div>
                </div>
                
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={onAccept} disabled={!accepted}>
                        Confirm & Upload
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

### 5.2 Update Document Upload Page

**File**: `resources/js/pages/Encounters/Documents/Upload.tsx`

Add state and consent checking:

```tsx
const [showConsentModal, setShowConsentModal] = useState(false);
const [consentData, setConsentData] = useState(null);
const [pendingUpload, setPendingUpload] = useState(null);

// Before handleSubmit for additional files:
const handleAdditionalUploadClick = async () => {
    // Check if consent needed
    const response = await axios.get('/api/consent/check/document-upload');
    
    if (response.data.needs_consent) {
        setConsentData(response.data.consent_data.version.consent_body);
        setPendingUpload('additional');
        setShowConsentModal(true);
    } else {
        handleSubmit(); // Proceed directly
    }
};

const handleConsentAccept = async () => {
    // Record consent
    await axios.post('/api/consent/accept', {
        consent_key: 'document_upload_sharing',
        consentable_type: 'App\\Models\\Practitioner',
        consentable_id: auth.user.practitioner_id,
    });
    
    setShowConsentModal(false);
    handleSubmit(); // Now proceed with upload
};

// Render modal
<DocumentUploadConsentModal
    open={showConsentModal}
    onAccept={handleConsentAccept}
    onCancel={() => setShowConsentModal(false)}
    consentData={consentData}
    patientName={encounter.appointment.patient.first_name}
/>
```

## Phase 6: Routes

### 6.1 Add Consent Routes

**File**: `routes/tenant.php`

```php
// Consent Management
Route::prefix('consent')->group(function () {
    Route::get('/check/{key}', [ConsentController::class, 'checkConsent']);
    Route::get('/active/{key}', [ConsentController::class, 'getActiveConsent']);
    Route::post('/accept', [ConsentController::class, 'acceptConsent']);
});

// Document consent check
Route::get('/api/consent/check/document-upload', 
    [EncounterDocumentConsentController::class, 'checkConsent']);
```

## Phase 7: Update Registration Flow

### 7.1 Fetch Consent from Database

**File**: `app/Http/Controllers/PractitionerInvitationController.php`

In `show` method, add:

```php
$confidentialityConsent = \App\Models\Tenant\Consent::where('key', 'confidentiality_oath')
    ->with('activeVersion')
    ->first();

return Inertia::render('auth/practitioner-invitation', [
    // ... existing props
    'confidentialityConsent' => [
        'consent' => $confidentialityConsent,
        'version' => $confidentialityConsent->activeVersion,
    ],
]);
```

### 7.2 Update Frontend Registration

**File**: `resources/js/pages/auth/practitioner-invitation.tsx`

Replace hardcoded consent text with dynamic content from props:

```tsx
export default function PractitionerInvitation({ 
    confidentialityConsent,
    // ... other props
}) {
    const consentBody = confidentialityConsent.version.consent_body;
    
    // Render consent using consentBody.heading, consentBody.points, etc.
}
```

## Implementation Order

1. **Migration** to drop old table
2. **Models** (Consent, ConsentVersion, EntityConsent)
3. **Seeder** with all 4 consent types
4. **Run seeder** in tenant context
5. **Controllers** (ConsentController, update PractitionerInvitationController)
6. **Routes** for consent endpoints
7. **DocumentUploadConsentModal** component
8. **Update Upload.tsx** with consent flow
9. **Update registration** to fetch consent from DB
10. **Test** complete flow

## Testing Checklist

- [ ] Seeder creates all 4 consents with version 1
- [ ] Registration fetches consent from database
- [ ] Consent acceptance creates entity_consent record
- [ ] Document upload shows consent modal (every time for now)
- [ ] Consent modal displays correct content from DB
- [ ] Accept creates entity_consent with correct polymorphic relation
- [ ] Admin email still sent on registration consent
- [ ] Can create new version and practitioners must re-consent

## Files to Create

1. `database/migrations/tenant/2025_10_23_180000_drop_consent_definitions_table.php`
2. `app/Models/Tenant/Consent.php`
3. `app/Models/Tenant/ConsentVersion.php`
4. `app/Models/Tenant/EntityConsent.php`
5. `database/seeders/Tenant/ConsentSeeder.php`
6. `app/Http/Controllers/Tenant/ConsentController.php`
7. `app/Http/Controllers/Tenant/EncounterDocumentConsentController.php`
8. `resources/js/components/practitioner/DocumentUploadConsentModal.tsx`

## Files to Modify

1. `app/Models/Practitioner.php` - Add entityConsents relationship
2. `app/Models/Patient.php` - Add entityConsents relationship
3. `app/Http/Controllers/PractitionerInvitationController.php` - Save consent to DB
4. `resources/js/pages/Encounters/Documents/Upload.tsx` - Add consent modal
5. `resources/js/pages/auth/practitioner-invitation.tsx` - Use DB consent
6. `routes/tenant.php` - Add consent routes

### To-dos

- [ ] Create migration to drop consent_definitions table
- [ ] Create Consent, ConsentVersion, and EntityConsent models with relationships
- [ ] Add entityConsents morphMany relationship to Practitioner and Patient models
- [ ] Create ConsentSeeder with all 4 consent types (confidentiality, document, calendar, recording)
- [ ] Create ConsentController for fetching and accepting consents
- [ ] Create EncounterDocumentConsentController for document upload consent checking
- [ ] Update PractitionerInvitationController to save consent to database and fetch consent data
- [ ] Create DocumentUploadConsentModal component with dynamic content from backend
- [ ] Update Upload.tsx to show consent modal before additional file upload
- [ ] Update practitioner-invitation.tsx to use consent data from database
- [ ] Add consent routes to routes/tenant.php
- [ ] Run ConsentSeeder in tenant context to populate consent data
- [ ] Test registration consent, document upload consent, and database records