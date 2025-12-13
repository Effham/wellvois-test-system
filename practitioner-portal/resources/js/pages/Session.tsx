import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, usePage, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, 
    Heart, 
    Activity, 
    Clock, 
    FileText, 
    Stethoscope,
    Clipboard,
    Save,
    Timer,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Pill,
    Plus,
    Trash,
    Mic,
    MicOff,
    Brain,
    History,
    Eye,
    X,
    Calendar,
    Info,
    ArrowLeft,
    CheckCircle,
    AlertTriangle,
    Video,
    VideoOff,
    RefreshCw,
    
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast, Toaster } from 'sonner';

interface SessionProps {
    appointment?: any;
    patient?: any;
    practitioner?: any;
    encounter?: any;
    antMediaUrl:string;
}

interface AppointmentHistoryItem {
    date: string;
    type: string;
    chiefComplaint: string;
    historyOfPresentIllness?: string;
    findings: string[];
    clinicalAssessment?: string;
    treatmentPlan?: string;
    additionalNotes?: string;
    prescriptions: string[];
    vitalSigns?: {
        bloodPressure?: string;
        heartRate?: string;
        temperature?: string;
        weight?: string;
    };
    mentalHealthData?: {
        mentalStateExam?: string;
        moodAffect?: string;
        thoughtProcess?: string;
        cognitiveAssessment?: string;
        riskAssessment?: string;
        therapeuticInterventions?: string;
        sessionGoals?: string;
        homeworkAssignments?: string;
    };
    status?: string;
    sessionDuration?: string;
}

export default function Session({ appointment, patient, practitioner, encounter: initialEncounter , antMediaUrl }: SessionProps) {
    const [encounter, setEncounter] = useState(initialEncounter || null);
    const [sessionStarted, setSessionStarted] = useState(true); // Always start as true since intro is on separate page
    const [sessionTime, setSessionTime] = useState(0);
    const [activeTab, setActiveTab] = useState('notes');
    const [isRecording, setIsRecording] = useState(false);
    const [showHistoryView, setShowHistoryView] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [aiSummary, setAiSummary] = useState<string[]>([]);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiCurrentText, setAiCurrentText] = useState('');
    const [aiCurrentIndex, setAiCurrentIndex] = useState(0);
    const [dynamicHistory, setDynamicHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        vitals: false,
        examination: false,
        assessment: false,
        recording: false
    });
    const [vitalSigns, setVitalSigns] = useState({
        bloodPressure: { systolic: '', diastolic: '' },
        heartRate: '',
        temperature: '',
        respiratoryRate: '',
        oxygenSaturation: '',
        weight: '',
        height: '',
        bmi: ''
    });

    const [onBroadcast, setOnBroadCast] = useState(false);
    const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false); // Start opened by default
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [isSendingInvite, setIsSendingInvite] = useState(false);
    // Recording consent state
    const [hasRecordingConsent, setHasRecordingConsent] = useState(false);
    const [isRequestingConsent, setIsRequestingConsent] = useState(false);
    const [showRecordingNotification, setShowRecordingNotification] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
    const noteTypes = [
    { label: "SOAP Note", value: "soap" },
    { label: "DAP Note", value: "dap" },
    { label: "BIRP Note", value: "birp" },
    { label: "PIE Note", value: "pie" },
    { label: "Narrative Note", value: "narrative" },
    { label: "Progress Note", value: "progress" },
    { label: "Discharge Note", value: "discharge" },
    ];

    console.log('onBroadcast',onBroadcast)

    // COMMENTED OUT: Auto-collapse AI panel when video session starts (causing issues)
    // useEffect(() => {
    //     setAiPanelCollapsed(onBroadcast);
    // }, [onBroadcast]);

  const [showModal, setShowModal] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [inputRoomId, setInputRoomId] = useState("");
  const [isNoteTypeDialogOpen, setIsNoteTypeDialogOpen] = useState(false);
  const [isNoteTypeDialogFinishOpen, setIsNoteTypeDialogFinishOpen] = useState(false);
    // Mental health specific state
    const [mentalHealthData, setMentalHealthData] = useState({
        mentalStateExam: '',
        moodAffect: '',
        thoughtProcess: '',
        cognitiveAssessment: '',
        riskAssessment: '',
        therapeuticInterventions: '',
        sessionGoals: '',
        homeworkAssignments: ''
    });

    // Determine session type based on service category
    const getSessionType = () => {
        if (!appointment?.service?.category) return 'general';
        const category = appointment.service.category.toLowerCase();
        if (category.includes('mental') || category.includes('therapy') || category.includes('counseling') || category.includes('psychology') || category.includes('psychiatry')) {
            return 'mental_health';
        }
        return 'general';
    };

    const sessionType = getSessionType();

    const [sessionData, setSessionData] = useState({
        chiefComplaint: '',
        historyOfPresentIllness: '',
        examination: '', // Combined physical and mental status
        assessment: '',
        plan: '',
        notes: '',
        note_type:'',
        sessionRecording: ''
    });
      const iframeRef = useRef(null);
  const [height, setHeight] = useState("600px");
    const [prescriptions, setPrescriptions] = useState<any[]>([]);

    const [documentRequests, setDocumentRequests] = useState<any[]>([]);
    const [filterByPractitioner, setFilterByPractitioner] = useState(false);

    // Load existing encounter data on mount
    useEffect(() => {
        if (encounter) {
            // Load encounter data
            setSessionData({
                chiefComplaint: encounter.chief_complaint || '',
                historyOfPresentIllness: encounter.history_of_present_illness || '',
                examination: encounter.examination_notes || '',
                assessment: encounter.clinical_assessment || '',
                plan: encounter.treatment_plan || '',
                notes: encounter.additional_notes || '',
                note_type:encounter.note_type || '',
                sessionRecording: encounter.session_recording || ''
            });

            // Load vital signs
            setVitalSigns({
                bloodPressure: { 
                    systolic: encounter.blood_pressure_systolic || '', 
                    diastolic: encounter.blood_pressure_diastolic || ''
                },
                heartRate: encounter.heart_rate || '',
                temperature: encounter.temperature || '',
                respiratoryRate: encounter.respiratory_rate || '',
                oxygenSaturation: encounter.oxygen_saturation || '',
                weight: encounter.weight || '',
                height: encounter.height || '',
                bmi: encounter.bmi || ''
            });

            // Load mental health data
            setMentalHealthData({
                mentalStateExam: encounter.mental_state_exam || '',
                moodAffect: encounter.mood_affect || '',
                thoughtProcess: encounter.thought_process || '',
                cognitiveAssessment: encounter.cognitive_assessment || '',
                riskAssessment: encounter.risk_assessment || '',
                therapeuticInterventions: encounter.therapeutic_interventions || '',
                sessionGoals: encounter.session_goals || '',
                homeworkAssignments: encounter.homework_assignments || ''
            });

            // Load prescriptions (only if they exist)
            if (encounter.prescriptions && encounter.prescriptions.length > 0) {
                setPrescriptions(encounter.prescriptions.map((prescription: any, index: number) => ({
                    id: prescription.id || index + 1,
                    medicine: prescription.medicine_name || '',
                    dosage: prescription.dosage || '',
                    frequency: prescription.frequency || '',
                    duration: prescription.duration || ''
                })));
            } else {
                setPrescriptions([]); // Start with no prescriptions by default
            }

            // Load document requests (only if they exist)
            if (encounter.document_requests && encounter.document_requests.length > 0) {
                setDocumentRequests(encounter.document_requests.map((request: any, index: number) => ({
                    id: request.id || index + 1,
                    document_type: request.document_type || '',
                    title: request.title || '',
                    description: request.description || '',
                    priority: request.priority || 'normal',
                    by_practitioner: request.by_practitioner || false
                })));
            } else {
                setDocumentRequests([]); // Start with no requests by default
            }

            // If encounter exists, session should be started
            if (encounter.session_started_at) {
                setSessionStarted(true);
                // Calculate session time if not completed
                if (!encounter.session_completed_at) {
                    const startTime = new Date(encounter.session_started_at).getTime();
                    const currentTime = new Date().getTime();
                    setSessionTime(Math.floor((currentTime - startTime) / 1000));
                } else {
                    setSessionTime(encounter.session_duration_seconds || 0);
                }
            }
        }
    }, [encounter]);
     useEffect(() => {
        if(onBroadcast){
              const handler = (event:any) => {
      // Optionally check event.origin === "https://your-app.com"
      if (event.data?.type === "IFRAME_SIZE") {
        setHeight(`${event.data.height}px`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
        }
  
  }, []);

    // Use real patient data if available, otherwise fallback to mock
    const patientInfo = patient ? {
        name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        age: patient.age || 'N/A',
        gender: patient.gender || 'N/A',
        mrn: patient.mrn || patient.health_number || 'N/A',
        dob: patient.dob || patient.date_of_birth || 'N/A',
        allergies: patient.allergies || [],
        lastVisit: patient.last_visit || 'N/A',
        conditions: patient.conditions || patient.medical_conditions || [],
        email: patient.email || 'N/A',
        phone: patient.phone || patient.phone_number || 'N/A'
    } : {
        name: "John Doe",
        first_name: "John",
        last_name: "Doe",
        age: 45,
        gender: "Male", 
        mrn: "MRN12345",
        dob: "1978-05-15",
        allergies: ["Penicillin", "Shellfish"],
        lastVisit: "2023-10-15",
        conditions: ["Hypertension", "Type 2 Diabetes"],
        email: "john.doe@example.com",
        phone: "+1234567890"
    };

    // Debug: Log patient data mapping

    // COMMENTED OUT: Load AI summary on component mount (causing crashes)
    // useEffect(() => {
    //     if (appointment?.id && sessionStarted) {
    //         generateAISummary();
    //     }
    // }, [appointment?.id, sessionStarted]);

    // COMMENTED OUT: Typewriter effect for AI summary (causing performance issues)
    // useEffect(() => {
    //     if (aiSummary.length > 0 && aiCurrentIndex < aiSummary.length) {
    //         if (aiCurrentText === aiSummary[aiCurrentIndex]) {
    //             setTimeout(() => {
    //                 setAiCurrentIndex(prev => prev + 1);
    //                 setAiCurrentText('');
    //             }, 800);
    //         } else {
    //             const timer = setTimeout(() => {
    //                 const targetText = aiSummary[aiCurrentIndex];
    //                 const nextLength = aiCurrentText.length + 1;
    //                 setAiCurrentText(targetText.slice(0, nextLength));
    //             }, 50);
    //             return () => clearTimeout(timer);
    //         }
    //     }
    // }, [aiCurrentText, aiCurrentIndex, aiSummary]);

    const generateAISummary = async () => {
        if (!appointment?.id) return;
        
        setIsGeneratingAI(true);
        setAiCurrentIndex(0);
        setAiCurrentText('');
        
        try {
            const response = await fetch('/ai-summary/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ appointment_id: appointment.id })
            });

            if (response.ok) {
                const result = await response.json();
                setAiSummary(result.ai_summary);
                // Start typewriter effect
                setTimeout(() => {
                    setIsGeneratingAI(false);
                }, 1000);
            } else {
                setIsGeneratingAI(false);
                console.error('Failed to generate AI summary');
            }
        } catch (error) {
            setIsGeneratingAI(false);
            console.error('Error generating AI summary:', error);
        }
    };

    const loadDynamicHistory = async () => {
        if (!appointment?.patient_id || dynamicHistory.length > 0) return;
        
        setIsLoadingHistory(true);
        
        try {
            const response = await fetch('/ai-summary/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ appointment_id: appointment.id })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.patient_context?.appointment_history) {
                    setDynamicHistory(result.patient_context.appointment_history);
                }
            }
        } catch (error) {
            console.error('Error loading dynamic history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // COMMENTED OUT: Load dynamic history when history view is opened (causing crashes)
    // useEffect(() => {
    //     if (showHistoryView) {
    //         loadDynamicHistory();
    //     }
    // }, [showHistoryView]);

    // Check recording consent on mount
    useEffect(() => {
        if (appointment?.id && appointment?.patient_id) {
            checkRecordingConsent();
        }
    }, [appointment?.id]);

    // Mock full appointment history for modal
    const appointmentHistory = [
        {
            date: "2023-11-20",
            type: "Follow-up Consultation",
            chiefComplaint: "Blood pressure monitoring",
            findings: ["BP: 145/90", "Weight: 78kg", "No chest pain"],
            prescriptions: ["Lisinopril increased to 10mg", "Added Atorvastatin 20mg"]
        },
        {
            date: "2023-09-15",
            type: "Regular Check-up",
            chiefComplaint: "Routine diabetes management",
            findings: ["HbA1c: 7.1%", "BP: 140/85", "No diabetic complications"],
            prescriptions: ["Started Sertraline 50mg", "Discontinued Metformin"]
        },
        {
            date: "2023-06-10",
            type: "Initial Consultation",
            chiefComplaint: "Anxiety and sleep issues",
            findings: ["Mild anxiety symptoms", "Poor sleep quality", "BP elevated"],
            prescriptions: ["Recommended lifestyle changes", "Sleep hygiene counseling"]
        }
    ];

    const startSession = () => {
        setSessionStarted(true);
        // Start timer
        const timer = setInterval(() => {
            setSessionTime(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    };

    // Check recording consent
    const checkRecordingConsent = async () => {
        try {
            const response = await fetch(`/session/check-recording-consent/${appointment.id}`, {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                }
            });
            const data = await response.json();
            setHasRecordingConsent(data.hasConsent);
            
            // If consent is now granted, hide the notification
            if (data.hasConsent && showRecordingNotification) {
                setShowRecordingNotification(false);
     

                showToastMessage('Recording consent received! You can now start recording.');
            }
        } catch (error) {
            console.error('Error checking recording consent:', error);
        }
    };
function showConsentToast() {
  const toastId = toast.success("Recording consent request sent to patient", {
    description: "Try refreshing in a while to start recording.",
    duration: Infinity, // stay until manually dismissed
    action: (
      <div className="flex items-center gap-2">
        <Button
          onClick={checkRecordingConsent}
          size="sm"
          variant="outline"
          className="h-6 text-xs inline-flex items-center"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="p-1 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
  });
}
    // Request recording consent
    const requestRecordingConsent = async () => {
        if (!appointment?.id || !appointment?.patient_id) return;
        
        setIsRequestingConsent(true);
        
        try {
            const response = await fetch('/session/request-recording-consent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    appointment_id: appointment.id,
                    patient_id: appointment.patient_id,
                })
            });

            const data = await response.json();
            
            if (data.success) {
                setShowRecordingNotification(true);
                showToastMessage('Recording consent request sent to patient');
                showConsentToast();
            } else {
                showToastMessage(data.message || 'Failed to send consent request');
            }
        } catch (error) {
            console.error('Error requesting recording consent:', error);
            showToastMessage('Failed to send consent request');
        } finally {
            setIsRequestingConsent(false);
        }
    };

    // Save recording audio
    const saveRecordingAudio = async (audioBlob: Blob) => {
        if (!appointment?.id) return;

        const formData = new FormData();
        formData.append('appointment_id', appointment.id.toString());
        formData.append('audio', audioBlob, `recording_${Date.now()}.webm`);

        try {
            const response = await fetch('/session/save-recording', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.transcription_started) {
                    showToastMessage('Recording saved and transcription started successfully');
                } else {
                    showToastMessage('Recording saved successfully');
                }
            } else {
                showToastMessage('Failed to save recording');
            }
        } catch (error) {
            console.error('Error saving recording:', error);
            showToastMessage('Failed to save recording');
        }
    };

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleVitalSignChange = (field: keyof typeof vitalSigns, value: string, subfield?: 'systolic' | 'diastolic') => {
        if (subfield && field === 'bloodPressure') {
            setVitalSigns(prev => ({
                ...prev,
                [field]: {
                    ...prev[field],
                    [subfield]: value
                }
            }));
        } else {
            setVitalSigns(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    const handleMentalHealthChange = (field: keyof typeof mentalHealthData, value: string) => {
        setMentalHealthData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSessionDataChange = (field: keyof typeof sessionData, value: string) => {
        setSessionData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const addPrescription = () => {
        setPrescriptions(prev => [
            ...prev,
            { id: Date.now(), medicine: '', dosage: '', frequency: '', duration: '' }
        ]);
    };

    const removePrescription = (id: number) => {
        setPrescriptions(prev => prev.filter(p => p.id !== id));
    };

    const updatePrescription = (id: number, field: 'medicine' | 'dosage' | 'frequency' | 'duration', value: string) => {
        setPrescriptions(prev => prev.map(p => 
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    const addDocumentRequest = () => {
        setDocumentRequests(prev => [
            ...prev,
            { id: Date.now(), document_type: '', title: '', description: '', priority: 'normal', by_practitioner: filterByPractitioner }
        ]);
    };

    const removeDocumentRequest = (id: number) => {
        setDocumentRequests(prev => prev.filter(r => r.id !== id));
    };

    const updateDocumentRequest = (id: number, field: 'document_type' | 'title' | 'description' | 'priority' | 'by_practitioner', value: string | boolean) => {
        setDocumentRequests(prev => prev.map(r =>
            r.id === id ? { ...r, [field]: value } : r
        ));
    };

    const toggleRecording = async () => {
        if (!isRecording) {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream);
                const chunks: Blob[] = [];

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                recorder.onstop = async () => {
                    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                    await saveRecordingAudio(audioBlob);
                    
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };

                recorder.start();
                setMediaRecorder(recorder);
                setAudioChunks(chunks);
                setIsRecording(true);
                
                handleSessionDataChange('sessionRecording', 'Session recording started at ' + new Date().toLocaleTimeString());
            } catch (error) {
                console.error('Error starting recording:', error);
                showToastMessage('Failed to access microphone. Please check permissions.');
            }
        } else {
            // Stop recording
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                setIsRecording(false);
                handleSessionDataChange('sessionRecording', 
                    sessionData.sessionRecording + '\n\nSession recording stopped at ' + new Date().toLocaleTimeString()
                );
            }
        }
    };

    const toggleVideoSession = () => {
        const newBroadcastState = !onBroadcast;
        setOnBroadCast(newBroadcastState);
        
        // Log video session activity
        if (appointment?.id) {
            const endpoint = newBroadcastState ? 'session.video.start' : 'session.video.stop';
            router.post(route(endpoint), {
                appointment_id: appointment.id
            }, {
                onSuccess: () => {
                    console.log(`Video session ${newBroadcastState ? 'started' : 'stopped'} logged successfully`);
                },
                onError: (errors) => {
                    console.error(`Failed to log video session ${newBroadcastState ? 'start' : 'stop'}:`, errors);
                }
            });
        }
        
        // Send patient appointment link when video session starts
        if (newBroadcastState && appointment?.id) {
            router.post(route('appointments.send-patient-link', appointment.id), {}, {
                onSuccess: (page) => {
                    console.log('Patient appointment link sent successfully');
                    // Show success message if available in page props
                    const flash = page.props?.flash as any;
                    if (flash && flash.success) {
                        showToastMessage(flash.success);
                    }
                },
                onError: (errors) => {
                    console.error('Failed to send patient appointment link:', errors);
                    showToastMessage('Failed to send patient appointment link. Please try again.');
                }
            });
        }
    };

    const sendInvite = () => {
        if (!inviteEmail.trim() || !appointment?.id) return;
        
        setIsSendingInvite(true);
        
        router.post(route('appointments.send-invitation', appointment.id), {
            email: inviteEmail.trim(),
            name: inviteName.trim() || inviteEmail.trim()
        }, {
            onSuccess: (page) => {
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteName('');
                // Show success message if available in page props
                const flash = page.props?.flash as any;
                if (flash && flash.success) {
                    showToastMessage(flash.success);
                } else {
                    showToastMessage('Invitation sent successfully!');
                }
            },
            onError: (errors) => {
                console.error('Failed to send invitation:', errors);
                showToastMessage('Failed to send invitation. Please try again.');
            },
            onFinish: () => {
                setIsSendingInvite(false);
            }
        });
    };

    // Helper function to convert text to Title Case
    const toTitleCase = (str: string) => {
        return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    };
    // Build iframe URL with doctor's name as query parameter
const buildIframeUrl = () => {
    if (!antMediaUrl) return '';
    const doctorName = practitioner
        ? toTitleCase(`${practitioner?.data?.first_name} ${practitioner?.data?.last_name}`.trim())
        : 'Doctor';

    // Encode the doctorName so spaces and special characters are safe in a URL
    const encodedName = encodeURIComponent(doctorName);

    const url = `${antMediaUrl}/room_${appointment.id}?name=${encodedName}&isDoctor=yes`;

    return url;
};


    const formatSessionTime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);

        return parts.slice(0, 2).join(', '); // Show max 2 parts
    };

    const validateSessionCompletion = () => {
        const errors = [];
        
        if (!sessionData.chiefComplaint.trim()) {
            errors.push("Chief Complaint is required");
        }
        
        if (!sessionData.historyOfPresentIllness.trim() && !sessionData.notes.trim()) {
            errors.push("Documentation (History of Present Illness or Notes) is required");
        }
        
        if (!sessionData.assessment.trim()) {
            errors.push("Clinical Assessment is required");
        }
        
        const hasValidPrescription = prescriptions.some(p => p.medicine.trim());
        if (!hasValidPrescription) {
            errors.push("At least one prescription is required");
        }
        
        return errors;
    };

    const validateDocumentRequests = () => {
        const errors: string[] = [];
        
        // Every document request card that exists must be completed
        documentRequests.forEach((request, index) => {
            if (!request.document_type.trim()) {
                errors.push(`Document Request ${index + 1}: Document type is required`);
            }
            if (!request.title.trim()) {
                errors.push(`Document Request ${index + 1}: Title/Description is required`);
            }
        });
        
        return errors;
    };

    const validatePrescriptions = () => {
        const errors: string[] = [];
        
        // Every prescription card that exists must be completed
        prescriptions.forEach((prescription, index) => {
            if (!prescription.medicine.trim()) {
                errors.push(`Prescription ${index + 1}: Medicine name is required`);
            }
        });
        
        return errors;
    };

    const showToastMessage = (message: string) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const saveSession = async () => {
        if (!appointment?.id) return;
        
        // Validate document requests before saving
        const documentRequestErrors = validateDocumentRequests();
        const prescriptionErrors = validatePrescriptions();
        const allErrors = [...documentRequestErrors, ...prescriptionErrors];
        
        if (allErrors.length > 0) {
            setValidationErrors(allErrors);
            showToastMessage('Please complete all required fields');
            return;
        }
        const hasText = (v?: string | null) => (v ?? "").trim().length > 0;
         if (!sessionData.note_type && hasText(sessionData.notes)) {
            if (!isNoteTypeDialogOpen) {
            setIsNoteTypeDialogOpen(true);
            return;
            }
        }          
        setIsSaving(true);
        
        const sessionPayload = {
            appointment_id: appointment.id,
            chief_complaint: sessionData.chiefComplaint,
            history_of_present_illness: sessionData.historyOfPresentIllness,
            examination_notes: sessionData.examination,
            clinical_assessment: sessionData.assessment,
            treatment_plan: sessionData.plan,
            additional_notes: sessionData.notes,
            note_type: sessionData.note_type,
            blood_pressure_systolic: vitalSigns.bloodPressure.systolic,
            blood_pressure_diastolic: vitalSigns.bloodPressure.diastolic,
            heart_rate: vitalSigns.heartRate,
            temperature: vitalSigns.temperature,
            respiratory_rate: vitalSigns.respiratoryRate,
            oxygen_saturation: vitalSigns.oxygenSaturation,
            weight: vitalSigns.weight,
            height: vitalSigns.height,
            bmi: vitalSigns.bmi,
            session_recording: sessionData.sessionRecording,
            session_duration_seconds: sessionTime,
            session_type: sessionType,
            // Mental health fields
            mental_state_exam: mentalHealthData.mentalStateExam,
            mood_affect: mentalHealthData.moodAffect,
            thought_process: mentalHealthData.thoughtProcess,
            cognitive_assessment: mentalHealthData.cognitiveAssessment,
            risk_assessment: mentalHealthData.riskAssessment,
            therapeutic_interventions: mentalHealthData.therapeuticInterventions,
            session_goals: mentalHealthData.sessionGoals,
            homework_assignments: mentalHealthData.homeworkAssignments,
            prescriptions: prescriptions.map(p => ({
                medicine_name: p.medicine,
                dosage: p.dosage,
                frequency: p.frequency,
                duration: p.duration
            })),
            document_requests: documentRequests.map(r => ({
                document_type: r.document_type,
                title: r.title,
                description: r.description,
                priority: r.priority,
                by_practitioner: r.by_practitioner || false
            }))
        };

        // Log document requests being sent to backend for debugging
        console.log('📤 FRONTEND: Sending document_requests to backend:',
            documentRequests.map(r => ({
                title: r.title,
                by_practitioner: r.by_practitioner,
                priority: r.priority
            }))
        );

        try {
            const response = await fetch('/session/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(sessionPayload)
            });

            if (response.ok) {
                const result = await response.json();

                // Log response from backend for debugging
                console.log('📥 FRONTEND: Received response from backend:',
                    result.encounter?.document_requests?.map((r: any) => ({
                        id: r.id,
                        title: r.title,
                        by_practitioner: r.by_practitioner,
                        priority: r.priority
                    }))
                );

                const message = encounter ? 'Session updated successfully!' : 'Session saved successfully!';
                showToastMessage(message);

                // Update encounter state without page refresh
                if (result.encounter) {
                    setEncounter(result.encounter);
                }
            } else {
                showToastMessage('Failed to save session. Please try again.');
                console.error('Failed to save session');
            }
        } catch (error) {
            showToastMessage('Failed to save session. Please try again.');
            console.error('Error saving session:', error);
        } finally {
            setIsSaving(false);
            setIsNoteTypeDialogOpen(false);
        }
    };

    const handleFinishSessionClick = () => {
        const errors = validateSessionCompletion();
        setValidationErrors(errors);
        setShowFinishModal(true);
    };

    const finishSession = async () => {
        if (!encounter?.id || !appointment?.id) return;
        
        // Validate document requests and prescriptions before finishing
        const documentRequestErrors = validateDocumentRequests();
        const prescriptionErrors = validatePrescriptions();
        const allErrors = [...documentRequestErrors, ...prescriptionErrors];
        
        if (allErrors.length > 0) {
            setValidationErrors(allErrors);
            showToastMessage('Please complete all required fields before finishing');
            setShowFinishModal(false);
            return;
        }
        
        setIsSaving(true);
        setShowFinishModal(false);

        try {
            // First save all session data including document requests


            const sessionPayload = {
                appointment_id: appointment.id,
                chief_complaint: sessionData.chiefComplaint,
                history_of_present_illness: sessionData.historyOfPresentIllness,
                examination_notes: sessionData.examination,
                clinical_assessment: sessionData.assessment,
                treatment_plan: sessionData.plan,
                additional_notes: sessionData.notes,
                note_type: sessionData.note_type,
                blood_pressure_systolic: vitalSigns.bloodPressure.systolic,
                blood_pressure_diastolic: vitalSigns.bloodPressure.diastolic,
                heart_rate: vitalSigns.heartRate,
                temperature: vitalSigns.temperature,
                respiratory_rate: vitalSigns.respiratoryRate,
                oxygen_saturation: vitalSigns.oxygenSaturation,
                weight: vitalSigns.weight,
                height: vitalSigns.height,
                bmi: vitalSigns.bmi,
                session_recording: sessionData.sessionRecording,
                session_duration_seconds: sessionTime,
                session_type: sessionType,
                // Mental health fields
                mental_state_exam: mentalHealthData.mentalStateExam,
                mood_affect: mentalHealthData.moodAffect,
                thought_process: mentalHealthData.thoughtProcess,
                cognitive_assessment: mentalHealthData.cognitiveAssessment,
                risk_assessment: mentalHealthData.riskAssessment,
                therapeutic_interventions: mentalHealthData.therapeuticInterventions,
                session_goals: mentalHealthData.sessionGoals,
                homework_assignments: mentalHealthData.homeworkAssignments,
                prescriptions: prescriptions.map(p => ({
                    medicine_name: p.medicine,
                    dosage: p.dosage,
                    frequency: p.frequency,
                    duration: p.duration
                })),
                document_requests: documentRequests.map(r => ({
                    document_type: r.document_type,
                    title: r.title,
                    description: r.description,
                    priority: r.priority,
                    by_practitioner: r.by_practitioner || false
                }))
            };

            // Save session data first
            const saveResponse = await fetch('/session/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(sessionPayload)
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save session data');
            }

            // Then mark session as finished
            const finishResponse = await fetch('/session/finish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ encounter_id: encounter.id })
            });

            if (finishResponse.ok) {
                // Update encounter status locally to reflect completion
                setEncounter((prev:any) => prev ? { ...prev, status: 'completed' } : prev);
                showToastMessage('Session completed successfully!');
                setTimeout(() => {
                    router.visit('/appointments');
                }, 1500);
            } else {
                showToastMessage('Failed to complete session. Please try again.');
                console.error('Failed to finish session');
            }
        } catch (error) {
            showToastMessage('Failed to complete session. Please try again.');
            console.error('Error finishing session:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate session progress based on completed fields
    const calculateProgress = () => {
        let completed = 0;
        const total = 4; // Chief Complaint, Documentation, Assessment, Prescription

        // Chief Complaint
        if (sessionData.chiefComplaint.trim()) completed++;
        
        // Documentation (History + Notes)
        if (sessionData.historyOfPresentIllness.trim() || sessionData.notes.trim()) completed++;
        
        // Assessment (Assessment + Plan)
        if (sessionData.assessment.trim() || sessionData.plan.trim()) completed++;
        
        // Prescription
        if (prescriptions.some(p => p.medicine.trim())) completed++;

        return (completed / total) * 100;
    };

    const progressPercentage = calculateProgress();

    // Check if session is editable (not completed)
    const isSessionEditable = encounter?.status !== 'completed';

    // REMOVED: Intro page logic - now handled by Session/Intro.tsx on separate route
    // Session always starts in active state since intro is on /current-session/{id}
    // and active session is on /session/active/{id}

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Current Session', href: '/current-session' },
            ]}
        >
                    <Toaster position="top-right" />
            
            <Head title="Current Session - Active" />

            {/* Toast Notification */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">{toastMessage}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Validation Modal */}
            <Dialog open={showFinishModal} onOpenChange={setShowFinishModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {validationErrors.length > 0 ? (
                                <>
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                    Incomplete Session
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    Confirm Session Completion
                                </>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        {validationErrors.length > 0 ? (
                            <>
                                <p className="text-sm text-muted-foreground">
                                    Please complete the following required fields before finishing the session:
                                </p>
                                <ul className="space-y-2">
                                    {validationErrors.map((error, index) => (
                                        <li key={index} className="flex items-start gap-2 text-sm">
                                            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                            <span>{error}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowFinishModal(false)}
                                    >
                                        Continue Editing
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground">
                                    All required information has been completed. Are you sure you want to finish this session? 
                                    Once finished, you will not be able to make any changes.
                                </p>
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowFinishModal(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={finishSession}
                                        disabled={isSaving}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {isSaving ? 'Finishing...' : 'Finish Session'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
                        <Dialog open={isNoteTypeDialogOpen} onOpenChange={setIsNoteTypeDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Select Note Type</DialogTitle>
    </DialogHeader>

    {/* Your existing dropdown (unchanged) */}
    <Select
      value={sessionData.note_type || ""}
      onValueChange={(value) => handleSessionDataChange("note_type", value)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select Note Type for AI" />
      </SelectTrigger>
      <SelectContent>
        {noteTypes.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <DialogFooter className="pt-4">
      <Button variant="outline" onClick={() => setIsNoteTypeDialogOpen(false)}>
        Cancel
      </Button>
      <Button
        onClick={() =>{
            setIsNoteTypeDialogOpen(false)
             saveSession()}}
        disabled={!sessionData.note_type}
      >
        Save Session
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
                  <Dialog open={isNoteTypeDialogFinishOpen} onOpenChange={setIsNoteTypeDialogFinishOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Select Note Type</DialogTitle>
    </DialogHeader>

    {/* Your existing dropdown (unchanged) */}
    <Select
      value={sessionData.note_type || ""}
      onValueChange={(value) => handleSessionDataChange("note_type", value)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select Note Type for AI" />
      </SelectTrigger>
      <SelectContent>
        {noteTypes.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <DialogFooter className="pt-4">
      <Button variant="outline" onClick={() => setIsNoteTypeDialogFinishOpen(false)}>
        Cancel
      </Button>
      <Button
        onClick={()=>{
            setIsNoteTypeDialogFinishOpen(false)
            handleFinishSessionClick()
            
        }}
        disabled={!sessionData.note_type}
      >
        Finish Session
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
            {/* Invite Participants Modal */}
            <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Invite Additional Participants
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Send a secure invitation link to additional participants who should join this video session.
                        </p>
                        
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="invite-email">Email Address *</Label>
                                <Input 
                                    id="invite-email"
                                    type="email"
                                    placeholder="participant@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    disabled={isSendingInvite}
                                />
                            </div>
                            
                            <div>
                                <Label htmlFor="invite-name">Name (Optional)</Label>
                                <Input 
                                    id="invite-name"
                                    type="text"
                                    placeholder="Participant Name"
                                    value={inviteName}
                                    onChange={(e) => setInviteName(e.target.value)}
                                    disabled={isSendingInvite}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    If left blank, email address will be used as the name
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowInviteModal(false);
                                    setInviteEmail('');
                                    setInviteName('');
                                }}
                                disabled={isSendingInvite}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={sendInvite}
                                disabled={!inviteEmail.trim() || isSendingInvite}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {isSendingInvite ? 'Sending...' : 'Send Invitation'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="p-4 h-[calc(100vh-80px)]">
                <div className="h-full flex flex-col">
                    {/* Enhanced Session Header with Patient Info */}
                    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                        <div className="flex justify-between items-center">
                            {/* Left side - Session and Patient Info */}
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                    <div>
                                        <h1 className="text-xl font-bold text-primary">
                                            Active Session
                                        </h1>
                                        <p className="text-sm text-muted-foreground">
                                            {appointment?.service?.name || 'Consultation'}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Basic Patient Info */}
                                <div className="flex items-center gap-4 bg-primary/5 rounded-lg px-4 py-2">
                                    <User className="h-4 w-4 text-primary flex-shrink-0" />
                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                        <div className="text-center">
                                            <div className="font-semibold text-primary">{patientInfo.name}</div>
                                            <div className="text-xs text-muted-foreground">Patient</div>
                                        </div>
                                        {/* <div className="text-center">
                                            <div className="font-medium">{patientInfo.age} yrs</div>
                                            <div className="text-xs text-muted-foreground">Age</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium">{patientInfo.gender}</div>
                                            <div className="text-xs text-muted-foreground">Gender</div>
                                        </div> */}
                                        <div className="text-center">
                                            <div className="font-medium">{patientInfo.mrn}</div>
                                            <div className="text-xs text-muted-foreground">MRN</div>
                                        </div>
                                    </div>
                                    
                                    {/* Patient Details Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10">
                                                <Info className="h-4 w-4 mr-1" />
                                                Details 
                                                <ChevronDown className="h-3 w-3 ml-1" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-96 p-4">
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="font-semibold text-primary mb-2">Contact Information</h4>
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <Label className="text-muted-foreground">Email:</Label>
                                                            <p className="font-medium break-words">{patientInfo.email}</p>
                                                        </div>
                                                        <div>
                                                            <Label className="text-muted-foreground">Phone:</Label>
                                                            <p className="font-medium">{patientInfo.phone}</p>
                                                        </div>
                                                        <div>
                                                            <Label className="text-muted-foreground">Date of Birth:</Label>
                                                            <p className="font-medium">{patientInfo.dob}</p>
                                                        </div>
                                                        <div>
                                                            <Label className="text-muted-foreground">Last Visit:</Label>
                                                            <p className="font-medium">{patientInfo.lastVisit}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <Separator />
                                                
                                                <div>
                                                    <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Allergies
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {patientInfo.allergies?.length > 0 ? patientInfo.allergies.map((allergy: string, index: number) => (
                                                            <Badge key={index} variant="destructive" className="text-xs">
                                                                {allergy}
                                                            </Badge>
                                                        )) : (
                                                            <span className="text-sm text-muted-foreground italic">No known allergies</span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <h4 className="font-semibold text-primary mb-2">Current Conditions</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {patientInfo.conditions?.length > 0 ? patientInfo.conditions.map((condition: string, index: number) => (
                                                            <Badge key={index} variant="secondary" className="text-xs">
                                                                {condition}
                                                            </Badge>
                                                        )) : (
                                                            <span className="text-sm text-muted-foreground italic">No current conditions</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            
                            {/* Right side - Controls */}
                                                    {/* <ConferenceModal
                        open={showModal}
                        onClose={() => setShowModal(false)}
                        onCreateRoom={(id:any) => {
                            setRoomId(id)
                            setIsHost(true)
                            setOnBroadCast(true)
                            setShowModal(false)
                        }}
                        onJoinRoom={(id) => {
                            setRoomId(id)
                            setIsHost(false)
                            setOnBroadCast(true)
                            setShowModal(false)
                        }}
                        /> */}
                            <div className="flex items-center gap-3">
                                  <Button 
                                        onClick={toggleVideoSession}
                                        variant={onBroadcast ? "destructive" : "outline"}
                                        size="sm"
                                        >
                                        {onBroadcast ? "Stop Video Session" : "Start Video Session"}
                                        </Button>
                                  
                                  <Button 
                                        onClick={() => setShowInviteModal(true)}
                                        variant="outline"
                                        size="sm"
                                        disabled={encounter?.status === 'completed'}
                                        >
                                        <User className="mr-2 h-4 w-4" />
                                        Invite Others
                                        </Button>
                                {/* Recording Consent Notification - Shows immediately after request button is clicked */}
                                {showRecordingNotification && (
                                    <Button 
                                    title='Consent request sent. Try refreshing in a while to start recording.'
                                            onClick={checkRecordingConsent}
                                            size="sm"
                                            variant="outline"
                                            className="ml-2 h-6 text-xs"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                        </Button>
                                )}

                                {/* Request Consent or Record Button */}
                                {!hasRecordingConsent ? (
                                    <Button 
                                        onClick={requestRecordingConsent}
                                        variant="outline"
                                        size="sm"
                                        disabled={isRequestingConsent || encounter?.status === 'completed'}
                                        title="Click to request the patient to give consent to start recording"
                                    >
                                        <Mic className="mr-2 h-4 w-4" />
                                        {isRequestingConsent ? 'Requesting...' : 'Request Recording Consent'}
                                    </Button>
                                ) : (
                                    <Button 
                                        onClick={toggleRecording}
                                        variant={isRecording ? "destructive" : "outline"}
                                        size="sm"
                                        disabled={encounter?.status === 'completed'}
                                        className={isRecording ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white border-green-600"}
                                    >
                                        {isRecording ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                                        {isRecording ? "Stop Recording" : "Record"}
                                    </Button>
                                )}
                                
                                {/* Dynamic Session Controls */}
                                {encounter?.status === 'completed' ? (
                                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="text-sm font-medium">Session Completed</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            onClick={saveSession} 
                                            size="sm" 
                                            className="bg-primary hover:bg-primary/90"
                                            disabled={isSaving}
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            {isSaving ? 'Saving...' : (encounter ? 'Update Session' : 'Save Session')}
                                        </Button>
                                        
                                        {encounter && progressPercentage >= 100 && (
                                            <Button 
                                                onClick={()=>{
                                                const hasText = (v?: string | null) => (v ?? "").trim().length > 0;
                                                    if (!sessionData.note_type && hasText(sessionData.notes)) {
                                                        if (!isNoteTypeDialogOpen) {
                                                        setIsNoteTypeDialogFinishOpen(true);
                                                        return;
                                                        }
                                                    } else{

                                                    handleFinishSessionClick()
                                                        
                                                    }    
                                                
                                                }} 
                                                size="sm" 
                                                variant="outline"
                                                className="border-green-600 text-green-600 hover:bg-green-50"
                                                disabled={isSaving}
                                            >
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Finish Session
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>



                    {/* Main Content Area - Dynamic Split (animations removed for performance) */}
                    <div 
                        className="grid gap-6 flex-grow min-h-0"
                        style={{
                            gridTemplateColumns: aiPanelCollapsed ? "1fr 60px" : "7fr 3fr"
                        }}
                    >
                        {/* Left Column - Main Content */}
                        <div 
                            className="space-y-4 overflow-y-auto relative"
                        >
                            {/* COMMENTED OUT: Appointment Details Overlay - Now using separate page */}
                            {/* <AnimatePresence>
                                {selectedAppointment && (
                                    <motion.div>
                                        ... Heavy overlay component removed to prevent crashes ...
                                        ... Now navigates to /session/history/{id} instead ...
                                    </motion.div>
                                )}
                            </AnimatePresence> */}

                            {/* Progress and Assessment Bar */}
                            <div>
                                {onBroadcast &&
                                <iframe 
                                    height={'840'}
                                    src={buildIframeUrl()} 
                                    ref={iframeRef}
                                    className="rounded-lg shadow-lg"
                                    style={{ border: 'none', overflow: 'hidden', width: '100%' }}
                                    allow="
                                        camera *;
                                        microphone *;
                                        display-capture *;
                                        autoplay *;
                                        fullscreen *;
                                        clipboard-read *;
                                        clipboard-write *
                                        "
                                >
                                </iframe>
}

                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Session Progress */}
                                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Activity className="h-4 w-4 text-green-600" />
                                                <span className="text-sm font-medium text-green-800">Session Progress</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-green-800">
                                                    {Math.round(progressPercentage)}%
                                                </div>
                                            </div>
                                        </div>
                                        <Progress value={progressPercentage} className="h-2 mb-2" />
                                        <div className="flex justify-between text-xs text-green-700">
                                            <span>{Math.round(progressPercentage)}% Complete</span>
                                            <span>{sessionStarted ? `${Math.floor(sessionTime / 60)}:${(sessionTime % 60).toString().padStart(2, '0')}` : 'Not started'}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Adaptive Assessment Card - Vital Signs or Mental Health */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            {sessionType === 'mental_health' ? (
                                                <Brain className="h-4 w-4 text-purple-600" />
                                            ) : (
                                                <Heart className="h-4 w-4 text-red-600" />
                                            )}
                                            <span className="text-sm font-medium text-gray-800">Quick Assessment</span>
                                            <Badge variant="outline" className="text-xs ml-auto">
                                                {sessionType === 'mental_health' ? 'Mental Health' : 'Medical'}
                                            </Badge>
                                        </div>
                                        <Tabs defaultValue={sessionType === 'mental_health' ? 'mental' : 'vitals'} className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 h-8 mb-3">
                                                <TabsTrigger value="vitals" className="text-xs h-7">
                                                    <Heart className="h-3 w-3 mr-1" />
                                                    Vitals
                                                </TabsTrigger>
                                                <TabsTrigger value="mental" className="text-xs h-7">
                                                    <Brain className="h-3 w-3 mr-1" />
                                                    Mental
                                                </TabsTrigger>
                                            </TabsList>
                                            
                                            <TabsContent value="vitals" className="mt-0 space-y-2">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <Label className="text-xs text-gray-600">BP</Label>
                                                        <div className="flex gap-1">
                                                            <Input 
                                                                type="number"
                                                                placeholder="120"
                                                                className="text-xs h-6 px-2"
                                                                value={vitalSigns.bloodPressure.systolic}
                                                                onChange={(e) => handleVitalSignChange('bloodPressure', e.target.value, 'systolic')}
                                                                disabled={!isSessionEditable}
                                                            />
                                                            <Input 
                                                                type="number"
                                                                placeholder="80"
                                                                className="text-xs h-6 px-2"
                                                                value={vitalSigns.bloodPressure.diastolic}
                                                                onChange={(e) => handleVitalSignChange('bloodPressure', e.target.value, 'diastolic')}
                                                                disabled={!isSessionEditable}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-gray-600">HR</Label>
                                                        <Input 
                                                            type="number"
                                                            placeholder="72"
                                                            className="text-xs h-6 px-2"
                                                            value={vitalSigns.heartRate}
                                                            onChange={(e) => handleVitalSignChange('heartRate', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-gray-600">Temp</Label>
                                                        <Input 
                                                            type="number"
                                                            placeholder="98.6"
                                                            className="text-xs h-6 px-2"
                                                            value={vitalSigns.temperature}
                                                            onChange={(e) => handleVitalSignChange('temperature', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                </div>
                                            </TabsContent>
                                            
                                            <TabsContent value="mental" className="mt-0 space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <Label className="text-xs text-gray-600">Mood</Label>
                                                        <Input 
                                                            placeholder="e.g., Anxious"
                                                            className="text-xs h-6 px-2"
                                                            value={mentalHealthData.moodAffect}
                                                            onChange={(e) => handleMentalHealthChange('moodAffect', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-gray-600">Risk</Label>
                                                        <Input 
                                                            placeholder="Low/Med/High"
                                                            className="text-xs h-6 px-2"
                                                            value={mentalHealthData.riskAssessment}
                                                            onChange={(e) => handleMentalHealthChange('riskAssessment', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-600">Session Goals</Label>
                                                    <Input 
                                                        placeholder="Brief session objectives"
                                                        className="text-xs h-6 px-2"
                                                        value={mentalHealthData.sessionGoals}
                                                        onChange={(e) => handleMentalHealthChange('sessionGoals', e.target.value)}
                                                        disabled={!isSessionEditable}
                                                    />
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Session Recording - Always visible when recording */}
                            {isRecording && (
                                <Card className="border-destructive">
                                    <CardHeader className="py-3">
                                        <CardTitle className="flex items-center gap-2 text-destructive text-sm">
                                            <Mic className="h-4 w-4" />
                                            Session Recording
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <Textarea 
                                            placeholder="Recording notes will appear here..."
                                            className="min-h-[80px] text-sm"
                                            value={sessionData.sessionRecording}
                                            onChange={(e) => handleSessionDataChange('sessionRecording', e.target.value)}
                                        />
                                    </CardContent>
                                </Card>
                            )}

                            {/* Main Content Area with 4 Tabs */}
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow">
                                <TabsList className="grid w-full grid-cols-5 mb-4">
                                    <TabsTrigger value="notes" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                                        <Clipboard className="mr-2 h-4 w-4" />
                                        Notes
                                    </TabsTrigger>                                    
                                    <TabsTrigger value="chief-complaint" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                                        <Clipboard className="mr-2 h-4 w-4" />
                                        Chief Complaint
                                    </TabsTrigger>
                                    <TabsTrigger value="documentation" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                                        <FileText className="mr-2 h-4 w-4" />
                                        Documentation
                                    </TabsTrigger>
                                    <TabsTrigger value="assessment" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                                        <Activity className="mr-2 h-4 w-4" />
                                        Assessment
                                    </TabsTrigger>
                                    <TabsTrigger value="prescription" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                                        <Pill className="mr-2 h-4 w-4" />
                                        Prescription
                                    </TabsTrigger>
                                    <TabsTrigger value="document-requests" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                                        <FileText className="mr-2 h-4 w-4" />
                                        Doc Requests
                                    </TabsTrigger>
                                </TabsList>







                                {/* Notes Tab ahnuf */}
                                 <TabsContent value="notes" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-primary text-sm">
                                                Notes
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                                <div className="w-[250px] mb-5">
                                                    {/* <Label htmlFor="noteType">AI Note Format</Label> */}
                                                        <Select 
                                                        value={sessionData.note_type || ""}
                                                        onValueChange={(value) => handleSessionDataChange('note_type', value)}>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select Note Type for AI" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {noteTypes.map((type) => (
                                                            <SelectItem key={type.value} value={type.value}>
                                                                {type.label}
                                                            </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                        </Select>

                                                    {/* {sessionData.note_type && (
                                                        <p className="mt-3 text-sm text-muted-foreground">
                                                        Selected: <span className="font-medium text-foreground">{sessionData.note_type}</span>
                                                        </p>
                                                    )} */}
                                                </div>
                                                 <Textarea 
                                                placeholder="Any additional observations or notes..."
                                                className="min-h-[80px] text-sm"
                                                value={sessionData.notes}
                                                onChange={(e) => handleSessionDataChange('notes', e.target.value)}
                                                disabled={!isSessionEditable}
                                            />
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                
                                {/* Chief Complaint Tab */}
                                <TabsContent value="chief-complaint" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-primary text-sm">
                                                Chief Complaint
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Textarea 
                                                placeholder="Patient's main concern or reason for visit..."
                                                className="min-h-[100px] text-sm"
                                                value={sessionData.chiefComplaint}
                                                onChange={(e) => handleSessionDataChange('chiefComplaint', e.target.value)}
                                                disabled={!isSessionEditable}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-primary text-sm">
                                                Quick Examination Notes
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Textarea 
                                                placeholder="Physical and mental status examination findings..."
                                                className="min-h-[100px] text-sm"
                                                value={sessionData.examination}
                                                onChange={(e) => handleSessionDataChange('examination', e.target.value)}
                                                disabled={!isSessionEditable}
                                            />
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Documentation Tab */}
                                <TabsContent value="documentation" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-primary text-sm">
                                                History of Present Illness
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Textarea 
                                                placeholder="Detailed history of the current condition..."
                                                className="min-h-[100px] text-sm"
                                                value={sessionData.historyOfPresentIllness}
                                                onChange={(e) => handleSessionDataChange('historyOfPresentIllness', e.target.value)}
                                                disabled={!isSessionEditable}
                                            />
                                        </CardContent>
                                    </Card>

                                    {/* <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-primary text-sm">
                                                Notes
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Textarea 
                                                placeholder="Any additional observations or notes..."
                                                className="min-h-[80px] text-sm"
                                                value={sessionData.notes}
                                                onChange={(e) => handleSessionDataChange('notes', e.target.value)}
                                                disabled={!isSessionEditable}
                                            />
                                        </CardContent>
                                    </Card> */}
                                </TabsContent>

                                {/* Assessment Tab */}
                                <TabsContent value="assessment" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-primary text-sm">
                                                Clinical Assessment
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Textarea 
                                                placeholder="Clinical assessment and diagnosis..."
                                                className="min-h-[80px] text-sm"
                                                value={sessionData.assessment}
                                                onChange={(e) => handleSessionDataChange('assessment', e.target.value)}
                                                disabled={!isSessionEditable}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-primary text-sm">
                                                Treatment Plan
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Textarea 
                                                placeholder="Treatment plan and follow-up instructions..."
                                                className="min-h-[80px] text-sm"
                                                value={sessionData.plan}
                                                onChange={(e) => handleSessionDataChange('plan', e.target.value)}
                                                disabled={!isSessionEditable}
                                            />
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Prescription Tab */}
                                <TabsContent value="prescription" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3">
                                            <div className="flex justify-between items-center">
                                                <CardTitle className="text-primary text-sm">
                                                    Prescription Management
                                                </CardTitle>
                                                <Button 
                                                    onClick={addPrescription}
                                                    size="sm"
                                                    className="bg-primary hover:bg-primary/90 text-xs"
                                                    disabled={!isSessionEditable}
                                                >
                                                    <Plus className="mr-2 h-3 w-3" />
                                                    Add Medication
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3 pt-0">
                                            {prescriptions.map((prescription) => (
                                                <div key={prescription.id} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                                                    <div className="col-span-5">
                                                        <Label className="text-xs">Medicine</Label>
                                                        <Input 
                                                            placeholder="Medicine name"
                                                            className="text-xs h-8"
                                                            value={prescription.medicine}
                                                            onChange={(e) => updatePrescription(prescription.id, 'medicine', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <Label className="text-xs">Dosage</Label>
                                                        <Input 
                                                            placeholder="mg"
                                                            className="text-xs h-8"
                                                            value={prescription.dosage}
                                                            onChange={(e) => updatePrescription(prescription.id, 'dosage', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <Label className="text-xs">Frequency</Label>
                                                        <Input 
                                                            placeholder="e.g., 2 times daily"
                                                            className="text-xs h-8"
                                                            value={prescription.frequency}
                                                            onChange={(e) => updatePrescription(prescription.id, 'frequency', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Label className="text-xs">Duration</Label>
                                                        <Input 
                                                            placeholder="days"
                                                            className="text-xs h-8"
                                                            value={prescription.duration}
                                                            onChange={(e) => updatePrescription(prescription.id, 'duration', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            onClick={() => removePrescription(prescription.id)}
                                                            className="text-destructive hover:text-destructive/80 h-8 w-8"
                                                            disabled={!isSessionEditable}
                                                        >
                                                            <Trash className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}

                                            {prescriptions.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    No medications prescribed yet
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Document Requests Tab */}
                                <TabsContent value="document-requests" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3">
                                            <div className="flex justify-between items-center">
                                                <CardTitle className="text-primary text-sm">
                                                    Request Documents from Patient
                                                </CardTitle>
                                                <Button 
                                                    onClick={addDocumentRequest}
                                                    size="sm"
                                                    className="bg-primary hover:bg-primary/90 text-xs"
                                                    disabled={!isSessionEditable}
                                                >
                                                    <Plus className="mr-2 h-3 w-3" />
                                                    Request Document
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3 pt-0">
                                            
                                            {documentRequests.map((request) => (
                                                <div key={request.id} className="p-4 border rounded-lg space-y-3">
                                                    <div className="flex justify-end items-center gap-2 pb-2">
                                                        <Label htmlFor={`by-practitioner-${request.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                                            To be uploaded by Practitioner
                                                        </Label>
                                                        <Switch
                                                            id={`by-practitioner-${request.id}`}
                                                            checked={request.by_practitioner || false}
                                                            onCheckedChange={(checked) => updateDocumentRequest(request.id, 'by_practitioner', checked)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-12 gap-3">
                                                        
                                                        <div className="col-span-4">
                                                            <Label className="text-xs">Document Type</Label>
                                                            <select 
                                                                className="w-full text-xs h-8 px-2 border rounded"
                                                                value={request.document_type}
                                                                onChange={(e) => updateDocumentRequest(request.id, 'document_type', e.target.value)}
                                                                disabled={!isSessionEditable}
                                                            >
                                                                <option value="">Select type...</option>
                                                                <option value="lab_result">Lab Result</option>
                                                                <option value="imaging">Imaging (X-ray, MRI, etc.)</option>
                                                                <option value="prescription">Prescription/Medication</option>
                                                                <option value="report">Clinical Note/Report</option>
                                                                <option value="consent">Consent Form</option>
                                                                <option value="additional">Additional Documents</option>
                                                                <option value="other">Other</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-5">
                                                            <Label className="text-xs">Title/What's Needed</Label>
                                                            <Input 
                                                                placeholder="e.g., Blood Test Results, X-Ray of Left Knee"
                                                                className="text-xs h-8"
                                                                value={request.title}
                                                                onChange={(e) => updateDocumentRequest(request.id, 'title', e.target.value)}
                                                                disabled={!isSessionEditable}
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <Label className="text-xs">Priority</Label>
                                                            <select 
                                                                className="w-full text-xs h-8 px-2 border rounded"
                                                                value={request.priority}
                                                                onChange={(e) => updateDocumentRequest(request.id, 'priority', e.target.value)}
                                                                disabled={!isSessionEditable}
                                                            >
                                                                <option value="normal">Normal</option>
                                                                <option value="high">High</option>
                                                                <option value="urgent">Urgent</option>
                                                                <option value="low">Low</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                onClick={() => removeDocumentRequest(request.id)}
                                                                className="text-destructive hover:text-destructive/80 h-8 w-8"
                                                                disabled={!isSessionEditable}
                                                            >
                                                                <Trash className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Description (Optional)</Label>
                                                        <Textarea 
                                                            placeholder="Additional details about what you need..."
                                                            className="text-xs min-h-[60px]"
                                                            value={request.description}
                                                            onChange={(e) => updateDocumentRequest(request.id, 'description', e.target.value)}
                                                            disabled={!isSessionEditable}
                                                        />
                                                    </div>
                                                </div>
                                            ))}

                                            {documentRequests.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                                    <p>No document requests yet</p>
                                                    <p className="text-xs">Request specific documents from the patient</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Right Column - AI Summary (animations removed for performance) */}
                        <div className="overflow-hidden relative h-full">
                            {aiPanelCollapsed ? (
                                /* Collapsed State - Vertical Toggle Button */
                                <div className="h-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 border rounded-lg shadow-lg flex flex-col items-center justify-center cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all duration-300"
                                     onClick={() => setAiPanelCollapsed(false)}>
                                    <motion.div
                                        className="text-blue-700 flex flex-col items-center gap-6"
                                        initial={false}
                                        animate={{ scale: 1 }}
                                        whileHover={{ scale: 1.02 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Brain className="h-5 w-5" />
                                        <div className="text-xs font-medium transform -rotate-90 whitespace-nowrap">
                                            AI Panel
                                        </div>
                                        <ChevronRight className="h-4 w-4" />
                                    </motion.div>
                                </div>
                            ) : (
                                /* Expanded State - Original Card */
                                <Card className={`h-full overflow-hidden flex flex-col transition-colors duration-300 ${
                                    showHistoryView ? 'bg-white border-gray-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                                }`}>
                                <CardHeader className="py-3 overflow-hidden flex-shrink-0">
                                    <CardTitle className={`flex items-center justify-between text-sm transition-colors duration-300 ${
                                        showHistoryView ? 'text-gray-800' : 'text-blue-800'
                                    }`}>
                                        <motion.div 
                                            className="flex items-center gap-2 min-w-0 flex-1"
                                            layout
                                        >
                                            {showHistoryView ? (
                                                <>
                                                    <History className="h-4 w-4 flex-shrink-0" />
                                                    <span className="truncate">Appointment History</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Brain className="h-4 w-4 flex-shrink-0" />
                                                    <span className="truncate">AI Summary & Patient History</span>
                                                </>
                                            )}
                                        </motion.div>
                                        <div className="flex items-center gap-2">
                                            {showHistoryView ? (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="border-gray-300 text-gray-700 hover:bg-gray-100 text-xs h-7 flex-shrink-0"
                                                    onClick={() => setShowHistoryView(false)}
                                                >
                                                    <ArrowLeft className="mr-1 h-3 w-3" />
                                                    Back to AI Summary
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="border-blue-300 text-blue-700 hover:bg-blue-100 text-xs h-7 flex-shrink-0"
                                                    onClick={() => setShowHistoryView(true)}
                                                >
                                                    <History className="mr-1 h-3 w-3" />
                                                    View Full History
                                                </Button>
                                            )}
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="border-blue-300 text-blue-700 hover:bg-blue-100 text-xs h-7 flex-shrink-0"
                                                onClick={() => setAiPanelCollapsed(true)}
                                                title="Collapse AI Panel"
                                            >
                                                <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-0 overflow-y-auto overflow-x-hidden flex-1">
                                    <AnimatePresence mode="wait">
                                        {showHistoryView ? (
                                            /* History View */
                                            <motion.div 
                                                key="history"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.3 }}
                                                className="space-y-4"
                                            >
                                                <div className="text-xs text-gray-600 border-b border-gray-200 pb-2 break-words">
                                                    {patientInfo.name} • {dynamicHistory.length} previous appointments
                                                </div>
                                                {dynamicHistory.map((appt, index) => (
                                                    <motion.div 
                                                        key={index} 
                                                        className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => {
                                                            // Navigate to separate page instead of showing overlay
                                                            const appointmentData = {
                                                                date: new Date(appt.appointment_date).toLocaleDateString(),
                                                                type: appt.service || 'Consultation',
                                                                chiefComplaint: appt.encounter_details?.chief_complaint || 'No chief complaint recorded',
                                                                historyOfPresentIllness: appt.encounter_details?.history_of_present_illness || '',
                                                                findings: appt.encounter_details?.examination_notes ? [appt.encounter_details.examination_notes] : ['No examination notes recorded'],
                                                                clinicalAssessment: appt.encounter_details?.clinical_assessment || '',
                                                                treatmentPlan: appt.encounter_details?.treatment_plan || '',
                                                                additionalNotes: appt.encounter_details?.additional_notes || '',
                                                                mentalHealthData: {
                                                                    mentalStateExam: appt.encounter_details?.mental_health_assessment?.mental_state_exam || '',
                                                                    moodAffect: appt.encounter_details?.mental_health_assessment?.mood_affect || '',
                                                                    thoughtProcess: appt.encounter_details?.mental_health_assessment?.thought_process || '',
                                                                    cognitiveAssessment: appt.encounter_details?.mental_health_assessment?.cognitive_assessment || '',
                                                                    riskAssessment: appt.encounter_details?.mental_health_assessment?.risk_assessment || '',
                                                                    therapeuticInterventions: appt.encounter_details?.mental_health_assessment?.therapeutic_interventions || '',
                                                                    sessionGoals: appt.encounter_details?.mental_health_assessment?.session_goals || '',
                                                                    homeworkAssignments: appt.encounter_details?.mental_health_assessment?.homework_assignments || ''
                                                                },
                                                                prescriptions: appt.encounter_details?.prescriptions ? 
                                                                    appt.encounter_details.prescriptions.map((p: any) => `${p.medicine_name} ${p.dosage} - ${p.frequency} for ${p.duration}`) : 
                                                                    ['No prescriptions recorded'],
                                                                vitalSigns: {
                                                                    bloodPressure: appt.encounter_details?.vital_signs?.blood_pressure || '',
                                                                    heartRate: appt.encounter_details?.vital_signs?.heart_rate || '',
                                                                    temperature: appt.encounter_details?.vital_signs?.temperature || '',
                                                                    weight: appt.encounter_details?.vital_signs?.weight || ''
                                                                },
                                                                status: appt.encounter_details?.session_details?.status || '',
                                                                sessionDuration: appt.encounter_details?.session_details?.duration_seconds ? 
                                                                    `${Math.floor(appt.encounter_details.session_details.duration_seconds / 60)} minutes` : ''
                                                            };
                                                            
                                                            router.visit(route('session.history.detail', appt.id), {
                                                                method: 'get',
                                                                data: {
                                                                    appointment: appointmentData,
                                                                    currentSessionId: appointment?.id
                                                                }
                                                            });
                                                        }}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <h3 className="font-medium text-gray-800 text-sm">{appt.service || 'Consultation'}</h3>
                                                                <p className="text-xs text-gray-600">{new Date(appt.appointment_date).toLocaleDateString()}</p>
                                                            </div>
                                                            <div className="text-xs text-gray-500">Click to view details</div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div>
                                                                <p className="text-xs font-medium text-gray-800">Chief Complaint</p>
                                                                <p className="text-xs text-gray-700">{appt.encounter_details?.chief_complaint || 'No chief complaint recorded'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium text-gray-800">Status</p>
                                                                <p className="text-xs text-gray-700">
                                                                    {appt.encounter_details ? (
                                                                        <span className={`inline-flex px-2 py-1 rounded text-xs ${
                                                                            appt.encounter_details.session_details?.status === 'completed' 
                                                                                ? 'bg-green-100 text-green-800' 
                                                                                : 'bg-yellow-100 text-yellow-800'
                                                                        }`}>
                                                                            {appt.encounter_details.session_details?.status || 'In Progress'}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-500 italic">No encounter data</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </motion.div>
                                        ) : (
                                            /* AI Summary View */
                                            <motion.div
                                                key="ai-summary"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <div className="text-xs text-blue-600 border-b border-blue-200 pb-2 break-words">
                                                    {isGeneratingAI ? (
                                                        <span className="animate-pulse">Generating AI Summary...</span>
                                                    ) : (
                                                        `${aiSummary.length} previous visits | Last visit: ${appointment?.appointment_datetime ? new Date(appointment.appointment_datetime).toLocaleDateString() : 'N/A'}`
                                                    )}
                                                </div>
                                                
                                                <div className="overflow-hidden">
                                                    <Label className="font-semibold text-blue-800 text-sm">Clinical Summary</Label>
                                                    <div className="text-sm text-blue-900 leading-relaxed mt-2 break-words overflow-wrap-anywhere">
                                                        {isGeneratingAI ? (
                                                            <span className="animate-pulse">Loading AI summary...</span>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {aiSummary.map((sentence, index) => (
                                                                    <div key={index} className="leading-relaxed">
                                                                        {index === aiCurrentIndex ? aiCurrentText : (index < aiCurrentIndex ? sentence : '')}
                                                                        {index === aiCurrentIndex && aiCurrentText.length > 0 && (
                                                                            <span className="animate-pulse">|</span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="overflow-hidden">
                                                    <Label className="font-semibold text-blue-800 text-sm">Key Findings</Label>
                                                    <ul className="mt-2 space-y-1">
                                                        {isGeneratingAI ? (
                                                            <li className="text-sm text-blue-800 italic">Loading key findings...</li>
                                                        ) : (
                                                            aiSummary.slice(0, Math.min(5, aiCurrentIndex + 1)).map((sentence, index) => (
                                                                <li key={index} className="flex items-start gap-2 text-sm">
                                                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                                                                    <span className="leading-relaxed text-blue-800 break-words overflow-wrap-anywhere flex-1">{sentence}</span>
                                                                </li>
                                                            ))
                                                        )}
                                                    </ul>
                                                </div>

                                                <div className="overflow-hidden">
                                                    <Label className="font-semibold text-blue-800 text-sm">Current Medications</Label>
                                                    <ul className="mt-2 space-y-1">
                                                        {isGeneratingAI ? (
                                                            <li className="text-sm text-blue-800 italic">Loading medication history...</li>
                                                        ) : (
                                                            aiSummary.slice(0, Math.min(3, aiCurrentIndex + 1)).map((sentence, index) => (
                                                                <li key={index} className="flex items-start gap-2 text-sm">
                                                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                                                                    <span className="leading-relaxed text-blue-800 break-words overflow-wrap-anywhere flex-1">{sentence}</span>
                                                                </li>
                                                            ))
                                                        )}
                                                    </ul>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </CardContent>
                            </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            </AppLayout>
        );
    }