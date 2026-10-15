import faceApiScriptUrl from '@vladmandic/face-api/dist/face-api.js?url';

type FaceApi = typeof import('@vladmandic/face-api');

declare global {
  interface Window {
    faceapi?: FaceApi;
  }
}

let loadingFaceApi: Promise<FaceApi> | null = null;

export function loadFaceApi(): Promise<FaceApi> {
  if (window.faceapi) return Promise.resolve(window.faceapi);
  if (loadingFaceApi) return loadingFaceApi;

  loadingFaceApi = new Promise<FaceApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = faceApiScriptUrl;
    script.async = true;
    script.onload = () => {
      if (window.faceapi) resolve(window.faceapi);
      else reject(new Error('Face scanner library did not initialize.'));
    };
    script.onerror = () => reject(new Error('Face scanner library could not be loaded.'));
    document.head.appendChild(script);
  }).catch((error) => {
    loadingFaceApi = null;
    throw error;
  });

  return loadingFaceApi;
}
