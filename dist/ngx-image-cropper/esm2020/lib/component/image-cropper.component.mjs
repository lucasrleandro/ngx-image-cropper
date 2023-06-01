import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, HostListener, Input, isDevMode, Output, ViewChild } from '@angular/core';
import { CropperSettings } from '../interfaces/cropper.settings';
import { MoveTypes } from '../interfaces/move-start.interface';
import { getEventForKey, getInvertedPositionForKey, getPositionForKey } from '../utils/keyboard.utils';
import * as i0 from "@angular/core";
import * as i1 from "../services/crop.service";
import * as i2 from "../services/cropper-position.service";
import * as i3 from "../services/load-image.service";
import * as i4 from "@angular/platform-browser";
import * as i5 from "@angular/common";
export class ImageCropperComponent {
    constructor(cropService, cropperPositionService, loadImageService, sanitizer, cd) {
        this.cropService = cropService;
        this.cropperPositionService = cropperPositionService;
        this.loadImageService = loadImageService;
        this.sanitizer = sanitizer;
        this.cd = cd;
        this.Hammer = window?.['Hammer'] || null;
        this.settings = new CropperSettings();
        this.setImageMaxSizeRetries = 0;
        this.resizedWhileHidden = false;
        this.marginLeft = '0px';
        this.maxSize = {
            width: 0,
            height: 0
        };
        this.moveTypes = MoveTypes;
        this.imageVisible = false;
        this.format = this.settings.format;
        this.transform = {};
        this.maintainAspectRatio = this.settings.maintainAspectRatio;
        this.aspectRatio = this.settings.aspectRatio;
        this.resetCropOnAspectRatioChange = this.settings.resetCropOnAspectRatioChange;
        this.resizeToWidth = this.settings.resizeToWidth;
        this.resizeToHeight = this.settings.resizeToHeight;
        this.cropperMinWidth = this.settings.cropperMinWidth;
        this.cropperMinHeight = this.settings.cropperMinHeight;
        this.cropperMaxHeight = this.settings.cropperMaxHeight;
        this.cropperMaxWidth = this.settings.cropperMaxWidth;
        this.cropperStaticWidth = this.settings.cropperStaticWidth;
        this.cropperStaticHeight = this.settings.cropperStaticHeight;
        this.canvasRotation = this.settings.canvasRotation;
        this.initialStepSize = this.settings.initialStepSize;
        this.roundCropper = this.settings.roundCropper;
        this.onlyScaleDown = this.settings.onlyScaleDown;
        this.imageQuality = this.settings.imageQuality;
        this.autoCrop = this.settings.autoCrop;
        this.backgroundColor = this.settings.backgroundColor;
        this.containWithinAspectRatio = this.settings.containWithinAspectRatio;
        this.hideResizeSquares = this.settings.hideResizeSquares;
        this.allowMoveImage = false;
        this.cropper = {
            x1: -100,
            y1: -100,
            x2: 10000,
            y2: 10000
        };
        this.alignImage = this.settings.alignImage;
        this.disabled = false;
        this.hidden = false;
        this.imageCropped = new EventEmitter();
        this.startCropImage = new EventEmitter();
        this.imageLoaded = new EventEmitter();
        this.cropperReady = new EventEmitter();
        this.loadImageFailed = new EventEmitter();
        this.transformChange = new EventEmitter();
        this.cropping = new EventEmitter();
        this.reset();
    }
    ngOnChanges(changes) {
        this.onChangesUpdateSettings(changes);
        this.onChangesInputImage(changes);
        if (this.loadedImage?.original.image.complete && (changes['containWithinAspectRatio'] || changes['canvasRotation'])) {
            this.loadImageService
                .transformLoadedImage(this.loadedImage, this.settings)
                .then((res) => this.setLoadedImage(res))
                .catch((err) => this.loadImageError(err));
        }
        if (changes['cropper'] || changes['maintainAspectRatio'] || changes['aspectRatio']) {
            this.setMaxSize();
            this.setCropperScaledMinSize();
            this.setCropperScaledMaxSize();
            if (this.maintainAspectRatio &&
                (this.resetCropOnAspectRatioChange || !this.aspectRatioIsCorrect()) &&
                (changes['maintainAspectRatio'] || changes['aspectRatio'])) {
                this.resetCropperPosition();
            }
            else if (changes['cropper']) {
                this.checkCropperPosition(false);
                this.doAutoCrop();
            }
            this.cd.markForCheck();
        }
        if (changes['transform']) {
            this.transform = this.transform || {};
            this.setCssTransform();
            this.doAutoCrop();
            this.cd.markForCheck();
        }
        if (changes['hidden'] && this.resizedWhileHidden && !this.hidden) {
            setTimeout(() => {
                this.onResize();
                this.resizedWhileHidden = false;
            });
        }
    }
    onChangesUpdateSettings(changes) {
        this.settings.setOptionsFromChanges(changes);
        if (this.settings.cropperStaticHeight && this.settings.cropperStaticWidth) {
            this.settings.setOptions({
                hideResizeSquares: true,
                cropperMinWidth: this.settings.cropperStaticWidth,
                cropperMinHeight: this.settings.cropperStaticHeight,
                cropperMaxHeight: this.settings.cropperStaticHeight,
                cropperMaxWidth: this.settings.cropperStaticWidth,
                maintainAspectRatio: false
            });
        }
    }
    onChangesInputImage(changes) {
        if (changes['imageChangedEvent'] || changes['imageURL'] || changes['imageBase64'] || changes['imageFile']) {
            this.reset();
        }
        if (changes['imageChangedEvent'] && this.isValidImageChangedEvent()) {
            this.loadImageFile(this.imageChangedEvent.target.files[0]);
        }
        if (changes['imageURL'] && this.imageURL) {
            this.loadImageFromURL(this.imageURL);
        }
        if (changes['imageBase64'] && this.imageBase64) {
            this.loadBase64Image(this.imageBase64);
        }
        if (changes['imageFile'] && this.imageFile) {
            this.loadImageFile(this.imageFile);
        }
    }
    isValidImageChangedEvent() {
        return this.imageChangedEvent?.target?.files?.length > 0;
    }
    setCssTransform() {
        const translateUnit = this.transform?.translateUnit || '%';
        this.safeTransformStyle = this.sanitizer.bypassSecurityTrustStyle(`translate(${this.transform.translateH || 0}${translateUnit}, ${this.transform.translateV || 0}${translateUnit})` +
            ' scaleX(' + (this.transform.scale || 1) * (this.transform.flipH ? -1 : 1) + ')' +
            ' scaleY(' + (this.transform.scale || 1) * (this.transform.flipV ? -1 : 1) + ')' +
            ' rotate(' + (this.transform.rotate || 0) + 'deg)');
    }
    ngOnInit() {
        this.settings.stepSize = this.initialStepSize;
        this.activatePinchGesture();
    }
    reset() {
        this.imageVisible = false;
        this.loadedImage = undefined;
        this.safeImgDataUrl = 'data:image/png;base64,iVBORw0KGg'
            + 'oAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAU'
            + 'AAarVyFEAAAAASUVORK5CYII=';
        this.moveStart = {
            active: false,
            type: null,
            position: null,
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
            clientX: 0,
            clientY: 0
        };
        this.maxSize = {
            width: 0,
            height: 0
        };
        this.cropper.x1 = -100;
        this.cropper.y1 = -100;
        this.cropper.x2 = 10000;
        this.cropper.y2 = 10000;
    }
    loadImageFile(file) {
        this.loadImageService
            .loadImageFile(file, this.settings)
            .then((res) => this.setLoadedImage(res))
            .catch((err) => this.loadImageError(err));
    }
    loadBase64Image(imageBase64) {
        this.loadImageService
            .loadBase64Image(imageBase64, this.settings)
            .then((res) => this.setLoadedImage(res))
            .catch((err) => this.loadImageError(err));
    }
    loadImageFromURL(url) {
        this.loadImageService
            .loadImageFromURL(url, this.settings)
            .then((res) => this.setLoadedImage(res))
            .catch((err) => this.loadImageError(err));
    }
    setLoadedImage(loadedImage) {
        this.loadedImage = loadedImage;
        this.safeImgDataUrl = this.sanitizer.bypassSecurityTrustResourceUrl(loadedImage.transformed.base64);
        this.cd.markForCheck();
    }
    loadImageError(error) {
        console.error(error);
        this.loadImageFailed.emit();
    }
    imageLoadedInView() {
        if (this.loadedImage != null) {
            this.imageLoaded.emit(this.loadedImage);
            this.setImageMaxSizeRetries = 0;
            setTimeout(() => this.checkImageMaxSizeRecursively());
        }
    }
    checkImageMaxSizeRecursively() {
        if (this.setImageMaxSizeRetries > 40) {
            this.loadImageFailed.emit();
        }
        else if (this.sourceImageLoaded()) {
            this.setMaxSize();
            this.setCropperScaledMinSize();
            this.setCropperScaledMaxSize();
            this.resetCropperPosition();
            this.cropperReady.emit({ ...this.maxSize });
            this.cd.markForCheck();
        }
        else {
            this.setImageMaxSizeRetries++;
            setTimeout(() => this.checkImageMaxSizeRecursively(), 50);
        }
    }
    sourceImageLoaded() {
        return this.sourceImage?.nativeElement?.offsetWidth > 0;
    }
    onResize() {
        if (!this.loadedImage) {
            return;
        }
        if (this.hidden) {
            this.resizedWhileHidden = true;
        }
        else {
            this.resizeCropperPosition();
            this.setMaxSize();
            this.setCropperScaledMinSize();
            this.setCropperScaledMaxSize();
        }
    }
    activatePinchGesture() {
        if (this.Hammer) {
            const hammer = new this.Hammer(this.wrapper.nativeElement);
            hammer.get('pinch').set({ enable: true });
            hammer.on('pinchmove', this.onPinch.bind(this));
            hammer.on('pinchend', this.pinchStop.bind(this));
            hammer.on('pinchstart', this.startPinch.bind(this));
        }
        else if (isDevMode()) {
            console.warn('[NgxImageCropper] Could not find HammerJS - Pinch Gesture won\'t work');
        }
    }
    resizeCropperPosition() {
        const sourceImageElement = this.sourceImage.nativeElement;
        if (this.maxSize.width !== sourceImageElement.offsetWidth || this.maxSize.height !== sourceImageElement.offsetHeight) {
            this.cropper.x1 = this.cropper.x1 * sourceImageElement.offsetWidth / this.maxSize.width;
            this.cropper.x2 = this.cropper.x2 * sourceImageElement.offsetWidth / this.maxSize.width;
            this.cropper.y1 = this.cropper.y1 * sourceImageElement.offsetHeight / this.maxSize.height;
            this.cropper.y2 = this.cropper.y2 * sourceImageElement.offsetHeight / this.maxSize.height;
        }
    }
    resetCropperPosition() {
        this.cropperPositionService.resetCropperPosition(this.sourceImage, this.cropper, this.settings);
        this.doAutoCrop();
        this.imageVisible = true;
    }
    keyboardAccess(event) {
        this.changeKeyboardStepSize(event);
        this.keyboardMoveCropper(event);
    }
    changeKeyboardStepSize(event) {
        const key = +event.key;
        if (key >= 1 && key <= 9) {
            this.settings.stepSize = key;
        }
    }
    keyboardMoveCropper(event) {
        const keyboardWhiteList = ['ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft'];
        if (!(keyboardWhiteList.includes(event.key))) {
            return;
        }
        const moveType = event.shiftKey ? MoveTypes.Resize : MoveTypes.Move;
        const position = event.altKey ? getInvertedPositionForKey(event.key) : getPositionForKey(event.key);
        const moveEvent = getEventForKey(event.key, this.settings.stepSize);
        event.preventDefault();
        event.stopPropagation();
        this.startMove({ clientX: 0, clientY: 0 }, moveType, position);
        this.moveImg(moveEvent);
        this.moveStop();
    }
    startMove(event, moveType, position = null) {
        if (this.disabled
            || this.moveStart?.active && this.moveStart?.type === MoveTypes.Pinch
            || moveType === MoveTypes.Drag && !this.allowMoveImage) {
            return;
        }
        if (event.preventDefault) {
            event.preventDefault();
        }
        this.moveStart = {
            active: true,
            type: moveType,
            position,
            transform: { ...this.transform },
            clientX: this.cropperPositionService.getClientX(event),
            clientY: this.cropperPositionService.getClientY(event),
            ...this.cropper
        };
    }
    startPinch(event) {
        if (!this.safeImgDataUrl) {
            return;
        }
        if (event.preventDefault) {
            event.preventDefault();
        }
        this.moveStart = {
            active: true,
            type: MoveTypes.Pinch,
            position: 'center',
            clientX: this.cropper.x1 + (this.cropper.x2 - this.cropper.x1) / 2,
            clientY: this.cropper.y1 + (this.cropper.y2 - this.cropper.y1) / 2,
            ...this.cropper
        };
    }
    moveImg(event) {
        if (this.moveStart.active) {
            if (event.stopPropagation) {
                event.stopPropagation();
            }
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (this.moveStart.type === MoveTypes.Move) {
                this.cropperPositionService.move(event, this.moveStart, this.cropper);
                this.checkCropperPosition(true);
            }
            else if (this.moveStart.type === MoveTypes.Resize) {
                if (!this.cropperStaticWidth && !this.cropperStaticHeight) {
                    this.cropperPositionService.resize(event, this.moveStart, this.cropper, this.maxSize, this.settings);
                    this.cropping.emit(this.cropper);
                }
                this.checkCropperPosition(false);
            }
            else if (this.moveStart.type === MoveTypes.Drag) {
                const diffX = this.cropperPositionService.getClientX(event) - this.moveStart.clientX;
                const diffY = this.cropperPositionService.getClientY(event) - this.moveStart.clientY;
                this.transform = {
                    ...this.transform,
                    translateH: (this.moveStart.transform?.translateH || 0) + diffX,
                    translateV: (this.moveStart.transform?.translateV || 0) + diffY
                };
                this.setCssTransform();
            }
            this.cd.detectChanges();
        }
    }
    onPinch(event) {
        if (this.moveStart.active) {
            if (event.stopPropagation) {
                event.stopPropagation();
            }
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (this.moveStart.type === MoveTypes.Pinch) {
                this.cropperPositionService.resize(event, this.moveStart, this.cropper, this.maxSize, this.settings);
                this.checkCropperPosition(false);
            }
            this.cd.detectChanges();
        }
    }
    setMaxSize() {
        if (this.sourceImage) {
            const sourceImageElement = this.sourceImage.nativeElement;
            this.maxSize.width = sourceImageElement.offsetWidth;
            this.maxSize.height = sourceImageElement.offsetHeight;
            this.marginLeft = this.sanitizer.bypassSecurityTrustStyle('calc(50% - ' + this.maxSize.width / 2 + 'px)');
        }
    }
    setCropperScaledMinSize() {
        if (this.loadedImage?.transformed?.image) {
            this.setCropperScaledMinWidth();
            this.setCropperScaledMinHeight();
        }
        else {
            this.settings.cropperScaledMinWidth = 20;
            this.settings.cropperScaledMinHeight = 20;
        }
    }
    setCropperScaledMinWidth() {
        this.settings.cropperScaledMinWidth = this.cropperMinWidth > 0
            ? Math.max(20, this.cropperMinWidth / this.loadedImage.transformed.image.width * this.maxSize.width)
            : 20;
    }
    setCropperScaledMinHeight() {
        if (this.maintainAspectRatio) {
            this.settings.cropperScaledMinHeight = Math.max(20, this.settings.cropperScaledMinWidth / this.aspectRatio);
        }
        else if (this.cropperMinHeight > 0) {
            this.settings.cropperScaledMinHeight = Math.max(20, this.cropperMinHeight / this.loadedImage.transformed.image.height * this.maxSize.height);
        }
        else {
            this.settings.cropperScaledMinHeight = 20;
        }
    }
    setCropperScaledMaxSize() {
        if (this.loadedImage?.transformed?.image) {
            const ratio = this.loadedImage.transformed.size.width / this.maxSize.width;
            this.settings.cropperScaledMaxWidth = this.cropperMaxWidth > 20 ? this.cropperMaxWidth / ratio : this.maxSize.width;
            this.settings.cropperScaledMaxHeight = this.cropperMaxHeight > 20 ? this.cropperMaxHeight / ratio : this.maxSize.height;
            if (this.maintainAspectRatio) {
                if (this.settings.cropperScaledMaxWidth > this.settings.cropperScaledMaxHeight * this.aspectRatio) {
                    this.settings.cropperScaledMaxWidth = this.settings.cropperScaledMaxHeight * this.aspectRatio;
                }
                else if (this.settings.cropperScaledMaxWidth < this.settings.cropperScaledMaxHeight * this.aspectRatio) {
                    this.settings.cropperScaledMaxHeight = this.settings.cropperScaledMaxWidth / this.aspectRatio;
                }
            }
        }
        else {
            this.settings.cropperScaledMaxWidth = this.maxSize.width;
            this.settings.cropperScaledMaxHeight = this.maxSize.height;
        }
    }
    checkCropperPosition(maintainSize = false) {
        if (this.cropper.x1 < 0) {
            this.cropper.x2 -= maintainSize ? this.cropper.x1 : 0;
            this.cropper.x1 = 0;
        }
        if (this.cropper.y1 < 0) {
            this.cropper.y2 -= maintainSize ? this.cropper.y1 : 0;
            this.cropper.y1 = 0;
        }
        if (this.cropper.x2 > this.maxSize.width) {
            this.cropper.x1 -= maintainSize ? (this.cropper.x2 - this.maxSize.width) : 0;
            this.cropper.x2 = this.maxSize.width;
        }
        if (this.cropper.y2 > this.maxSize.height) {
            this.cropper.y1 -= maintainSize ? (this.cropper.y2 - this.maxSize.height) : 0;
            this.cropper.y2 = this.maxSize.height;
        }
    }
    moveStop() {
        if (this.moveStart.active) {
            console.log('change!');
            this.moveStart.active = false;
            if (this.moveStart?.type === MoveTypes.Drag) {
                this.transformChange.emit(this.transform);
            }
            else {
                this.doAutoCrop();
            }
        }
    }
    pinchStop() {
        if (this.moveStart.active) {
            this.moveStart.active = false;
            this.doAutoCrop();
        }
    }
    doAutoCrop() {
        if (this.autoCrop) {
            this.crop();
        }
    }
    crop() {
        if (this.loadedImage?.transformed?.image != null) {
            this.startCropImage.emit();
            const output = this.cropService.crop(this.sourceImage, this.loadedImage, this.cropper, this.settings);
            if (output != null) {
                this.imageCropped.emit(output);
            }
            return output;
        }
        return null;
    }
    aspectRatioIsCorrect() {
        const currentCropAspectRatio = (this.cropper.x2 - this.cropper.x1) / (this.cropper.y2 - this.cropper.y1);
        return currentCropAspectRatio === this.aspectRatio;
    }
}
ImageCropperComponent.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "13.3.11", ngImport: i0, type: ImageCropperComponent, deps: [{ token: i1.CropService }, { token: i2.CropperPositionService }, { token: i3.LoadImageService }, { token: i4.DomSanitizer }, { token: i0.ChangeDetectorRef }], target: i0.ɵɵFactoryTarget.Component });
ImageCropperComponent.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "12.0.0", version: "13.3.11", type: ImageCropperComponent, selector: "image-cropper", inputs: { imageChangedEvent: "imageChangedEvent", imageURL: "imageURL", imageBase64: "imageBase64", imageFile: "imageFile", imageAltText: "imageAltText", format: "format", transform: "transform", maintainAspectRatio: "maintainAspectRatio", aspectRatio: "aspectRatio", resetCropOnAspectRatioChange: "resetCropOnAspectRatioChange", resizeToWidth: "resizeToWidth", resizeToHeight: "resizeToHeight", cropperMinWidth: "cropperMinWidth", cropperMinHeight: "cropperMinHeight", cropperMaxHeight: "cropperMaxHeight", cropperMaxWidth: "cropperMaxWidth", cropperStaticWidth: "cropperStaticWidth", cropperStaticHeight: "cropperStaticHeight", canvasRotation: "canvasRotation", initialStepSize: "initialStepSize", roundCropper: "roundCropper", onlyScaleDown: "onlyScaleDown", imageQuality: "imageQuality", autoCrop: "autoCrop", backgroundColor: "backgroundColor", containWithinAspectRatio: "containWithinAspectRatio", hideResizeSquares: "hideResizeSquares", allowMoveImage: "allowMoveImage", cropper: "cropper", alignImage: "alignImage", disabled: "disabled", hidden: "hidden" }, outputs: { imageCropped: "imageCropped", startCropImage: "startCropImage", imageLoaded: "imageLoaded", cropperReady: "cropperReady", loadImageFailed: "loadImageFailed", transformChange: "transformChange", cropping: "cropping" }, host: { listeners: { "window:resize": "onResize()", "document:mousemove": "moveImg($event)", "document:touchmove": "moveImg($event)", "document:mouseup": "moveStop()", "document:touchend": "moveStop()" }, properties: { "style.text-align": "this.alignImage", "class.disabled": "this.disabled", "class.ngx-ix-hidden": "this.hidden" } }, viewQueries: [{ propertyName: "wrapper", first: true, predicate: ["wrapper"], descendants: true, static: true }, { propertyName: "sourceImage", first: true, predicate: ["sourceImage"], descendants: true }], usesOnChanges: true, ngImport: i0, template: "<div\n  [style.background]=\"imageVisible && backgroundColor\"\n  #wrapper\n>\n  <img\n    #sourceImage\n    class=\"ngx-ic-source-image\"\n    *ngIf=\"safeImgDataUrl\"\n    [src]=\"safeImgDataUrl\"\n    [style.visibility]=\"imageVisible ? 'visible' : 'hidden'\"\n    [style.transform]=\"safeTransformStyle\"\n    [class.ngx-ic-draggable]=\"!disabled && allowMoveImage\"\n    [attr.alt]=\"imageAltText\"\n    (load)=\"imageLoadedInView()\"\n    (mousedown)=\"startMove($event, moveTypes.Drag)\"\n    (touchstart)=\"startMove($event, moveTypes.Drag)\"\n    (error)=\"loadImageError($event)\"\n  >\n  <div\n    class=\"ngx-ic-overlay\"\n    [style.width.px]=\"maxSize.width\"\n    [style.height.px]=\"maxSize.height\"\n    [style.margin-left]=\"alignImage === 'center' ? marginLeft : null\"\n  ></div>\n  <div class=\"ngx-ic-cropper\"\n       *ngIf=\"imageVisible\"\n       [class.ngx-ic-round]=\"roundCropper\"\n       [style.top.px]=\"cropper.y1\"\n       [style.left.px]=\"cropper.x1\"\n       [style.width.px]=\"cropper.x2 - cropper.x1\"\n       [style.height.px]=\"cropper.y2 - cropper.y1\"\n       [style.margin-left]=\"alignImage === 'center' ? marginLeft : null\"\n       [style.visibility]=\"imageVisible ? 'visible' : 'hidden'\"\n       (keydown)=\"keyboardAccess($event)\"\n       tabindex=\"0\"\n  >\n    <div\n      (mousedown)=\"startMove($event, moveTypes.Move)\"\n      (touchstart)=\"startMove($event, moveTypes.Move)\"\n      class=\"ngx-ic-move\">\n    </div>\n    <ng-container *ngIf=\"!hideResizeSquares\">\n            <span class=\"ngx-ic-resize ngx-ic-topleft\"\n                  (mousedown)=\"startMove($event, moveTypes.Resize, 'topleft')\"\n                  (touchstart)=\"startMove($event, moveTypes.Resize, 'topleft')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-top\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-topright\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'topright')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'topright')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-right\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottomright\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottomright')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottomright')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottom\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottomleft\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottomleft')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottomleft')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-left\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-top\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'top')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'top')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-right\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'right')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'right')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-bottom\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottom')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottom')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-left\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'left')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'left')\">\n            </span>\n    </ng-container>\n  </div>\n</div>\n", styles: [":host{display:flex;position:relative;width:100%;max-width:100%;max-height:100%;overflow:hidden;padding:5px;text-align:center}:host>div{width:100%;position:relative}:host>div img.ngx-ic-source-image{max-width:100%;max-height:100%;transform-origin:center}:host>div img.ngx-ic-source-image.ngx-ic-draggable{user-drag:none;-webkit-user-drag:none;user-select:none;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;cursor:grab}:host .ngx-ic-overlay{position:absolute;pointer-events:none;touch-action:none;outline:var(--cropper-overlay-color, white) solid 100vw;top:0;left:0}:host .ngx-ic-cropper{position:absolute;display:flex;color:#53535c;background:transparent;outline:rgba(255,255,255,.3) solid 100vw;outline:var(--cropper-outline-color, rgba(255, 255, 255, .3)) solid 100vw;touch-action:none}@media (orientation: portrait){:host .ngx-ic-cropper{outline-width:100vh}}:host .ngx-ic-cropper:after{position:absolute;content:\"\";inset:0;pointer-events:none;border:dashed 1px;opacity:.75;color:inherit;z-index:1}:host .ngx-ic-cropper .ngx-ic-move{width:100%;cursor:move;border:1px solid rgba(255,255,255,.5)}:host .ngx-ic-cropper:focus .ngx-ic-move{border-color:#1e90ff;border-width:2px}:host .ngx-ic-cropper .ngx-ic-resize{position:absolute;display:inline-block;line-height:6px;padding:8px;opacity:.85;z-index:1}:host .ngx-ic-cropper .ngx-ic-resize .ngx-ic-square{display:inline-block;background:#53535C;width:6px;height:6px;border:1px solid rgba(255,255,255,.5);box-sizing:content-box}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-topleft{top:-12px;left:-12px;cursor:nwse-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-top{top:-12px;left:calc(50% - 12px);cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-topright{top:-12px;right:-12px;cursor:nesw-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-right{top:calc(50% - 12px);right:-12px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottomright{bottom:-12px;right:-12px;cursor:nwse-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottom{bottom:-12px;left:calc(50% - 12px);cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottomleft{bottom:-12px;left:-12px;cursor:nesw-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-left{top:calc(50% - 12px);left:-12px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar{position:absolute;z-index:1}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-top{top:-11px;left:11px;width:calc(100% - 22px);height:22px;cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-right{top:11px;right:-11px;height:calc(100% - 22px);width:22px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-bottom{bottom:-11px;left:11px;width:calc(100% - 22px);height:22px;cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-left{top:11px;left:-11px;height:calc(100% - 22px);width:22px;cursor:ew-resize}:host .ngx-ic-cropper.ngx-ic-round{outline-color:transparent}:host .ngx-ic-cropper.ngx-ic-round:after{border-radius:100%;box-shadow:0 0 0 100vw #ffffff4d;box-shadow:0 0 0 100vw var(--cropper-outline-color, rgba(255, 255, 255, .3))}@media (orientation: portrait){:host .ngx-ic-cropper.ngx-ic-round:after{box-shadow:0 0 0 100vh #ffffff4d;box-shadow:0 0 0 100vh var(--cropper-outline-color, rgba(255, 255, 255, .3))}}:host .ngx-ic-cropper.ngx-ic-round .ngx-ic-move{border-radius:100%}:host.disabled .ngx-ic-cropper .ngx-ic-resize,:host.disabled .ngx-ic-cropper .ngx-ic-resize-bar,:host.disabled .ngx-ic-cropper .ngx-ic-move{display:none}:host.ngx-ix-hidden{display:none}\n"], directives: [{ type: i5.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "13.3.11", ngImport: i0, type: ImageCropperComponent, decorators: [{
            type: Component,
            args: [{ selector: 'image-cropper', changeDetection: ChangeDetectionStrategy.OnPush, template: "<div\n  [style.background]=\"imageVisible && backgroundColor\"\n  #wrapper\n>\n  <img\n    #sourceImage\n    class=\"ngx-ic-source-image\"\n    *ngIf=\"safeImgDataUrl\"\n    [src]=\"safeImgDataUrl\"\n    [style.visibility]=\"imageVisible ? 'visible' : 'hidden'\"\n    [style.transform]=\"safeTransformStyle\"\n    [class.ngx-ic-draggable]=\"!disabled && allowMoveImage\"\n    [attr.alt]=\"imageAltText\"\n    (load)=\"imageLoadedInView()\"\n    (mousedown)=\"startMove($event, moveTypes.Drag)\"\n    (touchstart)=\"startMove($event, moveTypes.Drag)\"\n    (error)=\"loadImageError($event)\"\n  >\n  <div\n    class=\"ngx-ic-overlay\"\n    [style.width.px]=\"maxSize.width\"\n    [style.height.px]=\"maxSize.height\"\n    [style.margin-left]=\"alignImage === 'center' ? marginLeft : null\"\n  ></div>\n  <div class=\"ngx-ic-cropper\"\n       *ngIf=\"imageVisible\"\n       [class.ngx-ic-round]=\"roundCropper\"\n       [style.top.px]=\"cropper.y1\"\n       [style.left.px]=\"cropper.x1\"\n       [style.width.px]=\"cropper.x2 - cropper.x1\"\n       [style.height.px]=\"cropper.y2 - cropper.y1\"\n       [style.margin-left]=\"alignImage === 'center' ? marginLeft : null\"\n       [style.visibility]=\"imageVisible ? 'visible' : 'hidden'\"\n       (keydown)=\"keyboardAccess($event)\"\n       tabindex=\"0\"\n  >\n    <div\n      (mousedown)=\"startMove($event, moveTypes.Move)\"\n      (touchstart)=\"startMove($event, moveTypes.Move)\"\n      class=\"ngx-ic-move\">\n    </div>\n    <ng-container *ngIf=\"!hideResizeSquares\">\n            <span class=\"ngx-ic-resize ngx-ic-topleft\"\n                  (mousedown)=\"startMove($event, moveTypes.Resize, 'topleft')\"\n                  (touchstart)=\"startMove($event, moveTypes.Resize, 'topleft')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-top\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-topright\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'topright')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'topright')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-right\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottomright\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottomright')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottomright')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottom\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottomleft\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottomleft')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottomleft')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-left\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-top\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'top')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'top')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-right\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'right')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'right')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-bottom\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottom')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottom')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-left\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'left')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'left')\">\n            </span>\n    </ng-container>\n  </div>\n</div>\n", styles: [":host{display:flex;position:relative;width:100%;max-width:100%;max-height:100%;overflow:hidden;padding:5px;text-align:center}:host>div{width:100%;position:relative}:host>div img.ngx-ic-source-image{max-width:100%;max-height:100%;transform-origin:center}:host>div img.ngx-ic-source-image.ngx-ic-draggable{user-drag:none;-webkit-user-drag:none;user-select:none;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;cursor:grab}:host .ngx-ic-overlay{position:absolute;pointer-events:none;touch-action:none;outline:var(--cropper-overlay-color, white) solid 100vw;top:0;left:0}:host .ngx-ic-cropper{position:absolute;display:flex;color:#53535c;background:transparent;outline:rgba(255,255,255,.3) solid 100vw;outline:var(--cropper-outline-color, rgba(255, 255, 255, .3)) solid 100vw;touch-action:none}@media (orientation: portrait){:host .ngx-ic-cropper{outline-width:100vh}}:host .ngx-ic-cropper:after{position:absolute;content:\"\";inset:0;pointer-events:none;border:dashed 1px;opacity:.75;color:inherit;z-index:1}:host .ngx-ic-cropper .ngx-ic-move{width:100%;cursor:move;border:1px solid rgba(255,255,255,.5)}:host .ngx-ic-cropper:focus .ngx-ic-move{border-color:#1e90ff;border-width:2px}:host .ngx-ic-cropper .ngx-ic-resize{position:absolute;display:inline-block;line-height:6px;padding:8px;opacity:.85;z-index:1}:host .ngx-ic-cropper .ngx-ic-resize .ngx-ic-square{display:inline-block;background:#53535C;width:6px;height:6px;border:1px solid rgba(255,255,255,.5);box-sizing:content-box}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-topleft{top:-12px;left:-12px;cursor:nwse-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-top{top:-12px;left:calc(50% - 12px);cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-topright{top:-12px;right:-12px;cursor:nesw-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-right{top:calc(50% - 12px);right:-12px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottomright{bottom:-12px;right:-12px;cursor:nwse-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottom{bottom:-12px;left:calc(50% - 12px);cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottomleft{bottom:-12px;left:-12px;cursor:nesw-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-left{top:calc(50% - 12px);left:-12px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar{position:absolute;z-index:1}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-top{top:-11px;left:11px;width:calc(100% - 22px);height:22px;cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-right{top:11px;right:-11px;height:calc(100% - 22px);width:22px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-bottom{bottom:-11px;left:11px;width:calc(100% - 22px);height:22px;cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-left{top:11px;left:-11px;height:calc(100% - 22px);width:22px;cursor:ew-resize}:host .ngx-ic-cropper.ngx-ic-round{outline-color:transparent}:host .ngx-ic-cropper.ngx-ic-round:after{border-radius:100%;box-shadow:0 0 0 100vw #ffffff4d;box-shadow:0 0 0 100vw var(--cropper-outline-color, rgba(255, 255, 255, .3))}@media (orientation: portrait){:host .ngx-ic-cropper.ngx-ic-round:after{box-shadow:0 0 0 100vh #ffffff4d;box-shadow:0 0 0 100vh var(--cropper-outline-color, rgba(255, 255, 255, .3))}}:host .ngx-ic-cropper.ngx-ic-round .ngx-ic-move{border-radius:100%}:host.disabled .ngx-ic-cropper .ngx-ic-resize,:host.disabled .ngx-ic-cropper .ngx-ic-resize-bar,:host.disabled .ngx-ic-cropper .ngx-ic-move{display:none}:host.ngx-ix-hidden{display:none}\n"] }]
        }], ctorParameters: function () { return [{ type: i1.CropService }, { type: i2.CropperPositionService }, { type: i3.LoadImageService }, { type: i4.DomSanitizer }, { type: i0.ChangeDetectorRef }]; }, propDecorators: { wrapper: [{
                type: ViewChild,
                args: ['wrapper', { static: true }]
            }], sourceImage: [{
                type: ViewChild,
                args: ['sourceImage', { static: false }]
            }], imageChangedEvent: [{
                type: Input
            }], imageURL: [{
                type: Input
            }], imageBase64: [{
                type: Input
            }], imageFile: [{
                type: Input
            }], imageAltText: [{
                type: Input
            }], format: [{
                type: Input
            }], transform: [{
                type: Input
            }], maintainAspectRatio: [{
                type: Input
            }], aspectRatio: [{
                type: Input
            }], resetCropOnAspectRatioChange: [{
                type: Input
            }], resizeToWidth: [{
                type: Input
            }], resizeToHeight: [{
                type: Input
            }], cropperMinWidth: [{
                type: Input
            }], cropperMinHeight: [{
                type: Input
            }], cropperMaxHeight: [{
                type: Input
            }], cropperMaxWidth: [{
                type: Input
            }], cropperStaticWidth: [{
                type: Input
            }], cropperStaticHeight: [{
                type: Input
            }], canvasRotation: [{
                type: Input
            }], initialStepSize: [{
                type: Input
            }], roundCropper: [{
                type: Input
            }], onlyScaleDown: [{
                type: Input
            }], imageQuality: [{
                type: Input
            }], autoCrop: [{
                type: Input
            }], backgroundColor: [{
                type: Input
            }], containWithinAspectRatio: [{
                type: Input
            }], hideResizeSquares: [{
                type: Input
            }], allowMoveImage: [{
                type: Input
            }], cropper: [{
                type: Input
            }], alignImage: [{
                type: HostBinding,
                args: ['style.text-align']
            }, {
                type: Input
            }], disabled: [{
                type: HostBinding,
                args: ['class.disabled']
            }, {
                type: Input
            }], hidden: [{
                type: HostBinding,
                args: ['class.ngx-ix-hidden']
            }, {
                type: Input
            }], imageCropped: [{
                type: Output
            }], startCropImage: [{
                type: Output
            }], imageLoaded: [{
                type: Output
            }], cropperReady: [{
                type: Output
            }], loadImageFailed: [{
                type: Output
            }], transformChange: [{
                type: Output
            }], cropping: [{
                type: Output
            }], onResize: [{
                type: HostListener,
                args: ['window:resize']
            }], moveImg: [{
                type: HostListener,
                args: ['document:mousemove', ['$event']]
            }, {
                type: HostListener,
                args: ['document:touchmove', ['$event']]
            }], moveStop: [{
                type: HostListener,
                args: ['document:mouseup']
            }, {
                type: HostListener,
                args: ['document:touchend']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtY3JvcHBlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtaW1hZ2UtY3JvcHBlci9zcmMvbGliL2NvbXBvbmVudC9pbWFnZS1jcm9wcGVyLmNvbXBvbmVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1pbWFnZS1jcm9wcGVyL3NyYy9saWIvY29tcG9uZW50L2ltYWdlLWNyb3BwZXIuY29tcG9uZW50Lmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLHVCQUF1QixFQUV2QixTQUFTLEVBRVQsWUFBWSxFQUNaLFdBQVcsRUFDWCxZQUFZLEVBQ1osS0FBSyxFQUNMLFNBQVMsRUFHVCxNQUFNLEVBRU4sU0FBUyxFQUNWLE1BQU0sZUFBZSxDQUFDO0FBSXZCLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFLL0QsT0FBTyxFQUFFLGNBQWMsRUFBRSx5QkFBeUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlCQUF5QixDQUFDOzs7Ozs7O0FBUXZHLE1BQU0sT0FBTyxxQkFBcUI7SUFzRWhDLFlBQ1UsV0FBd0IsRUFDeEIsc0JBQThDLEVBQzlDLGdCQUFrQyxFQUNsQyxTQUF1QixFQUN2QixFQUFxQjtRQUpyQixnQkFBVyxHQUFYLFdBQVcsQ0FBYTtRQUN4QiwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXdCO1FBQzlDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7UUFDbEMsY0FBUyxHQUFULFNBQVMsQ0FBYztRQUN2QixPQUFFLEdBQUYsRUFBRSxDQUFtQjtRQTFFdkIsV0FBTSxHQUFrQixNQUFjLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDM0QsYUFBUSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDakMsMkJB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QUs7Z0JBQ0csaUJBQWlCO3NCQUF6QixLQUFLO2dCQUNHLGNBQWM7c0JBQXRCLEtBQUs7Z0JBQ0csT0FBTztzQkFBZixLQUFLO2dCQU9HLFVBQVU7c0JBRGxCLFdBQVc7dUJBQUMsa0JBQWtCOztzQkFDOUIsS0FBSztnQkFFRyxRQUFRO3NCQURoQixXQUFXO3VCQUFDLGdCQUFnQjs7c0JBQzVCLEtBQUs7Z0JBRUcsTUFBTTtzQkFEZCxXQUFXO3VCQUFDLHFCQUFxQjs7c0JBQ2pDLEtBQUs7Z0JBRUksWUFBWTtzQkFBckIsTUFBTTtnQkFDRyxjQUFjO3NCQUF2QixNQUFNO2dCQUNHLFdBQVc7c0JBQXBCLE1BQU07Z0JBQ0csWUFBWTtzQkFBckIsTUFBTTtnQkFDRyxlQUFlO3NCQUF4QixNQUFNO2dCQUNHLGVBQWU7c0JBQXhCLE1BQU07Z0JBQ0csUUFBUTtzQkFBakIsTUFBTTtnQkFnTVAsUUFBUTtzQkFEUCxZQUFZO3VCQUFDLGVBQWU7Z0JBNkc3QixPQUFPO3NCQUZOLFlBQVk7dUJBQUMsb0JBQW9CLEVBQUUsQ0FBQyxRQUFRLENBQUM7O3NCQUM3QyxZQUFZO3VCQUFDLG9CQUFvQixFQUFFLENBQUMsUUFBUSxDQUFDO2dCQTZIOUMsUUFBUTtzQkFGUCxZQUFZO3VCQUFDLGtCQUFrQjs7c0JBQy9CLFlBQVk7dUJBQUMsbUJBQW1CIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksXG4gIENoYW5nZURldGVjdG9yUmVmLFxuICBDb21wb25lbnQsXG4gIEVsZW1lbnRSZWYsXG4gIEV2ZW50RW1pdHRlcixcbiAgSG9zdEJpbmRpbmcsXG4gIEhvc3RMaXN0ZW5lcixcbiAgSW5wdXQsXG4gIGlzRGV2TW9kZSxcbiAgT25DaGFuZ2VzLFxuICBPbkluaXQsXG4gIE91dHB1dCxcbiAgU2ltcGxlQ2hhbmdlcyxcbiAgVmlld0NoaWxkXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgRG9tU2FuaXRpemVyLCBTYWZlU3R5bGUsIFNhZmVVcmwgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyJztcbmltcG9ydCB7IENyb3BwZXJQb3NpdGlvbiwgRGltZW5zaW9ucywgSW1hZ2VDcm9wcGVkRXZlbnQsIEltYWdlVHJhbnNmb3JtLCBMb2FkZWRJbWFnZSwgTW92ZVN0YXJ0IH0gZnJvbSAnLi4vaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBPdXRwdXRGb3JtYXQgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2Nyb3BwZXItb3B0aW9ucy5pbnRlcmZhY2UnO1xuaW1wb3J0IHsgQ3JvcHBlclNldHRpbmdzIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9jcm9wcGVyLnNldHRpbmdzJztcbmltcG9ydCB7IE1vdmVUeXBlcyB9IGZyb20gJy4uL2ludGVyZmFjZXMvbW92ZS1zdGFydC5pbnRlcmZhY2UnO1xuaW1wb3J0IHsgQ3JvcFNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9jcm9wLnNlcnZpY2UnO1xuaW1wb3J0IHsgQ3JvcHBlclBvc2l0aW9uU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2Nyb3BwZXItcG9zaXRpb24uc2VydmljZSc7XG5pbXBvcnQgeyBMb2FkSW1hZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvbG9hZC1pbWFnZS5zZXJ2aWNlJztcbmltcG9ydCB7IEhhbW1lclN0YXRpYyB9IGZyb20gJy4uL3V0aWxzL2hhbW1lci51dGlscyc7XG5pbXBvcnQgeyBnZXRFdmVudEZvcktleSwgZ2V0SW52ZXJ0ZWRQb3NpdGlvbkZvcktleSwgZ2V0UG9zaXRpb25Gb3JLZXkgfSBmcm9tICcuLi91dGlscy9rZXlib2FyZC51dGlscyc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2ltYWdlLWNyb3BwZXInLFxuICB0ZW1wbGF0ZVVybDogJy4vaW1hZ2UtY3JvcHBlci5jb21wb25lbnQuaHRtbCcsXG4gIHN0eWxlVXJsczogWycuL2ltYWdlLWNyb3BwZXIuY29tcG9uZW50LnNjc3MnXSxcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5PblB1c2hcbn0pXG5leHBvcnQgY2xhc3MgSW1hZ2VDcm9wcGVyQ29tcG9uZW50IGltcGxlbWVudHMgT25DaGFuZ2VzLCBPbkluaXQge1xuICBwcml2YXRlIEhhbW1lcjogSGFtbWVyU3RhdGljID0gKHdpbmRvdyBhcyBhbnkpPy5bJ0hhbW1lciddIHx8IG51bGw7XG4gIHByaXZhdGUgc2V0dGluZ3MgPSBuZXcgQ3JvcHBlclNldHRpbmdzKCk7XG4gIHByaXZhdGUgc2V0SW1hZ2VNYXhTaXplUmV0cmllcyA9IDA7XG4gIHByaXZhdGUgbW92ZVN0YXJ0PzogTW92ZVN0YXJ0O1xuICBwcml2YXRlIGxvYWRlZEltYWdlPzogTG9hZGVkSW1hZ2U7XG4gIHByaXZhdGUgcmVzaXplZFdoaWxlSGlkZGVuID0gZmFsc2U7XG5cbiAgc2FmZUltZ0RhdGFVcmw/OiBTYWZlVXJsIHwgc3RyaW5nO1xuICBzYWZlVHJhbnNmb3JtU3R5bGU/OiBTYWZlU3R5bGUgfCBzdHJpbmc7XG4gIG1hcmdpbkxlZnQ6IFNhZmVTdHlsZSB8IHN0cmluZyA9ICcwcHgnO1xuICBtYXhTaXplOiBEaW1lbnNpb25zID0ge1xuICAgIHdpZHRoOiAwLFxuICAgIGhlaWdodDogMFxuICB9O1xuICBtb3ZlVHlwZXMgPSBNb3ZlVHlwZXM7XG4gIGltYWdlVmlzaWJsZSA9IGZhbHNlO1xuXG4gIEBWaWV3Q2hpbGQoJ3dyYXBwZXInLCB7c3RhdGljOiB0cnVlfSkgd3JhcHBlciE6IEVsZW1lbnRSZWY8SFRNTERpdkVsZW1lbnQ+O1xuICBAVmlld0NoaWxkKCdzb3VyY2VJbWFnZScsIHtzdGF0aWM6IGZhbHNlfSkgc291cmNlSW1hZ2UhOiBFbGVtZW50UmVmPEhUTUxEaXZFbGVtZW50PjtcblxuICBASW5wdXQoKSBpbWFnZUNoYW5nZWRFdmVudD86IGFueTtcbiAgQElucHV0KCkgaW1hZ2VVUkw/OiBzdHJpbmc7XG4gIEBJbnB1dCgpIGltYWdlQmFzZTY0Pzogc3RyaW5nO1xuICBASW5wdXQoKSBpbWFnZUZpbGU/OiBGaWxlO1xuICBASW5wdXQoKSBpbWFnZUFsdFRleHQ/OiBzdHJpbmc7XG4gIEBJbnB1dCgpIGZvcm1hdDogT3V0cHV0Rm9ybWF0ID0gdGhpcy5zZXR0aW5ncy5mb3JtYXQ7XG4gIEBJbnB1dCgpIHRyYW5zZm9ybTogSW1hZ2VUcmFuc2Zvcm0gPSB7fTtcbiAgQElucHV0KCkgbWFpbnRhaW5Bc3BlY3RSYXRpbyA9IHRoaXMuc2V0dGluZ3MubWFpbnRhaW5Bc3BlY3RSYXRpbztcbiAgQElucHV0KCkgYXNwZWN0UmF0aW8gPSB0aGlzLnNldHRpbmdzLmFzcGVjdFJhdGlvO1xuICBASW5wdXQoKSByZXNldENyb3BPbkFzcGVjdFJhdGlvQ2hhbmdlID0gdGhpcy5zZXR0aW5ncy5yZXNldENyb3BPbkFzcGVjdFJhdGlvQ2hhbmdlO1xuICBASW5wdXQoKSByZXNpemVUb1dpZHRoID0gdGhpcy5zZXR0aW5ncy5yZXNpemVUb1dpZHRoO1xuICBASW5wdXQoKSByZXNpemVUb0hlaWdodCA9IHRoaXMuc2V0dGluZ3MucmVzaXplVG9IZWlnaHQ7XG4gIEBJbnB1dCgpIGNyb3BwZXJNaW5XaWR0aCA9IHRoaXMuc2V0dGluZ3MuY3JvcHBlck1pbldpZHRoO1xuICBASW5wdXQoKSBjcm9wcGVyTWluSGVpZ2h0ID0gdGhpcy5zZXR0aW5ncy5jcm9wcGVyTWluSGVpZ2h0O1xuICBASW5wdXQoKSBjcm9wcGVyTWF4SGVpZ2h0ID0gdGhpcy5zZXR0aW5ncy5jcm9wcGVyTWF4SGVpZ2h0O1xuICBASW5wdXQoKSBjcm9wcGVyTWF4V2lkdGggPSB0aGlzLnNldHRpbmdzLmNyb3BwZXJNYXhXaWR0aDtcbiAgQElucHV0KCkgY3JvcHBlclN0YXRpY1dpZHRoID0gdGhpcy5zZXR0aW5ncy5jcm9wcGVyU3RhdGljV2lkdGg7XG4gIEBJbnB1dCgpIGNyb3BwZXJTdGF0aWNIZWlnaHQgPSB0aGlzLnNldHRpbmdzLmNyb3BwZXJTdGF0aWNIZWlnaHQ7XG4gIEBJbnB1dCgpIGNhbnZhc1JvdGF0aW9uID0gdGhpcy5zZXR0aW5ncy5jYW52YXNSb3RhdGlvbjtcbiAgQElucHV0KCkgaW5pdGlhbFN0ZXBTaXplID0gdGhpcy5zZXR0aW5ncy5pbml0aWFsU3RlcFNpemU7XG4gIEBJbnB1dCgpIHJvdW5kQ3JvcHBlciA9IHRoaXMuc2V0dGluZ3Mucm91bmRDcm9wcGVyO1xuICBASW5wdXQoKSBvbmx5U2NhbGVEb3duID0gdGhpcy5zZXR0aW5ncy5vbmx5U2NhbGVEb3duO1xuICBASW5wdXQoKSBpbWFnZVF1YWxpdHkgPSB0aGlzLnNldHRpbmdzLmltYWdlUXVhbGl0eTtcbiAgQElucHV0KCkgYXV0b0Nyb3AgPSB0aGlzLnNldHRpbmdzLmF1dG9Dcm9wO1xuICBASW5wdXQoKSBiYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLnNldHRpbmdzLmJhY2tncm91bmRDb2xvcjtcbiAgQElucHV0KCkgY29udGFpbldpdGhpbkFzcGVjdFJhdGlvID0gdGhpcy5zZXR0aW5ncy5jb250YWluV2l0aGluQXNwZWN0UmF0aW87XG4gIEBJbnB1dCgpIGhpZGVSZXNpemVTcXVhcmVzID0gdGhpcy5zZXR0aW5ncy5oaWRlUmVzaXplU3F1YXJlcztcbiAgQElucHV0KCkgYWxsb3dNb3ZlSW1hZ2UgPSBmYWxzZTtcbiAgQElucHV0KCkgY3JvcHBlcjogQ3JvcHBlclBvc2l0aW9uID0ge1xuICAgIHgxOiAtMTAwLFxuICAgIHkxOiAtMTAwLFxuICAgIHgyOiAxMDAwMCxcbiAgICB5MjogMTAwMDBcbiAgfTtcbiAgQEhvc3RCaW5kaW5nKCdzdHlsZS50ZXh0LWFsaWduJylcbiAgQElucHV0KCkgYWxpZ25JbWFnZTogJ2xlZnQnIHwgJ2NlbnRlcicgPSB0aGlzLnNldHRpbmdzLmFsaWduSW1hZ2U7XG4gIEBIb3N0QmluZGluZygnY2xhc3MuZGlzYWJsZWQnKVxuICBASW5wdXQoKSBkaXNhYmxlZCA9IGZhbHNlO1xuICBASG9zdEJpbmRpbmcoJ2NsYXNzLm5neC1peC1oaWRkZW4nKVxuICBASW5wdXQoKSBoaWRkZW4gPSBmYWxzZTtcblxuICBAT3V0cHV0KCkgaW1hZ2VDcm9wcGVkID0gbmV3IEV2ZW50RW1pdHRlcjxJbWFnZUNyb3BwZWRFdmVudD4oKTtcbiAgQE91dHB1dCgpIHN0YXJ0Q3JvcEltYWdlID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuICBAT3V0cHV0KCkgaW1hZ2VMb2FkZWQgPSBuZXcgRXZlbnRFbWl0dGVyPExvYWRlZEltYWdlPigpO1xuICBAT3V0cHV0KCkgY3JvcHBlclJlYWR5ID0gbmV3IEV2ZW50RW1pdHRlcjxEaW1lbnNpb25zPigpO1xuICBAT3V0cHV0KCkgbG9hZEltYWdlRmFpbGVkID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuICBAT3V0cHV0KCkgdHJhbnNmb3JtQ2hhbmdlID0gbmV3IEV2ZW50RW1pdHRlcjxJbWFnZVRyYW5zZm9ybT4oKTtcbiAgQE91dHB1dCgpIGNyb3BwaW5nID0gbmV3IEV2ZW50RW1pdHRlcjxDcm9wcGVyUG9zaXRpb24+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBjcm9wU2VydmljZTogQ3JvcFNlcnZpY2UsXG4gICAgcHJpdmF0ZSBjcm9wcGVyUG9zaXRpb25TZXJ2aWNlOiBDcm9wcGVyUG9zaXRpb25TZXJ2aWNlLFxuICAgIHByaXZhdGUgbG9hZEltYWdlU2VydmljZTogTG9hZEltYWdlU2VydmljZSxcbiAgICBwcml2YXRlIHNhbml0aXplcjogRG9tU2FuaXRpemVyLFxuICAgIHByaXZhdGUgY2Q6IENoYW5nZURldGVjdG9yUmVmXG4gICkge1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuXG4gIG5nT25DaGFuZ2VzKGNoYW5nZXM6IFNpbXBsZUNoYW5nZXMpOiB2b2lkIHtcbiAgICB0aGlzLm9uQ2hhbmdlc1VwZGF0ZVNldHRpbmdzKGNoYW5nZXMpO1xuICAgIHRoaXMub25DaGFuZ2VzSW5wdXRJbWFnZShjaGFuZ2VzKTtcblxuICAgIGlmICh0aGlzLmxvYWRlZEltYWdlPy5vcmlnaW5hbC5pbWFnZS5jb21wbGV0ZSAmJiAoY2hhbmdlc1snY29udGFpbldpdGhpbkFzcGVjdFJhdGlvJ10gfHwgY2hhbmdlc1snY2FudmFzUm90YXRpb24nXSkpIHtcbiAgICAgIHRoaXMubG9hZEltYWdlU2VydmljZVxuICAgICAgICAudHJhbnNmb3JtTG9hZGVkSW1hZ2UodGhpcy5sb2FkZWRJbWFnZSwgdGhpcy5zZXR0aW5ncylcbiAgICAgICAgLnRoZW4oKHJlcykgPT4gdGhpcy5zZXRMb2FkZWRJbWFnZShyZXMpKVxuICAgICAgICAuY2F0Y2goKGVycikgPT4gdGhpcy5sb2FkSW1hZ2VFcnJvcihlcnIpKTtcbiAgICB9XG4gICAgaWYgKGNoYW5nZXNbJ2Nyb3BwZXInXSB8fCBjaGFuZ2VzWydtYWludGFpbkFzcGVjdFJhdGlvJ10gfHwgY2hhbmdlc1snYXNwZWN0UmF0aW8nXSkge1xuICAgICAgdGhpcy5zZXRNYXhTaXplKCk7XG4gICAgICB0aGlzLnNldENyb3BwZXJTY2FsZWRNaW5TaXplKCk7XG4gICAgICB0aGlzLnNldENyb3BwZXJTY2FsZWRNYXhTaXplKCk7XG4gICAgICBpZiAoXG4gICAgICAgIHRoaXMubWFpbnRhaW5Bc3BlY3RSYXRpbyAmJlxuICAgICAgICAodGhpcy5yZXNldENyb3BPbkFzcGVjdFJhdGlvQ2hhbmdlIHx8ICF0aGlzLmFzcGVjdFJhdGlvSXNDb3JyZWN0KCkpICYmXG4gICAgICAgIChjaGFuZ2VzWydtYWludGFpbkFzcGVjdFJhdGlvJ10gfHwgY2hhbmdlc1snYXNwZWN0UmF0aW8nXSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLnJlc2V0Q3JvcHBlclBvc2l0aW9uKCk7XG4gICAgICB9IGVsc2UgaWYgKGNoYW5nZXNbJ2Nyb3BwZXInXSkge1xuICAgICAgICB0aGlzLmNoZWNrQ3JvcHBlclBvc2l0aW9uKGZhbHNlKTtcbiAgICAgICAgdGhpcy5kb0F1dG9Dcm9wKCk7XG4gICAgICB9XG4gICAgICB0aGlzLmNkLm1hcmtGb3JDaGVjaygpO1xuICAgIH1cbiAgICBpZiAoY2hhbmdlc1sndHJhbnNmb3JtJ10pIHtcbiAgICAgIHRoaXMudHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm0gfHwge307XG4gICAgICB0aGlzLnNldENzc1RyYW5zZm9ybSgpO1xuICAgICAgdGhpcy5kb0F1dG9Dcm9wKCk7XG4gICAgICB0aGlzLmNkLm1hcmtGb3JDaGVjaygpO1xuICAgIH1cbiAgICBpZiAoY2hhbmdlc1snaGlkZGVuJ10gJiYgdGhpcy5yZXNpemVkV2hpbGVIaWRkZW4gJiYgIXRoaXMuaGlkZGVuKSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5vblJlc2l6ZSgpO1xuICAgICAgICB0aGlzLnJlc2l6ZWRXaGlsZUhpZGRlbiA9IGZhbHNlO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBvbkNoYW5nZXNVcGRhdGVTZXR0aW5ncyhjaGFuZ2VzOiBTaW1wbGVDaGFuZ2VzKSB7XG4gICAgdGhpcy5zZXR0aW5ncy5zZXRPcHRpb25zRnJvbUNoYW5nZXMoY2hhbmdlcyk7XG5cbiAgICBpZiAodGhpcy5zZXR0aW5ncy5jcm9wcGVyU3RhdGljSGVpZ2h0ICYmIHRoaXMuc2V0dGluZ3MuY3JvcHBlclN0YXRpY1dpZHRoKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLnNldE9wdGlvbnMoe1xuICAgICAgICBoaWRlUmVzaXplU3F1YXJlczogdHJ1ZSxcbiAgICAgICAgY3JvcHBlck1pbldpZHRoOiB0aGlzLnNldHRpbmdzLmNyb3BwZXJTdGF0aWNXaWR0aCxcbiAgICAgICAgY3JvcHBlck1pbkhlaWdodDogdGhpcy5zZXR0aW5ncy5jcm9wcGVyU3RhdGljSGVpZ2h0LFxuICAgICAgICBjcm9wcGVyTWF4SGVpZ2h0OiB0aGlzLnNldHRpbmdzLmNyb3BwZXJTdGF0aWNIZWlnaHQsXG4gICAgICAgIGNyb3BwZXJNYXhXaWR0aDogdGhpcy5zZXR0aW5ncy5jcm9wcGVyU3RhdGljV2lkdGgsXG4gICAgICAgIG1haW50YWluQXNwZWN0UmF0aW86IGZhbHNlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG9uQ2hhbmdlc0lucHV0SW1hZ2UoY2hhbmdlczogU2ltcGxlQ2hhbmdlcyk6IHZvaWQge1xuICAgIGlmIChjaGFuZ2VzWydpbWFnZUNoYW5nZWRFdmVudCddIHx8IGNoYW5nZXNbJ2ltYWdlVVJMJ10gfHwgY2hhbmdlc1snaW1hZ2VCYXNlNjQnXSB8fCBjaGFuZ2VzWydpbWFnZUZpbGUnXSkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBpZiAoY2hhbmdlc1snaW1hZ2VDaGFuZ2VkRXZlbnQnXSAmJiB0aGlzLmlzVmFsaWRJbWFnZUNoYW5nZWRFdmVudCgpKSB7XG4gICAgICB0aGlzLmxvYWRJbWFnZUZpbGUodGhpcy5pbWFnZUNoYW5nZWRFdmVudC50YXJnZXQuZmlsZXNbMF0pO1xuICAgIH1cbiAgICBpZiAoY2hhbmdlc1snaW1hZ2VVUkwnXSAmJiB0aGlzLmltYWdlVVJMKSB7XG4gICAgICB0aGlzLmxvYWRJbWFnZUZyb21VUkwodGhpcy5pbWFnZVVSTCk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzWydpbWFnZUJhc2U2NCddICYmIHRoaXMuaW1hZ2VCYXNlNjQpIHtcbiAgICAgIHRoaXMubG9hZEJhc2U2NEltYWdlKHRoaXMuaW1hZ2VCYXNlNjQpO1xuICAgIH1cbiAgICBpZiAoY2hhbmdlc1snaW1hZ2VGaWxlJ10gJiYgdGhpcy5pbWFnZUZpbGUpIHtcbiAgICAgIHRoaXMubG9hZEltYWdlRmlsZSh0aGlzLmltYWdlRmlsZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBpc1ZhbGlkSW1hZ2VDaGFuZ2VkRXZlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaW1hZ2VDaGFuZ2VkRXZlbnQ/LnRhcmdldD8uZmlsZXM/Lmxlbmd0aCA+IDA7XG4gIH1cblxuICBwcml2YXRlIHNldENzc1RyYW5zZm9ybSgpIHtcbiAgICBjb25zdCB0cmFuc2xhdGVVbml0ID0gdGhpcy50cmFuc2Zvcm0/LnRyYW5zbGF0ZVVuaXQgfHwgJyUnO1xuICAgIHRoaXMuc2FmZVRyYW5zZm9ybVN0eWxlID0gdGhpcy5zYW5pdGl6ZXIuYnlwYXNzU2VjdXJpdHlUcnVzdFN0eWxlKFxuICAgICAgYHRyYW5zbGF0ZSgke3RoaXMudHJhbnNmb3JtLnRyYW5zbGF0ZUggfHwgMH0ke3RyYW5zbGF0ZVVuaXR9LCAke3RoaXMudHJhbnNmb3JtLnRyYW5zbGF0ZVYgfHwgMH0ke3RyYW5zbGF0ZVVuaXR9KWAgK1xuICAgICAgJyBzY2FsZVgoJyArICh0aGlzLnRyYW5zZm9ybS5zY2FsZSB8fCAxKSAqICh0aGlzLnRyYW5zZm9ybS5mbGlwSCA/IC0xIDogMSkgKyAnKScgK1xuICAgICAgJyBzY2FsZVkoJyArICh0aGlzLnRyYW5zZm9ybS5zY2FsZSB8fCAxKSAqICh0aGlzLnRyYW5zZm9ybS5mbGlwViA/IC0xIDogMSkgKyAnKScgK1xuICAgICAgJyByb3RhdGUoJyArICh0aGlzLnRyYW5zZm9ybS5yb3RhdGUgfHwgMCkgKyAnZGVnKSdcbiAgICApO1xuICB9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy5zZXR0aW5ncy5zdGVwU2l6ZSA9IHRoaXMuaW5pdGlhbFN0ZXBTaXplO1xuICAgIHRoaXMuYWN0aXZhdGVQaW5jaEdlc3R1cmUoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzZXQoKTogdm9pZCB7XG4gICAgdGhpcy5pbWFnZVZpc2libGUgPSBmYWxzZTtcbiAgICB0aGlzLmxvYWRlZEltYWdlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuc2FmZUltZ0RhdGFVcmwgPSAnZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2cnXG4gICAgICArICdvQUFBQU5TVWhFVWdBQUFBRUFBQUFCQ0FZQUFBQWZGY1NKQUFBQUMwbEVRVlFZVjJOZ0FBSUFBQVUnXG4gICAgICArICdBQWFyVnlGRUFBQUFBU1VWT1JLNUNZSUk9JztcbiAgICB0aGlzLm1vdmVTdGFydCA9IHtcbiAgICAgIGFjdGl2ZTogZmFsc2UsXG4gICAgICB0eXBlOiBudWxsLFxuICAgICAgcG9zaXRpb246IG51bGwsXG4gICAgICB4MTogMCxcbiAgICAgIHkxOiAwLFxuICAgICAgeDI6IDAsXG4gICAgICB5MjogMCxcbiAgICAgIGNsaWVudFg6IDAsXG4gICAgICBjbGllbnRZOiAwXG4gICAgfTtcbiAgICB0aGlzLm1heFNpemUgPSB7XG4gICAgICB3aWR0aDogMCxcbiAgICAgIGhlaWdodDogMFxuICAgIH07XG4gICAgdGhpcy5jcm9wcGVyLngxID0gLTEwMDtcbiAgICB0aGlzLmNyb3BwZXIueTEgPSAtMTAwO1xuICAgIHRoaXMuY3JvcHBlci54MiA9IDEwMDAwO1xuICAgIHRoaXMuY3JvcHBlci55MiA9IDEwMDAwO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2FkSW1hZ2VGaWxlKGZpbGU6IEZpbGUpOiB2b2lkIHtcbiAgICB0aGlzLmxvYWRJbWFnZVNlcnZpY2VcbiAgICAgIC5sb2FkSW1hZ2VGaWxlKGZpbGUsIHRoaXMuc2V0dGluZ3MpXG4gICAgICAudGhlbigocmVzKSA9PiB0aGlzLnNldExvYWRlZEltYWdlKHJlcykpXG4gICAgICAuY2F0Y2goKGVycikgPT4gdGhpcy5sb2FkSW1hZ2VFcnJvcihlcnIpKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZEJhc2U2NEltYWdlKGltYWdlQmFzZTY0OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmxvYWRJbWFnZVNlcnZpY2VcbiAgICAgIC5sb2FkQmFzZTY0SW1hZ2UoaW1hZ2VCYXNlNjQsIHRoaXMuc2V0dGluZ3MpXG4gICAgICAudGhlbigocmVzKSA9PiB0aGlzLnNldExvYWRlZEltYWdlKHJlcykpXG4gICAgICAuY2F0Y2goKGVycikgPT4gdGhpcy5sb2FkSW1hZ2VFcnJvcihlcnIpKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZEltYWdlRnJvbVVSTCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubG9hZEltYWdlU2VydmljZVxuICAgICAgLmxvYWRJbWFnZUZyb21VUkwodXJsLCB0aGlzLnNldHRpbmdzKVxuICAgICAgLnRoZW4oKHJlcykgPT4gdGhpcy5zZXRMb2FkZWRJbWFnZShyZXMpKVxuICAgICAgLmNhdGNoKChlcnIpID0+IHRoaXMubG9hZEltYWdlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBwcml2YXRlIHNldExvYWRlZEltYWdlKGxvYWRlZEltYWdlOiBMb2FkZWRJbWFnZSk6IHZvaWQge1xuICAgIHRoaXMubG9hZGVkSW1hZ2UgPSBsb2FkZWRJbWFnZTtcbiAgICB0aGlzLnNhZmVJbWdEYXRhVXJsID0gdGhpcy5zYW5pdGl6ZXIuYnlwYXNzU2VjdXJpdHlUcnVzdFJlc291cmNlVXJsKGxvYWRlZEltYWdlLnRyYW5zZm9ybWVkLmJhc2U2NCk7XG4gICAgdGhpcy5jZC5tYXJrRm9yQ2hlY2soKTtcbiAgfVxuXG4gIHB1YmxpYyBsb2FkSW1hZ2VFcnJvcihlcnJvcjogYW55KTogdm9pZCB7XG4gICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgdGhpcy5sb2FkSW1hZ2VGYWlsZWQuZW1pdCgpO1xuICB9XG5cbiAgaW1hZ2VMb2FkZWRJblZpZXcoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubG9hZGVkSW1hZ2UgIT0gbnVsbCkge1xuICAgICAgdGhpcy5pbWFnZUxvYWRlZC5lbWl0KHRoaXMubG9hZGVkSW1hZ2UpO1xuICAgICAgdGhpcy5zZXRJbWFnZU1heFNpemVSZXRyaWVzID0gMDtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5jaGVja0ltYWdlTWF4U2l6ZVJlY3Vyc2l2ZWx5KCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tJbWFnZU1heFNpemVSZWN1cnNpdmVseSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zZXRJbWFnZU1heFNpemVSZXRyaWVzID4gNDApIHtcbiAgICAgIHRoaXMubG9hZEltYWdlRmFpbGVkLmVtaXQoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc291cmNlSW1hZ2VMb2FkZWQoKSkge1xuICAgICAgdGhpcy5zZXRNYXhTaXplKCk7XG4gICAgICB0aGlzLnNldENyb3BwZXJTY2FsZWRNaW5TaXplKCk7XG4gICAgICB0aGlzLnNldENyb3BwZXJTY2FsZWRNYXhTaXplKCk7XG4gICAgICB0aGlzLnJlc2V0Q3JvcHBlclBvc2l0aW9uKCk7XG4gICAgICB0aGlzLmNyb3BwZXJSZWFkeS5lbWl0KHsuLi50aGlzLm1heFNpemV9KTtcbiAgICAgIHRoaXMuY2QubWFya0ZvckNoZWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0SW1hZ2VNYXhTaXplUmV0cmllcysrO1xuICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmNoZWNrSW1hZ2VNYXhTaXplUmVjdXJzaXZlbHkoKSwgNTApO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc291cmNlSW1hZ2VMb2FkZWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlSW1hZ2U/Lm5hdGl2ZUVsZW1lbnQ/Lm9mZnNldFdpZHRoID4gMDtcbiAgfVxuXG4gIEBIb3N0TGlzdGVuZXIoJ3dpbmRvdzpyZXNpemUnKVxuICBvblJlc2l6ZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubG9hZGVkSW1hZ2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMuaGlkZGVuKSB7XG4gICAgICB0aGlzLnJlc2l6ZWRXaGlsZUhpZGRlbiA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVzaXplQ3JvcHBlclBvc2l0aW9uKCk7XG4gICAgICB0aGlzLnNldE1heFNpemUoKTtcbiAgICAgIHRoaXMuc2V0Q3JvcHBlclNjYWxlZE1pblNpemUoKTtcbiAgICAgIHRoaXMuc2V0Q3JvcHBlclNjYWxlZE1heFNpemUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFjdGl2YXRlUGluY2hHZXN0dXJlKCkge1xuICAgIGlmICh0aGlzLkhhbW1lcikge1xuICAgICAgY29uc3QgaGFtbWVyID0gbmV3IHRoaXMuSGFtbWVyKHRoaXMud3JhcHBlci5uYXRpdmVFbGVtZW50KTtcbiAgICAgIGhhbW1lci5nZXQoJ3BpbmNoJykuc2V0KHtlbmFibGU6IHRydWV9KTtcbiAgICAgIGhhbW1lci5vbigncGluY2htb3ZlJywgdGhpcy5vblBpbmNoLmJpbmQodGhpcykpO1xuICAgICAgaGFtbWVyLm9uKCdwaW5jaGVuZCcsIHRoaXMucGluY2hTdG9wLmJpbmQodGhpcykpO1xuICAgICAgaGFtbWVyLm9uKCdwaW5jaHN0YXJ0JywgdGhpcy5zdGFydFBpbmNoLmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSBpZiAoaXNEZXZNb2RlKCkpIHtcbiAgICAgIGNvbnNvbGUud2FybignW05neEltYWdlQ3JvcHBlcl0gQ291bGQgbm90IGZpbmQgSGFtbWVySlMgLSBQaW5jaCBHZXN0dXJlIHdvblxcJ3Qgd29yaycpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVzaXplQ3JvcHBlclBvc2l0aW9uKCk6IHZvaWQge1xuICAgIGNvbnN0IHNvdXJjZUltYWdlRWxlbWVudCA9IHRoaXMuc291cmNlSW1hZ2UubmF0aXZlRWxlbWVudDtcbiAgICBpZiAodGhpcy5tYXhTaXplLndpZHRoICE9PSBzb3VyY2VJbWFnZUVsZW1lbnQub2Zmc2V0V2lkdGggfHwgdGhpcy5tYXhTaXplLmhlaWdodCAhPT0gc291cmNlSW1hZ2VFbGVtZW50Lm9mZnNldEhlaWdodCkge1xuICAgICAgdGhpcy5jcm9wcGVyLngxID0gdGhpcy5jcm9wcGVyLngxICogc291cmNlSW1hZ2VFbGVtZW50Lm9mZnNldFdpZHRoIC8gdGhpcy5tYXhTaXplLndpZHRoO1xuICAgICAgdGhpcy5jcm9wcGVyLngyID0gdGhpcy5jcm9wcGVyLngyICogc291cmNlSW1hZ2VFbGVtZW50Lm9mZnNldFdpZHRoIC8gdGhpcy5tYXhTaXplLndpZHRoO1xuICAgICAgdGhpcy5jcm9wcGVyLnkxID0gdGhpcy5jcm9wcGVyLnkxICogc291cmNlSW1hZ2VFbGVtZW50Lm9mZnNldEhlaWdodCAvIHRoaXMubWF4U2l6ZS5oZWlnaHQ7XG4gICAgICB0aGlzLmNyb3BwZXIueTIgPSB0aGlzLmNyb3BwZXIueTIgKiBzb3VyY2VJbWFnZUVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gdGhpcy5tYXhTaXplLmhlaWdodDtcbiAgICB9XG4gIH1cblxuICByZXNldENyb3BwZXJQb3NpdGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLmNyb3BwZXJQb3NpdGlvblNlcnZpY2UucmVzZXRDcm9wcGVyUG9zaXRpb24odGhpcy5zb3VyY2VJbWFnZSwgdGhpcy5jcm9wcGVyLCB0aGlzLnNldHRpbmdzKTtcbiAgICB0aGlzLmRvQXV0b0Nyb3AoKTtcbiAgICB0aGlzLmltYWdlVmlzaWJsZSA9IHRydWU7XG4gIH1cblxuICBrZXlib2FyZEFjY2VzcyhldmVudDogS2V5Ym9hcmRFdmVudCkge1xuICAgIHRoaXMuY2hhbmdlS2V5Ym9hcmRTdGVwU2l6ZShldmVudCk7XG4gICAgdGhpcy5rZXlib2FyZE1vdmVDcm9wcGVyKGV2ZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgY2hhbmdlS2V5Ym9hcmRTdGVwU2l6ZShldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgIGNvbnN0IGtleSA9ICtldmVudC5rZXk7XG4gICAgaWYgKGtleSA+PSAxICYmIGtleSA8PSA5KSB7XG4gICAgICB0aGlzLnNldHRpbmdzLnN0ZXBTaXplID0ga2V5O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUga2V5Ym9hcmRNb3ZlQ3JvcHBlcihldmVudDogYW55KSB7XG4gICAgY29uc3Qga2V5Ym9hcmRXaGl0ZUxpc3Q6IHN0cmluZ1tdID0gWydBcnJvd1VwJywgJ0Fycm93RG93bicsICdBcnJvd1JpZ2h0JywgJ0Fycm93TGVmdCddO1xuICAgIGlmICghKGtleWJvYXJkV2hpdGVMaXN0LmluY2x1ZGVzKGV2ZW50LmtleSkpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG1vdmVUeXBlID0gZXZlbnQuc2hpZnRLZXkgPyBNb3ZlVHlwZXMuUmVzaXplIDogTW92ZVR5cGVzLk1vdmU7XG4gICAgY29uc3QgcG9zaXRpb24gPSBldmVudC5hbHRLZXkgPyBnZXRJbnZlcnRlZFBvc2l0aW9uRm9yS2V5KGV2ZW50LmtleSkgOiBnZXRQb3NpdGlvbkZvcktleShldmVudC5rZXkpO1xuICAgIGNvbnN0IG1vdmVFdmVudCA9IGdldEV2ZW50Rm9yS2V5KGV2ZW50LmtleSwgdGhpcy5zZXR0aW5ncy5zdGVwU2l6ZSk7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLnN0YXJ0TW92ZSh7Y2xpZW50WDogMCwgY2xpZW50WTogMH0sIG1vdmVUeXBlLCBwb3NpdGlvbik7XG4gICAgdGhpcy5tb3ZlSW1nKG1vdmVFdmVudCk7XG4gICAgdGhpcy5tb3ZlU3RvcCgpO1xuICB9XG5cbiAgc3RhcnRNb3ZlKGV2ZW50OiBhbnksIG1vdmVUeXBlOiBNb3ZlVHlwZXMsIHBvc2l0aW9uOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmRpc2FibGVkXG4gICAgICB8fCB0aGlzLm1vdmVTdGFydD8uYWN0aXZlICYmIHRoaXMubW92ZVN0YXJ0Py50eXBlID09PSBNb3ZlVHlwZXMuUGluY2hcbiAgICAgIHx8IG1vdmVUeXBlID09PSBNb3ZlVHlwZXMuRHJhZyAmJiAhdGhpcy5hbGxvd01vdmVJbWFnZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZXZlbnQucHJldmVudERlZmF1bHQpIHtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICAgIHRoaXMubW92ZVN0YXJ0ID0ge1xuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgdHlwZTogbW92ZVR5cGUsXG4gICAgICBwb3NpdGlvbixcbiAgICAgIHRyYW5zZm9ybTogey4uLnRoaXMudHJhbnNmb3JtfSxcbiAgICAgIGNsaWVudFg6IHRoaXMuY3JvcHBlclBvc2l0aW9uU2VydmljZS5nZXRDbGllbnRYKGV2ZW50KSxcbiAgICAgIGNsaWVudFk6IHRoaXMuY3JvcHBlclBvc2l0aW9uU2VydmljZS5nZXRDbGllbnRZKGV2ZW50KSxcbiAgICAgIC4uLnRoaXMuY3JvcHBlclxuICAgIH07XG4gIH1cblxuICBzdGFydFBpbmNoKGV2ZW50OiBhbnkpIHtcbiAgICBpZiAoIXRoaXMuc2FmZUltZ0RhdGFVcmwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGV2ZW50LnByZXZlbnREZWZhdWx0KSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cbiAgICB0aGlzLm1vdmVTdGFydCA9IHtcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIHR5cGU6IE1vdmVUeXBlcy5QaW5jaCxcbiAgICAgIHBvc2l0aW9uOiAnY2VudGVyJyxcbiAgICAgIGNsaWVudFg6IHRoaXMuY3JvcHBlci54MSArICh0aGlzLmNyb3BwZXIueDIgLSB0aGlzLmNyb3BwZXIueDEpIC8gMixcbiAgICAgIGNsaWVudFk6IHRoaXMuY3JvcHBlci55MSArICh0aGlzLmNyb3BwZXIueTIgLSB0aGlzLmNyb3BwZXIueTEpIC8gMixcbiAgICAgIC4uLnRoaXMuY3JvcHBlclxuICAgIH07XG4gIH1cblxuICBASG9zdExpc3RlbmVyKCdkb2N1bWVudDptb3VzZW1vdmUnLCBbJyRldmVudCddKVxuICBASG9zdExpc3RlbmVyKCdkb2N1bWVudDp0b3VjaG1vdmUnLCBbJyRldmVudCddKVxuICBtb3ZlSW1nKGV2ZW50OiBhbnkpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5tb3ZlU3RhcnQhLmFjdGl2ZSkge1xuICAgICAgaWYgKGV2ZW50LnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIH1cbiAgICAgIGlmIChldmVudC5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMubW92ZVN0YXJ0IS50eXBlID09PSBNb3ZlVHlwZXMuTW92ZSkge1xuICAgICAgICB0aGlzLmNyb3BwZXJQb3NpdGlvblNlcnZpY2UubW92ZShldmVudCwgdGhpcy5tb3ZlU3RhcnQhLCB0aGlzLmNyb3BwZXIpO1xuICAgICAgICB0aGlzLmNoZWNrQ3JvcHBlclBvc2l0aW9uKHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm1vdmVTdGFydCEudHlwZSA9PT0gTW92ZVR5cGVzLlJlc2l6ZSkge1xuICAgICAgICBpZiAoIXRoaXMuY3JvcHBlclN0YXRpY1dpZHRoICYmICF0aGlzLmNyb3BwZXJTdGF0aWNIZWlnaHQpIHtcbiAgICAgICAgICB0aGlzLmNyb3BwZXJQb3NpdGlvblNlcnZpY2UucmVzaXplKGV2ZW50LCB0aGlzLm1vdmVTdGFydCEsIHRoaXMuY3JvcHBlciwgdGhpcy5tYXhTaXplLCB0aGlzLnNldHRpbmdzKTtcbiAgICAgICAgICB0aGlzLmNyb3BwaW5nLmVtaXQodGhpcy5jcm9wcGVyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNoZWNrQ3JvcHBlclBvc2l0aW9uKGZhbHNlKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5tb3ZlU3RhcnQhLnR5cGUgPT09IE1vdmVUeXBlcy5EcmFnKSB7XG4gICAgICAgIGNvbnN0IGRpZmZYID0gdGhpcy5jcm9wcGVyUG9zaXRpb25TZXJ2aWNlLmdldENsaWVudFgoZXZlbnQpIC0gdGhpcy5tb3ZlU3RhcnQhLmNsaWVudFg7XG4gICAgICAgIGNvbnN0IGRpZmZZID0gdGhpcy5jcm9wcGVyUG9zaXRpb25TZXJ2aWNlLmdldENsaWVudFkoZXZlbnQpIC0gdGhpcy5tb3ZlU3RhcnQhLmNsaWVudFk7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtID0ge1xuICAgICAgICAgIC4uLnRoaXMudHJhbnNmb3JtLFxuICAgICAgICAgIHRyYW5zbGF0ZUg6ICh0aGlzLm1vdmVTdGFydCEudHJhbnNmb3JtPy50cmFuc2xhdGVIIHx8IDApICsgZGlmZlgsXG4gICAgICAgICAgdHJhbnNsYXRlVjogKHRoaXMubW92ZVN0YXJ0IS50cmFuc2Zvcm0/LnRyYW5zbGF0ZVYgfHwgMCkgKyBkaWZmWVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldENzc1RyYW5zZm9ybSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5jZC5kZXRlY3RDaGFuZ2VzKCk7XG4gICAgfVxuICB9XG5cbiAgb25QaW5jaChldmVudDogYW55KSB7XG4gICAgaWYgKHRoaXMubW92ZVN0YXJ0IS5hY3RpdmUpIHtcbiAgICAgIGlmIChldmVudC5zdG9wUHJvcGFnYXRpb24pIHtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICB9XG4gICAgICBpZiAoZXZlbnQucHJldmVudERlZmF1bHQpIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1vdmVTdGFydCEudHlwZSA9PT0gTW92ZVR5cGVzLlBpbmNoKSB7XG4gICAgICAgIHRoaXMuY3JvcHBlclBvc2l0aW9uU2VydmljZS5yZXNpemUoZXZlbnQsIHRoaXMubW92ZVN0YXJ0ISwgdGhpcy5jcm9wcGVyLCB0aGlzLm1heFNpemUsIHRoaXMuc2V0dGluZ3MpO1xuICAgICAgICB0aGlzLmNoZWNrQ3JvcHBlclBvc2l0aW9uKGZhbHNlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY2QuZGV0ZWN0Q2hhbmdlcygpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2V0TWF4U2l6ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zb3VyY2VJbWFnZSkge1xuICAgICAgY29uc3Qgc291cmNlSW1hZ2VFbGVtZW50ID0gdGhpcy5zb3VyY2VJbWFnZS5uYXRpdmVFbGVtZW50O1xuICAgICAgdGhpcy5tYXhTaXplLndpZHRoID0gc291cmNlSW1hZ2VFbGVtZW50Lm9mZnNldFdpZHRoO1xuICAgICAgdGhpcy5tYXhTaXplLmhlaWdodCA9IHNvdXJjZUltYWdlRWxlbWVudC5vZmZzZXRIZWlnaHQ7XG4gICAgICB0aGlzLm1hcmdpbkxlZnQgPSB0aGlzLnNhbml0aXplci5ieXBhc3NTZWN1cml0eVRydXN0U3R5bGUoJ2NhbGMoNTAlIC0gJyArIHRoaXMubWF4U2l6ZS53aWR0aCAvIDIgKyAncHgpJyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzZXRDcm9wcGVyU2NhbGVkTWluU2l6ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sb2FkZWRJbWFnZT8udHJhbnNmb3JtZWQ/LmltYWdlKSB7XG4gICAgICB0aGlzLnNldENyb3BwZXJTY2FsZWRNaW5XaWR0aCgpO1xuICAgICAgdGhpcy5zZXRDcm9wcGVyU2NhbGVkTWluSGVpZ2h0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1pbldpZHRoID0gMjA7XG4gICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNaW5IZWlnaHQgPSAyMDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNldENyb3BwZXJTY2FsZWRNaW5XaWR0aCgpOiB2b2lkIHtcbiAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNaW5XaWR0aCA9IHRoaXMuY3JvcHBlck1pbldpZHRoID4gMFxuICAgICAgPyBNYXRoLm1heCgyMCwgdGhpcy5jcm9wcGVyTWluV2lkdGggLyB0aGlzLmxvYWRlZEltYWdlIS50cmFuc2Zvcm1lZC5pbWFnZS53aWR0aCAqIHRoaXMubWF4U2l6ZS53aWR0aClcbiAgICAgIDogMjA7XG4gIH1cblxuICBwcml2YXRlIHNldENyb3BwZXJTY2FsZWRNaW5IZWlnaHQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubWFpbnRhaW5Bc3BlY3RSYXRpbykge1xuICAgICAgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWluSGVpZ2h0ID0gTWF0aC5tYXgoMjAsIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1pbldpZHRoIC8gdGhpcy5hc3BlY3RSYXRpbyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNyb3BwZXJNaW5IZWlnaHQgPiAwKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNaW5IZWlnaHQgPSBNYXRoLm1heChcbiAgICAgICAgMjAsXG4gICAgICAgIHRoaXMuY3JvcHBlck1pbkhlaWdodCAvIHRoaXMubG9hZGVkSW1hZ2UhLnRyYW5zZm9ybWVkLmltYWdlLmhlaWdodCAqIHRoaXMubWF4U2l6ZS5oZWlnaHRcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1pbkhlaWdodCA9IDIwO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2V0Q3JvcHBlclNjYWxlZE1heFNpemUoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubG9hZGVkSW1hZ2U/LnRyYW5zZm9ybWVkPy5pbWFnZSkge1xuICAgICAgY29uc3QgcmF0aW8gPSB0aGlzLmxvYWRlZEltYWdlLnRyYW5zZm9ybWVkLnNpemUud2lkdGggLyB0aGlzLm1heFNpemUud2lkdGg7XG4gICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhXaWR0aCA9IHRoaXMuY3JvcHBlck1heFdpZHRoID4gMjAgPyB0aGlzLmNyb3BwZXJNYXhXaWR0aCAvIHJhdGlvIDogdGhpcy5tYXhTaXplLndpZHRoO1xuICAgICAgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4SGVpZ2h0ID0gdGhpcy5jcm9wcGVyTWF4SGVpZ2h0ID4gMjAgPyB0aGlzLmNyb3BwZXJNYXhIZWlnaHQgLyByYXRpbyA6IHRoaXMubWF4U2l6ZS5oZWlnaHQ7XG4gICAgICBpZiAodGhpcy5tYWludGFpbkFzcGVjdFJhdGlvKSB7XG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhXaWR0aCA+IHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1heEhlaWdodCAqIHRoaXMuYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhXaWR0aCA9IHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1heEhlaWdodCAqIHRoaXMuYXNwZWN0UmF0aW87XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4V2lkdGggPCB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhIZWlnaHQgKiB0aGlzLmFzcGVjdFJhdGlvKSB7XG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4SGVpZ2h0ID0gdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4V2lkdGggLyB0aGlzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1heFdpZHRoID0gdGhpcy5tYXhTaXplLndpZHRoO1xuICAgICAgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4SGVpZ2h0ID0gdGhpcy5tYXhTaXplLmhlaWdodDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNoZWNrQ3JvcHBlclBvc2l0aW9uKG1haW50YWluU2l6ZSA9IGZhbHNlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY3JvcHBlci54MSA8IDApIHtcbiAgICAgIHRoaXMuY3JvcHBlci54MiAtPSBtYWludGFpblNpemUgPyB0aGlzLmNyb3BwZXIueDEgOiAwO1xuICAgICAgdGhpcy5jcm9wcGVyLngxID0gMDtcbiAgICB9XG4gICAgaWYgKHRoaXMuY3JvcHBlci55MSA8IDApIHtcbiAgICAgIHRoaXMuY3JvcHBlci55MiAtPSBtYWludGFpblNpemUgPyB0aGlzLmNyb3BwZXIueTEgOiAwO1xuICAgICAgdGhpcy5jcm9wcGVyLnkxID0gMDtcbiAgICB9XG4gICAgaWYgKHRoaXMuY3JvcHBlci54MiA+IHRoaXMubWF4U2l6ZS53aWR0aCkge1xuICAgICAgdGhpcy5jcm9wcGVyLngxIC09IG1haW50YWluU2l6ZSA/ICh0aGlzLmNyb3BwZXIueDIgLSB0aGlzLm1heFNpemUud2lkdGgpIDogMDtcbiAgICAgIHRoaXMuY3JvcHBlci54MiA9IHRoaXMubWF4U2l6ZS53aWR0aDtcbiAgICB9XG4gICAgaWYgKHRoaXMuY3JvcHBlci55MiA+IHRoaXMubWF4U2l6ZS5oZWlnaHQpIHtcbiAgICAgIHRoaXMuY3JvcHBlci55MSAtPSBtYWludGFpblNpemUgPyAodGhpcy5jcm9wcGVyLnkyIC0gdGhpcy5tYXhTaXplLmhlaWdodCkgOiAwO1xuICAgICAgdGhpcy5jcm9wcGVyLnkyID0gdGhpcy5tYXhTaXplLmhlaWdodDtcbiAgICB9XG4gIH1cblxuICBASG9zdExpc3RlbmVyKCdkb2N1bWVudDptb3VzZXVwJylcbiAgQEhvc3RMaXN0ZW5lcignZG9jdW1lbnQ6dG91Y2hlbmQnKVxuICBtb3ZlU3RvcCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5tb3ZlU3RhcnQhLmFjdGl2ZSkge1xuICAgICAgY29uc29sZS5sb2coJ2NoYW5nZSEnKTtcbiAgICAgIHRoaXMubW92ZVN0YXJ0IS5hY3RpdmUgPSBmYWxzZTtcbiAgICAgIGlmICh0aGlzLm1vdmVTdGFydD8udHlwZSA9PT0gTW92ZVR5cGVzLkRyYWcpIHtcbiAgICAgICAgdGhpcy50cmFuc2Zvcm1DaGFuZ2UuZW1pdCh0aGlzLnRyYW5zZm9ybSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRvQXV0b0Nyb3AoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwaW5jaFN0b3AoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubW92ZVN0YXJ0IS5hY3RpdmUpIHtcbiAgICAgIHRoaXMubW92ZVN0YXJ0IS5hY3RpdmUgPSBmYWxzZTtcbiAgICAgIHRoaXMuZG9BdXRvQ3JvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZG9BdXRvQ3JvcCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5hdXRvQ3JvcCkge1xuICAgICAgdGhpcy5jcm9wKCk7XG4gICAgfVxuICB9XG5cbiAgY3JvcCgpOiBJbWFnZUNyb3BwZWRFdmVudCB8IG51bGwge1xuICAgIGlmICh0aGlzLmxvYWRlZEltYWdlPy50cmFuc2Zvcm1lZD8uaW1hZ2UgIT0gbnVsbCkge1xuICAgICAgdGhpcy5zdGFydENyb3BJbWFnZS5lbWl0KCk7XG4gICAgICBjb25zdCBvdXRwdXQgPSB0aGlzLmNyb3BTZXJ2aWNlLmNyb3AodGhpcy5zb3VyY2VJbWFnZSwgdGhpcy5sb2FkZWRJbWFnZSwgdGhpcy5jcm9wcGVyLCB0aGlzLnNldHRpbmdzKTtcbiAgICAgIGlmIChvdXRwdXQgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmltYWdlQ3JvcHBlZC5lbWl0KG91dHB1dCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYXNwZWN0UmF0aW9Jc0NvcnJlY3QoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgY3VycmVudENyb3BBc3BlY3RSYXRpbyA9ICh0aGlzLmNyb3BwZXIueDIgLSB0aGlzLmNyb3BwZXIueDEpIC8gKHRoaXMuY3JvcHBlci55MiAtIHRoaXMuY3JvcHBlci55MSk7XG4gICAgcmV0dXJuIGN1cnJlbnRDcm9wQXNwZWN0UmF0aW8gPT09IHRoaXMuYXNwZWN0UmF0aW87XG4gIH1cbn1cbiIsIjxkaXZcbiAgW3N0eWxlLmJhY2tncm91bmRdPVwiaW1hZ2VWaXNpYmxlICYmIGJhY2tncm91bmRDb2xvclwiXG4gICN3cmFwcGVyXG4+XG4gIDxpbWdcbiAgICAjc291cmNlSW1hZ2VcbiAgICBjbGFzcz1cIm5neC1pYy1zb3VyY2UtaW1hZ2VcIlxuICAgICpuZ0lmPVwic2FmZUltZ0RhdGFVcmxcIlxuICAgIFtzcmNdPVwic2FmZUltZ0RhdGFVcmxcIlxuICAgIFtzdHlsZS52aXNpYmlsaXR5XT1cImltYWdlVmlzaWJsZSA/ICd2aXNpYmxlJyA6ICdoaWRkZW4nXCJcbiAgICBbc3R5bGUudHJhbnNmb3JtXT1cInNhZmVUcmFuc2Zvcm1TdHlsZVwiXG4gICAgW2NsYXNzLm5neC1pYy1kcmFnZ2FibGVdPVwiIWRpc2FibGVkICYmIGFsbG93TW92ZUltYWdlXCJcbiAgICBbYXR0ci5hbHRdPVwiaW1hZ2VBbHRUZXh0XCJcbiAgICAobG9hZCk9XCJpbWFnZUxvYWRlZEluVmlldygpXCJcbiAgICAobW91c2Vkb3duKT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5EcmFnKVwiXG4gICAgKHRvdWNoc3RhcnQpPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLkRyYWcpXCJcbiAgICAoZXJyb3IpPVwibG9hZEltYWdlRXJyb3IoJGV2ZW50KVwiXG4gID5cbiAgPGRpdlxuICAgIGNsYXNzPVwibmd4LWljLW92ZXJsYXlcIlxuICAgIFtzdHlsZS53aWR0aC5weF09XCJtYXhTaXplLndpZHRoXCJcbiAgICBbc3R5bGUuaGVpZ2h0LnB4XT1cIm1heFNpemUuaGVpZ2h0XCJcbiAgICBbc3R5bGUubWFyZ2luLWxlZnRdPVwiYWxpZ25JbWFnZSA9PT0gJ2NlbnRlcicgPyBtYXJnaW5MZWZ0IDogbnVsbFwiXG4gID48L2Rpdj5cbiAgPGRpdiBjbGFzcz1cIm5neC1pYy1jcm9wcGVyXCJcbiAgICAgICAqbmdJZj1cImltYWdlVmlzaWJsZVwiXG4gICAgICAgW2NsYXNzLm5neC1pYy1yb3VuZF09XCJyb3VuZENyb3BwZXJcIlxuICAgICAgIFtzdHlsZS50b3AucHhdPVwiY3JvcHBlci55MVwiXG4gICAgICAgW3N0eWxlLmxlZnQucHhdPVwiY3JvcHBlci54MVwiXG4gICAgICAgW3N0eWxlLndpZHRoLnB4XT1cImNyb3BwZXIueDIgLSBjcm9wcGVyLngxXCJcbiAgICAgICBbc3R5bGUuaGVpZ2h0LnB4XT1cImNyb3BwZXIueTIgLSBjcm9wcGVyLnkxXCJcbiAgICAgICBbc3R5bGUubWFyZ2luLWxlZnRdPVwiYWxpZ25JbWFnZSA9PT0gJ2NlbnRlcicgPyBtYXJnaW5MZWZ0IDogbnVsbFwiXG4gICAgICAgW3N0eWxlLnZpc2liaWxpdHldPVwiaW1hZ2VWaXNpYmxlID8gJ3Zpc2libGUnIDogJ2hpZGRlbidcIlxuICAgICAgIChrZXlkb3duKT1cImtleWJvYXJkQWNjZXNzKCRldmVudClcIlxuICAgICAgIHRhYmluZGV4PVwiMFwiXG4gID5cbiAgICA8ZGl2XG4gICAgICAobW91c2Vkb3duKT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5Nb3ZlKVwiXG4gICAgICAodG91Y2hzdGFydCk9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuTW92ZSlcIlxuICAgICAgY2xhc3M9XCJuZ3gtaWMtbW92ZVwiPlxuICAgIDwvZGl2PlxuICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhaGlkZVJlc2l6ZVNxdWFyZXNcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibmd4LWljLXJlc2l6ZSBuZ3gtaWMtdG9wbGVmdFwiXG4gICAgICAgICAgICAgICAgICAobW91c2Vkb3duKT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICd0b3BsZWZ0JylcIlxuICAgICAgICAgICAgICAgICAgKHRvdWNoc3RhcnQpPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ3RvcGxlZnQnKVwiPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibmd4LWljLXNxdWFyZVwiPjwvc3Bhbj5cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgIDxzcGFuIGNsYXNzPVwibmd4LWljLXJlc2l6ZSBuZ3gtaWMtdG9wXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy10b3ByaWdodFwiXG4gICAgICAgICAgICAobW91c2Vkb3duKT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICd0b3ByaWdodCcpXCJcbiAgICAgICAgICAgICh0b3VjaHN0YXJ0KT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICd0b3ByaWdodCcpXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy1yaWdodFwiPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibmd4LWljLXNxdWFyZVwiPjwvc3Bhbj5cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgIDxzcGFuIGNsYXNzPVwibmd4LWljLXJlc2l6ZSBuZ3gtaWMtYm90dG9tcmlnaHRcIlxuICAgICAgICAgICAgKG1vdXNlZG93bik9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAnYm90dG9tcmlnaHQnKVwiXG4gICAgICAgICAgICAodG91Y2hzdGFydCk9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAnYm90dG9tcmlnaHQnKVwiPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibmd4LWljLXNxdWFyZVwiPjwvc3Bhbj5cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgIDxzcGFuIGNsYXNzPVwibmd4LWljLXJlc2l6ZSBuZ3gtaWMtYm90dG9tXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy1ib3R0b21sZWZ0XCJcbiAgICAgICAgICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ2JvdHRvbWxlZnQnKVwiXG4gICAgICAgICAgICAodG91Y2hzdGFydCk9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAnYm90dG9tbGVmdCcpXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy1sZWZ0XCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplLWJhciBuZ3gtaWMtdG9wXCJcbiAgICAgICAgICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ3RvcCcpXCJcbiAgICAgICAgICAgICh0b3VjaHN0YXJ0KT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICd0b3AnKVwiPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplLWJhciBuZ3gtaWMtcmlnaHRcIlxuICAgICAgICAgICAgKG1vdXNlZG93bik9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAncmlnaHQnKVwiXG4gICAgICAgICAgICAodG91Y2hzdGFydCk9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAncmlnaHQnKVwiPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplLWJhciBuZ3gtaWMtYm90dG9tXCJcbiAgICAgICAgICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ2JvdHRvbScpXCJcbiAgICAgICAgICAgICh0b3VjaHN0YXJ0KT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICdib3R0b20nKVwiPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplLWJhciBuZ3gtaWMtbGVmdFwiXG4gICAgICAgICAgICAobW91c2Vkb3duKT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICdsZWZ0JylcIlxuICAgICAgICAgICAgKHRvdWNoc3RhcnQpPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ2xlZnQnKVwiPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgIDwvbmctY29udGFpbmVyPlxuICA8L2Rpdj5cbjwvZGl2PlxuIl19