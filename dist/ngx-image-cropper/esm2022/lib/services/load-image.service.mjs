import { Injectable } from '@angular/core';
import { getTransformationsFromExifData, supportsAutomaticRotation } from '../utils/exif.utils';
import * as i0 from "@angular/core";
class LoadImageService {
    constructor() {
        this.autoRotateSupported = supportsAutomaticRotation();
    }
    loadImageFile(file, cropperSettings) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = (event) => {
                this.loadImage(event.target.result, file.type, cropperSettings)
                    .then(resolve)
                    .catch(reject);
            };
            fileReader.readAsDataURL(file);
        });
    }
    loadImage(imageBase64, imageType, cropperSettings) {
        if (!this.isValidImageType(imageType)) {
            return Promise.reject(new Error('Invalid image type'));
        }
        return this.loadBase64Image(imageBase64, cropperSettings);
    }
    isValidImageType(type) {
        return /image\/(png|jpg|jpeg|bmp|gif|tiff|webp|x-icon|vnd.microsoft.icon)/.test(type);
    }
    loadImageFromURL(url, cropperSettings) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onerror = () => reject;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                context?.drawImage(img, 0, 0);
                this.loadBase64Image(canvas.toDataURL(), cropperSettings).then(resolve);
            };
            img.crossOrigin = 'anonymous';
            img.src = url;
        });
    }
    loadBase64Image(imageBase64, cropperSettings) {
        return new Promise((resolve, reject) => {
            const originalImage = new Image();
            originalImage.onload = () => resolve({
                originalImage,
                originalBase64: imageBase64
            });
            originalImage.onerror = reject;
            originalImage.src = imageBase64;
        }).then((res) => this.transformImageBase64(res, cropperSettings));
    }
    async transformImageBase64(res, cropperSettings) {
        const autoRotate = await this.autoRotateSupported;
        const exifTransform = await getTransformationsFromExifData(autoRotate ? -1 : res.originalBase64);
        if (!res.originalImage || !res.originalImage.complete) {
            return Promise.reject(new Error('No image loaded'));
        }
        const loadedImage = {
            original: {
                base64: res.originalBase64,
                image: res.originalImage,
                size: {
                    width: res.originalImage.naturalWidth,
                    height: res.originalImage.naturalHeight
                }
            },
            exifTransform
        };
        return this.transformLoadedImage(loadedImage, cropperSettings);
    }
    async transformLoadedImage(loadedImage, cropperSettings) {
        const canvasRotation = cropperSettings.canvasRotation + loadedImage.exifTransform.rotate;
        const originalSize = {
            width: loadedImage.original.image.naturalWidth,
            height: loadedImage.original.image.naturalHeight
        };
        if (canvasRotation === 0 && !loadedImage.exifTransform.flip && !cropperSettings.containWithinAspectRatio) {
            return {
                original: {
                    base64: loadedImage.original.base64,
                    image: loadedImage.original.image,
                    size: { ...originalSize }
                },
                transformed: {
                    base64: loadedImage.original.base64,
                    image: loadedImage.original.image,
                    size: { ...originalSize }
                },
                exifTransform: loadedImage.exifTransform
            };
        }
        const transformedSize = this.getTransformedSize(originalSize, loadedImage.exifTransform, cropperSettings);
        const canvas = document.createElement('canvas');
        canvas.width = transformedSize.width;
        canvas.height = transformedSize.height;
        const ctx = canvas.getContext('2d');
        ctx?.setTransform(loadedImage.exifTransform.flip ? -1 : 1, 0, 0, 1, canvas.width / 2, canvas.height / 2);
        ctx?.rotate(Math.PI * (canvasRotation / 2));
        ctx?.drawImage(loadedImage.original.image, -originalSize.width / 2, -originalSize.height / 2);
        const transformedBase64 = canvas.toDataURL();
        const transformedImage = await this.loadImageFromBase64(transformedBase64);
        return {
            original: {
                base64: loadedImage.original.base64,
                image: loadedImage.original.image,
                size: { ...originalSize }
            },
            transformed: {
                base64: transformedBase64,
                image: transformedImage,
                size: {
                    width: transformedImage.width,
                    height: transformedImage.height
                }
            },
            exifTransform: loadedImage.exifTransform
        };
    }
    loadImageFromBase64(imageBase64) {
        return new Promise(((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = imageBase64;
        }));
    }
    getTransformedSize(originalSize, exifTransform, cropperSettings) {
        const canvasRotation = cropperSettings.canvasRotation + exifTransform.rotate;
        if (cropperSettings.containWithinAspectRatio) {
            if (canvasRotation % 2) {
                const minWidthToContain = originalSize.width * cropperSettings.aspectRatio;
                const minHeightToContain = originalSize.height / cropperSettings.aspectRatio;
                return {
                    width: Math.max(originalSize.height, minWidthToContain),
                    height: Math.max(originalSize.width, minHeightToContain)
                };
            }
            else {
                const minWidthToContain = originalSize.height * cropperSettings.aspectRatio;
                const minHeightToContain = originalSize.width / cropperSettings.aspectRatio;
                return {
                    width: Math.max(originalSize.width, minWidthToContain),
                    height: Math.max(originalSize.height, minHeightToContain)
                };
            }
        }
        if (canvasRotation % 2) {
            return {
                height: originalSize.width,
                width: originalSize.height
            };
        }
        return {
            width: originalSize.width,
            height: originalSize.height
        };
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.0.3", ngImport: i0, type: LoadImageService, deps: [], target: i0.ɵɵFactoryTarget.Injectable }); }
    static { this.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "16.0.3", ngImport: i0, type: LoadImageService, providedIn: 'root' }); }
}
export { LoadImageService };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.0.3", ngImport: i0, type: LoadImageService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1pbWFnZS5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LWltYWdlLWNyb3BwZXIvc3JjL2xpYi9zZXJ2aWNlcy9sb2FkLWltYWdlLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUkzQyxPQUFPLEVBQUUsOEJBQThCLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQzs7QUFPaEcsTUFDYSxnQkFBZ0I7SUFEN0I7UUFHVSx3QkFBbUIsR0FBcUIseUJBQXlCLEVBQUUsQ0FBQztLQW1MN0U7SUFqTEMsYUFBYSxDQUFDLElBQVUsRUFBRSxlQUFnQztRQUN4RCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE1BQU0sVUFBVSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7WUFDcEMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQVUsRUFBRSxFQUFFO2dCQUNqQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDO3FCQUM1RCxJQUFJLENBQUMsT0FBTyxDQUFDO3FCQUNiLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuQixDQUFDLENBQUM7WUFDRixVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLFNBQVMsQ0FBQyxXQUFtQixFQUFFLFNBQWlCLEVBQUUsZUFBZ0M7UUFDeEYsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNyQyxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsb0JBQW9CLENB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R0FBRyxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLENBQUM7aUJBQ3pELENBQUM7YUFDSDtpQkFBTTtnQkFDTCxNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQztnQkFDNUUsTUFBTSxrQkFBa0IsR0FBRyxZQUFZLENBQUMsS0FBSyxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUM7Z0JBQzVFLE9BQU87b0JBQ0wsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxpQkFBaUIsQ0FBQztvQkFDdEQsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxrQkFBa0IsQ0FBQztpQkFDMUQsQ0FBQzthQUNIO1NBQ0Y7UUFFRCxJQUFJLGNBQWMsR0FBRyxDQUFDLEVBQUU7WUFDdEIsT0FBTztnQkFDTCxNQUFNLEVBQUUsWUFBWSxDQUFDLEtBQUs7Z0JBQzFCLEtBQUssRUFBRSxZQUFZLENBQUMsTUFBTTthQUMzQixDQUFDO1NBQ0g7UUFDRCxPQUFPO1lBQ0wsS0FBSyxFQUFFLFlBQVksQ0FBQyxLQUFLO1lBQ3pCLE1BQU0sRUFBRSxZQUFZLENBQUMsTUFBTTtTQUM1QixDQUFDO0lBQ0osQ0FBQzs4R0FwTFUsZ0JBQWdCO2tIQUFoQixnQkFBZ0IsY0FESixNQUFNOztTQUNsQixnQkFBZ0I7MkZBQWhCLGdCQUFnQjtrQkFENUIsVUFBVTttQkFBQyxFQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBEaW1lbnNpb25zLCBMb2FkZWRJbWFnZSB9IGZyb20gJy4uL2ludGVyZmFjZXMnO1xuaW1wb3J0IHsgQ3JvcHBlclNldHRpbmdzIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9jcm9wcGVyLnNldHRpbmdzJztcbmltcG9ydCB7IEV4aWZUcmFuc2Zvcm0gfSBmcm9tICcuLi9pbnRlcmZhY2VzL2V4aWYtdHJhbnNmb3JtLmludGVyZmFjZSc7XG5pbXBvcnQgeyBnZXRUcmFuc2Zvcm1hdGlvbnNGcm9tRXhpZkRhdGEsIHN1cHBvcnRzQXV0b21hdGljUm90YXRpb24gfSBmcm9tICcuLi91dGlscy9leGlmLnV0aWxzJztcblxuaW50ZXJmYWNlIExvYWRJbWFnZUJhc2U2NCB7XG4gIG9yaWdpbmFsSW1hZ2U6IEhUTUxJbWFnZUVsZW1lbnQ7XG4gIG9yaWdpbmFsQmFzZTY0OiBzdHJpbmc7XG59XG5cbkBJbmplY3RhYmxlKHtwcm92aWRlZEluOiAncm9vdCd9KVxuZXhwb3J0IGNsYXNzIExvYWRJbWFnZVNlcnZpY2Uge1xuXG4gIHByaXZhdGUgYXV0b1JvdGF0ZVN1cHBvcnRlZDogUHJvbWlzZTxib29sZWFuPiA9IHN1cHBvcnRzQXV0b21hdGljUm90YXRpb24oKTtcblxuICBsb2FkSW1hZ2VGaWxlKGZpbGU6IEZpbGUsIGNyb3BwZXJTZXR0aW5nczogQ3JvcHBlclNldHRpbmdzKTogUHJvbWlzZTxMb2FkZWRJbWFnZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBmaWxlUmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIGZpbGVSZWFkZXIub25sb2FkID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgdGhpcy5sb2FkSW1hZ2UoZXZlbnQudGFyZ2V0LnJlc3VsdCwgZmlsZS50eXBlLCBjcm9wcGVyU2V0dGluZ3MpXG4gICAgICAgICAgLnRoZW4ocmVzb2x2ZSlcbiAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgIH07XG4gICAgICBmaWxlUmVhZGVyLnJlYWRBc0RhdGFVUkwoZmlsZSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGxvYWRJbWFnZShpbWFnZUJhc2U2NDogc3RyaW5nLCBpbWFnZVR5cGU6IHN0cmluZywgY3JvcHBlclNldHRpbmdzOiBDcm9wcGVyU2V0dGluZ3MpOiBQcm9taXNlPExvYWRlZEltYWdlPiB7XG4gICAgaWYgKCF0aGlzLmlzVmFsaWRJbWFnZVR5cGUoaW1hZ2VUeXBlKSkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignSW52YWxpZCBpbWFnZSB0eXBlJykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5sb2FkQmFzZTY0SW1hZ2UoaW1hZ2VCYXNlNjQsIGNyb3BwZXJTZXR0aW5ncyk7XG4gIH1cblxuICBwcml2YXRlIGlzVmFsaWRJbWFnZVR5cGUodHlwZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIC9pbWFnZVxcLyhwbmd8anBnfGpwZWd8Ym1wfGdpZnx0aWZmfHdlYnB8eC1pY29ufHZuZC5taWNyb3NvZnQuaWNvbikvLnRlc3QodHlwZSk7XG4gIH1cblxuICBsb2FkSW1hZ2VGcm9tVVJMKHVybDogc3RyaW5nLCBjcm9wcGVyU2V0dGluZ3M6IENyb3BwZXJTZXR0aW5ncyk6IFByb21pc2U8TG9hZGVkSW1hZ2U+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgaW1nID0gbmV3IEltYWdlKCk7XG4gICAgICBpbWcub25lcnJvciA9ICgpID0+IHJlamVjdDtcbiAgICAgIGltZy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICBjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IGltZy53aWR0aDtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGltZy5oZWlnaHQ7XG4gICAgICAgIGNvbnRleHQ/LmRyYXdJbWFnZShpbWcsIDAsIDApO1xuICAgICAgICB0aGlzLmxvYWRCYXNlNjRJbWFnZShjYW52YXMudG9EYXRhVVJMKCksIGNyb3BwZXJTZXR0aW5ncykudGhlbihyZXNvbHZlKTtcbiAgICAgIH07XG4gICAgICBpbWcuY3Jvc3NPcmlnaW4gPSAnYW5vbnltb3VzJztcbiAgICAgIGltZy5zcmMgPSB1cmw7XG4gICAgfSk7XG4gIH1cblxuICBsb2FkQmFzZTY0SW1hZ2UoaW1hZ2VCYXNlNjQ6IHN0cmluZywgY3JvcHBlclNldHRpbmdzOiBDcm9wcGVyU2V0dGluZ3MpOiBQcm9taXNlPExvYWRlZEltYWdlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPExvYWRJbWFnZUJhc2U2ND4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3Qgb3JpZ2luYWxJbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgb3JpZ2luYWxJbWFnZS5vbmxvYWQgPSAoKSA9PiByZXNvbHZlKHtcbiAgICAgICAgb3JpZ2luYWxJbWFnZSxcbiAgICAgICAgb3JpZ2luYWxCYXNlNjQ6IGltYWdlQmFzZTY0XG4gICAgICB9KTtcbiAgICAgIG9yaWdpbmFsSW1hZ2Uub25lcnJvciA9IHJlamVjdDtcbiAgICAgIG9yaWdpbmFsSW1hZ2Uuc3JjID0gaW1hZ2VCYXNlNjQ7XG4gICAgfSkudGhlbigocmVzOiBMb2FkSW1hZ2VCYXNlNjQpID0+IHRoaXMudHJhbnNmb3JtSW1hZ2VCYXNlNjQocmVzLCBjcm9wcGVyU2V0dGluZ3MpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgdHJhbnNmb3JtSW1hZ2VCYXNlNjQocmVzOiBMb2FkSW1hZ2VCYXNlNjQsIGNyb3BwZXJTZXR0aW5nczogQ3JvcHBlclNldHRpbmdzKTogUHJvbWlzZTxMb2FkZWRJbWFnZT4ge1xuICAgIGNvbnN0IGF1dG9Sb3RhdGUgPSBhd2FpdCB0aGlzLmF1dG9Sb3RhdGVTdXBwb3J0ZWQ7XG4gICAgY29uc3QgZXhpZlRyYW5zZm9ybSA9IGF3YWl0IGdldFRyYW5zZm9ybWF0aW9uc0Zyb21FeGlmRGF0YShhdXRvUm90YXRlID8gLTEgOiByZXMub3JpZ2luYWxCYXNlNjQpO1xuICAgIGlmICghcmVzLm9yaWdpbmFsSW1hZ2UgfHwgIXJlcy5vcmlnaW5hbEltYWdlLmNvbXBsZXRlKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdObyBpbWFnZSBsb2FkZWQnKSk7XG4gICAgfVxuICAgIGNvbnN0IGxvYWRlZEltYWdlID0ge1xuICAgICAgb3JpZ2luYWw6IHtcbiAgICAgICAgYmFzZTY0OiByZXMub3JpZ2luYWxCYXNlNjQsXG4gICAgICAgIGltYWdlOiByZXMub3JpZ2luYWxJbWFnZSxcbiAgICAgICAgc2l6ZToge1xuICAgICAgICAgIHdpZHRoOiByZXMub3JpZ2luYWxJbWFnZS5uYXR1cmFsV2lkdGgsXG4gICAgICAgICAgaGVpZ2h0OiByZXMub3JpZ2luYWxJbWFnZS5uYXR1cmFsSGVpZ2h0XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBleGlmVHJhbnNmb3JtXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1Mb2FkZWRJbWFnZShsb2FkZWRJbWFnZSwgY3JvcHBlclNldHRpbmdzKTtcbiAgfVxuXG4gIGFzeW5jIHRyYW5zZm9ybUxvYWRlZEltYWdlKGxvYWRlZEltYWdlOiBQYXJ0aWFsPExvYWRlZEltYWdlPiwgY3JvcHBlclNldHRpbmdzOiBDcm9wcGVyU2V0dGluZ3MpOiBQcm9taXNlPExvYWRlZEltYWdlPiB7XG4gICAgY29uc3QgY2FudmFzUm90YXRpb24gPSBjcm9wcGVyU2V0dGluZ3MuY2FudmFzUm90YXRpb24gKyBsb2FkZWRJbWFnZS5leGlmVHJhbnNmb3JtIS5yb3RhdGU7XG4gICAgY29uc3Qgb3JpZ2luYWxTaXplID0ge1xuICAgICAgd2lkdGg6IGxvYWRlZEltYWdlLm9yaWdpbmFsIS5pbWFnZS5uYXR1cmFsV2lkdGgsXG4gICAgICBoZWlnaHQ6IGxvYWRlZEltYWdlLm9yaWdpbmFsIS5pbWFnZS5uYXR1cmFsSGVpZ2h0XG4gICAgfTtcbiAgICBpZiAoY2FudmFzUm90YXRpb24gPT09IDAgJiYgIWxvYWRlZEltYWdlLmV4aWZUcmFuc2Zvcm0hLmZsaXAgJiYgIWNyb3BwZXJTZXR0aW5ncy5jb250YWluV2l0aGluQXNwZWN0UmF0aW8pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9yaWdpbmFsOiB7XG4gICAgICAgICAgYmFzZTY0OiBsb2FkZWRJbWFnZS5vcmlnaW5hbCEuYmFzZTY0LFxuICAgICAgICAgIGltYWdlOiBsb2FkZWRJbWFnZS5vcmlnaW5hbCEuaW1hZ2UsXG4gICAgICAgICAgc2l6ZTogey4uLm9yaWdpbmFsU2l6ZX1cbiAgICAgICAgfSxcbiAgICAgICAgdHJhbnNmb3JtZWQ6IHtcbiAgICAgICAgICBiYXNlNjQ6IGxvYWRlZEltYWdlLm9yaWdpbmFsIS5iYXNlNjQsXG4gICAgICAgICAgaW1hZ2U6IGxvYWRlZEltYWdlLm9yaWdpbmFsIS5pbWFnZSxcbiAgICAgICAgICBzaXplOiB7Li4ub3JpZ2luYWxTaXplfVxuICAgICAgICB9LFxuICAgICAgICBleGlmVHJhbnNmb3JtOiBsb2FkZWRJbWFnZS5leGlmVHJhbnNmb3JtIVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmFuc2Zvcm1lZFNpemUgPSB0aGlzLmdldFRyYW5zZm9ybWVkU2l6ZShvcmlnaW5hbFNpemUsIGxvYWRlZEltYWdlLmV4aWZUcmFuc2Zvcm0hLCBjcm9wcGVyU2V0dGluZ3MpO1xuICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIGNhbnZhcy53aWR0aCA9IHRyYW5zZm9ybWVkU2l6ZS53aWR0aDtcbiAgICBjYW52YXMuaGVpZ2h0ID0gdHJhbnNmb3JtZWRTaXplLmhlaWdodDtcbiAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjdHg/LnNldFRyYW5zZm9ybShcbiAgICAgIGxvYWRlZEltYWdlLmV4aWZUcmFuc2Zvcm0hLmZsaXAgPyAtMSA6IDEsXG4gICAgICAwLFxuICAgICAgMCxcbiAgICAgIDEsXG4gICAgICBjYW52YXMud2lkdGggLyAyLFxuICAgICAgY2FudmFzLmhlaWdodCAvIDJcbiAgICApO1xuICAgIGN0eD8ucm90YXRlKE1hdGguUEkgKiAoY2FudmFzUm90YXRpb24gLyAyKSk7XG4gICAgY3R4Py5kcmF3SW1hZ2UoXG4gICAgICBsb2FkZWRJbWFnZS5vcmlnaW5hbCEuaW1hZ2UsXG4gICAgICAtb3JpZ2luYWxTaXplLndpZHRoIC8gMixcbiAgICAgIC1vcmlnaW5hbFNpemUuaGVpZ2h0IC8gMlxuICAgICk7XG4gICAgY29uc3QgdHJhbnNmb3JtZWRCYXNlNjQgPSBjYW52YXMudG9EYXRhVVJMKCk7XG4gICAgY29uc3QgdHJhbnNmb3JtZWRJbWFnZSA9IGF3YWl0IHRoaXMubG9hZEltYWdlRnJvbUJhc2U2NCh0cmFuc2Zvcm1lZEJhc2U2NCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIG9yaWdpbmFsOiB7XG4gICAgICAgIGJhc2U2NDogbG9hZGVkSW1hZ2Uub3JpZ2luYWwhLmJhc2U2NCxcbiAgICAgICAgaW1hZ2U6IGxvYWRlZEltYWdlLm9yaWdpbmFsIS5pbWFnZSxcbiAgICAgICAgc2l6ZTogey4uLm9yaWdpbmFsU2l6ZX1cbiAgICAgIH0sXG4gICAgICB0cmFuc2Zvcm1lZDoge1xuICAgICAgICBiYXNlNjQ6IHRyYW5zZm9ybWVkQmFzZTY0LFxuICAgICAgICBpbWFnZTogdHJhbnNmb3JtZWRJbWFnZSxcbiAgICAgICAgc2l6ZToge1xuICAgICAgICAgIHdpZHRoOiB0cmFuc2Zvcm1lZEltYWdlLndpZHRoLFxuICAgICAgICAgIGhlaWdodDogdHJhbnNmb3JtZWRJbWFnZS5oZWlnaHRcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGV4aWZUcmFuc2Zvcm06IGxvYWRlZEltYWdlLmV4aWZUcmFuc2Zvcm0hXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZEltYWdlRnJvbUJhc2U2NChpbWFnZUJhc2U2NDogc3RyaW5nKTogUHJvbWlzZTxIVE1MSW1hZ2VFbGVtZW50PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPEhUTUxJbWFnZUVsZW1lbnQ+KCgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBpbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgaW1hZ2Uub25sb2FkID0gKCkgPT4gcmVzb2x2ZShpbWFnZSk7XG4gICAgICBpbWFnZS5vbmVycm9yID0gcmVqZWN0O1xuICAgICAgaW1hZ2Uuc3JjID0gaW1hZ2VCYXNlNjQ7XG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRUcmFuc2Zvcm1lZFNpemUoXG4gICAgb3JpZ2luYWxTaXplOiB7IHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyIH0sXG4gICAgZXhpZlRyYW5zZm9ybTogRXhpZlRyYW5zZm9ybSxcbiAgICBjcm9wcGVyU2V0dGluZ3M6IENyb3BwZXJTZXR0aW5nc1xuICApOiBEaW1lbnNpb25zIHtcbiAgICBjb25zdCBjYW52YXNSb3RhdGlvbiA9IGNyb3BwZXJTZXR0aW5ncy5jYW52YXNSb3RhdGlvbiArIGV4aWZUcmFuc2Zvcm0ucm90YXRlO1xuICAgIGlmIChjcm9wcGVyU2V0dGluZ3MuY29udGFpbldpdGhpbkFzcGVjdFJhdGlvKSB7XG4gICAgICBpZiAoY2FudmFzUm90YXRpb24gJSAyKSB7XG4gICAgICAgIGNvbnN0IG1pbldpZHRoVG9Db250YWluID0gb3JpZ2luYWxTaXplLndpZHRoICogY3JvcHBlclNldHRpbmdzLmFzcGVjdFJhdGlvO1xuICAgICAgICBjb25zdCBtaW5IZWlnaHRUb0NvbnRhaW4gPSBvcmlnaW5hbFNpemUuaGVpZ2h0IC8gY3JvcHBlclNldHRpbmdzLmFzcGVjdFJhdGlvO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHdpZHRoOiBNYXRoLm1heChvcmlnaW5hbFNpemUuaGVpZ2h0LCBtaW5XaWR0aFRvQ29udGFpbiksXG4gICAgICAgICAgaGVpZ2h0OiBNYXRoLm1heChvcmlnaW5hbFNpemUud2lkdGgsIG1pbkhlaWdodFRvQ29udGFpbilcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG1pbldpZHRoVG9Db250YWluID0gb3JpZ2luYWxTaXplLmhlaWdodCAqIGNyb3BwZXJTZXR0aW5ncy5hc3BlY3RSYXRpbztcbiAgICAgICAgY29uc3QgbWluSGVpZ2h0VG9Db250YWluID0gb3JpZ2luYWxTaXplLndpZHRoIC8gY3JvcHBlclNldHRpbmdzLmFzcGVjdFJhdGlvO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHdpZHRoOiBNYXRoLm1heChvcmlnaW5hbFNpemUud2lkdGgsIG1pbldpZHRoVG9Db250YWluKSxcbiAgICAgICAgICBoZWlnaHQ6IE1hdGgubWF4KG9yaWdpbmFsU2l6ZS5oZWlnaHQsIG1pbkhlaWdodFRvQ29udGFpbilcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2FudmFzUm90YXRpb24gJSAyKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBoZWlnaHQ6IG9yaWdpbmFsU2l6ZS53aWR0aCxcbiAgICAgICAgd2lkdGg6IG9yaWdpbmFsU2l6ZS5oZWlnaHRcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogb3JpZ2luYWxTaXplLndpZHRoLFxuICAgICAgaGVpZ2h0OiBvcmlnaW5hbFNpemUuaGVpZ2h0XG4gICAgfTtcbiAgfVxufVxuIl19