// Store the video and its metadata together. A future remote storage adapter can
// accept the same record without relying on the currently displayed session ID.
export function saveRecording(record) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fieldnote', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('recordings', { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('recordings', 'readwrite');
      transaction.objectStore('recordings').add(record);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error('Recording could not be saved.'));
      };
    };
  });
}
