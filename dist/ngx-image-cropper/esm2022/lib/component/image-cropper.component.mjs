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
class ImageCropperComponent {
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
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.0.3", ngImport: i0, type: ImageCropperComponent, deps: [{ token: i1.CropService }, { token: i2.CropperPositionService }, { token: i3.LoadImageService }, { token: i4.DomSanitizer }, { token: i0.ChangeDetectorRef }], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "16.0.3", type: ImageCropperComponent, selector: "image-cropper", inputs: { imageChangedEvent: "imageChangedEvent", imageURL: "imageURL", imageBase64: "imageBase64", imageFile: "imageFile", imageAltText: "imageAltText", format: "format", transform: "transform", maintainAspectRatio: "maintainAspectRatio", aspectRatio: "aspectRatio", resetCropOnAspectRatioChange: "resetCropOnAspectRatioChange", resizeToWidth: "resizeToWidth", resizeToHeight: "resizeToHeight", cropperMinWidth: "cropperMinWidth", cropperMinHeight: "cropperMinHeight", cropperMaxHeight: "cropperMaxHeight", cropperMaxWidth: "cropperMaxWidth", cropperStaticWidth: "cropperStaticWidth", cropperStaticHeight: "cropperStaticHeight", canvasRotation: "canvasRotation", initialStepSize: "initialStepSize", roundCropper: "roundCropper", onlyScaleDown: "onlyScaleDown", imageQuality: "imageQuality", autoCrop: "autoCrop", backgroundColor: "backgroundColor", containWithinAspectRatio: "containWithinAspectRatio", hideResizeSquares: "hideResizeSquares", allowMoveImage: "allowMoveImage", cropper: "cropper", alignImage: "alignImage", disabled: "disabled", hidden: "hidden" }, outputs: { imageCropped: "imageCropped", startCropImage: "startCropImage", imageLoaded: "imageLoaded", cropperReady: "cropperReady", loadImageFailed: "loadImageFailed", transformChange: "transformChange", cropping: "cropping" }, host: { listeners: { "window:resize": "onResize()", "document:mousemove": "moveImg($event)", "document:touchmove": "moveImg($event)", "document:mouseup": "moveStop()", "document:touchend": "moveStop()" }, properties: { "style.text-align": "this.alignImage", "class.disabled": "this.disabled", "class.ngx-ix-hidden": "this.hidden" } }, viewQueries: [{ propertyName: "wrapper", first: true, predicate: ["wrapper"], descendants: true, static: true }, { propertyName: "sourceImage", first: true, predicate: ["sourceImage"], descendants: true }], usesOnChanges: true, ngImport: i0, template: "<div\n  [style.background]=\"imageVisible && backgroundColor\"\n  #wrapper\n>\n  <img\n    #sourceImage\n    class=\"ngx-ic-source-image\"\n    *ngIf=\"safeImgDataUrl\"\n    [src]=\"safeImgDataUrl\"\n    [style.visibility]=\"imageVisible ? 'visible' : 'hidden'\"\n    [style.transform]=\"safeTransformStyle\"\n    [class.ngx-ic-draggable]=\"!disabled && allowMoveImage\"\n    [attr.alt]=\"imageAltText\"\n    (load)=\"imageLoadedInView()\"\n    (mousedown)=\"startMove($event, moveTypes.Drag)\"\n    (touchstart)=\"startMove($event, moveTypes.Drag)\"\n    (error)=\"loadImageError($event)\"\n  >\n  <div\n    class=\"ngx-ic-overlay\"\n    [style.width.px]=\"maxSize.width\"\n    [style.height.px]=\"maxSize.height\"\n    [style.margin-left]=\"alignImage === 'center' ? marginLeft : null\"\n  ></div>\n  <div class=\"ngx-ic-cropper\"\n       *ngIf=\"imageVisible\"\n       [class.ngx-ic-round]=\"roundCropper\"\n       [style.top.px]=\"cropper.y1\"\n       [style.left.px]=\"cropper.x1\"\n       [style.width.px]=\"cropper.x2 - cropper.x1\"\n       [style.height.px]=\"cropper.y2 - cropper.y1\"\n       [style.margin-left]=\"alignImage === 'center' ? marginLeft : null\"\n       [style.visibility]=\"imageVisible ? 'visible' : 'hidden'\"\n       (keydown)=\"keyboardAccess($event)\"\n       tabindex=\"0\"\n  >\n    <div\n      (mousedown)=\"startMove($event, moveTypes.Move)\"\n      (touchstart)=\"startMove($event, moveTypes.Move)\"\n      class=\"ngx-ic-move\">\n    </div>\n    <ng-container *ngIf=\"!hideResizeSquares\">\n            <span class=\"ngx-ic-resize ngx-ic-topleft\"\n                  (mousedown)=\"startMove($event, moveTypes.Resize, 'topleft')\"\n                  (touchstart)=\"startMove($event, moveTypes.Resize, 'topleft')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-top\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-topright\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'topright')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'topright')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-right\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottomright\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottomright')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottomright')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottom\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-bottomleft\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottomleft')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottomleft')\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize ngx-ic-left\">\n                <span class=\"ngx-ic-square\"></span>\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-top\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'top')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'top')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-right\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'right')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'right')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-bottom\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'bottom')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'bottom')\">\n            </span>\n      <span class=\"ngx-ic-resize-bar ngx-ic-left\"\n            (mousedown)=\"startMove($event, moveTypes.Resize, 'left')\"\n            (touchstart)=\"startMove($event, moveTypes.Resize, 'left')\">\n            </span>\n    </ng-container>\n  </div>\n</div>\n", styles: [":host{display:flex;position:relative;width:100%;max-width:100%;max-height:100%;overflow:hidden;padding:5px;text-align:center}:host>div{width:100%;position:relative}:host>div img.ngx-ic-source-image{max-width:100%;max-height:100%;transform-origin:center}:host>div img.ngx-ic-source-image.ngx-ic-draggable{user-drag:none;-webkit-user-drag:none;user-select:none;-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;cursor:grab}:host .ngx-ic-overlay{position:absolute;pointer-events:none;touch-action:none;outline:var(--cropper-overlay-color, white) solid 100vw;top:0;left:0}:host .ngx-ic-cropper{position:absolute;display:flex;color:#53535c;background:transparent;outline:rgba(255,255,255,.3) solid 100vw;outline:var(--cropper-outline-color, rgba(255, 255, 255, .3)) solid 100vw;touch-action:none}@media (orientation: portrait){:host .ngx-ic-cropper{outline-width:100vh}}:host .ngx-ic-cropper:after{position:absolute;content:\"\";inset:0;pointer-events:none;border:dashed 1px;opacity:.75;color:inherit;z-index:1}:host .ngx-ic-cropper .ngx-ic-move{width:100%;cursor:move;border:1px solid rgba(255,255,255,.5)}:host .ngx-ic-cropper:focus .ngx-ic-move{border-color:#1e90ff;border-width:2px}:host .ngx-ic-cropper .ngx-ic-resize{position:absolute;display:inline-block;line-height:6px;padding:8px;opacity:.85;z-index:1}:host .ngx-ic-cropper .ngx-ic-resize .ngx-ic-square{display:inline-block;background:#53535C;width:6px;height:6px;border:1px solid rgba(255,255,255,.5);box-sizing:content-box}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-topleft{top:-12px;left:-12px;cursor:nwse-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-top{top:-12px;left:calc(50% - 12px);cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-topright{top:-12px;right:-12px;cursor:nesw-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-right{top:calc(50% - 12px);right:-12px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottomright{bottom:-12px;right:-12px;cursor:nwse-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottom{bottom:-12px;left:calc(50% - 12px);cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-bottomleft{bottom:-12px;left:-12px;cursor:nesw-resize}:host .ngx-ic-cropper .ngx-ic-resize.ngx-ic-left{top:calc(50% - 12px);left:-12px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar{position:absolute;z-index:1}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-top{top:-11px;left:11px;width:calc(100% - 22px);height:22px;cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-right{top:11px;right:-11px;height:calc(100% - 22px);width:22px;cursor:ew-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-bottom{bottom:-11px;left:11px;width:calc(100% - 22px);height:22px;cursor:ns-resize}:host .ngx-ic-cropper .ngx-ic-resize-bar.ngx-ic-left{top:11px;left:-11px;height:calc(100% - 22px);width:22px;cursor:ew-resize}:host .ngx-ic-cropper.ngx-ic-round{outline-color:transparent}:host .ngx-ic-cropper.ngx-ic-round:after{border-radius:100%;box-shadow:0 0 0 100vw #ffffff4d;box-shadow:0 0 0 100vw var(--cropper-outline-color, rgba(255, 255, 255, .3))}@media (orientation: portrait){:host .ngx-ic-cropper.ngx-ic-round:after{box-shadow:0 0 0 100vh #ffffff4d;box-shadow:0 0 0 100vh var(--cropper-outline-color, rgba(255, 255, 255, .3))}}:host .ngx-ic-cropper.ngx-ic-round .ngx-ic-move{border-radius:100%}:host.disabled .ngx-ic-cropper .ngx-ic-resize,:host.disabled .ngx-ic-cropper .ngx-ic-resize-bar,:host.disabled .ngx-ic-cropper .ngx-ic-move{display:none}:host.ngx-ix-hidden{display:none}\n"], dependencies: [{ kind: "directive", type: i5.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush }); }
}
export { ImageCropperComponent };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.0.3", ngImport: i0, type: ImageCropperComponent, decorators: [{
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtY3JvcHBlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtaW1hZ2UtY3JvcHBlci9zcmMvbGliL2NvbXBvbmVudC9pbWFnZS1jcm9wcGVyLmNvbXBvbmVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1pbWFnZS1jcm9wcGVyL3NyYy9saWIvY29tcG9uZW50L2ltYWdlLWNyb3BwZXIuY29tcG9uZW50Lmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLHVCQUF1QixFQUV2QixTQUFTLEVBRVQsWUFBWSxFQUNaLFdBQVcsRUFDWCxZQUFZLEVBQ1osS0FBSyxFQUNMLFNBQVMsRUFHVCxNQUFNLEVBRU4sU0FBUyxFQUNWLE1BQU0sZUFBZSxDQUFDO0FBSXZCLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFLL0QsT0FBTyxFQUFFLGNBQWMsRUFBRSx5QkFBeUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlCQUF5QixDQUFDOzs7Ozs7O0FBRXZHLE1BTWEscUJBQXFCO0lBc0VoQyxZQUNVLFdBQXdCLEVBQ3hCLHNCQUE4QyxFQUM5QyxnQkFBa0MsRUFDbEMsU0FBdUIsRUFDdkIsRUFBcUI7UUFKckIsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDeEIsMkJBQXNCLEdBQXRCLHNCQUFzQixDQUF3QjtRQUM5QyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO1FBQ2xDLGNBQVMsR0FBVCxTQUFTLENBQWM7UUFDdkIsT0FBRSxHQUFGLEVBQUUsQ0FBbUI7UUExRXZCLFdBQU0sR0FBa0IsTUFBYyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDO1FBQzNELGFBQVEsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ2pDLDJCQUFzQixH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QkFBaEMsS0FBSztnQkFDRyxpQkFBaUI7c0JBQXpCLEtBQUs7Z0JBQ0csY0FBYztzQkFBdEIsS0FBSztnQkFDRyxPQUFPO3NCQUFmLEtBQUs7Z0JBT0csVUFBVTtzQkFEbEIsV0FBVzt1QkFBQyxrQkFBa0I7O3NCQUM5QixLQUFLO2dCQUVHLFFBQVE7c0JBRGhCLFdBQVc7dUJBQUMsZ0JBQWdCOztzQkFDNUIsS0FBSztnQkFFRyxNQUFNO3NCQURkLFdBQVc7dUJBQUMscUJBQXFCOztzQkFDakMsS0FBSztnQkFFSSxZQUFZO3NCQUFyQixNQUFNO2dCQUNHLGNBQWM7c0JBQXZCLE1BQU07Z0JBQ0csV0FBVztzQkFBcEIsTUFBTTtnQkFDRyxZQUFZO3NCQUFyQixNQUFNO2dCQUNHLGVBQWU7c0JBQXhCLE1BQU07Z0JBQ0csZUFBZTtzQkFBeEIsTUFBTTtnQkFDRyxRQUFRO3NCQUFqQixNQUFNO2dCQWdNUCxRQUFRO3NCQURQLFlBQVk7dUJBQUMsZUFBZTtnQkE2RzdCLE9BQU87c0JBRk4sWUFBWTt1QkFBQyxvQkFBb0IsRUFBRSxDQUFDLFFBQVEsQ0FBQzs7c0JBQzdDLFlBQVk7dUJBQUMsb0JBQW9CLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBNkg5QyxRQUFRO3NCQUZQLFlBQVk7dUJBQUMsa0JBQWtCOztzQkFDL0IsWUFBWTt1QkFBQyxtQkFBbUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSxcbiAgQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gIENvbXBvbmVudCxcbiAgRWxlbWVudFJlZixcbiAgRXZlbnRFbWl0dGVyLFxuICBIb3N0QmluZGluZyxcbiAgSG9zdExpc3RlbmVyLFxuICBJbnB1dCxcbiAgaXNEZXZNb2RlLFxuICBPbkNoYW5nZXMsXG4gIE9uSW5pdCxcbiAgT3V0cHV0LFxuICBTaW1wbGVDaGFuZ2VzLFxuICBWaWV3Q2hpbGRcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBEb21TYW5pdGl6ZXIsIFNhZmVTdHlsZSwgU2FmZVVybCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXInO1xuaW1wb3J0IHsgQ3JvcHBlclBvc2l0aW9uLCBEaW1lbnNpb25zLCBJbWFnZUNyb3BwZWRFdmVudCwgSW1hZ2VUcmFuc2Zvcm0sIExvYWRlZEltYWdlLCBNb3ZlU3RhcnQgfSBmcm9tICcuLi9pbnRlcmZhY2VzJztcbmltcG9ydCB7IE91dHB1dEZvcm1hdCB9IGZyb20gJy4uL2ludGVyZmFjZXMvY3JvcHBlci1vcHRpb25zLmludGVyZmFjZSc7XG5pbXBvcnQgeyBDcm9wcGVyU2V0dGluZ3MgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2Nyb3BwZXIuc2V0dGluZ3MnO1xuaW1wb3J0IHsgTW92ZVR5cGVzIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9tb3ZlLXN0YXJ0LmludGVyZmFjZSc7XG5pbXBvcnQgeyBDcm9wU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2Nyb3Auc2VydmljZSc7XG5pbXBvcnQgeyBDcm9wcGVyUG9zaXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvY3JvcHBlci1wb3NpdGlvbi5zZXJ2aWNlJztcbmltcG9ydCB7IExvYWRJbWFnZVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9sb2FkLWltYWdlLnNlcnZpY2UnO1xuaW1wb3J0IHsgSGFtbWVyU3RhdGljIH0gZnJvbSAnLi4vdXRpbHMvaGFtbWVyLnV0aWxzJztcbmltcG9ydCB7IGdldEV2ZW50Rm9yS2V5LCBnZXRJbnZlcnRlZFBvc2l0aW9uRm9yS2V5LCBnZXRQb3NpdGlvbkZvcktleSB9IGZyb20gJy4uL3V0aWxzL2tleWJvYXJkLnV0aWxzJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnaW1hZ2UtY3JvcHBlcicsXG4gIHRlbXBsYXRlVXJsOiAnLi9pbWFnZS1jcm9wcGVyLmNvbXBvbmVudC5odG1sJyxcbiAgc3R5bGVVcmxzOiBbJy4vaW1hZ2UtY3JvcHBlci5jb21wb25lbnQuc2NzcyddLFxuICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaFxufSlcbmV4cG9ydCBjbGFzcyBJbWFnZUNyb3BwZXJDb21wb25lbnQgaW1wbGVtZW50cyBPbkNoYW5nZXMsIE9uSW5pdCB7XG4gIHByaXZhdGUgSGFtbWVyOiBIYW1tZXJTdGF0aWMgPSAod2luZG93IGFzIGFueSk/LlsnSGFtbWVyJ10gfHwgbnVsbDtcbiAgcHJpdmF0ZSBzZXR0aW5ncyA9IG5ldyBDcm9wcGVyU2V0dGluZ3MoKTtcbiAgcHJpdmF0ZSBzZXRJbWFnZU1heFNpemVSZXRyaWVzID0gMDtcbiAgcHJpdmF0ZSBtb3ZlU3RhcnQ/OiBNb3ZlU3RhcnQ7XG4gIHByaXZhdGUgbG9hZGVkSW1hZ2U/OiBMb2FkZWRJbWFnZTtcbiAgcHJpdmF0ZSByZXNpemVkV2hpbGVIaWRkZW4gPSBmYWxzZTtcblxuICBzYWZlSW1nRGF0YVVybD86IFNhZmVVcmwgfCBzdHJpbmc7XG4gIHNhZmVUcmFuc2Zvcm1TdHlsZT86IFNhZmVTdHlsZSB8IHN0cmluZztcbiAgbWFyZ2luTGVmdDogU2FmZVN0eWxlIHwgc3RyaW5nID0gJzBweCc7XG4gIG1heFNpemU6IERpbWVuc2lvbnMgPSB7XG4gICAgd2lkdGg6IDAsXG4gICAgaGVpZ2h0OiAwXG4gIH07XG4gIG1vdmVUeXBlcyA9IE1vdmVUeXBlcztcbiAgaW1hZ2VWaXNpYmxlID0gZmFsc2U7XG5cbiAgQFZpZXdDaGlsZCgnd3JhcHBlcicsIHtzdGF0aWM6IHRydWV9KSB3cmFwcGVyITogRWxlbWVudFJlZjxIVE1MRGl2RWxlbWVudD47XG4gIEBWaWV3Q2hpbGQoJ3NvdXJjZUltYWdlJywge3N0YXRpYzogZmFsc2V9KSBzb3VyY2VJbWFnZSE6IEVsZW1lbnRSZWY8SFRNTERpdkVsZW1lbnQ+O1xuXG4gIEBJbnB1dCgpIGltYWdlQ2hhbmdlZEV2ZW50PzogYW55O1xuICBASW5wdXQoKSBpbWFnZVVSTD86IHN0cmluZztcbiAgQElucHV0KCkgaW1hZ2VCYXNlNjQ/OiBzdHJpbmc7XG4gIEBJbnB1dCgpIGltYWdlRmlsZT86IEZpbGU7XG4gIEBJbnB1dCgpIGltYWdlQWx0VGV4dD86IHN0cmluZztcbiAgQElucHV0KCkgZm9ybWF0OiBPdXRwdXRGb3JtYXQgPSB0aGlzLnNldHRpbmdzLmZvcm1hdDtcbiAgQElucHV0KCkgdHJhbnNmb3JtOiBJbWFnZVRyYW5zZm9ybSA9IHt9O1xuICBASW5wdXQoKSBtYWludGFpbkFzcGVjdFJhdGlvID0gdGhpcy5zZXR0aW5ncy5tYWludGFpbkFzcGVjdFJhdGlvO1xuICBASW5wdXQoKSBhc3BlY3RSYXRpbyA9IHRoaXMuc2V0dGluZ3MuYXNwZWN0UmF0aW87XG4gIEBJbnB1dCgpIHJlc2V0Q3JvcE9uQXNwZWN0UmF0aW9DaGFuZ2UgPSB0aGlzLnNldHRpbmdzLnJlc2V0Q3JvcE9uQXNwZWN0UmF0aW9DaGFuZ2U7XG4gIEBJbnB1dCgpIHJlc2l6ZVRvV2lkdGggPSB0aGlzLnNldHRpbmdzLnJlc2l6ZVRvV2lkdGg7XG4gIEBJbnB1dCgpIHJlc2l6ZVRvSGVpZ2h0ID0gdGhpcy5zZXR0aW5ncy5yZXNpemVUb0hlaWdodDtcbiAgQElucHV0KCkgY3JvcHBlck1pbldpZHRoID0gdGhpcy5zZXR0aW5ncy5jcm9wcGVyTWluV2lkdGg7XG4gIEBJbnB1dCgpIGNyb3BwZXJNaW5IZWlnaHQgPSB0aGlzLnNldHRpbmdzLmNyb3BwZXJNaW5IZWlnaHQ7XG4gIEBJbnB1dCgpIGNyb3BwZXJNYXhIZWlnaHQgPSB0aGlzLnNldHRpbmdzLmNyb3BwZXJNYXhIZWlnaHQ7XG4gIEBJbnB1dCgpIGNyb3BwZXJNYXhXaWR0aCA9IHRoaXMuc2V0dGluZ3MuY3JvcHBlck1heFdpZHRoO1xuICBASW5wdXQoKSBjcm9wcGVyU3RhdGljV2lkdGggPSB0aGlzLnNldHRpbmdzLmNyb3BwZXJTdGF0aWNXaWR0aDtcbiAgQElucHV0KCkgY3JvcHBlclN0YXRpY0hlaWdodCA9IHRoaXMuc2V0dGluZ3MuY3JvcHBlclN0YXRpY0hlaWdodDtcbiAgQElucHV0KCkgY2FudmFzUm90YXRpb24gPSB0aGlzLnNldHRpbmdzLmNhbnZhc1JvdGF0aW9uO1xuICBASW5wdXQoKSBpbml0aWFsU3RlcFNpemUgPSB0aGlzLnNldHRpbmdzLmluaXRpYWxTdGVwU2l6ZTtcbiAgQElucHV0KCkgcm91bmRDcm9wcGVyID0gdGhpcy5zZXR0aW5ncy5yb3VuZENyb3BwZXI7XG4gIEBJbnB1dCgpIG9ubHlTY2FsZURvd24gPSB0aGlzLnNldHRpbmdzLm9ubHlTY2FsZURvd247XG4gIEBJbnB1dCgpIGltYWdlUXVhbGl0eSA9IHRoaXMuc2V0dGluZ3MuaW1hZ2VRdWFsaXR5O1xuICBASW5wdXQoKSBhdXRvQ3JvcCA9IHRoaXMuc2V0dGluZ3MuYXV0b0Nyb3A7XG4gIEBJbnB1dCgpIGJhY2tncm91bmRDb2xvciA9IHRoaXMuc2V0dGluZ3MuYmFja2dyb3VuZENvbG9yO1xuICBASW5wdXQoKSBjb250YWluV2l0aGluQXNwZWN0UmF0aW8gPSB0aGlzLnNldHRpbmdzLmNvbnRhaW5XaXRoaW5Bc3BlY3RSYXRpbztcbiAgQElucHV0KCkgaGlkZVJlc2l6ZVNxdWFyZXMgPSB0aGlzLnNldHRpbmdzLmhpZGVSZXNpemVTcXVhcmVzO1xuICBASW5wdXQoKSBhbGxvd01vdmVJbWFnZSA9IGZhbHNlO1xuICBASW5wdXQoKSBjcm9wcGVyOiBDcm9wcGVyUG9zaXRpb24gPSB7XG4gICAgeDE6IC0xMDAsXG4gICAgeTE6IC0xMDAsXG4gICAgeDI6IDEwMDAwLFxuICAgIHkyOiAxMDAwMFxuICB9O1xuICBASG9zdEJpbmRpbmcoJ3N0eWxlLnRleHQtYWxpZ24nKVxuICBASW5wdXQoKSBhbGlnbkltYWdlOiAnbGVmdCcgfCAnY2VudGVyJyA9IHRoaXMuc2V0dGluZ3MuYWxpZ25JbWFnZTtcbiAgQEhvc3RCaW5kaW5nKCdjbGFzcy5kaXNhYmxlZCcpXG4gIEBJbnB1dCgpIGRpc2FibGVkID0gZmFsc2U7XG4gIEBIb3N0QmluZGluZygnY2xhc3Mubmd4LWl4LWhpZGRlbicpXG4gIEBJbnB1dCgpIGhpZGRlbiA9IGZhbHNlO1xuXG4gIEBPdXRwdXQoKSBpbWFnZUNyb3BwZWQgPSBuZXcgRXZlbnRFbWl0dGVyPEltYWdlQ3JvcHBlZEV2ZW50PigpO1xuICBAT3V0cHV0KCkgc3RhcnRDcm9wSW1hZ2UgPSBuZXcgRXZlbnRFbWl0dGVyPHZvaWQ+KCk7XG4gIEBPdXRwdXQoKSBpbWFnZUxvYWRlZCA9IG5ldyBFdmVudEVtaXR0ZXI8TG9hZGVkSW1hZ2U+KCk7XG4gIEBPdXRwdXQoKSBjcm9wcGVyUmVhZHkgPSBuZXcgRXZlbnRFbWl0dGVyPERpbWVuc2lvbnM+KCk7XG4gIEBPdXRwdXQoKSBsb2FkSW1hZ2VGYWlsZWQgPSBuZXcgRXZlbnRFbWl0dGVyPHZvaWQ+KCk7XG4gIEBPdXRwdXQoKSB0cmFuc2Zvcm1DaGFuZ2UgPSBuZXcgRXZlbnRFbWl0dGVyPEltYWdlVHJhbnNmb3JtPigpO1xuICBAT3V0cHV0KCkgY3JvcHBpbmcgPSBuZXcgRXZlbnRFbWl0dGVyPENyb3BwZXJQb3NpdGlvbj4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGNyb3BTZXJ2aWNlOiBDcm9wU2VydmljZSxcbiAgICBwcml2YXRlIGNyb3BwZXJQb3NpdGlvblNlcnZpY2U6IENyb3BwZXJQb3NpdGlvblNlcnZpY2UsXG4gICAgcHJpdmF0ZSBsb2FkSW1hZ2VTZXJ2aWNlOiBMb2FkSW1hZ2VTZXJ2aWNlLFxuICAgIHByaXZhdGUgc2FuaXRpemVyOiBEb21TYW5pdGl6ZXIsXG4gICAgcHJpdmF0ZSBjZDogQ2hhbmdlRGV0ZWN0b3JSZWZcbiAgKSB7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG5cbiAgbmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcyk6IHZvaWQge1xuICAgIHRoaXMub25DaGFuZ2VzVXBkYXRlU2V0dGluZ3MoY2hhbmdlcyk7XG4gICAgdGhpcy5vbkNoYW5nZXNJbnB1dEltYWdlKGNoYW5nZXMpO1xuXG4gICAgaWYgKHRoaXMubG9hZGVkSW1hZ2U/Lm9yaWdpbmFsLmltYWdlLmNvbXBsZXRlICYmIChjaGFuZ2VzWydjb250YWluV2l0aGluQXNwZWN0UmF0aW8nXSB8fCBjaGFuZ2VzWydjYW52YXNSb3RhdGlvbiddKSkge1xuICAgICAgdGhpcy5sb2FkSW1hZ2VTZXJ2aWNlXG4gICAgICAgIC50cmFuc2Zvcm1Mb2FkZWRJbWFnZSh0aGlzLmxvYWRlZEltYWdlLCB0aGlzLnNldHRpbmdzKVxuICAgICAgICAudGhlbigocmVzKSA9PiB0aGlzLnNldExvYWRlZEltYWdlKHJlcykpXG4gICAgICAgIC5jYXRjaCgoZXJyKSA9PiB0aGlzLmxvYWRJbWFnZUVycm9yKGVycikpO1xuICAgIH1cbiAgICBpZiAoY2hhbmdlc1snY3JvcHBlciddIHx8IGNoYW5nZXNbJ21haW50YWluQXNwZWN0UmF0aW8nXSB8fCBjaGFuZ2VzWydhc3BlY3RSYXRpbyddKSB7XG4gICAgICB0aGlzLnNldE1heFNpemUoKTtcbiAgICAgIHRoaXMuc2V0Q3JvcHBlclNjYWxlZE1pblNpemUoKTtcbiAgICAgIHRoaXMuc2V0Q3JvcHBlclNjYWxlZE1heFNpemUoKTtcbiAgICAgIGlmIChcbiAgICAgICAgdGhpcy5tYWludGFpbkFzcGVjdFJhdGlvICYmXG4gICAgICAgICh0aGlzLnJlc2V0Q3JvcE9uQXNwZWN0UmF0aW9DaGFuZ2UgfHwgIXRoaXMuYXNwZWN0UmF0aW9Jc0NvcnJlY3QoKSkgJiZcbiAgICAgICAgKGNoYW5nZXNbJ21haW50YWluQXNwZWN0UmF0aW8nXSB8fCBjaGFuZ2VzWydhc3BlY3RSYXRpbyddKVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMucmVzZXRDcm9wcGVyUG9zaXRpb24oKTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhbmdlc1snY3JvcHBlciddKSB7XG4gICAgICAgIHRoaXMuY2hlY2tDcm9wcGVyUG9zaXRpb24oZmFsc2UpO1xuICAgICAgICB0aGlzLmRvQXV0b0Nyb3AoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY2QubWFya0ZvckNoZWNrKCk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzWyd0cmFuc2Zvcm0nXSkge1xuICAgICAgdGhpcy50cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybSB8fCB7fTtcbiAgICAgIHRoaXMuc2V0Q3NzVHJhbnNmb3JtKCk7XG4gICAgICB0aGlzLmRvQXV0b0Nyb3AoKTtcbiAgICAgIHRoaXMuY2QubWFya0ZvckNoZWNrKCk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzWydoaWRkZW4nXSAmJiB0aGlzLnJlc2l6ZWRXaGlsZUhpZGRlbiAmJiAhdGhpcy5oaWRkZW4pIHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLm9uUmVzaXplKCk7XG4gICAgICAgIHRoaXMucmVzaXplZFdoaWxlSGlkZGVuID0gZmFsc2U7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG9uQ2hhbmdlc1VwZGF0ZVNldHRpbmdzKGNoYW5nZXM6IFNpbXBsZUNoYW5nZXMpIHtcbiAgICB0aGlzLnNldHRpbmdzLnNldE9wdGlvbnNGcm9tQ2hhbmdlcyhjaGFuZ2VzKTtcblxuICAgIGlmICh0aGlzLnNldHRpbmdzLmNyb3BwZXJTdGF0aWNIZWlnaHQgJiYgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU3RhdGljV2lkdGgpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3Muc2V0T3B0aW9ucyh7XG4gICAgICAgIGhpZGVSZXNpemVTcXVhcmVzOiB0cnVlLFxuICAgICAgICBjcm9wcGVyTWluV2lkdGg6IHRoaXMuc2V0dGluZ3MuY3JvcHBlclN0YXRpY1dpZHRoLFxuICAgICAgICBjcm9wcGVyTWluSGVpZ2h0OiB0aGlzLnNldHRpbmdzLmNyb3BwZXJTdGF0aWNIZWlnaHQsXG4gICAgICAgIGNyb3BwZXJNYXhIZWlnaHQ6IHRoaXMuc2V0dGluZ3MuY3JvcHBlclN0YXRpY0hlaWdodCxcbiAgICAgICAgY3JvcHBlck1heFdpZHRoOiB0aGlzLnNldHRpbmdzLmNyb3BwZXJTdGF0aWNXaWR0aCxcbiAgICAgICAgbWFpbnRhaW5Bc3BlY3RSYXRpbzogZmFsc2VcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgb25DaGFuZ2VzSW5wdXRJbWFnZShjaGFuZ2VzOiBTaW1wbGVDaGFuZ2VzKTogdm9pZCB7XG4gICAgaWYgKGNoYW5nZXNbJ2ltYWdlQ2hhbmdlZEV2ZW50J10gfHwgY2hhbmdlc1snaW1hZ2VVUkwnXSB8fCBjaGFuZ2VzWydpbWFnZUJhc2U2NCddIHx8IGNoYW5nZXNbJ2ltYWdlRmlsZSddKSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzWydpbWFnZUNoYW5nZWRFdmVudCddICYmIHRoaXMuaXNWYWxpZEltYWdlQ2hhbmdlZEV2ZW50KCkpIHtcbiAgICAgIHRoaXMubG9hZEltYWdlRmlsZSh0aGlzLmltYWdlQ2hhbmdlZEV2ZW50LnRhcmdldC5maWxlc1swXSk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzWydpbWFnZVVSTCddICYmIHRoaXMuaW1hZ2VVUkwpIHtcbiAgICAgIHRoaXMubG9hZEltYWdlRnJvbVVSTCh0aGlzLmltYWdlVVJMKTtcbiAgICB9XG4gICAgaWYgKGNoYW5nZXNbJ2ltYWdlQmFzZTY0J10gJiYgdGhpcy5pbWFnZUJhc2U2NCkge1xuICAgICAgdGhpcy5sb2FkQmFzZTY0SW1hZ2UodGhpcy5pbWFnZUJhc2U2NCk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzWydpbWFnZUZpbGUnXSAmJiB0aGlzLmltYWdlRmlsZSkge1xuICAgICAgdGhpcy5sb2FkSW1hZ2VGaWxlKHRoaXMuaW1hZ2VGaWxlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGlzVmFsaWRJbWFnZUNoYW5nZWRFdmVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5pbWFnZUNoYW5nZWRFdmVudD8udGFyZ2V0Py5maWxlcz8ubGVuZ3RoID4gMDtcbiAgfVxuXG4gIHByaXZhdGUgc2V0Q3NzVHJhbnNmb3JtKCkge1xuICAgIGNvbnN0IHRyYW5zbGF0ZVVuaXQgPSB0aGlzLnRyYW5zZm9ybT8udHJhbnNsYXRlVW5pdCB8fCAnJSc7XG4gICAgdGhpcy5zYWZlVHJhbnNmb3JtU3R5bGUgPSB0aGlzLnNhbml0aXplci5ieXBhc3NTZWN1cml0eVRydXN0U3R5bGUoXG4gICAgICBgdHJhbnNsYXRlKCR7dGhpcy50cmFuc2Zvcm0udHJhbnNsYXRlSCB8fCAwfSR7dHJhbnNsYXRlVW5pdH0sICR7dGhpcy50cmFuc2Zvcm0udHJhbnNsYXRlViB8fCAwfSR7dHJhbnNsYXRlVW5pdH0pYCArXG4gICAgICAnIHNjYWxlWCgnICsgKHRoaXMudHJhbnNmb3JtLnNjYWxlIHx8IDEpICogKHRoaXMudHJhbnNmb3JtLmZsaXBIID8gLTEgOiAxKSArICcpJyArXG4gICAgICAnIHNjYWxlWSgnICsgKHRoaXMudHJhbnNmb3JtLnNjYWxlIHx8IDEpICogKHRoaXMudHJhbnNmb3JtLmZsaXBWID8gLTEgOiAxKSArICcpJyArXG4gICAgICAnIHJvdGF0ZSgnICsgKHRoaXMudHJhbnNmb3JtLnJvdGF0ZSB8fCAwKSArICdkZWcpJ1xuICAgICk7XG4gIH1cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLnNldHRpbmdzLnN0ZXBTaXplID0gdGhpcy5pbml0aWFsU3RlcFNpemU7XG4gICAgdGhpcy5hY3RpdmF0ZVBpbmNoR2VzdHVyZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldCgpOiB2b2lkIHtcbiAgICB0aGlzLmltYWdlVmlzaWJsZSA9IGZhbHNlO1xuICAgIHRoaXMubG9hZGVkSW1hZ2UgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5zYWZlSW1nRGF0YVVybCA9ICdkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZydcbiAgICAgICsgJ29BQUFBTlNVaEVVZ0FBQUFFQUFBQUJDQVlBQUFBZkZjU0pBQUFBQzBsRVFWUVlWMk5nQUFJQUFBVSdcbiAgICAgICsgJ0FBYXJWeUZFQUFBQUFTVVZPUks1Q1lJST0nO1xuICAgIHRoaXMubW92ZVN0YXJ0ID0ge1xuICAgICAgYWN0aXZlOiBmYWxzZSxcbiAgICAgIHR5cGU6IG51bGwsXG4gICAgICBwb3NpdGlvbjogbnVsbCxcbiAgICAgIHgxOiAwLFxuICAgICAgeTE6IDAsXG4gICAgICB4MjogMCxcbiAgICAgIHkyOiAwLFxuICAgICAgY2xpZW50WDogMCxcbiAgICAgIGNsaWVudFk6IDBcbiAgICB9O1xuICAgIHRoaXMubWF4U2l6ZSA9IHtcbiAgICAgIHdpZHRoOiAwLFxuICAgICAgaGVpZ2h0OiAwXG4gICAgfTtcbiAgICB0aGlzLmNyb3BwZXIueDEgPSAtMTAwO1xuICAgIHRoaXMuY3JvcHBlci55MSA9IC0xMDA7XG4gICAgdGhpcy5jcm9wcGVyLngyID0gMTAwMDA7XG4gICAgdGhpcy5jcm9wcGVyLnkyID0gMTAwMDA7XG4gIH1cblxuICBwcml2YXRlIGxvYWRJbWFnZUZpbGUoZmlsZTogRmlsZSk6IHZvaWQge1xuICAgIHRoaXMubG9hZEltYWdlU2VydmljZVxuICAgICAgLmxvYWRJbWFnZUZpbGUoZmlsZSwgdGhpcy5zZXR0aW5ncylcbiAgICAgIC50aGVuKChyZXMpID0+IHRoaXMuc2V0TG9hZGVkSW1hZ2UocmVzKSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB0aGlzLmxvYWRJbWFnZUVycm9yKGVycikpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2FkQmFzZTY0SW1hZ2UoaW1hZ2VCYXNlNjQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubG9hZEltYWdlU2VydmljZVxuICAgICAgLmxvYWRCYXNlNjRJbWFnZShpbWFnZUJhc2U2NCwgdGhpcy5zZXR0aW5ncylcbiAgICAgIC50aGVuKChyZXMpID0+IHRoaXMuc2V0TG9hZGVkSW1hZ2UocmVzKSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB0aGlzLmxvYWRJbWFnZUVycm9yKGVycikpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2FkSW1hZ2VGcm9tVVJMKHVybDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5sb2FkSW1hZ2VTZXJ2aWNlXG4gICAgICAubG9hZEltYWdlRnJvbVVSTCh1cmwsIHRoaXMuc2V0dGluZ3MpXG4gICAgICAudGhlbigocmVzKSA9PiB0aGlzLnNldExvYWRlZEltYWdlKHJlcykpXG4gICAgICAuY2F0Y2goKGVycikgPT4gdGhpcy5sb2FkSW1hZ2VFcnJvcihlcnIpKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0TG9hZGVkSW1hZ2UobG9hZGVkSW1hZ2U6IExvYWRlZEltYWdlKTogdm9pZCB7XG4gICAgdGhpcy5sb2FkZWRJbWFnZSA9IGxvYWRlZEltYWdlO1xuICAgIHRoaXMuc2FmZUltZ0RhdGFVcmwgPSB0aGlzLnNhbml0aXplci5ieXBhc3NTZWN1cml0eVRydXN0UmVzb3VyY2VVcmwobG9hZGVkSW1hZ2UudHJhbnNmb3JtZWQuYmFzZTY0KTtcbiAgICB0aGlzLmNkLm1hcmtGb3JDaGVjaygpO1xuICB9XG5cbiAgcHVibGljIGxvYWRJbWFnZUVycm9yKGVycm9yOiBhbnkpOiB2b2lkIHtcbiAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICB0aGlzLmxvYWRJbWFnZUZhaWxlZC5lbWl0KCk7XG4gIH1cblxuICBpbWFnZUxvYWRlZEluVmlldygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sb2FkZWRJbWFnZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLmltYWdlTG9hZGVkLmVtaXQodGhpcy5sb2FkZWRJbWFnZSk7XG4gICAgICB0aGlzLnNldEltYWdlTWF4U2l6ZVJldHJpZXMgPSAwO1xuICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmNoZWNrSW1hZ2VNYXhTaXplUmVjdXJzaXZlbHkoKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjaGVja0ltYWdlTWF4U2l6ZVJlY3Vyc2l2ZWx5KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnNldEltYWdlTWF4U2l6ZVJldHJpZXMgPiA0MCkge1xuICAgICAgdGhpcy5sb2FkSW1hZ2VGYWlsZWQuZW1pdCgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5zb3VyY2VJbWFnZUxvYWRlZCgpKSB7XG4gICAgICB0aGlzLnNldE1heFNpemUoKTtcbiAgICAgIHRoaXMuc2V0Q3JvcHBlclNjYWxlZE1pblNpemUoKTtcbiAgICAgIHRoaXMuc2V0Q3JvcHBlclNjYWxlZE1heFNpemUoKTtcbiAgICAgIHRoaXMucmVzZXRDcm9wcGVyUG9zaXRpb24oKTtcbiAgICAgIHRoaXMuY3JvcHBlclJlYWR5LmVtaXQoey4uLnRoaXMubWF4U2l6ZX0pO1xuICAgICAgdGhpcy5jZC5tYXJrRm9yQ2hlY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXRJbWFnZU1heFNpemVSZXRyaWVzKys7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuY2hlY2tJbWFnZU1heFNpemVSZWN1cnNpdmVseSgpLCA1MCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzb3VyY2VJbWFnZUxvYWRlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zb3VyY2VJbWFnZT8ubmF0aXZlRWxlbWVudD8ub2Zmc2V0V2lkdGggPiAwO1xuICB9XG5cbiAgQEhvc3RMaXN0ZW5lcignd2luZG93OnJlc2l6ZScpXG4gIG9uUmVzaXplKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5sb2FkZWRJbWFnZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5oaWRkZW4pIHtcbiAgICAgIHRoaXMucmVzaXplZFdoaWxlSGlkZGVuID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZXNpemVDcm9wcGVyUG9zaXRpb24oKTtcbiAgICAgIHRoaXMuc2V0TWF4U2l6ZSgpO1xuICAgICAgdGhpcy5zZXRDcm9wcGVyU2NhbGVkTWluU2l6ZSgpO1xuICAgICAgdGhpcy5zZXRDcm9wcGVyU2NhbGVkTWF4U2l6ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWN0aXZhdGVQaW5jaEdlc3R1cmUoKSB7XG4gICAgaWYgKHRoaXMuSGFtbWVyKSB7XG4gICAgICBjb25zdCBoYW1tZXIgPSBuZXcgdGhpcy5IYW1tZXIodGhpcy53cmFwcGVyLm5hdGl2ZUVsZW1lbnQpO1xuICAgICAgaGFtbWVyLmdldCgncGluY2gnKS5zZXQoe2VuYWJsZTogdHJ1ZX0pO1xuICAgICAgaGFtbWVyLm9uKCdwaW5jaG1vdmUnLCB0aGlzLm9uUGluY2guYmluZCh0aGlzKSk7XG4gICAgICBoYW1tZXIub24oJ3BpbmNoZW5kJywgdGhpcy5waW5jaFN0b3AuYmluZCh0aGlzKSk7XG4gICAgICBoYW1tZXIub24oJ3BpbmNoc3RhcnQnLCB0aGlzLnN0YXJ0UGluY2guYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIGlmIChpc0Rldk1vZGUoKSkge1xuICAgICAgY29uc29sZS53YXJuKCdbTmd4SW1hZ2VDcm9wcGVyXSBDb3VsZCBub3QgZmluZCBIYW1tZXJKUyAtIFBpbmNoIEdlc3R1cmUgd29uXFwndCB3b3JrJyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZXNpemVDcm9wcGVyUG9zaXRpb24oKTogdm9pZCB7XG4gICAgY29uc3Qgc291cmNlSW1hZ2VFbGVtZW50ID0gdGhpcy5zb3VyY2VJbWFnZS5uYXRpdmVFbGVtZW50O1xuICAgIGlmICh0aGlzLm1heFNpemUud2lkdGggIT09IHNvdXJjZUltYWdlRWxlbWVudC5vZmZzZXRXaWR0aCB8fCB0aGlzLm1heFNpemUuaGVpZ2h0ICE9PSBzb3VyY2VJbWFnZUVsZW1lbnQub2Zmc2V0SGVpZ2h0KSB7XG4gICAgICB0aGlzLmNyb3BwZXIueDEgPSB0aGlzLmNyb3BwZXIueDEgKiBzb3VyY2VJbWFnZUVsZW1lbnQub2Zmc2V0V2lkdGggLyB0aGlzLm1heFNpemUud2lkdGg7XG4gICAgICB0aGlzLmNyb3BwZXIueDIgPSB0aGlzLmNyb3BwZXIueDIgKiBzb3VyY2VJbWFnZUVsZW1lbnQub2Zmc2V0V2lkdGggLyB0aGlzLm1heFNpemUud2lkdGg7XG4gICAgICB0aGlzLmNyb3BwZXIueTEgPSB0aGlzLmNyb3BwZXIueTEgKiBzb3VyY2VJbWFnZUVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gdGhpcy5tYXhTaXplLmhlaWdodDtcbiAgICAgIHRoaXMuY3JvcHBlci55MiA9IHRoaXMuY3JvcHBlci55MiAqIHNvdXJjZUltYWdlRWxlbWVudC5vZmZzZXRIZWlnaHQgLyB0aGlzLm1heFNpemUuaGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIHJlc2V0Q3JvcHBlclBvc2l0aW9uKCk6IHZvaWQge1xuICAgIHRoaXMuY3JvcHBlclBvc2l0aW9uU2VydmljZS5yZXNldENyb3BwZXJQb3NpdGlvbih0aGlzLnNvdXJjZUltYWdlLCB0aGlzLmNyb3BwZXIsIHRoaXMuc2V0dGluZ3MpO1xuICAgIHRoaXMuZG9BdXRvQ3JvcCgpO1xuICAgIHRoaXMuaW1hZ2VWaXNpYmxlID0gdHJ1ZTtcbiAgfVxuXG4gIGtleWJvYXJkQWNjZXNzKGV2ZW50OiBLZXlib2FyZEV2ZW50KSB7XG4gICAgdGhpcy5jaGFuZ2VLZXlib2FyZFN0ZXBTaXplKGV2ZW50KTtcbiAgICB0aGlzLmtleWJvYXJkTW92ZUNyb3BwZXIoZXZlbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGFuZ2VLZXlib2FyZFN0ZXBTaXplKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3Qga2V5ID0gK2V2ZW50LmtleTtcbiAgICBpZiAoa2V5ID49IDEgJiYga2V5IDw9IDkpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3Muc3RlcFNpemUgPSBrZXk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBrZXlib2FyZE1vdmVDcm9wcGVyKGV2ZW50OiBhbnkpIHtcbiAgICBjb25zdCBrZXlib2FyZFdoaXRlTGlzdDogc3RyaW5nW10gPSBbJ0Fycm93VXAnLCAnQXJyb3dEb3duJywgJ0Fycm93UmlnaHQnLCAnQXJyb3dMZWZ0J107XG4gICAgaWYgKCEoa2V5Ym9hcmRXaGl0ZUxpc3QuaW5jbHVkZXMoZXZlbnQua2V5KSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbW92ZVR5cGUgPSBldmVudC5zaGlmdEtleSA/IE1vdmVUeXBlcy5SZXNpemUgOiBNb3ZlVHlwZXMuTW92ZTtcbiAgICBjb25zdCBwb3NpdGlvbiA9IGV2ZW50LmFsdEtleSA/IGdldEludmVydGVkUG9zaXRpb25Gb3JLZXkoZXZlbnQua2V5KSA6IGdldFBvc2l0aW9uRm9yS2V5KGV2ZW50LmtleSk7XG4gICAgY29uc3QgbW92ZUV2ZW50ID0gZ2V0RXZlbnRGb3JLZXkoZXZlbnQua2V5LCB0aGlzLnNldHRpbmdzLnN0ZXBTaXplKTtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMuc3RhcnRNb3ZlKHtjbGllbnRYOiAwLCBjbGllbnRZOiAwfSwgbW92ZVR5cGUsIHBvc2l0aW9uKTtcbiAgICB0aGlzLm1vdmVJbWcobW92ZUV2ZW50KTtcbiAgICB0aGlzLm1vdmVTdG9wKCk7XG4gIH1cblxuICBzdGFydE1vdmUoZXZlbnQ6IGFueSwgbW92ZVR5cGU6IE1vdmVUeXBlcywgcG9zaXRpb246IHN0cmluZyB8IG51bGwgPSBudWxsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGlzYWJsZWRcbiAgICAgIHx8IHRoaXMubW92ZVN0YXJ0Py5hY3RpdmUgJiYgdGhpcy5tb3ZlU3RhcnQ/LnR5cGUgPT09IE1vdmVUeXBlcy5QaW5jaFxuICAgICAgfHwgbW92ZVR5cGUgPT09IE1vdmVUeXBlcy5EcmFnICYmICF0aGlzLmFsbG93TW92ZUltYWdlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChldmVudC5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gICAgdGhpcy5tb3ZlU3RhcnQgPSB7XG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgICB0eXBlOiBtb3ZlVHlwZSxcbiAgICAgIHBvc2l0aW9uLFxuICAgICAgdHJhbnNmb3JtOiB7Li4udGhpcy50cmFuc2Zvcm19LFxuICAgICAgY2xpZW50WDogdGhpcy5jcm9wcGVyUG9zaXRpb25TZXJ2aWNlLmdldENsaWVudFgoZXZlbnQpLFxuICAgICAgY2xpZW50WTogdGhpcy5jcm9wcGVyUG9zaXRpb25TZXJ2aWNlLmdldENsaWVudFkoZXZlbnQpLFxuICAgICAgLi4udGhpcy5jcm9wcGVyXG4gICAgfTtcbiAgfVxuXG4gIHN0YXJ0UGluY2goZXZlbnQ6IGFueSkge1xuICAgIGlmICghdGhpcy5zYWZlSW1nRGF0YVVybCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZXZlbnQucHJldmVudERlZmF1bHQpIHtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICAgIHRoaXMubW92ZVN0YXJ0ID0ge1xuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgdHlwZTogTW92ZVR5cGVzLlBpbmNoLFxuICAgICAgcG9zaXRpb246ICdjZW50ZXInLFxuICAgICAgY2xpZW50WDogdGhpcy5jcm9wcGVyLngxICsgKHRoaXMuY3JvcHBlci54MiAtIHRoaXMuY3JvcHBlci54MSkgLyAyLFxuICAgICAgY2xpZW50WTogdGhpcy5jcm9wcGVyLnkxICsgKHRoaXMuY3JvcHBlci55MiAtIHRoaXMuY3JvcHBlci55MSkgLyAyLFxuICAgICAgLi4udGhpcy5jcm9wcGVyXG4gICAgfTtcbiAgfVxuXG4gIEBIb3N0TGlzdGVuZXIoJ2RvY3VtZW50Om1vdXNlbW92ZScsIFsnJGV2ZW50J10pXG4gIEBIb3N0TGlzdGVuZXIoJ2RvY3VtZW50OnRvdWNobW92ZScsIFsnJGV2ZW50J10pXG4gIG1vdmVJbWcoZXZlbnQ6IGFueSk6IHZvaWQge1xuICAgIGlmICh0aGlzLm1vdmVTdGFydCEuYWN0aXZlKSB7XG4gICAgICBpZiAoZXZlbnQuc3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgfVxuICAgICAgaWYgKGV2ZW50LnByZXZlbnREZWZhdWx0KSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5tb3ZlU3RhcnQhLnR5cGUgPT09IE1vdmVUeXBlcy5Nb3ZlKSB7XG4gICAgICAgIHRoaXMuY3JvcHBlclBvc2l0aW9uU2VydmljZS5tb3ZlKGV2ZW50LCB0aGlzLm1vdmVTdGFydCEsIHRoaXMuY3JvcHBlcik7XG4gICAgICAgIHRoaXMuY2hlY2tDcm9wcGVyUG9zaXRpb24odHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMubW92ZVN0YXJ0IS50eXBlID09PSBNb3ZlVHlwZXMuUmVzaXplKSB7XG4gICAgICAgIGlmICghdGhpcy5jcm9wcGVyU3RhdGljV2lkdGggJiYgIXRoaXMuY3JvcHBlclN0YXRpY0hlaWdodCkge1xuICAgICAgICAgIHRoaXMuY3JvcHBlclBvc2l0aW9uU2VydmljZS5yZXNpemUoZXZlbnQsIHRoaXMubW92ZVN0YXJ0ISwgdGhpcy5jcm9wcGVyLCB0aGlzLm1heFNpemUsIHRoaXMuc2V0dGluZ3MpO1xuICAgICAgICAgIHRoaXMuY3JvcHBpbmcuZW1pdCh0aGlzLmNyb3BwZXIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2hlY2tDcm9wcGVyUG9zaXRpb24oZmFsc2UpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm1vdmVTdGFydCEudHlwZSA9PT0gTW92ZVR5cGVzLkRyYWcpIHtcbiAgICAgICAgY29uc3QgZGlmZlggPSB0aGlzLmNyb3BwZXJQb3NpdGlvblNlcnZpY2UuZ2V0Q2xpZW50WChldmVudCkgLSB0aGlzLm1vdmVTdGFydCEuY2xpZW50WDtcbiAgICAgICAgY29uc3QgZGlmZlkgPSB0aGlzLmNyb3BwZXJQb3NpdGlvblNlcnZpY2UuZ2V0Q2xpZW50WShldmVudCkgLSB0aGlzLm1vdmVTdGFydCEuY2xpZW50WTtcbiAgICAgICAgdGhpcy50cmFuc2Zvcm0gPSB7XG4gICAgICAgICAgLi4udGhpcy50cmFuc2Zvcm0sXG4gICAgICAgICAgdHJhbnNsYXRlSDogKHRoaXMubW92ZVN0YXJ0IS50cmFuc2Zvcm0/LnRyYW5zbGF0ZUggfHwgMCkgKyBkaWZmWCxcbiAgICAgICAgICB0cmFuc2xhdGVWOiAodGhpcy5tb3ZlU3RhcnQhLnRyYW5zZm9ybT8udHJhbnNsYXRlViB8fCAwKSArIGRpZmZZXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2V0Q3NzVHJhbnNmb3JtKCk7XG4gICAgICB9XG4gICAgICB0aGlzLmNkLmRldGVjdENoYW5nZXMoKTtcbiAgICB9XG4gIH1cblxuICBvblBpbmNoKGV2ZW50OiBhbnkpIHtcbiAgICBpZiAodGhpcy5tb3ZlU3RhcnQhLmFjdGl2ZSkge1xuICAgICAgaWYgKGV2ZW50LnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIH1cbiAgICAgIGlmIChldmVudC5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMubW92ZVN0YXJ0IS50eXBlID09PSBNb3ZlVHlwZXMuUGluY2gpIHtcbiAgICAgICAgdGhpcy5jcm9wcGVyUG9zaXRpb25TZXJ2aWNlLnJlc2l6ZShldmVudCwgdGhpcy5tb3ZlU3RhcnQhLCB0aGlzLmNyb3BwZXIsIHRoaXMubWF4U2l6ZSwgdGhpcy5zZXR0aW5ncyk7XG4gICAgICAgIHRoaXMuY2hlY2tDcm9wcGVyUG9zaXRpb24oZmFsc2UpO1xuICAgICAgfVxuICAgICAgdGhpcy5jZC5kZXRlY3RDaGFuZ2VzKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzZXRNYXhTaXplKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnNvdXJjZUltYWdlKSB7XG4gICAgICBjb25zdCBzb3VyY2VJbWFnZUVsZW1lbnQgPSB0aGlzLnNvdXJjZUltYWdlLm5hdGl2ZUVsZW1lbnQ7XG4gICAgICB0aGlzLm1heFNpemUud2lkdGggPSBzb3VyY2VJbWFnZUVsZW1lbnQub2Zmc2V0V2lkdGg7XG4gICAgICB0aGlzLm1heFNpemUuaGVpZ2h0ID0gc291cmNlSW1hZ2VFbGVtZW50Lm9mZnNldEhlaWdodDtcbiAgICAgIHRoaXMubWFyZ2luTGVmdCA9IHRoaXMuc2FuaXRpemVyLmJ5cGFzc1NlY3VyaXR5VHJ1c3RTdHlsZSgnY2FsYyg1MCUgLSAnICsgdGhpcy5tYXhTaXplLndpZHRoIC8gMiArICdweCknKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNldENyb3BwZXJTY2FsZWRNaW5TaXplKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmxvYWRlZEltYWdlPy50cmFuc2Zvcm1lZD8uaW1hZ2UpIHtcbiAgICAgIHRoaXMuc2V0Q3JvcHBlclNjYWxlZE1pbldpZHRoKCk7XG4gICAgICB0aGlzLnNldENyb3BwZXJTY2FsZWRNaW5IZWlnaHQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWluV2lkdGggPSAyMDtcbiAgICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1pbkhlaWdodCA9IDIwO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2V0Q3JvcHBlclNjYWxlZE1pbldpZHRoKCk6IHZvaWQge1xuICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1pbldpZHRoID0gdGhpcy5jcm9wcGVyTWluV2lkdGggPiAwXG4gICAgICA/IE1hdGgubWF4KDIwLCB0aGlzLmNyb3BwZXJNaW5XaWR0aCAvIHRoaXMubG9hZGVkSW1hZ2UhLnRyYW5zZm9ybWVkLmltYWdlLndpZHRoICogdGhpcy5tYXhTaXplLndpZHRoKVxuICAgICAgOiAyMDtcbiAgfVxuXG4gIHByaXZhdGUgc2V0Q3JvcHBlclNjYWxlZE1pbkhlaWdodCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5tYWludGFpbkFzcGVjdFJhdGlvKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNaW5IZWlnaHQgPSBNYXRoLm1heCgyMCwgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWluV2lkdGggLyB0aGlzLmFzcGVjdFJhdGlvKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY3JvcHBlck1pbkhlaWdodCA+IDApIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1pbkhlaWdodCA9IE1hdGgubWF4KFxuICAgICAgICAyMCxcbiAgICAgICAgdGhpcy5jcm9wcGVyTWluSGVpZ2h0IC8gdGhpcy5sb2FkZWRJbWFnZSEudHJhbnNmb3JtZWQuaW1hZ2UuaGVpZ2h0ICogdGhpcy5tYXhTaXplLmhlaWdodFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWluSGVpZ2h0ID0gMjA7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzZXRDcm9wcGVyU2NhbGVkTWF4U2l6ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sb2FkZWRJbWFnZT8udHJhbnNmb3JtZWQ/LmltYWdlKSB7XG4gICAgICBjb25zdCByYXRpbyA9IHRoaXMubG9hZGVkSW1hZ2UudHJhbnNmb3JtZWQuc2l6ZS53aWR0aCAvIHRoaXMubWF4U2l6ZS53aWR0aDtcbiAgICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1heFdpZHRoID0gdGhpcy5jcm9wcGVyTWF4V2lkdGggPiAyMCA/IHRoaXMuY3JvcHBlck1heFdpZHRoIC8gcmF0aW8gOiB0aGlzLm1heFNpemUud2lkdGg7XG4gICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhIZWlnaHQgPSB0aGlzLmNyb3BwZXJNYXhIZWlnaHQgPiAyMCA/IHRoaXMuY3JvcHBlck1heEhlaWdodCAvIHJhdGlvIDogdGhpcy5tYXhTaXplLmhlaWdodDtcbiAgICAgIGlmICh0aGlzLm1haW50YWluQXNwZWN0UmF0aW8pIHtcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1heFdpZHRoID4gdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4SGVpZ2h0ICogdGhpcy5hc3BlY3RSYXRpbykge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1heFdpZHRoID0gdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4SGVpZ2h0ICogdGhpcy5hc3BlY3RSYXRpbztcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhXaWR0aCA8IHRoaXMuc2V0dGluZ3MuY3JvcHBlclNjYWxlZE1heEhlaWdodCAqIHRoaXMuYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhIZWlnaHQgPSB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhXaWR0aCAvIHRoaXMuYXNwZWN0UmF0aW87XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXR0aW5ncy5jcm9wcGVyU2NhbGVkTWF4V2lkdGggPSB0aGlzLm1heFNpemUud2lkdGg7XG4gICAgICB0aGlzLnNldHRpbmdzLmNyb3BwZXJTY2FsZWRNYXhIZWlnaHQgPSB0aGlzLm1heFNpemUuaGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tDcm9wcGVyUG9zaXRpb24obWFpbnRhaW5TaXplID0gZmFsc2UpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5jcm9wcGVyLngxIDwgMCkge1xuICAgICAgdGhpcy5jcm9wcGVyLngyIC09IG1haW50YWluU2l6ZSA/IHRoaXMuY3JvcHBlci54MSA6IDA7XG4gICAgICB0aGlzLmNyb3BwZXIueDEgPSAwO1xuICAgIH1cbiAgICBpZiAodGhpcy5jcm9wcGVyLnkxIDwgMCkge1xuICAgICAgdGhpcy5jcm9wcGVyLnkyIC09IG1haW50YWluU2l6ZSA/IHRoaXMuY3JvcHBlci55MSA6IDA7XG4gICAgICB0aGlzLmNyb3BwZXIueTEgPSAwO1xuICAgIH1cbiAgICBpZiAodGhpcy5jcm9wcGVyLngyID4gdGhpcy5tYXhTaXplLndpZHRoKSB7XG4gICAgICB0aGlzLmNyb3BwZXIueDEgLT0gbWFpbnRhaW5TaXplID8gKHRoaXMuY3JvcHBlci54MiAtIHRoaXMubWF4U2l6ZS53aWR0aCkgOiAwO1xuICAgICAgdGhpcy5jcm9wcGVyLngyID0gdGhpcy5tYXhTaXplLndpZHRoO1xuICAgIH1cbiAgICBpZiAodGhpcy5jcm9wcGVyLnkyID4gdGhpcy5tYXhTaXplLmhlaWdodCkge1xuICAgICAgdGhpcy5jcm9wcGVyLnkxIC09IG1haW50YWluU2l6ZSA/ICh0aGlzLmNyb3BwZXIueTIgLSB0aGlzLm1heFNpemUuaGVpZ2h0KSA6IDA7XG4gICAgICB0aGlzLmNyb3BwZXIueTIgPSB0aGlzLm1heFNpemUuaGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIEBIb3N0TGlzdGVuZXIoJ2RvY3VtZW50Om1vdXNldXAnKVxuICBASG9zdExpc3RlbmVyKCdkb2N1bWVudDp0b3VjaGVuZCcpXG4gIG1vdmVTdG9wKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLm1vdmVTdGFydCEuYWN0aXZlKSB7XG4gICAgICBjb25zb2xlLmxvZygnY2hhbmdlIScpO1xuICAgICAgdGhpcy5tb3ZlU3RhcnQhLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgaWYgKHRoaXMubW92ZVN0YXJ0Py50eXBlID09PSBNb3ZlVHlwZXMuRHJhZykge1xuICAgICAgICB0aGlzLnRyYW5zZm9ybUNoYW5nZS5lbWl0KHRoaXMudHJhbnNmb3JtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZG9BdXRvQ3JvcCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBpbmNoU3RvcCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5tb3ZlU3RhcnQhLmFjdGl2ZSkge1xuICAgICAgdGhpcy5tb3ZlU3RhcnQhLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgdGhpcy5kb0F1dG9Dcm9wKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBkb0F1dG9Dcm9wKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmF1dG9Dcm9wKSB7XG4gICAgICB0aGlzLmNyb3AoKTtcbiAgICB9XG4gIH1cblxuICBjcm9wKCk6IEltYWdlQ3JvcHBlZEV2ZW50IHwgbnVsbCB7XG4gICAgaWYgKHRoaXMubG9hZGVkSW1hZ2U/LnRyYW5zZm9ybWVkPy5pbWFnZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnN0YXJ0Q3JvcEltYWdlLmVtaXQoKTtcbiAgICAgIGNvbnN0IG91dHB1dCA9IHRoaXMuY3JvcFNlcnZpY2UuY3JvcCh0aGlzLnNvdXJjZUltYWdlLCB0aGlzLmxvYWRlZEltYWdlLCB0aGlzLmNyb3BwZXIsIHRoaXMuc2V0dGluZ3MpO1xuICAgICAgaWYgKG91dHB1dCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuaW1hZ2VDcm9wcGVkLmVtaXQob3V0cHV0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3BlY3RSYXRpb0lzQ29ycmVjdCgpOiBib29sZWFuIHtcbiAgICBjb25zdCBjdXJyZW50Q3JvcEFzcGVjdFJhdGlvID0gKHRoaXMuY3JvcHBlci54MiAtIHRoaXMuY3JvcHBlci54MSkgLyAodGhpcy5jcm9wcGVyLnkyIC0gdGhpcy5jcm9wcGVyLnkxKTtcbiAgICByZXR1cm4gY3VycmVudENyb3BBc3BlY3RSYXRpbyA9PT0gdGhpcy5hc3BlY3RSYXRpbztcbiAgfVxufVxuIiwiPGRpdlxuICBbc3R5bGUuYmFja2dyb3VuZF09XCJpbWFnZVZpc2libGUgJiYgYmFja2dyb3VuZENvbG9yXCJcbiAgI3dyYXBwZXJcbj5cbiAgPGltZ1xuICAgICNzb3VyY2VJbWFnZVxuICAgIGNsYXNzPVwibmd4LWljLXNvdXJjZS1pbWFnZVwiXG4gICAgKm5nSWY9XCJzYWZlSW1nRGF0YVVybFwiXG4gICAgW3NyY109XCJzYWZlSW1nRGF0YVVybFwiXG4gICAgW3N0eWxlLnZpc2liaWxpdHldPVwiaW1hZ2VWaXNpYmxlID8gJ3Zpc2libGUnIDogJ2hpZGRlbidcIlxuICAgIFtzdHlsZS50cmFuc2Zvcm1dPVwic2FmZVRyYW5zZm9ybVN0eWxlXCJcbiAgICBbY2xhc3Mubmd4LWljLWRyYWdnYWJsZV09XCIhZGlzYWJsZWQgJiYgYWxsb3dNb3ZlSW1hZ2VcIlxuICAgIFthdHRyLmFsdF09XCJpbWFnZUFsdFRleHRcIlxuICAgIChsb2FkKT1cImltYWdlTG9hZGVkSW5WaWV3KClcIlxuICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLkRyYWcpXCJcbiAgICAodG91Y2hzdGFydCk9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuRHJhZylcIlxuICAgIChlcnJvcik9XCJsb2FkSW1hZ2VFcnJvcigkZXZlbnQpXCJcbiAgPlxuICA8ZGl2XG4gICAgY2xhc3M9XCJuZ3gtaWMtb3ZlcmxheVwiXG4gICAgW3N0eWxlLndpZHRoLnB4XT1cIm1heFNpemUud2lkdGhcIlxuICAgIFtzdHlsZS5oZWlnaHQucHhdPVwibWF4U2l6ZS5oZWlnaHRcIlxuICAgIFtzdHlsZS5tYXJnaW4tbGVmdF09XCJhbGlnbkltYWdlID09PSAnY2VudGVyJyA/IG1hcmdpbkxlZnQgOiBudWxsXCJcbiAgPjwvZGl2PlxuICA8ZGl2IGNsYXNzPVwibmd4LWljLWNyb3BwZXJcIlxuICAgICAgICpuZ0lmPVwiaW1hZ2VWaXNpYmxlXCJcbiAgICAgICBbY2xhc3Mubmd4LWljLXJvdW5kXT1cInJvdW5kQ3JvcHBlclwiXG4gICAgICAgW3N0eWxlLnRvcC5weF09XCJjcm9wcGVyLnkxXCJcbiAgICAgICBbc3R5bGUubGVmdC5weF09XCJjcm9wcGVyLngxXCJcbiAgICAgICBbc3R5bGUud2lkdGgucHhdPVwiY3JvcHBlci54MiAtIGNyb3BwZXIueDFcIlxuICAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwiY3JvcHBlci55MiAtIGNyb3BwZXIueTFcIlxuICAgICAgIFtzdHlsZS5tYXJnaW4tbGVmdF09XCJhbGlnbkltYWdlID09PSAnY2VudGVyJyA/IG1hcmdpbkxlZnQgOiBudWxsXCJcbiAgICAgICBbc3R5bGUudmlzaWJpbGl0eV09XCJpbWFnZVZpc2libGUgPyAndmlzaWJsZScgOiAnaGlkZGVuJ1wiXG4gICAgICAgKGtleWRvd24pPVwia2V5Ym9hcmRBY2Nlc3MoJGV2ZW50KVwiXG4gICAgICAgdGFiaW5kZXg9XCIwXCJcbiAgPlxuICAgIDxkaXZcbiAgICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLk1vdmUpXCJcbiAgICAgICh0b3VjaHN0YXJ0KT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5Nb3ZlKVwiXG4gICAgICBjbGFzcz1cIm5neC1pYy1tb3ZlXCI+XG4gICAgPC9kaXY+XG4gICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFoaWRlUmVzaXplU3F1YXJlc1wiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy10b3BsZWZ0XCJcbiAgICAgICAgICAgICAgICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ3RvcGxlZnQnKVwiXG4gICAgICAgICAgICAgICAgICAodG91Y2hzdGFydCk9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAndG9wbGVmdCcpXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy10b3BcIj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1zcXVhcmVcIj48L3NwYW4+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUgbmd4LWljLXRvcHJpZ2h0XCJcbiAgICAgICAgICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ3RvcHJpZ2h0JylcIlxuICAgICAgICAgICAgKHRvdWNoc3RhcnQpPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ3RvcHJpZ2h0JylcIj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1zcXVhcmVcIj48L3NwYW4+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUgbmd4LWljLXJpZ2h0XCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy1ib3R0b21yaWdodFwiXG4gICAgICAgICAgICAobW91c2Vkb3duKT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICdib3R0b21yaWdodCcpXCJcbiAgICAgICAgICAgICh0b3VjaHN0YXJ0KT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICdib3R0b21yaWdodCcpXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtc3F1YXJlXCI+PC9zcGFuPlxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJuZ3gtaWMtcmVzaXplIG5neC1pYy1ib3R0b21cIj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1zcXVhcmVcIj48L3NwYW4+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUgbmd4LWljLWJvdHRvbWxlZnRcIlxuICAgICAgICAgICAgKG1vdXNlZG93bik9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAnYm90dG9tbGVmdCcpXCJcbiAgICAgICAgICAgICh0b3VjaHN0YXJ0KT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICdib3R0b21sZWZ0JylcIj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1zcXVhcmVcIj48L3NwYW4+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUgbmd4LWljLWxlZnRcIj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1zcXVhcmVcIj48L3NwYW4+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUtYmFyIG5neC1pYy10b3BcIlxuICAgICAgICAgICAgKG1vdXNlZG93bik9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAndG9wJylcIlxuICAgICAgICAgICAgKHRvdWNoc3RhcnQpPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ3RvcCcpXCI+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUtYmFyIG5neC1pYy1yaWdodFwiXG4gICAgICAgICAgICAobW91c2Vkb3duKT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICdyaWdodCcpXCJcbiAgICAgICAgICAgICh0b3VjaHN0YXJ0KT1cInN0YXJ0TW92ZSgkZXZlbnQsIG1vdmVUeXBlcy5SZXNpemUsICdyaWdodCcpXCI+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUtYmFyIG5neC1pYy1ib3R0b21cIlxuICAgICAgICAgICAgKG1vdXNlZG93bik9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAnYm90dG9tJylcIlxuICAgICAgICAgICAgKHRvdWNoc3RhcnQpPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ2JvdHRvbScpXCI+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cIm5neC1pYy1yZXNpemUtYmFyIG5neC1pYy1sZWZ0XCJcbiAgICAgICAgICAgIChtb3VzZWRvd24pPVwic3RhcnRNb3ZlKCRldmVudCwgbW92ZVR5cGVzLlJlc2l6ZSwgJ2xlZnQnKVwiXG4gICAgICAgICAgICAodG91Y2hzdGFydCk9XCJzdGFydE1vdmUoJGV2ZW50LCBtb3ZlVHlwZXMuUmVzaXplLCAnbGVmdCcpXCI+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgPC9uZy1jb250YWluZXI+XG4gIDwvZGl2PlxuPC9kaXY+XG4iXX0=