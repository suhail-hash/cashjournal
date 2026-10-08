import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}

@Injectable({
  providedIn: 'root'
})

export class PhotoService {

  public photos: UserPhoto[] = [];

  async ensureCameraPermission() {
    if (Capacitor.getPlatform() === 'web') return true; // Extra fuer Web-abfragen

    const status = await Camera.checkPermissions();

    if (status.camera !== 'granted') {
      const request = await Camera.requestPermissions();
      return request.camera === 'granted';
    }

    return true;
  }


  public async addNewToGallery() {
    //check permission
    const granted = await this.ensureCameraPermission();

    if(!granted){
      throw new Error('Zugriff verweigert');
    }

    // Take a photo
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    this.photos.unshift({
      filepath: "soon...",
      webviewPath: capturedPhoto.webPath!
    });
  }

}
