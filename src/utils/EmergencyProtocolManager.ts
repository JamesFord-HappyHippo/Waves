/**
 * Emergency Protocol Manager - Handles emergency contacts, location sharing, and coordination
 * Integrates with coast guard, marine rescue services, and emergency response systems
 */

import { Location, VesselProfile } from '../types';
import { EmergencyContact } from './SafetySystem';
import { SafetyAlert } from './SafetyAlertHierarchy';

export interface EmergencyContact {
  id: string;
  name: string;
  type: 'coast_guard' | 'harbor_master' | 'marine_police' | 'rescue_service' | 'tow_service' | 'family' | 'friend' | 'marina';
  priority: number; // 1-10, 10 being highest priority
  phoneNumbers: ContactPhone[];
  email?: string;
  vhfChannel?: number;
  mmsi?: string; // For vessel contacts
  position?: Location; // Last known position for mobile contacts
  serviceArea: ServiceArea;
  availability: ContactAvailability;
  capabilities: ServiceCapability[];
  responseTime: number; // Expected response time in minutes
  languages: string[];
  notes?: string;
  verified: boolean; // Contact information verified
  lastContactAttempt?: number;
  lastSuccessfulContact?: number;
}

export interface ContactPhone {
  number: string;
  type: 'mobile' | 'landline' | 'satellite' | 'emergency_only';
  primary: boolean;
  countryCode: string;
  extension?: string;
}

export interface ServiceArea {
  center: Location;
  radiusKm: number;
  boundaries?: Location[]; // Polygon boundaries if not circular
  jurisdictions: string[]; // Legal jurisdictions covered
  waterTypes: Array<'coastal' | 'offshore' | 'inland' | 'harbor' | 'river'>;
}

export interface ContactAvailability {
  available24h: boolean;
  businessHours?: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  };
  seasonalLimitations?: {
    start: string; // MM-DD format
    end: string;
    reason: string;
  };
  emergencyOverride: boolean; // Available for emergencies even outside hours
}

export interface ServiceCapability {
  type: 'rescue' | 'towing' | 'medical' | 'firefighting' | 'pollution_response' | 'law_enforcement' | 'coordination';
  vesselTypes: string[]; // Types of vessels they can assist
  maxVesselSize: number; // Meters
  equipmentAvailable: string[];
  specializations: string[];
  limitations: string[];
}

export interface EmergencyIncident {
  id: string;
  type: 'grounding' | 'collision' | 'fire' | 'flooding' | 'medical' | 'mechanical' | 'weather' | 'missing' | 'distress';
  severity: 'low' | 'medium' | 'high' | 'critical' | 'mayday';
  status: 'reported' | 'acknowledged' | 'responding' | 'on_scene' | 'resolved' | 'cancelled';
  reportedAt: number;
  location: Location;
  vesselInfo: VesselProfile;
  personOnBoard: number;
  injuries: boolean;
  immediateDanger: boolean;
  description: string;
  contactsNotified: NotificationRecord[];
  responseCoordination: ResponseCoordination;
  updates: IncidentUpdate[];
  resources: ResourceDeployment[];
  resolution?: IncidentResolution;
}

export interface NotificationRecord {
  contactId: string;
  method: 'phone' | 'vhf' | 'email' | 'sms' | 'satellite' | 'ais';
  attemptedAt: number;
  successful: boolean;
  responseTime?: number;
  notes?: string;
  retryCount: number;
}

export interface ResponseCoordination {
  leadAgency: string;
  coordinationCenter: string;
  searchPattern?: string;
  rendezvousPoint?: Location;
  communicationPlan: CommunicationPlan;
  authorizations: string[];
  restrictions: string[];
}

export interface CommunicationPlan {
  primaryVhfChannel: number;
  backupVhfChannel?: number;
  workingFrequencies: number[];
  sateliteComms?: {
    provider: string;
    identifier: string;
  };
  positionReporting: {
    interval: number; // minutes
    method: 'vhf' | 'ais' | 'satellite' | 'cellular';
  };
}

export interface IncidentUpdate {
  id: string;
  timestamp: number;
  source: string; // Who provided the update
  type: 'status_change' | 'position_update' | 'resource_deployment' | 'weather_change' | 'progress_report';
  content: string;
  location?: Location;
  urgent: boolean;
}

export interface ResourceDeployment {
  id: string;
  type: 'vessel' | 'aircraft' | 'personnel' | 'equipment';
  name: string;
  eta: number;
  position?: Location;
  capabilities: string[];
  contact: string;
  status: 'dispatched' | 'en_route' | 'on_scene' | 'returning' | 'available';
}

export interface IncidentResolution {
  resolvedAt: number;
  outcome: 'rescued' | 'self_recovered' | 'towed' | 'false_alarm' | 'cancelled' | 'ongoing';
  summary: string;
  lessonsLearned?: string[];
  followUpRequired?: string[];
}

export interface LocationSharingSession {
  id: string;
  vesselId: string;
  startedAt: number;
  endsAt?: number;
  shareWith: string[]; // Contact IDs
  frequency: number; // Update frequency in seconds
  includeVesselData: boolean;
  includeEnvironmental: boolean;
  emergency: boolean;
  permissions: SharingPermission[];
  lastUpdate: number;
  updateCount: number;
}

export interface SharingPermission {
  contactId: string;
  canViewLocation: boolean;
  canViewVesselData: boolean;
  canViewEnvironmental: boolean;
  canReceiveAlerts: boolean;
  accessLevel: 'basic' | 'detailed' | 'full';
  expiresAt?: number;
}

export interface PositionReport {
  vesselId: string;
  timestamp: number;
  location: Location;
  course: number;
  speed: number;
  status: 'underway' | 'anchored' | 'moored' | 'aground' | 'disabled' | 'emergency';
  vesselData?: {
    draft: number;
    crew: number;
    fuel: number; // Percentage
    water: number; // Percentage
  };
  environmental?: {
    windSpeed: number;
    windDirection: number;
    waveHeight: number;
    visibility: number;
    temperature: number;
  };
  emergencyStatus?: {
    distress: boolean;
    urgency: boolean;
    safety: boolean;
    description?: string;
  };
}

export class EmergencyProtocolManager {
  private emergencyContacts: Map<string, EmergencyContact> = new Map();
  private activeIncidents: Map<string, EmergencyIncident> = new Map();
  private locationSharingSessions: Map<string, LocationSharingSession> = new Map();
  private incidentSubscribers: Array<(incident: EmergencyIncident) => void> = [];
  private locationSubscribers: Array<(report: PositionReport) => void> = [];

  constructor() {
    this.initializeDefaultContacts();
  }

  /**
   * Register an emergency contact
   */
  addEmergencyContact(contact: Omit<EmergencyContact, 'id'>): EmergencyContact {
    const fullContact: EmergencyContact = {
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...contact
    };

    this.emergencyContacts.set(fullContact.id, fullContact);
    console.log(`[EMERGENCY CONTACT] Added ${fullContact.type}: ${fullContact.name}`);
    return fullContact;
  }

  /**
   * Get emergency contacts for a specific location and situation
   */
  getEmergencyContacts(
    location: Location,
    incidentType?: string,
    vesselType?: string
  ): EmergencyContact[] {
    const applicableContacts = Array.from(this.emergencyContacts.values())
      .filter(contact => {
        // Check if contact serves this area
        const distance = this.calculateDistance(location, contact.serviceArea.center);
        if (distance > contact.serviceArea.radiusKm * 1000) return false;

        // Check vessel type compatibility if specified
        if (vesselType && contact.capabilities.length > 0) {
          const compatibleCapability = contact.capabilities.some(cap =>
            cap.vesselTypes.includes(vesselType) || cap.vesselTypes.includes('all')
          );
          if (!compatibleCapability) return false;
        }

        // Check if contact is currently available
        if (!this.isContactAvailable(contact)) return false;

        return true;
      })
      .sort((a, b) => {
        // Sort by priority, then by distance
        if (a.priority !== b.priority) return b.priority - a.priority;
        
        const distanceA = this.calculateDistance(location, a.serviceArea.center);
        const distanceB = this.calculateDistance(location, b.serviceArea.center);
        return distanceA - distanceB;
      });

    return applicableContacts;
  }

  /**
   * Report an emergency incident
   */
  async reportEmergencyIncident(
    type: EmergencyIncident['type'],
    severity: EmergencyIncident['severity'],
    location: Location,
    vesselInfo: VesselProfile,
    description: string,
    options: {
      personOnBoard?: number;
      injuries?: boolean;
      immediateDanger?: boolean;
    } = {}
  ): Promise<EmergencyIncident> {
    const incident: EmergencyIncident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      status: 'reported',
      reportedAt: Date.now(),
      location,
      vesselInfo,
      personOnBoard: options.personOnBoard || 1,
      injuries: options.injuries || false,
      immediateDanger: options.immediateDanger || severity === 'mayday',
      description,
      contactsNotified: [],
      responseCoordination: {
        leadAgency: '',
        coordinationCenter: '',
        communicationPlan: {
          primaryVhfChannel: 16, // International distress frequency
          workingFrequencies: [],
          positionReporting: {
            interval: 15, // Every 15 minutes
            method: 'vhf'
          }
        },
        authorizations: [],
        restrictions: []
      },
      updates: [],
      resources: []
    };

    // Store incident
    this.activeIncidents.set(incident.id, incident);

    // Determine appropriate contacts and notify them
    await this.notifyEmergencyContacts(incident);

    // Start emergency location sharing
    if (severity === 'mayday' || severity === 'critical') {
      await this.startEmergencyLocationSharing(incident);
    }

    // Notify subscribers
    this.notifyIncidentSubscribers(incident);

    console.log(`[EMERGENCY INCIDENT] Reported ${type} incident (${severity}): ${incident.id}`);
    return incident;
  }

  /**
   * Notify appropriate emergency contacts for an incident
   */
  private async notifyEmergencyContacts(incident: EmergencyIncident): Promise<void> {
    const contacts = this.getEmergencyContacts(
      incident.location,
      incident.type,
      incident.vesselInfo.type
    );

    // Prioritize contacts based on incident severity
    let contactsToNotify = contacts;
    if (incident.severity === 'mayday' || incident.severity === 'critical') {
      // Notify all relevant contacts immediately
      contactsToNotify = contacts;
    } else if (incident.severity === 'high') {
      // Notify top 3 contacts
      contactsToNotify = contacts.slice(0, 3);
    } else {
      // Notify top contact only
      contactsToNotify = contacts.slice(0, 1);
    }

    // Perform notifications
    for (const contact of contactsToNotify) {
      await this.notifyContact(contact, incident);
    }

    // Set lead agency for coordination
    if (contactsToNotify.length > 0) {
      const leadContact = contactsToNotify[0];
      incident.responseCoordination.leadAgency = leadContact.name;
      
      if (leadContact.type === 'coast_guard') {
        incident.responseCoordination.coordinationCenter = 'Coast Guard Operations Center';
      } else if (leadContact.type === 'rescue_service') {
        incident.responseCoordination.coordinationCenter = 'Marine Rescue Coordination Center';
      }
    }
  }

  /**
   * Notify a specific contact about an incident
   */
  private async notifyContact(
    contact: EmergencyContact,
    incident: EmergencyIncident
  ): Promise<void> {
    const notificationRecord: NotificationRecord = {
      contactId: contact.id,
      method: 'phone', // Start with phone
      attemptedAt: Date.now(),
      successful: false,
      retryCount: 0
    };

    try {
      // Attempt notification via multiple methods
      const methods: NotificationRecord['method'][] = ['phone', 'vhf'];
      if (contact.email) methods.push('email');

      for (const method of methods) {
        const success = await this.attemptNotification(contact, incident, method);
        if (success) {
          notificationRecord.method = method;
          notificationRecord.successful = true;
          notificationRecord.responseTime = Date.now() - notificationRecord.attemptedAt;
          break;
        }
      }

      // Record notification attempt
      incident.contactsNotified.push(notificationRecord);

      if (notificationRecord.successful) {
        console.log(`[EMERGENCY NOTIFICATION] Successfully notified ${contact.name} via ${notificationRecord.method}`);
        
        // Update incident status
        if (incident.status === 'reported') {
          incident.status = 'acknowledged';
          this.addIncidentUpdate(incident, `Contact established with ${contact.name}`, 'status_change');
        }
      } else {
        console.warn(`[EMERGENCY NOTIFICATION] Failed to notify ${contact.name}`);
        
        // Schedule retry for critical incidents
        if (incident.severity === 'mayday' || incident.severity === 'critical') {
          setTimeout(() => {
            this.retryContactNotification(contact, incident);
          }, 60000); // Retry in 1 minute
        }
      }

    } catch (error) {
      console.error(`[EMERGENCY NOTIFICATION ERROR] Error notifying ${contact.name}:`, error);
      incident.contactsNotified.push(notificationRecord);
    }
  }

  /**
   * Attempt notification via a specific method
   */
  private async attemptNotification(
    contact: EmergencyContact,
    incident: EmergencyIncident,
    method: NotificationRecord['method']
  ): Promise<boolean> {
    const message = this.createNotificationMessage(incident);

    switch (method) {
      case 'phone':
        return this.makePhoneCall(contact, message);
      case 'vhf':
        return this.sendVhfMessage(contact, message);
      case 'email':
        return this.sendEmail(contact, message);
      case 'sms':
        return this.sendSMS(contact, message);
      default:
        return false;
    }
  }

  /**
   * Start emergency location sharing
   */
  async startEmergencyLocationSharing(incident: EmergencyIncident): Promise<LocationSharingSession> {
    const contacts = this.getEmergencyContacts(incident.location);
    const contactIds = contacts.map(c => c.id);

    const session: LocationSharingSession = {
      id: `sharing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vesselId: incident.vesselInfo.name || 'Unknown',
      startedAt: Date.now(),
      shareWith: contactIds,
      frequency: incident.severity === 'mayday' ? 60 : 300, // Every 1-5 minutes
      includeVesselData: true,
      includeEnvironmental: true,
      emergency: true,
      permissions: contactIds.map(id => ({
        contactId: id,
        canViewLocation: true,
        canViewVesselData: true,
        canViewEnvironmental: true,
        canReceiveAlerts: true,
        accessLevel: 'full' as const
      })),
      lastUpdate: Date.now(),
      updateCount: 0
    };

    this.locationSharingSessions.set(session.id, session);

    console.log(`[EMERGENCY SHARING] Started emergency location sharing session: ${session.id}`);
    return session;
  }

  /**
   * Start regular location sharing with selected contacts
   */
  startLocationSharing(
    vesselId: string,
    contactIds: string[],
    options: {
      frequency?: number;
      duration?: number;
      includeVesselData?: boolean;
      includeEnvironmental?: boolean;
      permissions?: Partial<SharingPermission>[];
    } = {}
  ): LocationSharingSession {
    const session: LocationSharingSession = {
      id: `sharing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vesselId,
      startedAt: Date.now(),
      endsAt: options.duration ? Date.now() + options.duration : undefined,
      shareWith: contactIds,
      frequency: options.frequency || 1800, // Default 30 minutes
      includeVesselData: options.includeVesselData || false,
      includeEnvironmental: options.includeEnvironmental || false,
      emergency: false,
      permissions: contactIds.map((id, index) => ({
        contactId: id,
        canViewLocation: true,
        canViewVesselData: options.includeVesselData || false,
        canViewEnvironmental: options.includeEnvironmental || false,
        canReceiveAlerts: false,
        accessLevel: 'basic' as const,
        ...options.permissions?.[index]
      })),
      lastUpdate: Date.now(),
      updateCount: 0
    };

    this.locationSharingSessions.set(session.id, session);

    console.log(`[LOCATION SHARING] Started location sharing session: ${session.id}`);
    return session;
  }

  /**
   * Send position report for active sharing sessions
   */
  sendPositionReport(report: PositionReport): void {
    const activeSessions = Array.from(this.locationSharingSessions.values())
      .filter(session => {
        // Check if session is still active
        if (session.endsAt && Date.now() > session.endsAt) return false;
        
        // Check if it's time for next update
        const timeSinceLastUpdate = Date.now() - session.lastUpdate;
        return timeSinceLastUpdate >= session.frequency * 1000;
      });

    for (const session of activeSessions) {
      this.broadcastPositionReport(session, report);
      session.lastUpdate = Date.now();
      session.updateCount++;
    }

    // Notify position subscribers
    this.locationSubscribers.forEach(subscriber => {
      try {
        subscriber(report);
      } catch (error) {
        console.error('Error notifying location subscriber:', error);
      }
    });
  }

  /**
   * Broadcast position report to session participants
   */
  private broadcastPositionReport(session: LocationSharingSession, report: PositionReport): void {
    for (const permission of session.permissions) {
      const contact = this.emergencyContacts.get(permission.contactId);
      if (!contact) continue;

      // Create filtered report based on permissions
      const filteredReport = this.filterReportByPermissions(report, permission);
      
      // Send report to contact
      this.sendReportToContact(contact, filteredReport, session);
    }

    console.log(`[POSITION BROADCAST] Sent position report to ${session.permissions.length} contacts`);
  }

  /**
   * Filter position report based on contact permissions
   */
  private filterReportByPermissions(
    report: PositionReport,
    permission: SharingPermission
  ): Partial<PositionReport> {
    const filtered: Partial<PositionReport> = {
      vesselId: report.vesselId,
      timestamp: report.timestamp
    };

    if (permission.canViewLocation) {
      filtered.location = report.location;
      filtered.course = report.course;
      filtered.speed = report.speed;
      filtered.status = report.status;
    }

    if (permission.canViewVesselData && report.vesselData) {
      filtered.vesselData = report.vesselData;
    }

    if (permission.canViewEnvironmental && report.environmental) {
      filtered.environmental = report.environmental;
    }

    if (permission.canReceiveAlerts && report.emergencyStatus) {
      filtered.emergencyStatus = report.emergencyStatus;
    }

    return filtered;
  }

  /**
   * Update incident status and notify stakeholders
   */
  updateIncident(
    incidentId: string,
    update: {
      status?: EmergencyIncident['status'];
      description?: string;
      location?: Location;
      resources?: ResourceDeployment[];
    }
  ): void {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) return;

    if (update.status && update.status !== incident.status) {
      incident.status = update.status;
      this.addIncidentUpdate(incident, `Status changed to ${update.status}`, 'status_change');
    }

    if (update.location) {
      incident.location = update.location;
      this.addIncidentUpdate(incident, 'Position updated', 'position_update');
    }

    if (update.resources) {
      incident.resources.push(...update.resources);
      this.addIncidentUpdate(incident, `${update.resources.length} resources deployed`, 'resource_deployment');
    }

    if (update.description) {
      this.addIncidentUpdate(incident, update.description, 'progress_report');
    }

    // Notify subscribers of incident update
    this.notifyIncidentSubscribers(incident);

    console.log(`[INCIDENT UPDATE] Updated incident ${incidentId}: ${update.status || 'details updated'}`);
  }

  /**
   * Resolve an incident
   */
  resolveIncident(
    incidentId: string,
    outcome: IncidentResolution['outcome'],
    summary: string,
    lessonsLearned?: string[]
  ): void {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) return;

    incident.status = 'resolved';
    incident.resolution = {
      resolvedAt: Date.now(),
      outcome,
      summary,
      lessonsLearned
    };

    this.addIncidentUpdate(incident, `Incident resolved: ${outcome}`, 'status_change');

    // Stop emergency location sharing if active
    const emergencySessions = Array.from(this.locationSharingSessions.values())
      .filter(session => session.emergency && session.vesselId === incident.vesselInfo.name);
    
    for (const session of emergencySessions) {
      session.endsAt = Date.now();
    }

    this.notifyIncidentSubscribers(incident);

    console.log(`[INCIDENT RESOLVED] Incident ${incidentId} resolved: ${outcome}`);
  }

  /**
   * Add update to incident
   */
  private addIncidentUpdate(
    incident: EmergencyIncident,
    content: string,
    type: IncidentUpdate['type'],
    urgent: boolean = false
  ): void {
    const update: IncidentUpdate = {
      id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      source: 'system',
      type,
      content,
      location: incident.location,
      urgent
    };

    incident.updates.push(update);
  }

  /**
   * Check if contact is currently available
   */
  private isContactAvailable(contact: EmergencyContact): boolean {
    if (contact.availability.available24h) return true;

    const now = new Date();
    const availability = contact.availability;

    // Check business hours
    if (availability.businessHours) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      const [startHour, startMin] = availability.businessHours.start.split(':').map(Number);
      const [endHour, endMin] = availability.businessHours.end.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      const currentDay = now.getDay();
      const isBusinessDay = availability.businessHours.daysOfWeek.includes(currentDay);
      const isBusinessHours = currentTime >= startTime && currentTime <= endTime;

      if (!isBusinessDay || !isBusinessHours) {
        return availability.emergencyOverride;
      }
    }

    // Check seasonal limitations
    if (availability.seasonalLimitations) {
      const currentMonth = now.getMonth() + 1;
      const currentDate = now.getDate();
      const currentMMDD = `${currentMonth.toString().padStart(2, '0')}-${currentDate.toString().padStart(2, '0')}`;

      const seasonStart = availability.seasonalLimitations.start;
      const seasonEnd = availability.seasonalLimitations.end;

      if (currentMMDD >= seasonStart && currentMMDD <= seasonEnd) {
        return availability.emergencyOverride;
      }
    }

    return true;
  }

  /**
   * Create notification message for an incident
   */
  private createNotificationMessage(incident: EmergencyIncident): string {
    const severity = incident.severity.toUpperCase();
    const type = incident.type.replace('_', ' ').toUpperCase();
    const vessel = incident.vesselInfo.name || 'Unknown Vessel';
    const location = `${incident.location.latitude.toFixed(4)}, ${incident.location.longitude.toFixed(4)}`;
    const pob = incident.personOnBoard;

    let message = `${severity} - ${type}\n`;
    message += `Vessel: ${vessel}\n`;
    message += `Position: ${location}\n`;
    message += `POB: ${pob}\n`;

    if (incident.injuries) message += `INJURIES REPORTED\n`;
    if (incident.immediateDanger) message += `IMMEDIATE DANGER\n`;

    message += `Description: ${incident.description}\n`;
    message += `Time: ${new Date(incident.reportedAt).toISOString()}`;

    return message;
  }

  // Helper methods for notification (would integrate with actual services)
  private async makePhoneCall(contact: EmergencyContact, message: string): Promise<boolean> {
    console.log(`[PHONE CALL] Calling ${contact.name}: ${contact.phoneNumbers[0]?.number}`);
    // Would integrate with phone/VoIP service
    return true; // Simulate success
  }

  private async sendVhfMessage(contact: EmergencyContact, message: string): Promise<boolean> {
    if (!contact.vhfChannel) return false;
    console.log(`[VHF] Broadcasting on channel ${contact.vhfChannel}: ${message}`);
    // Would integrate with VHF radio system
    return true;
  }

  private async sendEmail(contact: EmergencyContact, message: string): Promise<boolean> {
    if (!contact.email) return false;
    console.log(`[EMAIL] Sending to ${contact.email}: ${message}`);
    // Would integrate with email service
    return true;
  }

  private async sendSMS(contact: EmergencyContact, message: string): Promise<boolean> {
    console.log(`[SMS] Sending SMS: ${message}`);
    // Would integrate with SMS service
    return true;
  }

  private sendReportToContact(
    contact: EmergencyContact,
    report: Partial<PositionReport>,
    session: LocationSharingSession
  ): void {
    console.log(`[POSITION REPORT] Sending report to ${contact.name}`);
    // Would send report via appropriate method
  }

  private async retryContactNotification(contact: EmergencyContact, incident: EmergencyIncident): Promise<void> {
    console.log(`[RETRY NOTIFICATION] Retrying contact: ${contact.name}`);
    await this.notifyContact(contact, incident);
  }

  private calculateDistance(point1: Location, point2: Location): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Initialize default emergency contacts
   */
  private initializeDefaultContacts(): void {
    // US Coast Guard
    this.addEmergencyContact({
      name: 'US Coast Guard',
      type: 'coast_guard',
      priority: 10,
      phoneNumbers: [
        { number: '+1-800-424-8802', type: 'emergency_only', primary: true, countryCode: '+1' }
      ],
      vhfChannel: 16,
      serviceArea: {
        center: { latitude: 39.8283, longitude: -98.5795, accuracy: 1000, timestamp: Date.now() },
        radiusKm: 5000,
        jurisdictions: ['US Waters'],
        waterTypes: ['coastal', 'offshore']
      },
      availability: {
        available24h: true,
        emergencyOverride: true
      },
      capabilities: [
        {
          type: 'rescue',
          vesselTypes: ['all'],
          maxVesselSize: 1000,
          equipmentAvailable: ['helicopter', 'cutter', 'rescue_boat'],
          specializations: ['search_and_rescue', 'medical_evacuation'],
          limitations: []
        }
      ],
      responseTime: 30,
      languages: ['en'],
      verified: true
    });

    // Marine Police
    this.addEmergencyContact({
      name: 'Marine Police',
      type: 'marine_police',
      priority: 8,
      phoneNumbers: [
        { number: '+1-911', type: 'emergency_only', primary: true, countryCode: '+1' }
      ],
      vhfChannel: 22,
      serviceArea: {
        center: { latitude: 40.7128, longitude: -74.0060, accuracy: 1000, timestamp: Date.now() },
        radiusKm: 50,
        jurisdictions: ['State Waters'],
        waterTypes: ['coastal', 'harbor', 'inland']
      },
      availability: {
        available24h: true,
        emergencyOverride: true
      },
      capabilities: [
        {
          type: 'law_enforcement',
          vesselTypes: ['recreational', 'commercial'],
          maxVesselSize: 50,
          equipmentAvailable: ['patrol_boat'],
          specializations: ['law_enforcement', 'rescue'],
          limitations: ['weather_dependent']
        }
      ],
      responseTime: 15,
      languages: ['en'],
      verified: true
    });
  }

  /**
   * Subscribe to incident updates
   */
  subscribeToIncidents(callback: (incident: EmergencyIncident) => void): () => void {
    this.incidentSubscribers.push(callback);
    return () => {
      const index = this.incidentSubscribers.indexOf(callback);
      if (index > -1) this.incidentSubscribers.splice(index, 1);
    };
  }

  /**
   * Subscribe to location sharing updates
   */
  subscribeToLocationSharing(callback: (report: PositionReport) => void): () => void {
    this.locationSubscribers.push(callback);
    return () => {
      const index = this.locationSubscribers.indexOf(callback);
      if (index > -1) this.locationSubscribers.splice(index, 1);
    };
  }

  private notifyIncidentSubscribers(incident: EmergencyIncident): void {
    this.incidentSubscribers.forEach(subscriber => {
      try {
        subscriber(incident);
      } catch (error) {
        console.error('Error notifying incident subscriber:', error);
      }
    });
  }

  /**
   * Get all active incidents
   */
  getActiveIncidents(): EmergencyIncident[] {
    return Array.from(this.activeIncidents.values())
      .filter(incident => incident.status !== 'resolved' && incident.status !== 'cancelled');
  }

  /**
   * Get active location sharing sessions
   */
  getActiveLocationSharingSessions(): LocationSharingSession[] {
    return Array.from(this.locationSharingSessions.values())
      .filter(session => !session.endsAt || Date.now() < session.endsAt);
  }

  /**
   * Stop location sharing session
   */
  stopLocationSharing(sessionId: string): void {
    const session = this.locationSharingSessions.get(sessionId);
    if (session) {
      session.endsAt = Date.now();
      console.log(`[LOCATION SHARING] Stopped session: ${sessionId}`);
    }
  }
}

export default EmergencyProtocolManager;