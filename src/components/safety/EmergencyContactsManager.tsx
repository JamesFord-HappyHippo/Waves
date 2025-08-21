/**
 * Emergency Contacts Manager - Manage and display emergency contacts
 * Handles contact setup, verification, and quick access during emergencies
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Switch,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { EmergencyContact } from '../../utils/EmergencyProtocolManager';
import { Location } from '../../types';

interface EmergencyContactsManagerProps {
  contacts: EmergencyContact[];
  currentLocation: Location;
  onAddContact: (contact: Omit<EmergencyContact, 'id'>) => void;
  onUpdateContact: (contactId: string, updates: Partial<EmergencyContact>) => void;
  onDeleteContact: (contactId: string) => void;
  onTestContact: (contactId: string) => Promise<boolean>;
  onCallContact: (contactId: string) => void;
  onVhfContact: (contactId: string) => void;
}

interface NewContactForm {
  name: string;
  type: EmergencyContact['type'];
  phoneNumbers: string[];
  email: string;
  vhfChannel: string;
  priority: number;
  notes: string;
}

const EmergencyContactsManager: React.FC<EmergencyContactsManagerProps> = ({
  contacts,
  currentLocation,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onTestContact,
  onCallContact,
  onVhfContact,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState<EmergencyContact | null>(null);
  const [newContact, setNewContact] = useState<NewContactForm>({
    name: '',
    type: 'family',
    phoneNumbers: [''],
    email: '',
    vhfChannel: '',
    priority: 5,
    notes: ''
  });
  const [testingContact, setTestingContact] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'distance' | 'type'>('priority');

  const contactTypeIcons = {
    coast_guard: 'security',
    harbor_master: 'anchor',
    marine_police: 'local-police',
    rescue_service: 'emergency',
    tow_service: 'car-towing',
    family: 'family-restroom',
    friend: 'person',
    marina: 'directions-boat'
  };

  const contactTypeColors = {
    coast_guard: '#FF4444',
    harbor_master: '#007AFF',
    marine_police: '#FF8800',
    rescue_service: '#CC0000',
    tow_service: '#FFB000',
    family: '#00C851',
    friend: '#6C5CE7',
    marina: '#0984e3'
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return b.priority - a.priority;
      case 'distance':
        const distanceA = calculateDistance(currentLocation, a.serviceArea.center);
        const distanceB = calculateDistance(currentLocation, b.serviceArea.center);
        return distanceA - distanceB;
      case 'type':
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  const nearbyContacts = sortedContacts.filter(contact => {
    const distance = calculateDistance(currentLocation, contact.serviceArea.center);
    return distance <= contact.serviceArea.radiusKm * 1000;
  });

  const handleAddContact = () => {
    if (!newContact.name.trim()) {
      Alert.alert('Error', 'Contact name is required');
      return;
    }

    if (newContact.phoneNumbers.filter(p => p.trim()).length === 0 && !newContact.email.trim()) {
      Alert.alert('Error', 'At least one phone number or email is required');
      return;
    }

    const contact: Omit<EmergencyContact, 'id'> = {
      name: newContact.name.trim(),
      type: newContact.type,
      priority: newContact.priority,
      phoneNumbers: newContact.phoneNumbers
        .filter(p => p.trim())
        .map(number => ({
          number: number.trim(),
          type: 'mobile' as const,
          primary: true,
          countryCode: '+1'
        })),
      email: newContact.email.trim() || undefined,
      vhfChannel: newContact.vhfChannel ? parseInt(newContact.vhfChannel) : undefined,
      serviceArea: {
        center: currentLocation,
        radiusKm: newContact.type === 'family' || newContact.type === 'friend' ? 50 : 25,
        jurisdictions: [],
        waterTypes: ['coastal']
      },
      availability: {
        available24h: newContact.type === 'coast_guard' || newContact.type === 'rescue_service',
        emergencyOverride: true
      },
      capabilities: [],
      responseTime: newContact.type === 'coast_guard' ? 30 : 60,
      languages: ['en'],
      notes: newContact.notes.trim() || undefined,
      verified: false
    };

    onAddContact(contact);
    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setNewContact({
      name: '',
      type: 'family',
      phoneNumbers: [''],
      email: '',
      vhfChannel: '',
      priority: 5,
      notes: ''
    });
  };

  const handleTestContact = async (contactId: string) => {
    setTestingContact(contactId);
    try {
      const success = await onTestContact(contactId);
      Alert.alert(
        'Contact Test',
        success ? 'Contact test successful' : 'Contact test failed',
        [{ text: 'OK' }]
      );
    } finally {
      setTestingContact(null);
    }
  };

  const handleCallContact = (contact: EmergencyContact) => {
    if (contact.phoneNumbers.length === 0) {
      Alert.alert('Error', 'No phone numbers available for this contact');
      return;
    }

    if (contact.phoneNumbers.length === 1) {
      const phoneNumber = contact.phoneNumbers[0].number;
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      // Show phone number selection
      Alert.alert(
        'Select Phone Number',
        'Choose which number to call:',
        contact.phoneNumbers.map(phone => ({
          text: `${phone.number} (${phone.type})`,
          onPress: () => Linking.openURL(`tel:${phone.number}`)
        })).concat([{ text: 'Cancel', style: 'cancel' }])
      );
    }
  };

  const handleVhfContact = (contact: EmergencyContact) => {
    if (!contact.vhfChannel) {
      Alert.alert('Error', 'No VHF channel available for this contact');
      return;
    }

    Alert.alert(
      'VHF Contact',
      `Contact ${contact.name} on VHF Channel ${contact.vhfChannel}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set Radio', onPress: () => onVhfContact(contact.id) }
      ]
    );
  };

  const handleDeleteContact = (contact: EmergencyContact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => onDeleteContact(contact.id)
        }
      ]
    );
  };

  const calculateDistance = (point1: Location, point2: Location): number => {
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
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1000) return `${Math.round(distance)}m`;
    if (distance < 10000) return `${(distance / 1000).toFixed(1)}km`;
    return `${Math.round(distance / 1000)}km`;
  };

  const isContactAvailable = (contact: EmergencyContact): boolean => {
    if (contact.availability.available24h) return true;
    // Simplified availability check
    return contact.availability.emergencyOverride;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Contacts</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddForm(true)}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'priority' && styles.sortButtonActive]}
          onPress={() => setSortBy('priority')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'priority' && styles.sortButtonTextActive]}>
            Priority
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
          onPress={() => setSortBy('distance')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>
            Distance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'type' && styles.sortButtonActive]}
          onPress={() => setSortBy('type')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'type' && styles.sortButtonTextActive]}>
            Type
          </Text>
        </TouchableOpacity>
      </View>

      {/* Nearby Contacts */}
      {nearbyContacts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Contacts ({nearbyContacts.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nearbyScroll}>
            {nearbyContacts.slice(0, 5).map(contact => (
              <TouchableOpacity
                key={contact.id}
                style={[styles.nearbyCard, { borderColor: contactTypeColors[contact.type] }]}
                onPress={() => setSelectedContact(contact)}
              >
                <MaterialIcons 
                  name={contactTypeIcons[contact.type]} 
                  size={24} 
                  color={contactTypeColors[contact.type]} 
                />
                <Text style={styles.nearbyName}>{contact.name}</Text>
                <Text style={styles.nearbyDistance}>
                  {formatDistance(calculateDistance(currentLocation, contact.serviceArea.center))}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* All Contacts */}
      <ScrollView style={styles.contactsList}>
        {sortedContacts.map(contact => {
          const distance = calculateDistance(currentLocation, contact.serviceArea.center);
          const isNearby = distance <= contact.serviceArea.radiusKm * 1000;
          
          return (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactItem}
              onPress={() => setSelectedContact(contact)}
            >
              <View style={styles.contactHeader}>
                <MaterialIcons 
                  name={contactTypeIcons[contact.type]} 
                  size={28} 
                  color={contactTypeColors[contact.type]} 
                />
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactType}>
                    {contact.type.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactActions}>
                  {isContactAvailable(contact) && (
                    <View style={styles.availableBadge}>
                      <Text style={styles.availableText}>Available</Text>
                    </View>
                  )}
                  <Text style={styles.priorityText}>P{contact.priority}</Text>
                </View>
              </View>

              <View style={styles.contactDetails}>
                <Text style={styles.contactDistance}>
                  {formatDistance(distance)} away
                  {isNearby && ' • In service area'}
                </Text>
                
                {contact.phoneNumbers.length > 0 && (
                  <Text style={styles.contactPhone}>
                    📞 {contact.phoneNumbers[0].number}
                  </Text>
                )}
                
                {contact.vhfChannel && (
                  <Text style={styles.contactVhf}>
                    📻 VHF Ch {contact.vhfChannel}
                  </Text>
                )}
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.callButton]}
                  onPress={() => handleCallContact(contact)}
                  disabled={contact.phoneNumbers.length === 0}
                >
                  <MaterialIcons name="phone" size={20} color="white" />
                </TouchableOpacity>

                {contact.vhfChannel && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.vhfButton]}
                    onPress={() => handleVhfContact(contact)}
                  >
                    <MaterialCommunityIcons name="radio" size={20} color="white" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.testButton]}
                  onPress={() => handleTestContact(contact.id)}
                  disabled={testingContact === contact.id}
                >
                  {testingContact === contact.id ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <MaterialIcons name="check" size={20} color="white" />
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add Contact Modal */}
      <Modal visible={showAddForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Contact</Text>
            <TouchableOpacity onPress={handleAddContact}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput
                style={styles.formInput}
                value={newContact.name}
                onChangeText={(text) => setNewContact({...newContact, name: text})}
                placeholder="Contact name"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {Object.keys(contactTypeIcons).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newContact.type === type && styles.typeButtonActive,
                      { borderColor: contactTypeColors[type] }
                    ]}
                    onPress={() => setNewContact({...newContact, type: type as EmergencyContact['type']})}
                  >
                    <MaterialIcons 
                      name={contactTypeIcons[type]} 
                      size={20} 
                      color={newContact.type === type ? 'white' : contactTypeColors[type]} 
                    />
                    <Text style={[
                      styles.typeButtonText,
                      newContact.type === type && styles.typeButtonTextActive
                    ]}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone Numbers</Text>
              {newContact.phoneNumbers.map((phone, index) => (
                <View key={index} style={styles.phoneInputRow}>
                  <TextInput
                    style={[styles.formInput, { flex: 1 }]}
                    value={phone}
                    onChangeText={(text) => {
                      const phones = [...newContact.phoneNumbers];
                      phones[index] = text;
                      setNewContact({...newContact, phoneNumbers: phones});
                    }}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />
                  {newContact.phoneNumbers.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => {
                        const phones = newContact.phoneNumbers.filter((_, i) => i !== index);
                        setNewContact({...newContact, phoneNumbers: phones});
                      }}
                    >
                      <MaterialIcons name="remove" size={20} color="#FF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.addPhoneButton}
                onPress={() => setNewContact({
                  ...newContact, 
                  phoneNumbers: [...newContact.phoneNumbers, '']
                })}
              >
                <MaterialIcons name="add" size={20} color="#007AFF" />
                <Text style={styles.addPhoneText}>Add phone number</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                style={styles.formInput}
                value={newContact.email}
                onChangeText={(text) => setNewContact({...newContact, email: text})}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>VHF Channel</Text>
              <TextInput
                style={styles.formInput}
                value={newContact.vhfChannel}
                onChangeText={(text) => setNewContact({...newContact, vhfChannel: text})}
                placeholder="VHF channel number"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Priority (1-10)</Text>
              <View style={styles.priorityContainer}>
                {[1,2,3,4,5,6,7,8,9,10].map(num => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.priorityButton,
                      newContact.priority === num && styles.priorityButtonActive
                    ]}
                    onPress={() => setNewContact({...newContact, priority: num})}
                  >
                    <Text style={[
                      styles.priorityButtonText,
                      newContact.priority === num && styles.priorityButtonTextActive
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                style={[styles.formInput, styles.notesInput]}
                value={newContact.notes}
                onChangeText={(text) => setNewContact({...newContact, notes: text})}
                placeholder="Additional notes"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Contact Details Modal */}
      <Modal 
        visible={selectedContact !== null} 
        animationType="slide" 
        presentationStyle="pageSheet"
      >
        {selectedContact && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedContact(null)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedContact.name}</Text>
              <TouchableOpacity onPress={() => handleDeleteContact(selectedContact)}>
                <MaterialIcons name="delete" size={24} color="#FF4444" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailsContainer}>
              <View style={styles.detailsHeader}>
                <MaterialIcons 
                  name={contactTypeIcons[selectedContact.type]} 
                  size={48} 
                  color={contactTypeColors[selectedContact.type]} 
                />
                <Text style={styles.detailsType}>
                  {selectedContact.type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.detailsPriority}>Priority {selectedContact.priority}</Text>
              </View>

              {/* Contact Methods */}
              <View style={styles.contactMethods}>
                {selectedContact.phoneNumbers.map((phone, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.contactMethod}
                    onPress={() => Linking.openURL(`tel:${phone.number}`)}
                  >
                    <MaterialIcons name="phone" size={24} color="#007AFF" />
                    <View style={styles.contactMethodInfo}>
                      <Text style={styles.contactMethodValue}>{phone.number}</Text>
                      <Text style={styles.contactMethodType}>{phone.type}</Text>
                    </View>
                    <MaterialIcons name="call" size={20} color="#666" />
                  </TouchableOpacity>
                ))}

                {selectedContact.email && (
                  <TouchableOpacity
                    style={styles.contactMethod}
                    onPress={() => Linking.openURL(`mailto:${selectedContact.email}`)}
                  >
                    <MaterialIcons name="email" size={24} color="#007AFF" />
                    <View style={styles.contactMethodInfo}>
                      <Text style={styles.contactMethodValue}>{selectedContact.email}</Text>
                      <Text style={styles.contactMethodType}>Email</Text>
                    </View>
                    <MaterialIcons name="send" size={20} color="#666" />
                  </TouchableOpacity>
                )}

                {selectedContact.vhfChannel && (
                  <TouchableOpacity
                    style={styles.contactMethod}
                    onPress={() => handleVhfContact(selectedContact)}
                  >
                    <MaterialCommunityIcons name="radio" size={24} color="#007AFF" />
                    <View style={styles.contactMethodInfo}>
                      <Text style={styles.contactMethodValue}>Channel {selectedContact.vhfChannel}</Text>
                      <Text style={styles.contactMethodType}>VHF Radio</Text>
                    </View>
                    <MaterialIcons name="radio" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Service Area */}
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>Service Area</Text>
                <Text style={styles.detailsText}>
                  Radius: {selectedContact.serviceArea.radiusKm} km
                </Text>
                <Text style={styles.detailsText}>
                  Distance: {formatDistance(calculateDistance(currentLocation, selectedContact.serviceArea.center))}
                </Text>
                <Text style={styles.detailsText}>
                  Response Time: ~{selectedContact.responseTime} minutes
                </Text>
              </View>

              {/* Availability */}
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>Availability</Text>
                <Text style={styles.detailsText}>
                  {selectedContact.availability.available24h ? '24/7 Available' : 'Limited Hours'}
                </Text>
                {selectedContact.availability.emergencyOverride && (
                  <Text style={styles.detailsText}>Emergency Override: Yes</Text>
                )}
              </View>

              {/* Notes */}
              {selectedContact.notes && (
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>Notes</Text>
                  <Text style={styles.detailsText}>{selectedContact.notes}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.detailsActions}>
                <TouchableOpacity
                  style={[styles.detailsActionButton, styles.callActionButton]}
                  onPress={() => handleCallContact(selectedContact)}
                >
                  <MaterialIcons name="phone" size={24} color="white" />
                  <Text style={styles.detailsActionText}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailsActionButton, styles.testActionButton]}
                  onPress={() => handleTestContact(selectedContact.id)}
                >
                  <MaterialIcons name="check-circle" size={24} color="white" />
                  <Text style={styles.detailsActionText}>Test</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    padding: 8,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    gap: 10,
  },
  sortLabel: {
    fontSize: 16,
    color: '#666',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  sortButtonTextActive: {
    color: 'white',
  },
  section: {
    backgroundColor: 'white',
    marginBottom: 10,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  nearbyScroll: {
    paddingLeft: 15,
  },
  nearbyCard: {
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'white',
    minWidth: 80,
  },
  nearbyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
    textAlign: 'center',
  },
  nearbyDistance: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  contactType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  contactActions: {
    alignItems: 'flex-end',
  },
  availableBadge: {
    backgroundColor: '#00C851',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  availableText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  priorityText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  contactDetails: {
    marginBottom: 10,
  },
  contactDistance: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  contactVhf: {
    fontSize: 12,
    color: '#333',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  callButton: {
    backgroundColor: '#00C851',
  },
  vhfButton: {
    backgroundColor: '#007AFF',
  },
  testButton: {
    backgroundColor: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  removeButton: {
    padding: 8,
  },
  addPhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
  },
  addPhoneText: {
    color: '#007AFF',
    fontSize: 14,
  },
  typeButton: {
    alignItems: 'center',
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#007AFF',
  },
  priorityButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  priorityButtonTextActive: {
    color: 'white',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  detailsContainer: {
    flex: 1,
    padding: 20,
  },
  detailsHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  detailsType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 10,
  },
  detailsPriority: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  contactMethods: {
    marginBottom: 30,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  contactMethodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactMethodValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contactMethodType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 20,
  },
  detailsActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 8,
  },
  callActionButton: {
    backgroundColor: '#00C851',
  },
  testActionButton: {
    backgroundColor: '#007AFF',
  },
  detailsActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EmergencyContactsManager;