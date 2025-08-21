# Waves Mobile App User Guide

## Welcome to Waves

Waves is your community-driven marine navigation companion that helps you navigate safely in nearshore waters using crowdsourced depth data, real-time weather information, and intelligent safety alerts.

## Important Safety Notice

⚠️ **Critical Safety Information** ⚠️

- **This app provides supplementary navigation information only**
- **Always use official nautical charts as your primary navigation source**
- **Verify all depths with your own depth sounder**
- **Never rely solely on crowdsourced data for navigation decisions**
- **Maintain proper marine safety equipment and procedures**

## Getting Started

### 1. Initial Setup

**Download and Installation:**
1. Download Waves from the App Store (iOS) or Google Play (Android)
2. Open the app and tap "Get Started"
3. Read and accept the Marine Safety Agreement
4. Allow location permissions when prompted
5. Complete the safety orientation (required)

**Account Creation:**
1. Tap "Create Account" or "Sign Up"
2. Enter your email and create a secure password
3. Verify your email address
4. Complete your mariner profile

### 2. Mariner Profile Setup

**Personal Information:**
- Name and contact information
- Maritime experience level
- Emergency contacts
- Medical information (optional, for emergencies)

**Vessel Registration:**
```
Required Information:
- Vessel name
- Vessel type (sailboat, powerboat, etc.)
- Length, beam, and draft measurements
- Registration number
- Equipment on board (GPS, depth sounder, VHF radio)

Optional Information:
- MMSI number
- Insurance information
- Photos of vessel
```

### 3. Preferences Configuration

**Units and Display:**
- **Units**: Metric, Imperial, or Nautical
- **Depth Display**: Meters, feet, or fathoms
- **Distance**: Nautical miles, kilometers, or statute miles
- **Speed**: Knots, km/h, or mph

**Safety Settings:**
- **Safety Margin**: Distance to maintain above your draft (recommended: 1.5-3.0m)
- **Alert Sensitivity**: Conservative, Moderate, or Aggressive
- **Battery Optimization**: Enable for longer trips
- **Offline Mode**: Download areas for offline navigation

## Core Features

### 1. Navigation Map

**Map Interface Elements:**

```
Top Bar:
├── Location accuracy indicator
├── GPS signal strength
├── Battery level
└── Settings menu

Map Display:
├── Your position (blue dot with heading indicator)
├── Depth color coding (red=shallow, yellow=caution, green=safe)
├── Crowdsourced depth readings (colored dots)
├── Weather overlays (optional)
├── Navigation hazards (warning symbols)
└── Marine areas of interest

Bottom Bar:
├── Depth at current location
├── Speed and heading
├── Tide information
└── Quick actions menu
```

**Understanding Depth Colors:**
- 🔴 **Red**: Dangerous - less than your draft + safety margin
- 🟡 **Yellow**: Caution - limited clearance under keel
- 🟢 **Green**: Safe - adequate water depth
- ⚫ **Gray**: No data available
- 🔵 **Blue**: Deep water (>20m typically)

**Map Navigation:**
- **Pinch to zoom**: Zoom in/out on the map
- **Two-finger rotation**: Rotate map orientation
- **Tap and hold**: Drop a waypoint or get depth information
- **Double-tap**: Center map on your location

### 2. Depth Data Collection

**Contributing Depth Readings:**

1. **Automatic Collection** (if enabled):
   - App automatically records depth from connected depth sounder
   - Data is validated and tagged with your vessel's draft
   - Contributes to community database in real-time

2. **Manual Entry**:
   - Tap the "+" button on the main screen
   - Enter the depth reading from your depth sounder
   - Add confidence level (how certain you are of the reading)
   - Optionally add notes about bottom type or conditions

**Data Quality Guidelines:**
- Only enter depths you've personally verified
- Include environmental conditions when possible
- Note if using depth sounder vs. lead line
- Indicate confidence level honestly

### 3. Safety Alerts System

**Alert Types and Responses:**

**🚨 Emergency Alert (Red)**
- **Meaning**: Immediate grounding risk (<30 seconds)
- **Sound**: Continuous loud alarm
- **Action**: STOP immediately, reverse if possible
- **Display**: Full-screen warning with recommended action

**⚠️ Critical Alert (Orange)**  
- **Meaning**: Serious grounding risk (<2 minutes)
- **Sound**: Rapid beeping
- **Action**: Alter course immediately
- **Display**: Prominent banner with course recommendations

**⚡ Warning Alert (Yellow)**
- **Meaning**: Shallow water ahead (<5 minutes)
- **Sound**: Intermittent beep
- **Action**: Prepare to alter course, reduce speed
- **Display**: Top banner with information

**ℹ️ Caution Notice (Blue)**
- **Meaning**: Depth information for awareness
- **Sound**: Single chime
- **Action**: Monitor situation
- **Display**: Small notification

**Responding to Alerts:**
1. **Acknowledge the Alert**: Tap "Acknowledge" to stop audio
2. **Review Recommendations**: Read suggested actions
3. **Take Appropriate Action**: Follow recommendations or use your judgment
4. **Monitor Continuously**: Keep watching for additional alerts

### 4. Route Planning

**Creating a Route:**

1. **Start Planning**:
   - Tap "Route" in the bottom menu
   - Tap "New Route" or use the "+" button
   - Enter route name and description

2. **Set Waypoints**:
   - Tap on the map to place waypoints
   - Drag waypoints to adjust position
   - Add intermediate waypoints by tapping on route line

3. **Route Configuration**:
   - Set departure time
   - Choose route optimization (fastest, safest, most scenic)
   - Configure safety preferences
   - Review depth analysis along route

4. **Route Validation**:
   - App analyzes route for depth hazards
   - Weather forecast integration
   - Estimated time and fuel consumption
   - Safety rating and warnings

**Following a Route:**
1. Select your planned route from the routes list
2. Tap "Start Navigation"
3. Follow the purple route line on the map
4. Monitor navigation alerts and recommendations
5. Tap "End Navigation" when complete

### 5. Weather and Environmental Data

**Weather Display:**
- **Current Conditions**: Wind, waves, visibility, barometric pressure
- **Marine Forecast**: 48-hour detailed marine weather
- **Tide Information**: Current level, next high/low tides
- **Water Temperature**: Surface temperature readings
- **UV Index**: Sun exposure warnings

**Weather Alerts:**
- Small craft advisories
- Storm warnings
- Dense fog alerts
- High wind warnings
- Marine weather watches

**Interpreting Weather Data:**
```
Wind Information:
├── Speed (knots)
├── Direction (true bearing)
├── Gusts (if significant)
└── Beaufort scale equivalent

Wave Information:
├── Height (meters/feet)
├── Period (seconds)
├── Direction
└── Sea state (0-9 scale)

Visibility:
├── Current visibility (km/miles)
├── Fog probability
├── Sunrise/sunset times
└── Moon phase
```

## Advanced Features

### 1. 3D Underwater Terrain View

**Activating 3D View:**
1. Tap the "3D" button in the map toolbar
2. Use pinch gestures to zoom
3. Drag to rotate the view
4. Two-finger vertical swipe to adjust angle

**3D View Features:**
- **Underwater topography**: Visualize depth changes
- **Your track**: See your path through 3D space
- **Hazard visualization**: Shallow areas highlighted in red
- **Route preview**: See planned route in 3D context

### 2. Offline Navigation

**Downloading Offline Areas:**
1. Go to Settings → Offline Maps
2. Tap "Download New Area"
3. Zoom to desired area and tap "Download"
4. Choose data quality level (affects storage size)
5. Monitor download progress

**Offline Features Available:**
- Basic navigation and position tracking
- Previously downloaded depth data
- Cached weather information (24-48 hours)
- Safety alerts based on downloaded data
- Route planning with cached data

**Offline Limitations:**
- No real-time weather updates
- No new crowdsourced data
- Limited safety alerts
- No route sharing or synchronization

### 3. Captain Features (Verified Users)

**Becoming a Verified Captain:**
1. Complete advanced safety training
2. Submit proof of maritime credentials
3. Pass captain-level safety examination
4. Maintain high data quality contributions

**Captain Privileges:**
- Enhanced data validation tools
- Access to captain-only data layers
- Ability to flag dangerous areas
- Advanced route sharing capabilities
- Priority customer support

### 4. Social Features

**Sharing and Community:**
- **Share Routes**: Send favorite routes to friends
- **Community Alerts**: Report hazards to other boaters
- **Marinas and Services**: Rate and review marine facilities
- **Local Knowledge**: Access insights from experienced local boaters

**Privacy Controls:**
- Choose what data to share with the community
- Control visibility of your tracks and routes
- Manage emergency contact sharing
- Configure location sharing preferences

## Safety and Emergency Features

### 1. Emergency Contacts

**Setting Up Emergency Contacts:**
1. Go to Settings → Emergency Contacts
2. Add at least 3 emergency contacts
3. Include local Coast Guard stations
4. Add marina or towing service contacts
5. Include medical emergency contacts

**Emergency Contact Information:**
- Name and relationship
- Primary and secondary phone numbers
- VHF radio information (if applicable)
- Medical information relevance
- Automatic notification preferences

### 2. Man Overboard (MOB) Procedure

**Activating MOB Alert:**
1. **Quick Access**: Press and hold the MOB button (red button with person icon)
2. **Voice Command**: Say "Hey Waves, man overboard"
3. **Emergency Menu**: Access through emergency menu

**MOB Response:**
- Immediately marks MOB position with GPS coordinates
- Starts countdown timer from MOB event
- Calculates drift estimates based on current and wind
- Displays return course to MOB position
- Automatically contacts emergency services (if configured)
- Sends alerts to emergency contacts

### 3. Emergency Broadcast

**Automatic Emergency Detection:**
- Sudden stop or impact detection
- Extended period without movement in open water
- Manual emergency activation
- Loss of GPS signal in hazardous areas

**Emergency Information Shared:**
- Current GPS position and course
- Vessel information and specifications
- Number of people on board
- Emergency contact information
- Medical information (if provided)
- Last known safe position

### 4. Coast Guard Integration

**Direct Coast Guard Communication:**
- One-tap access to Coast Guard emergency line
- Automatic position sharing with emergency services
- VHF Channel 16 quick access
- Integration with Coast Guard rescue coordination

## Data and Privacy

### 1. Data Sharing Controls

**What Data is Collected:**
- GPS tracks (anonymized after 24 hours)
- Depth readings with vessel specifications
- Weather observations
- Navigation patterns (aggregated)
- Safety incident reports (anonymized)

**Privacy Settings:**
```
Data Sharing Options:
├── Share Anonymous Tracks ☐
├── Share Depth Readings ☑
├── Share Weather Observations ☑
├── Share Safety Alerts ☑
├── Share Route Patterns ☐
└── Emergency Override ☑
```

**Data Retention:**
- Personal tracking data: 30 days
- Contributed depth data: Permanent (anonymized)
- Route plans: Until deleted by user
- Emergency contacts: Until updated by user

### 2. Privacy Protection

**Location Privacy:**
- Real-time location only shared during active navigation
- Historical tracks anonymized and aggregated
- No personal identification in shared data
- Emergency override for safety situations

**Data Security:**
- End-to-end encryption for personal data
- Secure cloud storage with redundancy
- Regular security audits and updates
- Compliance with maritime privacy regulations

## Troubleshooting

### Common Issues and Solutions

**GPS Accuracy Problems:**
```
Issue: Poor GPS accuracy or no signal
Solutions:
1. Ensure clear view of sky (remove phone case if thick)
2. Restart the app and wait 2-3 minutes for GPS lock
3. Check phone location settings are enabled for Waves
4. Try moving away from tall buildings or metal structures
5. Calibrate phone compass in phone settings
```

**App Performance Issues:**
```
Issue: App running slowly or freezing
Solutions:
1. Close other apps to free memory
2. Restart the Waves app
3. Clear app cache in phone settings
4. Update to latest app version
5. Restart your phone if problems persist
```

**Depth Data Not Showing:**
```
Issue: No depth readings visible on map
Solutions:
1. Check internet connection for real-time data
2. Zoom in closer to see individual readings
3. Verify data filters aren't excluding readings
4. Check if in offline mode with no downloaded data
5. Report issue if in known coverage area
```

**Battery Drain:**
```
Issue: App using too much battery
Solutions:
1. Enable Battery Optimization in app settings
2. Reduce GPS update frequency for casual use
3. Turn off 3D visualization when not needed
4. Close app when not actively navigating
5. Use power saving mode on your phone
```

**Weather Data Not Updating:**
```
Issue: Weather information appears outdated
Solutions:
1. Check internet connection
2. Manually refresh by pulling down on weather screen
3. Verify location services are enabled
4. Check if external weather services are available
5. Use cached data if offshore with limited connectivity
```

### Getting Additional Help

**In-App Support:**
- Tap Settings → Help & Support
- Access built-in tutorials and FAQ
- Submit support requests with automatic log inclusion
- Access emergency procedures guide

**Community Support:**
- Join the Waves Boaters Community forum
- Connect with local mariner groups
- Share experiences and get advice
- Report issues and suggest improvements

**Emergency Support:**
- Coast Guard: VHF Channel 16 or phone emergency services
- Local marine police or harbor master
- Commercial towing services (TowBoatUS, Sea Tow)
- Marina emergency contacts

## Best Practices for Safe Navigation

### Pre-Departure Checklist

**App Preparation:**
- [ ] Update app to latest version
- [ ] Download offline maps for your area
- [ ] Check weather forecast and marine conditions
- [ ] Verify emergency contacts are current
- [ ] Test GPS accuracy and map display
- [ ] Ensure device is fully charged

**Safety Preparation:**
- [ ] File float plan with someone ashore
- [ ] Check all safety equipment
- [ ] Verify VHF radio and emergency beacon
- [ ] Review planned route for hazards
- [ ] Check tide tables and current forecasts
- [ ] Inform crew of emergency procedures

### During Navigation

**Continuous Monitoring:**
- Keep traditional navigation tools ready
- Monitor depth sounder continuously
- Watch for weather changes
- Pay attention to safety alerts
- Maintain visual watch for hazards
- Keep emergency contacts readily available

**Regular Safety Checks:**
- Verify GPS position against visual references
- Cross-check app depth readings with depth sounder
- Monitor battery level and charging status
- Check weather updates every 30 minutes
- Communicate position to shore contacts
- Document any hazards or discrepancies

### Post-Trip Actions

**Data Contribution:**
- Submit any depth readings you collected
- Report hazards or changed conditions
- Update route information if needed
- Share experiences with the community
- Provide feedback on app performance

**Safety Reporting:**
- Report any safety incidents or near-misses
- Document equipment failures or issues
- Provide feedback on alert accuracy
- Suggest improvements for safety features

Remember: Waves is designed to enhance your navigation capabilities, not replace proper seamanship and traditional navigation tools. Always maintain situational awareness and use multiple sources of information for navigation decisions.