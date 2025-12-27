import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';

// --- EXPANDED DUMMY DATA FOR ALL OF INDIA ---
const DUMMY_HAZARDS = [
  // ... keep your hazards data unchanged
  { id: '1', type: 'Oil Spill', location: 'Off the coast of Mumbai Port, Maharashtra', description: 'Visible oil slick reported by local fishermen near the shipping lanes. Coast Guard has been alerted.', reporter: 'Rajesh Kumar', timestamp: '2 hours ago', image: 'https://images.unsplash.com/photo-1491841550275-5d745bab9495?auto=compress&cs=tinysrgb&w=400', severity: 'high', coordinates: { latitude: 18.9647, longitude: 72.8258 }, }, { id: '2', type: 'Plastic Debris', location: 'Juhu Beach, Mumbai', description: 'Large accumulation of plastic bottles and single-use plastics after the recent high tide.', reporter: 'Ananya Desai', timestamp: '5 hours ago', image: 'https://images.unsplash.com/photo-1618331390013-9c881b245a4a?auto=compress&cs=tinysrgb&w=400', severity: 'medium', coordinates: { latitude: 19.0886, longitude: 72.8265 }, }, { id: '3', type: 'Algal Bloom', location: 'Vembanad Lake, Kerala', description: 'Water has turned a reddish-brown, and dead fish are washing ashore. Suspected harmful algal bloom.', reporter: 'Suresh Menon', timestamp: '1 day ago', image: 'https://images.unsplash.com/photo-1590184401887-53fb6a350482?auto=compress&cs=tinysrgb&w=400', severity: 'high', coordinates: { latitude: 9.7331, longitude: 76.3335 }, }, { id: '4', type: 'Tarball Deposition', location: 'Candolim Beach, Goa', description: 'Sticky tarballs are scattered across the shoreline, making it difficult for tourists to walk.', reporter: 'Priya Fernandes', timestamp: '2 days ago', image: 'https://plus.unsplash.com/premium_photo-1673293699320-3323315a5a1e?auto=compress&cs=tinysrgb&w=400', severity: 'medium', coordinates: { latitude: 15.5173, longitude: 73.7649 }, }, { id: '5', type: 'High Tide Flooding', location: 'Sundarbans Delta, West Bengal', description: 'Unusually high tides have submerged low-lying coastal villages, displacing residents.', reporter: 'Amit Banerjee', timestamp: '6 hours ago', image: 'https://images.unsplash.com/photo-1567439363322-c3a1b5b5c18a?auto=compress&cs=tinysrgb&w=400', severity: 'high', coordinates: { latitude: 21.9497, longitude: 89.1833 }, }, { id: '6', type: 'Coastal Erosion', location: 'RK Beach, Visakhapatnam, AP', description: 'Significant loss of beach area observed over the past few months, threatening coastal structures.', reporter: 'Lakshmi Rao', timestamp: '3 days ago', image: 'https://images.unsplash.com/photo-1615412518833-04e578433362?auto=compress&cs=tinysrgb&w=400', severity: 'medium', coordinates: { latitude: 17.7161, longitude: 83.3228 }, }, { id: '7', type: 'Industrial Effluent', location: 'Gulf of Khambhat, Gujarat', description: 'Discolored water with a chemical smell near an industrial zone, likely untreated discharge.', reporter: 'Mehul Patel', timestamp: '1 day ago', image: 'https://images.unsplash.com/photo-1581452924180-66a2e143ba2f?auto=compress&cs=tinysrgb&w=400', severity: 'high', coordinates: { latitude: 22.3072, longitude: 72.1276 }, }, { id: '8', type: 'Coral Bleaching', location: 'Havelock Island, Andaman & Nicobar', description: 'Reports from divers indicate widespread coral bleaching in shallow reefs.', reporter: 'Aarav Sharma', timestamp: '1 week ago', image: 'https://images.unsplash.com/photo-1551201993-483c2742d17c?auto=compress&cs=tinysrgb&w=400', severity: 'low', coordinates: { latitude: 12.0290, longitude: 92.9388 }, }
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high': return '#EF4444';
    case 'medium': return '#F97316';
    case 'low': return '#10B981';
    default: return '#6B7280';
  }
};

const getHazardIcon = (type: string) => {
  switch (type) {
    case 'Oil Spill': return '🛢️';
    case 'Sewage Outflow': return '☣️';
    case 'Industrial Effluent': return '🏭';
    case 'Plastic Debris': return '🗑️';
    case 'Algal Bloom': return '🌊';
    case 'High Tide Flooding': return '🌊';
    case 'Tarball Deposition': return '⚫';
    case 'Coastal Erosion': return '🏖️';
    case 'Coral Bleaching': return '⚪';
    default: return '⚠️';
  }
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [isSendingSOS, setIsSendingSOS] = useState(false);
  
  const { wsConnection, isConnected } = useAuth();
  const { location: currentLocation } = useLocation();

  // Default location set to Central India for a wider view
  const defaultLocation = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 20,
    longitudeDelta: 20,
  };

  const zoomIn = () => {
    mapRef.current?.getCamera().then(cam => {
      cam.zoom += 1;
      mapRef.current?.animateCamera(cam);
    });
  };

  const zoomOut = () => {
    mapRef.current?.getCamera().then(cam => {
      cam.zoom -= 1;
      mapRef.current?.animateCamera(cam);
    });
  };

  const resetZoom = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion(userLocation, 1000);
    }
  };

  const handleMarkerPress = (hazard: any) => {
    setSelectedHazard(hazard);
    setShowModal(true);
  };

  const handleSOSPress = () => {
    if (!isConnected || !wsConnection) {
      Alert.alert('Connection Error', 'Please check your internet connection and try again.');
      return;
    }
    
    if (!currentLocation) {
      Alert.alert('Location Error', 'Unable to get your current location. Please ensure location services are enabled.');
      return;
    }
    
    setShowSOSModal(true);
  };

  const sendSOS = async () => {
    if (!sosMessage.trim()) {
      Alert.alert('Error', 'Please enter a message for your SOS alert.');
      return;
    }

    if (!currentLocation) {
      Alert.alert('Error', 'Unable to get your current location.');
      return;
    }

    setIsSendingSOS(true);

    try {
      const sosData = {
        type: 'sos_notification',
        payload: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          msg: sosMessage.trim()
        }
      };

      wsConnection?.send(JSON.stringify(sosData));
      
      Alert.alert(
        'SOS Sent!', 
        'Your emergency alert has been sent to authorities. Help is on the way!',
        [{ text: 'OK', onPress: () => {
          setShowSOSModal(false);
          setSosMessage('');
        }}]
      );
    } catch (error) {
      console.error('Error sending SOS:', error);
      Alert.alert('Error', 'Failed to send SOS alert. Please try again.');
    } finally {
      setIsSendingSOS(false);
    }
  };

  useEffect(() => {
    const getLocation = async () => {
      setIsLoading(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Showing default location for India. Grant location access to see your position.');
        setUserLocation(defaultLocation);
        setIsLoading(false);
        return;
      }

      try {
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        });
      } catch (error) {
        setUserLocation(defaultLocation);
      } finally {
        setIsLoading(false);
      }
    };

    getLocation();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}  
            initialRegion={defaultLocation}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
          {/* OpenStreetMap tiles */}
  <UrlTile
  urlTemplate="http://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          shouldReplaceMapContent={true}
/>

            {DUMMY_HAZARDS.map(hazard => (
              <Marker
                key={hazard.id}
                coordinate={hazard.coordinates}
                onPress={() => handleMarkerPress(hazard)}
              >
                <View style={[
                  styles.markerContainer,
                  { borderColor: getSeverityColor(hazard.severity) }
                ]}>
                  <View style={[
                    styles.marker,
                    { backgroundColor: getSeverityColor(hazard.severity) }
                  ]}>
                    <Text style={styles.markerIcon}>{getHazardIcon(hazard.type)}</Text>
                  </View>
                </View>
              </Marker>
            ))}
          </MapView>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statsCard}>
              <Text style={styles.statsNumber}>{DUMMY_HAZARDS.length}</Text>
              <Text style={styles.statsLabel}>Active Hazards</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={[styles.statsNumber, { color: '#EF4444' }]}>
                {DUMMY_HAZARDS.filter(h => h.severity === 'high').length}
              </Text>
              <Text style={styles.statsLabel}>High Priority</Text>
            </View>
          </View>

         {/* Zoom Controls + SOS */}
<View style={styles.zoomControls}>
  <TouchableOpacity style={styles.sosButton} onPress={handleSOSPress}>
    <Text style={styles.sosButtonText}>SOS</Text>
  </TouchableOpacity>

  <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
    <Ionicons name="add" size={20} color="#fff" />
  </TouchableOpacity>
  <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
    <Ionicons name="remove" size={20} color="#fff" />
  </TouchableOpacity>
  <TouchableOpacity style={styles.zoomButton} onPress={resetZoom}>
    <Ionicons name="locate-outline" size={18} color="#fff" />
  </TouchableOpacity>
</View>


        </>
      )}

      {/* Hazard Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        {/* Keep your modal code unchanged */}
      </Modal>

      {/* SOS Modal */}
      <Modal
        visible={showSOSModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSOSModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sosModalContainer}>
            <View style={styles.sosModalHeader}>
              <Text style={styles.sosModalTitle}>🚨 Emergency SOS</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowSOSModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sosModalSubtitle}>
              Describe your emergency situation. Your location will be automatically included.
            </Text>
            
            <TextInput
              style={styles.sosMessageInput}
              placeholder="Enter your emergency message..."
              placeholderTextColor="#999"
              value={sosMessage}
              onChangeText={setSosMessage}
              multiline
              numberOfLines={4}
              maxLength={200}
              editable={!isSendingSOS}
            />
            
            <Text style={styles.characterCount}>
              {sosMessage.length}/200 characters
            </Text>
            
            <View style={styles.sosModalButtons}>
              <TouchableOpacity 
                style={[styles.sosModalButton, styles.cancelButton]}
                onPress={() => {
                  setShowSOSModal(false);
                  setSosMessage('');
                }}
                disabled={isSendingSOS}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sosModalButton, styles.sendButton, isSendingSOS && styles.disabledButton]}
                onPress={sendSOS}
                disabled={isSendingSOS}
              >
                {isSendingSOS ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Send SOS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#64748b' },
  statsContainer: {
    position: 'absolute', top: 60, left: 20, right: 20,
    flexDirection: 'row', gap: 12, zIndex: 1000,
  },
  statsCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#e2e8f0',
  },
  statsNumber: { fontSize: 24, fontWeight: 'bold', color: '#0EA5E9', marginBottom: 4 },
  statsLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  markerContainer: { padding: 3, borderRadius: 20, backgroundColor: '#fff' },
  marker: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  markerIcon: { fontSize: 16 },
 zoomControls: {
  position: 'absolute',
  right: 20,
  bottom: 40,
  flexDirection: 'column',
  gap: 12,
  alignItems: 'center',
},
zoomButton: {
  backgroundColor: 'rgba(0, 122, 255, 0.9)',
  width: 50,
  height: 50,
  borderRadius: 25,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
},
sosButton: {
  backgroundColor: '#D92D20',
  width: 60,
  height: 60,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 12, // keeps it above the zoomIn button
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 6,
},
sosButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},
sosModalContainer: {
  backgroundColor: '#fff',
  borderRadius: 20,
  padding: 24,
  width: '100%',
  maxWidth: 400,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 8,
},
sosModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
},
sosModalTitle: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#D92D20',
},
closeButton: {
  padding: 4,
},
sosModalSubtitle: {
  fontSize: 16,
  color: '#666',
  marginBottom: 20,
  lineHeight: 22,
},
sosMessageInput: {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 12,
  padding: 16,
  fontSize: 16,
  textAlignVertical: 'top',
  minHeight: 100,
  marginBottom: 8,
},
characterCount: {
  fontSize: 12,
  color: '#999',
  textAlign: 'right',
  marginBottom: 20,
},
sosModalButtons: {
  flexDirection: 'row',
  gap: 12,
},
sosModalButton: {
  flex: 1,
  paddingVertical: 16,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
},
cancelButton: {
  backgroundColor: '#f3f4f6',
  borderWidth: 1,
  borderColor: '#d1d5db',
},
cancelButtonText: {
  color: '#374151',
  fontSize: 16,
  fontWeight: '600',
},
sendButton: {
  backgroundColor: '#D92D20',
},
sendButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
disabledButton: {
  opacity: 0.6,
},

});
