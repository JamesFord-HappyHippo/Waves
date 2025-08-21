/**
 * User Profile Screen for Waves Marine Navigation App
 * Features: User information, vessel details, navigation history
 */

import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '@/store';
import {updateUserProfile} from '@/store/slices/settingsSlice';

export const ProfileScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.settings);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    vesselName: user?.vesselName || '',
    vesselType: user?.vesselType || 'sailboat',
    vesselLength: user?.vesselLength?.toString() || '',
    vesselDraft: user?.vesselDraft?.toString() || '',
    experience: user?.experience || 'intermediate',
  });

  const handleSave = () => {
    dispatch(updateUserProfile({
      ...profileData,
      vesselLength: profileData.vesselLength ? parseFloat(profileData.vesselLength) : undefined,
      vesselDraft: profileData.vesselDraft ? parseFloat(profileData.vesselDraft) : undefined,
    }));
    
    Alert.alert('Success', 'Profile updated successfully!', [{text: 'OK'}]);
  };

  const vesselTypes = [
    {label: 'Sailboat', value: 'sailboat'},
    {label: 'Powerboat', value: 'powerboat'},
    {label: 'Kayak', value: 'kayak'},
    {label: 'Other', value: 'other'},
  ];

  const experienceLevels = [
    {label: 'Beginner', value: 'beginner'},
    {label: 'Intermediate', value: 'intermediate'},
    {label: 'Advanced', value: 'advanced'},
    {label: 'Professional', value: 'professional'},
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Icon name="account-circle" size={80} color="#007AFF" />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Icon name="camera" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerText}>
            {profileData.name || 'Complete Your Profile'}
          </Text>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={profileData.name}
              onChangeText={(text) => setProfileData(prev => ({...prev, name: text}))}
              placeholder="Enter your full name"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={profileData.email}
              onChangeText={(text) => setProfileData(prev => ({...prev, email: text}))}
              placeholder="Enter your email address"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Experience Level</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.segmentedControl}>
                {experienceLevels.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={[
                      styles.segment,
                      profileData.experience === level.value && styles.segmentActive
                    ]}
                    onPress={() => setProfileData(prev => ({...prev, experience: level.value}))}
                  >
                    <Text style={[
                      styles.segmentText,
                      profileData.experience === level.value && styles.segmentTextActive
                    ]}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Vessel Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vessel Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Vessel Name</Text>
            <TextInput
              style={styles.textInput}
              value={profileData.vesselName}
              onChangeText={(text) => setProfileData(prev => ({...prev, vesselName: text}))}
              placeholder="Enter your vessel's name"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Vessel Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.segmentedControl}>
                {vesselTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.segment,
                      profileData.vesselType === type.value && styles.segmentActive
                    ]}
                    onPress={() => setProfileData(prev => ({...prev, vesselType: type.value}))}
                  >
                    <Text style={[
                      styles.segmentText,
                      profileData.vesselType === type.value && styles.segmentTextActive
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, {flex: 1, marginRight: 10}]}>
              <Text style={styles.inputLabel}>Length (m)</Text>
              <TextInput
                style={styles.textInput}
                value={profileData.vesselLength}
                onChangeText={(text) => setProfileData(prev => ({...prev, vesselLength: text}))}
                placeholder="0.0"
                keyboardType="decimal-pad"
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={[styles.inputContainer, {flex: 1, marginLeft: 10}]}>
              <Text style={styles.inputLabel}>Draft (m)</Text>
              <TextInput
                style={styles.textInput}
                value={profileData.vesselDraft}
                onChangeText={(text) => setProfileData(prev => ({...prev, vesselDraft: text}))}
                placeholder="0.0"
                keyboardType="decimal-pad"
                placeholderTextColor="#8E8E93"
              />
            </View>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Statistics</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Icon name="waves" size={24} color="#007AFF" />
              <Text style={styles.statNumber}>127</Text>
              <Text style={styles.statLabel}>Depth Reports</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="map-marker-path" size={24} color="#28A745" />
              <Text style={styles.statNumber}>43.2</Text>
              <Text style={styles.statLabel}>NM Tracked</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="clock-outline" size={24} color="#FFC107" />
              <Text style={styles.statNumber}>28</Text>
              <Text style={styles.statLabel}>Hours at Sea</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Icon name="check" size={20} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </TouchableOpacity>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          <View style={styles.activityItem}>
            <Icon name="waves" size={20} color="#007AFF" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Depth reading reported</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
          </View>

          <View style={styles.activityItem}>
            <Icon name="map-marker-path" size={20} color="#28A745" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Navigation session completed</Text>
              <Text style={styles.activityTime}>1 day ago</Text>
            </View>
          </View>

          <View style={styles.activityItem}>
            <Icon name="download" size={20} color="#FFC107" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Offline map downloaded</Text>
              <Text style={styles.activityTime}>3 days ago</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 20,
  },
  rowContainer: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#F9F9F9',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
});