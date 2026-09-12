// AsyncStorage has no native side under Jest; the official in-memory mock stands in.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
