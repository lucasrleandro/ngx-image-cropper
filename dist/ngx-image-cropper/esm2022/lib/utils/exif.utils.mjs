// Black 2x1 JPEG, with the following meta information set:
// - EXIF Orientation: 6 (Rotated 90° CCW)
// Source: https://github.com/blueimp/JavaScript-Load-Image
const testAutoOrientationImageURL = 'data:image/jpeg;base64,/9j/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAA' +
    'AAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA' +
    'QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE' +
    'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAAEAAgMBEQACEQEDEQH/x' +
    'ABKAAEAAAAAAAAAAAAAAAAAAAALEAEAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAA' +
    'AAAAAEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8H//2Q==';
export function supportsAutomaticRotation() {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Check if browser supports automatic image orientation:
            const supported = img.width === 1 && img.height === 2;
            resolve(supported);
        };
        img.src = testAutoOrientationImageURL;
    });
}
export function getTransformationsFromExifData(exifRotationOrBase64Image) {
    if (typeof exifRotationOrBase64Image === 'string') {
        exifRotationOrBase64Image = getExifRotation(exifRotationOrBase64Image);
    }
    switch (exifRotationOrBase64Image) {
        case 2:
            return { rotate: 0, flip: true };
        case 3:
            return { rotate: 2, flip: false };
        case 4:
            return { rotate: 2, flip: true };
        case 5:
            return { rotate: 1, flip: true };
        case 6:
            return { rotate: 1, flip: false };
        case 7:
            return { rotate: 3, flip: true };
        case 8:
            return { rotate: 3, flip: false };
        default:
            return { rotate: 0, flip: false };
    }
}
function getExifRotation(imageBase64) {
    const view = new DataView(base64ToArrayBuffer(imageBase64));
    if (view.getUint16(0, false) !== 0xFFD8) {
        return -2;
    }
    const length = view.byteLength;
    let offset = 2;
    while (offset < length) {
        if (view.getUint16(offset + 2, false) <= 8)
            return -1;
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker == 0xFFE1) {
            if (view.getUint32(offset += 2, false) !== 0x45786966) {
                return -1;
            }
            const little = view.getUint16(offset += 6, false) == 0x4949;
            offset += view.getUint32(offset + 4, little);
            const tags = view.getUint16(offset, little);
            offset += 2;
            for (let i = 0; i < tags; i++) {
                if (view.getUint16(offset + (i * 12), little) == 0x0112) {
                    return view.getUint16(offset + (i * 12) + 8, little);
                }
            }
        }
        else if ((marker & 0xFF00) !== 0xFF00) {
            break;
        }
        else {
            offset += view.getUint16(offset, false);
        }
    }
    return -1;
}
function base64ToArrayBuffer(imageBase64) {
    imageBase64 = imageBase64.replace(/^data\:([^\;]+)\;base64,/gmi, '');
    const binaryString = atob(imageBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhpZi51dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1pbWFnZS1jcm9wcGVyL3NyYy9saWIvdXRpbHMvZXhpZi51dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSwyREFBMkQ7QUFDM0QsMENBQTBDO0FBQzFDLDJEQUEyRDtBQUMzRCxNQUFNLDJCQUEyQixHQUMvQix3RUFBd0U7SUFDeEUsd0VBQXdFO0lBQ3hFLHdFQUF3RTtJQUN4RSx3RUFBd0U7SUFDeEUsd0VBQXdFO0lBQ3hFLDJEQUEyRCxDQUFDO0FBRTlELE1BQU0sVUFBVSx5QkFBeUI7SUFDdkMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1FBQzdCLE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7UUFDeEIsR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLEVBQUU7WUFDaEIseURBQXlEO1lBQ3pELE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO1lBQ3RELE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyQixDQUFDLENBQUM7UUFDRixHQUFHLENBQUMsR0FBRyxHQUFHLDJCQUEyQixDQUFDO0lBQ3hDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELE1BQU0sVUFBVSw4QkFBOEIsQ0FBQyx5QkFBMEM7SUFDdkYsSUFBSSxPQUFPLHlCQUF5QixLQUFLLFFBQVEsRUFBRTtRQUNqRCx5QkFBeUIsR0FBRyxlQUFlLENBQUMseUJBQXlCLENBQUMsQ0FBQztLQUN4RTtJQUNELFFBQVEseUJBQXlCLEVBQUU7UUFDakMsS0FBSyxDQUFDO1lBQ0osT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO1FBQ25DLEtBQUssQ0FBQztZQUNKLE9BQU8s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O0lBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNaLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLFdBQW1CO0lBQzlDLFdBQVcsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLDZCQUE2QixFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3JFLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN2QyxNQUFNLEdBQUcsR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDO0lBQ2hDLE1BQU0sS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDNUIsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDdkM7SUFDRCxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDdEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV4aWZUcmFuc2Zvcm0gfSBmcm9tICcuLi9pbnRlcmZhY2VzL2V4aWYtdHJhbnNmb3JtLmludGVyZmFjZSc7XG5cbi8vIEJsYWNrIDJ4MSBKUEVHLCB3aXRoIHRoZSBmb2xsb3dpbmcgbWV0YSBpbmZvcm1hdGlvbiBzZXQ6XG4vLyAtIEVYSUYgT3JpZW50YXRpb246IDYgKFJvdGF0ZWQgOTDCsCBDQ1cpXG4vLyBTb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL0phdmFTY3JpcHQtTG9hZC1JbWFnZVxuY29uc3QgdGVzdEF1dG9PcmllbnRhdGlvbkltYWdlVVJMID1cbiAgJ2RhdGE6aW1hZ2UvanBlZztiYXNlNjQsLzlqLzRRQWlSWGhwWmdBQVRVMEFLZ0FBQUFnQUFRRVNBQU1BQUFBQkFBWUFBQUEnICtcbiAgJ0FBQUQvMndDRUFBRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkEnICtcbiAgJ1FFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUUnICtcbiAgJ0JBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQWYvQUFCRUlBQUVBQWdNQkVRQUNFUUVERVFIL3gnICtcbiAgJ0FCS0FBRUFBQUFBQUFBQUFBQUFBQUFBQUFBTEVBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRRUFBQUFBQUFBQUFBQUFBQUEnICtcbiAgJ0FBQUFBRVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBLzlvQURBTUJBQUlSQXhFQVB3QS84SC8vMlE9PSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzdXBwb3J0c0F1dG9tYXRpY1JvdGF0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICBpbWcub25sb2FkID0gKCkgPT4ge1xuICAgICAgLy8gQ2hlY2sgaWYgYnJvd3NlciBzdXBwb3J0cyBhdXRvbWF0aWMgaW1hZ2Ugb3JpZW50YXRpb246XG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBpbWcud2lkdGggPT09IDEgJiYgaW1nLmhlaWdodCA9PT0gMjtcbiAgICAgIHJlc29sdmUoc3VwcG9ydGVkKTtcbiAgICB9O1xuICAgIGltZy5zcmMgPSB0ZXN0QXV0b09yaWVudGF0aW9uSW1hZ2VVUkw7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHJhbnNmb3JtYXRpb25zRnJvbUV4aWZEYXRhKGV4aWZSb3RhdGlvbk9yQmFzZTY0SW1hZ2U6IG51bWJlciB8IHN0cmluZyk6IEV4aWZUcmFuc2Zvcm0ge1xuICBpZiAodHlwZW9mIGV4aWZSb3RhdGlvbk9yQmFzZTY0SW1hZ2UgPT09ICdzdHJpbmcnKSB7XG4gICAgZXhpZlJvdGF0aW9uT3JCYXNlNjRJbWFnZSA9IGdldEV4aWZSb3RhdGlvbihleGlmUm90YXRpb25PckJhc2U2NEltYWdlKTtcbiAgfVxuICBzd2l0Y2ggKGV4aWZSb3RhdGlvbk9yQmFzZTY0SW1hZ2UpIHtcbiAgICBjYXNlIDI6XG4gICAgICByZXR1cm4geyByb3RhdGU6IDAsIGZsaXA6IHRydWUgfTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4geyByb3RhdGU6IDIsIGZsaXA6IGZhbHNlIH07XG4gICAgY2FzZSA0OlxuICAgICAgcmV0dXJuIHsgcm90YXRlOiAyLCBmbGlwOiB0cnVlIH07XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIHsgcm90YXRlOiAxLCBmbGlwOiB0cnVlIH07XG4gICAgY2FzZSA2OlxuICAgICAgcmV0dXJuIHsgcm90YXRlOiAxLCBmbGlwOiBmYWxzZSB9O1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiB7IHJvdGF0ZTogMywgZmxpcDogdHJ1ZSB9O1xuICAgIGNhc2UgODpcbiAgICAgIHJldHVybiB7IHJvdGF0ZTogMywgZmxpcDogZmFsc2UgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHsgcm90YXRlOiAwLCBmbGlwOiBmYWxzZSB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEV4aWZSb3RhdGlvbihpbWFnZUJhc2U2NDogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhiYXNlNjRUb0FycmF5QnVmZmVyKGltYWdlQmFzZTY0KSk7XG4gIGlmICh2aWV3LmdldFVpbnQxNigwLCBmYWxzZSkgIT09IDB4RkZEOCkge1xuICAgIHJldHVybiAtMjtcbiAgfVxuICBjb25zdCBsZW5ndGggPSB2aWV3LmJ5dGVMZW5ndGg7XG4gIGxldCBvZmZzZXQgPSAyO1xuICB3aGlsZSAob2Zmc2V0IDwgbGVuZ3RoKSB7XG4gICAgaWYgKHZpZXcuZ2V0VWludDE2KG9mZnNldCArIDIsIGZhbHNlKSA8PSA4KSByZXR1cm4gLTE7XG4gICAgY29uc3QgbWFya2VyID0gdmlldy5nZXRVaW50MTYob2Zmc2V0LCBmYWxzZSk7XG4gICAgb2Zmc2V0ICs9IDI7XG4gICAgaWYgKG1hcmtlciA9PSAweEZGRTEpIHtcbiAgICAgIGlmICh2aWV3LmdldFVpbnQzMihvZmZzZXQgKz0gMiwgZmFsc2UpICE9PSAweDQ1Nzg2OTY2KSB7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbGl0dGxlID0gdmlldy5nZXRVaW50MTYob2Zmc2V0ICs9IDYsIGZhbHNlKSA9PSAweDQ5NDk7XG4gICAgICBvZmZzZXQgKz0gdmlldy5nZXRVaW50MzIob2Zmc2V0ICsgNCwgbGl0dGxlKTtcbiAgICAgIGNvbnN0IHRhZ3MgPSB2aWV3LmdldFVpbnQxNihvZmZzZXQsIGxpdHRsZSk7XG4gICAgICBvZmZzZXQgKz0gMjtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFnczsgaSsrKSB7XG4gICAgICAgIGlmICh2aWV3LmdldFVpbnQxNihvZmZzZXQgKyAoaSAqIDEyKSwgbGl0dGxlKSA9PSAweDAxMTIpIHtcbiAgICAgICAgICByZXR1cm4gdmlldy5nZXRVaW50MTYob2Zmc2V0ICsgKGkgKiAxMikgKyA4LCBsaXR0bGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICgobWFya2VyICYgMHhGRjAwKSAhPT0gMHhGRjAwKSB7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2Uge1xuICAgICAgb2Zmc2V0ICs9IHZpZXcuZ2V0VWludDE2KG9mZnNldCwgZmFsc2UpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gLTE7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQXJyYXlCdWZmZXIoaW1hZ2VCYXNlNjQ6IHN0cmluZykge1xuICBpbWFnZUJhc2U2NCA9IGltYWdlQmFzZTY0LnJlcGxhY2UoL15kYXRhXFw6KFteXFw7XSspXFw7YmFzZTY0LC9nbWksICcnKTtcbiAgY29uc3QgYmluYXJ5U3RyaW5nID0gYXRvYihpbWFnZUJhc2U2NCk7XG4gIGNvbnN0IGxlbiA9IGJpbmFyeVN0cmluZy5sZW5ndGg7XG4gIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGJ5dGVzW2ldID0gYmluYXJ5U3RyaW5nLmNoYXJDb2RlQXQoaSk7XG4gIH1cbiAgcmV0dXJuIGJ5dGVzLmJ1ZmZlcjtcbn1cbiJdfQ==